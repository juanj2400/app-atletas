// deno-lint-ignore-file no-explicit-any
// =====================================================================
// Edge Function: generate-weekly-proposals
//
// Qué hace: cuando el ADMIN pulsa "Generar propuestas de la semana", lee los
// datos de cada atleta, se los envía a Gemini y guarda las sugerencias en
// ai_nutrition_suggestions y ai_load_suggestions SIEMPRE como 'pendiente'.
// La IA nunca aplica nada: tú decides en el dashboard.
//
// Secrets necesarios (Edge Functions > Secrets):
//   GEMINI_API_KEY   -> tu clave de Google AI Studio
//   GEMINI_MODEL     -> (opcional) por defecto gemini-3.8-flash
// Supabase inyecta solo: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Entrada (POST, JSON): { "user_ids": ["uuid", ...máx 3], "forzar": false }
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

// ---------- Configuración y límites de seguridad ----------
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
const PROMPT_VERSION = "v1";
const MAX_ATLETAS_POR_LLAMADA = 3;   // evita timeouts y límites de la capa gratuita
const MIN_CHECKINS_SEMANA = 3;       // si hay menos, se omite al atleta (salvo forzar)
const MAX_CAMBIO_KCAL_PCT = 0.10;    // la IA no puede mover las kcal más de ±10 %
const MAX_CAMBIO_CARGA_PCT = 0.10;   // ni las cargas más de ±10 %
const KCAL_MIN = 1200;
const KCAL_MAX = 6000;
const MAX_EJERCICIOS_ANALIZADOS = 8;
const MAX_CARGAS_POR_ATLETA = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // el acceso real lo protege el JWT + la comprobación de admin
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------- Utilidades pequeñas ----------
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const meanOrNull = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const e1rm = (peso: number, reps: number) => (reps === 1 ? peso : peso * (1 + reps / 30));
const unwrap = (res: { data: any; error: any }) => {
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

// =====================================================================
// 1) PUNTO DE ENTRADA: autenticación y comprobación de administrador
// =====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "Falta el secret GEMINI_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autenticado" }, 401);

  // Cliente "como el usuario que llama": sirve para saber QUIÉN es y si es admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Sesión inválida" }, 401);

  const { data: perfil } = await userClient
    .from("profiles").select("rol").eq("id", userData.user.id).maybeSingle();
  if (perfil?.rol !== "admin") return json({ error: "Solo administradores" }, 403);

  // Validar el cuerpo
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const userIds: string[] = Array.isArray(body?.user_ids) ? body.user_ids.filter((x: any) => typeof x === "string") : [];
  const forzar = body?.forzar === true;
  if (userIds.length === 0 || userIds.length > MAX_ATLETAS_POR_LLAMADA) {
    return json({ error: `user_ids debe tener entre 1 y ${MAX_ATLETAS_POR_LLAMADA} elementos` }, 400);
  }

  // Cliente con service_role (ignora RLS): solo se usa DESPUÉS de verificar que eres admin
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const resultados = [];
  for (const id of userIds) {
    try {
      resultados.push(await procesarAtleta(db, ai, id, forzar));
    } catch (e) {
      const msg = String((e as any)?.message ?? e);
      resultados.push({
        user_id: id,
        estado: "error",
        motivo: msg === "RATE_LIMITED" ? "limite_gemini_alcanzado_reintenta_en_1_minuto" : msg,
      });
    }
  }
  return json({ ok: true, modelo: GEMINI_MODEL, resultados });
});

// =====================================================================
// 2) PROCESAR UN ATLETA: leer datos -> calcular hechos -> IA -> validar -> guardar
// =====================================================================
async function procesarAtleta(db: any, ai: GoogleGenAI, userId: string, forzar: boolean) {
  const perfil = unwrap(
    await db.from("profiles").select("id,nombre_completo,rol").eq("id", userId).maybeSingle(),
  );
  if (!perfil || perfil.rol !== "client") {
    return { user_id: userId, estado: "omitido", motivo: "no_es_atleta" };
  }
  const nombre = perfil.nombre_completo ?? "(sin nombre)";

  // ---- Lectura de datos (en paralelo) ----
  const [metrics, checkins, plan, logs, blacklist, restringidos, pendNut, pendLoad, recientes] =
    (await Promise.all([
      db.from("v_metrics_trend")
        .select("fecha,peso_corporal_kg,perimetro_cintura_cm,calorias_consumidas,peso_media_7d")
        .eq("user_id", userId).gte("fecha", daysAgo(21)).order("fecha"),
      db.from("daily_check_ins")
        .select("fecha,calorias_ayer_cumplidas,horas_sueno,estado_animo,se_siente_recuperado")
        .eq("user_id", userId).gte("fecha", daysAgo(6)),
      db.from("nutrition_plans")
        .select("id,calorias_objetivo,proteina_g,carbohidratos_g,grasas_g,objetivo_calorico,vigente_desde")
        .eq("user_id", userId).is("vigente_hasta", null).maybeSingle(),
      db.from("routine_logs")
        .select("exercise_id,peso_kg,repeticiones,rpe,realizado_en")
        .eq("user_id", userId).gte("realizado_en", `${daysAgo(27)}T00:00:00Z`).order("realizado_en"),
      db.from("athlete_exercise_blacklist").select("exercise_id").eq("user_id", userId),
      db.from("exercises").select("id").eq("restringido", true),
      db.from("ai_nutrition_suggestions").select("id").eq("user_id", userId).eq("estado", "pendiente"),
      db.from("ai_load_suggestions").select("exercise_id").eq("user_id", userId).eq("estado", "pendiente"),
      db.from("ai_nutrition_suggestions")
        .select("estado,calorias_sugeridas,created_at")
        .eq("user_id", userId).neq("estado", "pendiente")
        .gte("created_at", `${daysAgo(28)}T00:00:00Z`)
        .order("created_at", { ascending: false }).limit(3),
    ])).map(unwrap);

  // ---- Compuerta: ¿llenaron sus check-ins? ----
  if (checkins.length < MIN_CHECKINS_SEMANA && !forzar) {
    return {
      user_id: userId, nombre, estado: "omitido",
      motivo: `checkins_insuficientes (${checkins.length}/${MIN_CHECKINS_SEMANA} esta semana)`,
    };
  }

  // ---- Hechos de nutrición (calculados por CÓDIGO, no por la IA) ----
  const pesos = metrics
    .filter((m: any) => m.peso_corporal_kg !== null)
    .map((m: any) => ({ fecha: m.fecha, peso: Number(m.peso_corporal_kg) }));
  const cal7 = metrics
    .filter((m: any) => m.fecha >= daysAgo(6) && m.calorias_consumidas !== null)
    .map((m: any) => Number(m.calorias_consumidas));
  const promKcal = meanOrNull(cal7);
  const cintura = metrics.filter((m: any) => m.perimetro_cintura_cm !== null);

  const hechosNutricion = {
    plan_activo: plan ? {
      calorias_objetivo: plan.calorias_objetivo,
      proteina_g: plan.proteina_g,
      carbohidratos_g: plan.carbohidratos_g,
      grasas_g: plan.grasas_g,
      objetivo_calorico: plan.objetivo_calorico,
      dias_en_plan: Math.floor((Date.now() - new Date(plan.vigente_desde).getTime()) / 86400000),
    } : null,
    peso: {
      mediciones_21d: pesos.length,
      peso_inicial_kg: pesos.length ? pesos[0].peso : null,
      peso_final_kg: pesos.length ? pesos[pesos.length - 1].peso : null,
      media_7d_actual_kg: metrics.length ? r(Number(metrics[metrics.length - 1].peso_media_7d), 2) : null,
      tendencia: tendenciaPeso(pesos),
    },
    calorias_consumidas: {
      dias_con_registro_7d: cal7.length,
      promedio_7d: promKcal === null ? null : Math.round(promKcal),
      desviacion_vs_objetivo_pct:
        promKcal !== null && plan ? r(((promKcal - plan.calorias_objetivo) / plan.calorias_objetivo) * 100, 1) : null,
    },
    cintura_cm: cintura.length >= 2
      ? { inicio: Number(cintura[0].perimetro_cintura_cm), fin: Number(cintura[cintura.length - 1].perimetro_cintura_cm) }
      : null,
    propuestas_resueltas_recientes: recientes.map((p: any) => ({
      estado: p.estado,
      calorias_sugeridas: p.calorias_sugeridas,
      hace_dias: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000),
    })),
  };

  // ---- Hechos de entrenamiento (sin ejercicios en lista negra) ----
  const bloqueados = new Set<string>([
    ...blacklist.map((b: any) => b.exercise_id),
    ...restringidos.map((e: any) => e.id),
  ]);
  const pendEj = new Set<string>(pendLoad.map((p: any) => p.exercise_id));
  const ejercicios = resumirEjercicios(logs, bloqueados);

  const nombresEj = ejercicios.length
    ? unwrap(await db.from("exercises").select("id,nombre,grupo_muscular").in("id", ejercicios.map((e: any) => e.exercise_id)))
    : [];
  const infoEj = new Map<string, any>(nombresEj.map((e: any) => [e.id, e]));

  // Referencias cortas (E1, E2...): la IA nunca ve ni inventa UUID
  const mapaRefs: Record<string, any> = {};
  const entrenamiento = ejercicios.map((e: any, i: number) => {
    const ref = `E${i + 1}`;
    mapaRefs[ref] = e;
    return {
      ref,
      ejercicio: infoEj.get(e.exercise_id)?.nombre ?? "desconocido",
      grupo_muscular: infoEj.get(e.exercise_id)?.grupo_muscular ?? null,
      series_7d: e.series_7d,
      sesiones_28d: e.sesiones_28d,
      rpe_medio_7d: e.rpe_medio_7d,
      peso_max_7d_kg: e.peso_max_7d,
      peso_max_previo_kg: e.peso_max_previo,
      peso_trabajo_actual_kg: e.peso_trabajo_actual_kg,
      mejor_set_reciente: e.mejor_set_reciente,
    };
  });

  const hechos = {
    fecha_analisis: daysAgo(0),
    nutricion: hechosNutricion,
    checkins_ultimos_7d: resumirCheckins(checkins),
    entrenamiento,
  };

  const refs = Object.keys(mapaRefs);
  if (!plan && refs.length === 0) {
    return { user_id: userId, nombre, estado: "omitido", motivo: "sin_plan_nutricional_ni_datos_de_entrenamiento" };
  }

  // ---- Llamada a Gemini con JSON estricto ----
  const schema = construirSchema(!!plan, refs);
  const prompt = `${INSTRUCCIONES}\n\nDATOS DEL ATLETA (JSON):\n${JSON.stringify(hechos)}`;
  const salida = await llamarGemini(ai, prompt, schema);

  // ---- Validar y guardar (la IA propone; el código aplica límites) ----
  let nutricionCreada = false;
  const cargasCreadas: string[] = [];
  const avisos: string[] = [];

  // Nutrición
  if (plan && salida.nutricion?.accion === "ajustar") {
    if (pendNut.length > 0) {
      avisos.push("ya_existe_una_propuesta_nutricional_pendiente");
    } else {
      const n = salida.nutricion;
      const base = plan.calorias_objetivo as number;
      const pedido = Math.round(Number(n.calorias_sugeridas));
      if (Number.isFinite(pedido)) {
        const tope = Math.round(base * MAX_CAMBIO_KCAL_PCT);
        let kcal = clamp(pedido, base - tope, base + tope);
        kcal = clamp(kcal, KCAL_MIN, KCAL_MAX);
        const nota = kcal !== pedido ? " (Ajustado automáticamente al límite de seguridad de ±10 %.)" : "";

        if (kcal !== base) {
          // Macros: se reescalan para que sumen las kcal finales
          let p: number | null = null, c: number | null = null, g: number | null = null;
          const kcalMacros = 4 * Number(n.proteina_g) + 4 * Number(n.carbohidratos_g) + 9 * Number(n.grasas_g);
          if (Number.isFinite(kcalMacros) && kcalMacros > 0) {
            const f = kcal / kcalMacros;
            p = Math.round(Number(n.proteina_g) * f);
            c = Math.round(Number(n.carbohidratos_g) * f);
            g = Math.round(Number(n.grasas_g) * f);
          }
          const { error } = await db.from("ai_nutrition_suggestions").insert({
            user_id: userId,
            plan_actual_id: plan.id,
            calorias_actuales: base,
            calorias_sugeridas: kcal,
            proteina_g_sugerida: p,
            carbohidratos_g_sugerido: c,
            grasas_g_sugerida: g,
            objetivo_calorico: ["deficit", "superavit", "normocalorica"].includes(n.objetivo_calorico)
              ? n.objetivo_calorico : plan.objetivo_calorico,
            razon: String(n.razon ?? "").slice(0, 600) + nota,
            datos_analisis: { modelo: GEMINI_MODEL, version_prompt: PROMPT_VERSION, resumen_ia: salida.resumen_analisis, hechos },
          });
          if (error) avisos.push(`error_guardando_nutricion: ${error.message}`);
          else nutricionCreada = true;
        }
      }
    }
  }

  // Cargas
  for (const c of (salida.cargas ?? []).slice(0, MAX_CARGAS_POR_ATLETA)) {
    const ej = mapaRefs[c.ejercicio_ref];
    if (!ej) continue;                                 // referencia inventada: se descarta
    if (pendEj.has(ej.exercise_id)) continue;          // ya hay una pendiente para este ejercicio
    const base = ej.peso_trabajo_actual_kg as number;
    const pedido = Number(c.peso_sugerido_kg);
    if (!Number.isFinite(pedido) || pedido <= 0) continue;
    const tope = base * MAX_CAMBIO_CARGA_PCT;
    const peso = Math.round(clamp(pedido, base - tope, base + tope) * 2) / 2; // pasos de 0,5 kg
    if (peso === base) continue;
    const reps = clamp(Math.round(Number(c.repeticiones_sugeridas)), 1, 30);

    const { error } = await db.from("ai_load_suggestions").insert({
      user_id: userId,
      exercise_id: ej.exercise_id,
      peso_actual_kg: base,
      peso_sugerido_kg: peso,
      repeticiones_sugeridas: Number.isFinite(reps) ? reps : null,
      razon: String(c.razon ?? "").slice(0, 600),
      datos_analisis: { modelo: GEMINI_MODEL, version_prompt: PROMPT_VERSION, resumen_ia: salida.resumen_analisis, hechos_ejercicio: entrenamiento.find((x: any) => x.ref === c.ejercicio_ref) },
    });
    if (error) avisos.push(`error_guardando_carga_${c.ejercicio_ref}: ${error.message}`);
    else cargasCreadas.push(infoEj.get(ej.exercise_id)?.nombre ?? c.ejercicio_ref);
  }

  return {
    user_id: userId, nombre, estado: "procesado",
    nutricion_creada: nutricionCreada,
    cargas_creadas: cargasCreadas.length,
    ejercicios_con_propuesta: cargasCreadas,
    resumen_ia: salida.resumen_analisis,
    avisos,
  };
}

// =====================================================================
// 3) CÁLCULOS DETERMINISTAS (matemáticas exactas, sin IA)
// =====================================================================
function tendenciaPeso(pts: { fecha: string; peso: number }[]) {
  if (pts.length < 4) return null;
  const t0 = new Date(pts[0].fecha).getTime();
  const xs = pts.map((p) => (new Date(p.fecha).getTime() - t0) / 86400000);
  if (xs[xs.length - 1] < 7) return null; // se necesita al menos una semana de rango
  const ys = pts.map((p) => p.peso);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  const kgSemana = (num / den) * 7; // pendiente de la regresión lineal
  return { kg_por_semana: r(kgSemana, 2), pct_peso_por_semana: r((kgSemana / my) * 100, 2) };
}

function resumirCheckins(rows: any[]) {
  const horas = rows.filter((c) => c.horas_sueno !== null).map((c) => Number(c.horas_sueno));
  const cuenta = (campo: string, valor: unknown) => rows.filter((c) => c[campo] === valor).length;
  return {
    cantidad: rows.length,
    horas_sueno_promedio: r(meanOrNull(horas), 1),
    animo: { mal: cuenta("estado_animo", "mal"), regular: cuenta("estado_animo", "regular"), bien: cuenta("estado_animo", "bien") },
    se_siente_recuperado: { si: cuenta("se_siente_recuperado", true), no: cuenta("se_siente_recuperado", false) },
    calorias_ayer_cumplidas: { si: cuenta("calorias_ayer_cumplidas", true), no: cuenta("calorias_ayer_cumplidas", false) },
  };
}

function resumirEjercicios(logs: any[], bloqueados: Set<string>) {
  const t7 = Date.now() - 7 * 86400000;
  const t14 = Date.now() - 14 * 86400000;
  const ms = (s: any) => new Date(s.realizado_en).getTime();
  const grupos = new Map<string, any[]>();
  for (const l of logs) {
    if (bloqueados.has(l.exercise_id) || !(Number(l.peso_kg) > 0)) continue;
    const arr = grupos.get(l.exercise_id) ?? [];
    arr.push(l);
    grupos.set(l.exercise_id, arr);
  }

  const salida: any[] = [];
  for (const [exercise_id, sets] of grupos) {
    const s7 = sets.filter((s) => ms(s) >= t7);
    const previos = sets.filter((s) => ms(s) < t7);
    if (sets.filter((s) => ms(s) >= t14).length < 3) continue; // datos insuficientes

    const fechaUltima = sets.map((s) => String(s.realizado_en).slice(0, 10)).sort().at(-1)!;
    const ultimaSesion = sets.filter((s) => String(s.realizado_en).slice(0, 10) === fechaUltima);
    const mejor = [...(s7.length ? s7 : sets)]
      .sort((a, b) => e1rm(Number(b.peso_kg), b.repeticiones) - e1rm(Number(a.peso_kg), a.repeticiones))[0];
    const rpes = s7.filter((s) => s.rpe !== null).map((s) => Number(s.rpe));

    salida.push({
      exercise_id,
      series_28d: sets.length,
      series_7d: s7.length,
      sesiones_28d: new Set(sets.map((s) => String(s.realizado_en).slice(0, 10))).size,
      rpe_medio_7d: r(meanOrNull(rpes), 1),
      peso_max_7d: s7.length ? Math.max(...s7.map((s) => Number(s.peso_kg))) : null,
      peso_max_previo: previos.length ? Math.max(...previos.map((s) => Number(s.peso_kg))) : null,
      peso_trabajo_actual_kg: Math.max(...ultimaSesion.map((s) => Number(s.peso_kg))),
      mejor_set_reciente: { peso_kg: Number(mejor.peso_kg), repeticiones: mejor.repeticiones, rpe: mejor.rpe },
    });
  }
  return salida.sort((a, b) => b.series_28d - a.series_28d).slice(0, MAX_EJERCICIOS_ANALIZADOS);
}

// =====================================================================
// 4) GEMINI: instrucciones, esquema JSON y llamada
// =====================================================================
const INSTRUCCIONES = `Eres un asistente de apoyo para un entrenador de fuerza. Analizas los datos de UN atleta de la última semana y propones ajustes. Tú solo PROPONES: el entrenador revisa y decide. No eres médico: no diagnostiques ni recomiendes tratamientos.

REGLAS GENERALES
- Usa únicamente los datos del JSON. No inventes cifras ni ejercicios.
- Si los datos son insuficientes o contradictorios, elige accion "mantener" (nutrición) o no propongas cambios de carga. Es una respuesta válida.
- Cada "razon" va en español, máximo 2 frases, citando los números concretos que la justifican.
- No repitas una propuesta nutricional que el entrenador rechazó recientemente (ver propuestas_resueltas_recientes).

NUTRICIÓN
- Compara la tendencia de peso con el objetivo_calorico del plan. Referencia orientativa: en déficit, una pérdida de ~0,5 a 1 % del peso corporal por semana es razonable; en superávit, una ganancia de ~0,25 a 0,5 % por semana.
- Antes de recortar calorías, considera la adherencia (desviacion_vs_objetivo_pct, calorias_ayer_cumplidas) y el sueño. Si el atleta no está cumpliendo el plan, el problema es la adherencia, no el plan: prefiere "mantener" y dilo en la razón.
- Cambios pequeños: máximo ±10 % de las calorías actuales. Si propones ajustar, las calorías deben ser distintas a las actuales y los macros (4 kcal/g proteína y carbohidratos, 9 kcal/g grasas) deben aproximarse a esas calorías. Si decides mantener, repite los valores actuales del plan.

CARGAS
- Solo propones sobre los ejercicios listados (campo ref). Máximo 5 propuestas.
- RPE medio bajo (<= 7) con repeticiones completadas sugiere margen para subir carga (~2,5 a 5 %). RPE medio muy alto (>= 9,5) o descenso de rendimiento sugiere mantener o bajar ~5 %.
- Si hay poco sueño (< 6 h de media) o mala recuperación en los check-ins, sé conservador.
- Si no hay motivo claro para cambiar un ejercicio, no lo incluyas.`;

function construirSchema(hayPlan: boolean, refs: string[]) {
  const properties: Record<string, unknown> = {
    resumen_analisis: {
      type: "string",
      description: "Resumen de 2 a 3 frases del estado del atleta esta semana, en español.",
    },
  };
  const required = ["resumen_analisis"];

  if (hayPlan) {
    properties.nutricion = {
      type: "object",
      description: "Propuesta nutricional. Si accion es mantener, repite los valores actuales.",
      properties: {
        accion: { type: "string", enum: ["mantener", "ajustar"] },
        objetivo_calorico: { type: "string", enum: ["deficit", "superavit", "normocalorica"] },
        calorias_sugeridas: { type: "integer" },
        proteina_g: { type: "integer" },
        carbohidratos_g: { type: "integer" },
        grasas_g: { type: "integer" },
        razon: { type: "string", description: "Justificación breve citando datos." },
      },
      required: ["accion", "objetivo_calorico", "calorias_sugeridas", "proteina_g", "carbohidratos_g", "grasas_g", "razon"],
    };
    required.push("nutricion");
  }

  if (refs.length > 0) {
    properties.cargas = {
      type: "array",
      maxItems: MAX_CARGAS_POR_ATLETA,
      description: "Ajustes de carga propuestos. Lista vacía si no hay motivo para cambiar nada.",
      items: {
        type: "object",
        properties: {
          ejercicio_ref: { type: "string", enum: refs },
          peso_sugerido_kg: { type: "number" },
          repeticiones_sugeridas: { type: "integer" },
          razon: { type: "string", description: "Justificación breve citando RPE, series o pesos." },
        },
        required: ["ejercicio_ref", "peso_sugerido_kg", "repeticiones_sugeridas", "razon"],
      },
    };
    required.push("cargas");
  }

  return { type: "object", properties, required };
}

async function llamarGemini(ai: GoogleGenAI, prompt: string, schema: unknown): Promise<any> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const interaction = await ai.interactions.create({
        model: GEMINI_MODEL,
        input: prompt,
        response_format: { type: "text", mime_type: "application/json", schema },
      } as any);
      const texto = String((interaction as any).output_text ?? "").replace(/```json|```/g, "").trim();
      return JSON.parse(texto);
    } catch (e) {
      const msg = String((e as any)?.message ?? e);
      const limitado = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      if (limitado && intento === 0) { await sleep(15000); continue; } // un reintento tras 15 s
      if (limitado) throw new Error("RATE_LIMITED");
      if (e instanceof SyntaxError) throw new Error("respuesta_de_la_ia_no_es_json_valido");
      throw e;
    }
  }
}
