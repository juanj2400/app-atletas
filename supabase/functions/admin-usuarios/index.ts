// deno-lint-ignore-file no-explicit-any
// =====================================================================
// Edge Function: admin-usuarios
//
// Qué hace: deja que el ENTRENADOR (admin) gestione cuentas desde la app, sin entrar al panel
// de Supabase. Crear usuarios, cambiar contraseñas y bloquear el acceso necesitan la clave
// service_role (la "llave maestra"), que NUNCA puede estar en el frontend: por eso viven aquí.
//
// Acciones (POST, JSON), siempre con la sesión del entrenador en el encabezado Authorization:
//   { "accion": "crear",      "email", "password", "nombre_completo", "fecha_nacimiento"? }
//   { "accion": "estado",     "atleta_id", "activo": true | false }
//   { "accion": "contrasena", "atleta_id", "password" }
//
// Seguridad:
//   1) Se comprueba la sesión (JWT) y que el perfil de quien llama tenga rol 'admin'.
//      Solo después se crea el cliente service_role.
//   2) Todo se valida aquí otra vez (la pantalla valida por comodidad, esta es la barrera).
//   3) Solo se actúa sobre perfiles con rol 'client': nunca se toca a un admin ni se puede
//      crear uno desde esta función (el rol de admin se asigna a mano en el SQL Editor).
//   4) La contraseña nunca se escribe en los registros (logs) ni se devuelve en la respuesta.
//
// Secrets: no hay que crear ninguno. Supabase inyecta solo SUPABASE_URL, SUPABASE_ANON_KEY
// y SUPABASE_SERVICE_ROLE_KEY.
// Requiere la migración 20 (columna profiles.activo).
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

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

// Las dos funciones de abajo devuelven un texto de error (en español) o "" si todo está bien.

// ---------- VALIDACIONES (inicio) ----------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOQUEO_PERMANENTE = "876000h"; // ~100 años: Auth no admite "para siempre"

function validarNombre(v: unknown): string {
  const t = String(v ?? "").trim();
  if (t.length < 2) return "Escribe el nombre del atleta (mínimo 2 letras).";
  if (t.length > 80) return "El nombre es demasiado largo (máximo 80 caracteres).";
  return "";
}

function validarEmail(v: unknown): string {
  const t = String(v ?? "").trim();
  if (t === "" || t.length > 254 || !EMAIL_RE.test(t)) return "Escribe un correo válido.";
  return "";
}

// bcrypt (lo que usa Auth) solo lee los primeros 72 bytes: se pide un máximo para no engañar.
function validarPassword(v: unknown): string {
  const t = typeof v === "string" ? v : "";
  if (t.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (new TextEncoder().encode(t).length > 72) return "La contraseña es demasiado larga (máximo 72).";
  return "";
}

// Fecha opcional "YYYY-MM-DD". "Hoy" es el de UTC porque así lo compara la base de datos
// (trigger validar_fecha_nacimiento); Colombia nunca va por delante de UTC.
function validarFecha(v: unknown, hoyUTC: string): string {
  if (v === null || v === undefined || v === "") return "";
  const t = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return "La fecha de nacimiento no es válida.";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const real = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  if (!real) return "La fecha de nacimiento no es válida.";
  if (+m[1] < 1900) return "La fecha de nacimiento no puede ser anterior a 1900.";
  if (t > hoyUTC) return "La fecha de nacimiento no puede ser futura.";
  return "";
}

// Traduce los errores de Supabase Auth a mensajes para el entrenador.
function mensajeErrorAuth(err: any): { texto: string; estado: number } {
  const codigo = String(err?.code ?? "");
  // Respaldo: si Auth no manda código, el texto del error sí dice que el correo ya está registrado.
  const yaRegistrado = /already.*registered/i.test(String(err?.message ?? ""));
  if (codigo === "email_exists" || codigo === "user_already_exists" || yaRegistrado) {
    return { texto: "Ya existe un usuario con ese correo.", estado: 409 };
  }
  if (codigo === "weak_password") {
    return { texto: "La contraseña es muy débil. Usa letras y números, mínimo 8 caracteres.", estado: 400 };
  }
  if (codigo === "email_address_invalid") return { texto: "Escribe un correo válido.", estado: 400 };
  console.error("admin-usuarios: error de Auth", codigo, err?.status); // sin datos personales
  return { texto: "No se pudo completar la acción. Intenta de nuevo.", estado: 500 };
}
// ---------- VALIDACIONES (fin) ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "La función no está configurada correctamente." }, 500);
  }

  // 1) ¿Quién llama y es admin? Se consulta "como el usuario" (con RLS), no con service_role.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autenticado." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Tu sesión venció. Vuelve a entrar." }, 401);

  const { data: perfil } = await userClient
    .from("profiles").select("rol").eq("id", userData.user.id).maybeSingle();
  if (perfil?.rol !== "admin") return json({ error: "Solo el entrenador puede hacer esto." }, 403);

  // 2) Cuerpo de la petición
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Petición no válida." }, 400); }
  const accion = body?.accion;

  // 3) Recién ahora se crea el cliente con la llave maestra (ignora RLS).
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ------------------------------------------------------------------
  // CREAR UN ATLETA
  // ------------------------------------------------------------------
  if (accion === "crear") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const nombre = String(body.nombre_completo ?? "").trim();
    const fecha = body.fecha_nacimiento ? String(body.fecha_nacimiento) : null;
    const hoyUTC = new Date().toISOString().slice(0, 10);

    const problema =
      validarNombre(nombre) || validarEmail(email) || validarPassword(body.password) || validarFecha(fecha, hoyUTC);
    if (problema) return json({ error: problema }, 400);

    // email_confirm: true = el correo queda confirmado (no se manda ningún mensaje).
    // El trigger handle_new_user crea el perfil (rol 'client', activo) con este nombre.
    const { data: creado, error: errCrear } = await db.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { nombre_completo: nombre },
    });
    if (errCrear || !creado?.user) {
      const m = mensajeErrorAuth(errCrear);
      return json({ error: m.texto }, m.estado);
    }
    const id = creado.user.id;

    // Guardar la fecha y, de paso, comprobar que el perfil se creó como atleta.
    // Si algo falla se deshace la creación: no se deja un usuario a medias.
    const { data: filas, error: errPerfil } = await db
      .from("profiles")
      .update({ fecha_nacimiento: fecha })
      .eq("id", id).eq("rol", "client")
      .select("id");
    if (errPerfil || !filas || filas.length === 0) {
      await db.auth.admin.deleteUser(id);
      return json({ error: "No se pudo crear el atleta. Intenta de nuevo." }, 500);
    }
    return json({ ok: true, id, email });
  }

  // Las otras dos acciones trabajan sobre un atleta que ya existe.
  if (accion === "estado" || accion === "contrasena") {
    const atletaId = String(body.atleta_id ?? "");
    if (!UUID_RE.test(atletaId)) return json({ error: "Atleta no válido." }, 400);
    if (atletaId === userData.user.id) return json({ error: "No puedes cambiar tu propia cuenta desde aquí." }, 400);

    const { data: objetivo } = await db
      .from("profiles").select("id, rol").eq("id", atletaId).maybeSingle();
    if (!objetivo || objetivo.rol !== "client") return json({ error: "No se encontró al atleta." }, 404);

    // ----------------------------------------------------------------
    // ACTIVAR / DESACTIVAR EL ACCESO
    // Primero se cambia el bloqueo de Auth (lo que de verdad impide entrar) y después la
    // marca profiles.activo. Si la segunda falla, repetir la acción lo arregla (es idempotente).
    // Un token ya emitido sigue valiendo hasta que caduca (≤ 1 h); la app además lo bloquea
    // en pantalla al abrirse (RutaProtegida).
    // ----------------------------------------------------------------
    if (accion === "estado") {
      if (typeof body.activo !== "boolean") return json({ error: "Estado no válido." }, 400);
      const { error: errAuth } = await db.auth.admin.updateUserById(atletaId, {
        ban_duration: body.activo ? "none" : BLOQUEO_PERMANENTE,
      });
      if (errAuth) {
        const m = mensajeErrorAuth(errAuth);
        return json({ error: m.texto }, m.estado);
      }
      const { data: filas, error: errDb } = await db
        .from("profiles").update({ activo: body.activo })
        .eq("id", atletaId).eq("rol", "client").select("id");
      if (errDb || !filas || filas.length === 0) {
        console.error("admin-usuarios: no se pudo guardar profiles.activo");
        return json({ error: "El acceso cambió, pero no se pudo guardar el estado. Repite la acción." }, 500);
      }
      return json({ ok: true, activo: body.activo });
    }

    // ----------------------------------------------------------------
    // CAMBIAR LA CONTRASEÑA (útil mientras no haya correo propio para "olvidé mi contraseña")
    // ----------------------------------------------------------------
    const problema = validarPassword(body.password);
    if (problema) return json({ error: problema }, 400);
    const { error: errPass } = await db.auth.admin.updateUserById(atletaId, { password: body.password });
    if (errPass) {
      const m = mensajeErrorAuth(errPass);
      return json({ error: m.texto }, m.estado);
    }
    return json({ ok: true });
  }

  return json({ error: "Acción no válida." }, 400);
});
