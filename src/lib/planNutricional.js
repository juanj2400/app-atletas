// =====================================================================
// src/lib/planNutricional.js — lógica PURA del "configurador" del Plan nutricional (paso 36).
//
// A partir de la edad, el peso, la estatura, el sexo y el nivel de actividad del atleta calcula:
//   1. Metabolismo basal (TMB) con la ecuación de Mifflin-St Jeor.
//   2. Gasto energético diario = TMB × factor de actividad.
//   3. Calorías objetivo = gasto ± un porcentaje según el objetivo físico y la intensidad.
//   4. Macros en gramos según el objetivo y el tipo de dieta.
// Y ofrece `reequilibrar`: cuando el entrenador edita una calorías/macro (en g o en %), reparte
// la diferencia entre los demás para que el total siga cuadrando con las calorías.
//
// Todo es JavaScript puro y DETERMINISTA (sin IA, sin consultas): los mismos datos dan siempre
// el mismo resultado. No toca la base de datos ni la pantalla.
//
// ───────────── Criterios y de dónde salen (son ESTIMACIONES, no mediciones) ─────────────
//  · TMB — Mifflin-St Jeor (peso, estatura, edad, sexo). Es la ecuación estándar para población
//    general. OJO: una revisión sistemática de 2023 en atletas (Sports Medicine, Accuracy of RMR
//    Prediction Equations in Athletes) encontró que sobre o subestima de forma significativa
//    en ese grupo y que la ecuación de Ten Haaf fue la más precisa (80 % de los casos dentro de
//    ±10 %). No se usó Ten Haaf porque no se pudieron verificar sus coeficientes. Por eso el
//    gasto es EDITABLE y debe ajustarse con la tendencia real de peso del atleta.
//  · Factor de actividad — 1,2 · 1,375 · 1,55 · 1,725 · 1,9 (valores clásicos de uso común; son
//    aproximaciones poblacionales).
//  · Ritmo del déficit — Helms et al. 2014 (J Int Soc Sports Nutr): 0,5–1 % del peso por semana,
//    proteína 2,3–3,1 g/kg de masa libre de grasa, grasa 15–30 % de las kcal, carbohidratos el resto.
//    Aquí se usa g/kg del PESO TOTAL (no hay masa libre de grasa registrada), de ahí 2,0–2,4.
//  · Volumen — Iraki et al. 2019 (Nutrition Recommendations for Bodybuilders in the Off-Season):
//    superávit ~10–20 %, ganancia 0,25–0,5 % del peso por semana (principiantes/intermedios; los
//    avanzados, más conservador), proteína 1,6–2,2 g/kg, grasa 0,5–1,5 g/kg, carbohidratos el resto.
//  · CRITERIO PROPIO (no es un rango de un estudio): los porcentajes exactos por intensidad
//    (−10/−20/−25 %, +5/+10/+20 %), la recomposición (0/−5/−10 %), el piso de grasa de 0,6 g/kg y
//    las proporciones de cada tipo de dieta. Están todos en constantes de abajo para ajustarlos.
// =====================================================================
import { aNumero } from './numeros'

export const OBJETIVOS = [
  { valor: 'deficit', etiqueta: 'Déficit', descripcion: 'Perder grasa conservando el músculo' },
  { valor: 'recomposicion', etiqueta: 'Recomposición', descripcion: 'Bajar grasa y ganar músculo con el peso casi estable' },
  { valor: 'volumen', etiqueta: 'Volumen', descripcion: 'Ganar músculo con superávit calórico' },
]

export const INTENSIDADES = [
  { valor: 'conservadora', etiqueta: 'Conservadora' },
  { valor: 'moderada', etiqueta: 'Moderada' },
  { valor: 'agresiva', etiqueta: 'Agresiva' },
]

export const TIPOS_DIETA = [
  { valor: 'equilibrada', etiqueta: 'Equilibrada', descripcion: 'Grasa 25 % de las calorías; carbohidratos el resto' },
  { valor: 'alta_proteina', etiqueta: 'Alta en proteína', descripcion: 'Proteína +0,4 g/kg; grasa 25 %' },
  { valor: 'alta_carbohidratos', etiqueta: 'Alta en carbohidratos', descripcion: 'Grasa 20 % (con piso de 0,6 g/kg)' },
  { valor: 'baja_carbohidratos', etiqueta: 'Baja en carbohidratos', descripcion: 'Grasa 40 % de las calorías' },
  { valor: 'cetogenica', etiqueta: 'Cetogénica', descripcion: '30 g de carbohidratos; grasa el resto' },
]

export const SEXOS = [
  { valor: 'masculino', etiqueta: 'Masculino' },
  { valor: 'femenino', etiqueta: 'Femenino' },
]

export const NIVELES_ACTIVIDAD = [
  { valor: 'sedentario', etiqueta: 'Sedentario', factor: 1.2, descripcion: 'Poco o nada de ejercicio' },
  { valor: 'ligero', etiqueta: 'Ligero', factor: 1.375, descripcion: 'Ejercicio 1–3 días a la semana' },
  { valor: 'moderado', etiqueta: 'Moderado', factor: 1.55, descripcion: 'Ejercicio 3–5 días a la semana' },
  { valor: 'intenso', etiqueta: 'Intenso', factor: 1.725, descripcion: 'Ejercicio 6–7 días a la semana' },
  { valor: 'muy_intenso', etiqueta: 'Muy intenso', factor: 1.9, descripcion: 'Doble sesión o trabajo físico duro' },
]

// ───────────── Constantes de criterio (cámbialas aquí y se aplican en toda la app) ─────────────

// Ajuste de calorías sobre el gasto (−0,20 = 20 % menos).
export const AJUSTE_KCAL = {
  deficit: { conservadora: -0.10, moderada: -0.20, agresiva: -0.25 },
  recomposicion: { conservadora: 0, moderada: -0.05, agresiva: -0.10 },
  volumen: { conservadora: 0.05, moderada: 0.10, agresiva: 0.20 },
}

// Proteína base en g por kg de peso total.
export const PROTEINA_G_KG = {
  deficit: { conservadora: 2.0, moderada: 2.2, agresiva: 2.4 },
  recomposicion: { conservadora: 2.2, moderada: 2.2, agresiva: 2.2 },
  volumen: { conservadora: 1.8, moderada: 1.8, agresiva: 1.8 },
}
const PROTEINA_EXTRA_ALTA_G_KG = 0.4
const PROTEINA_MAX_G_KG = 3.0
const PROTEINA_MIN_G_KG = 1.6
const GRASA_MIN_G_KG = 0.6
const GRASA_PCT_KCAL = { equilibrada: 0.25, alta_proteina: 0.25, alta_carbohidratos: 0.20, baja_carbohidratos: 0.40 }
const CARBOS_CETOGENICA_G = 30
const CARBOS_BAJOS_G_KG = 2 // por debajo de esto se avisa (salvo dietas bajas en carbohidratos)
const KCAL_MINIMAS_HOMBRE = 1500 // referencia de uso común: por debajo se avisa (no se bloquea)
const KCAL_MINIMAS_MUJER = 1200

const KCAL_G = { proteina: 4, carbohidratos: 4, grasas: 9 }
const CLAVES_MACRO = ['proteina', 'carbohidratos', 'grasas']
const ETIQUETA_MACRO = { proteina: 'proteína', carbohidratos: 'carbohidratos', grasas: 'grasas' }

// Mismos límites que la base de datos (migración 26).
export const LIMITES = { pesoMin: 20, pesoMax: 400, estaturaMin: 100, estaturaMax: 250, edadMin: 14, edadMax: 100 }

export const kcalDeMacrosG = ({ proteina, carbohidratos, grasas }) =>
  KCAL_G.proteina * proteina + KCAL_G.carbohidratos * carbohidratos + KCAL_G.grasas * grasas

// ───────────── Metabolismo y gasto ─────────────

// Mifflin-St Jeor: 10·peso(kg) + 6,25·estatura(cm) − 5·edad + (5 hombres | −161 mujeres)
export function calcularTMB({ sexo, pesoKg, estaturaCm, edad }) {
  const base = 10 * pesoKg + 6.25 * estaturaCm - 5 * edad
  return Math.round(base + (sexo === 'masculino' ? 5 : -161))
}

export const factorActividad = (nivel) => NIVELES_ACTIVIDAD.find((n) => n.valor === nivel)?.factor ?? null

// Revisa los datos del atleta. Devuelve '' si están completos y son razonables, o el motivo.
export function validarDatosFisicos({ sexo, edad, pesoKg, estaturaCm, nivelActividad }) {
  if (edad === null || edad === undefined) return 'Falta la fecha de nacimiento del atleta (se agrega en la cabecera de la ficha).'
  if (!Number.isFinite(edad) || edad < LIMITES.edadMin || edad > LIMITES.edadMax) {
    return `La edad debe estar entre ${LIMITES.edadMin} y ${LIMITES.edadMax} años. Revisa la fecha de nacimiento.`
  }
  if (!SEXOS.some((s) => s.valor === sexo)) return 'Elige el sexo del atleta.'
  if (!Number.isFinite(pesoKg) || pesoKg < LIMITES.pesoMin || pesoKg > LIMITES.pesoMax) {
    return `El peso debe estar entre ${LIMITES.pesoMin} y ${LIMITES.pesoMax} kg.`
  }
  if (!Number.isFinite(estaturaCm) || estaturaCm < LIMITES.estaturaMin || estaturaCm > LIMITES.estaturaMax) {
    return `La estatura debe estar entre ${LIMITES.estaturaMin} y ${LIMITES.estaturaMax} cm.`
  }
  if (factorActividad(nivelActividad) === null) return 'Elige el nivel de actividad.'
  return ''
}

// ───────────── Calorías y macros objetivo ─────────────

const aMultiplo10 = (n) => Math.round(n / 10) * 10

// Calcula todo el plan. `gastoManual` (opcional) reemplaza el gasto estimado (el entrenador lo
// ajustó a mano). Devuelve { error } o:
//   { tmb, gasto, factor, ajustePct, kcal, proteina, carbohidratos, grasas, avisos: [texto] }
export function calcularPlan({
  sexo, edad, pesoKg, estaturaCm, nivelActividad, objetivo, intensidad, dieta, gastoManual = null,
}) {
  const problema = validarDatosFisicos({ sexo, edad, pesoKg, estaturaCm, nivelActividad })
  if (problema) return { error: problema }
  if (!Object.hasOwn(AJUSTE_KCAL, objetivo)) return { error: 'Elige el objetivo físico.' }
  // Object.hasOwn y no "!valor": el ajuste de la recomposición conservadora es 0 (falso en JS).
  if (!Object.hasOwn(AJUSTE_KCAL[objetivo], intensidad)) return { error: 'Elige la intensidad.' }
  if (!TIPOS_DIETA.some((d) => d.valor === dieta)) return { error: 'Elige el tipo de dieta.' }
  if (gastoManual !== null && (!Number.isFinite(gastoManual) || gastoManual < 800 || gastoManual > 10000)) {
    return { error: 'El gasto energético debe estar entre 800 y 10.000 kcal.' }
  }

  const avisos = []
  const factor = factorActividad(nivelActividad)
  const tmb = calcularTMB({ sexo, pesoKg, estaturaCm, edad })
  const gasto = gastoManual !== null ? Math.round(gastoManual) : Math.round(tmb * factor)
  const ajustePct = AJUSTE_KCAL[objetivo][intensidad]

  // Calorías: nunca por debajo del metabolismo basal (piso de seguridad).
  let kcal = aMultiplo10(gasto * (1 + ajustePct))
  const piso = Math.ceil(tmb / 10) * 10
  if (kcal < piso) {
    kcal = piso
    avisos.push(`Las calorías quedaron en el metabolismo basal (${piso} kcal): con ese ajuste bajarían de ahí. Elige una intensidad menor o revisa el gasto.`)
  }

  // Proteína
  const pKg = Math.min(
    PROTEINA_MAX_G_KG,
    PROTEINA_G_KG[objetivo][intensidad] + (dieta === 'alta_proteina' ? PROTEINA_EXTRA_ALTA_G_KG : 0),
  )
  let proteina = Math.round(pKg * pesoKg)
  const proteinaMin = Math.round(PROTEINA_MIN_G_KG * pesoKg)
  const grasaMin = Math.round(GRASA_MIN_G_KG * pesoKg)

  // Grasa y carbohidratos
  let grasas
  let carbohidratos
  if (dieta === 'cetogenica') {
    carbohidratos = CARBOS_CETOGENICA_G
    grasas = Math.round((kcal - 4 * proteina - 4 * carbohidratos) / 9)
    if (grasas < grasaMin) {
      // Calorías muy bajas: se recorta primero la proteína hasta su mínimo.
      proteina = Math.max(proteinaMin, Math.round((kcal - 4 * carbohidratos - 9 * grasaMin) / 4))
      grasas = Math.max(grasaMin, Math.round((kcal - 4 * proteina - 4 * carbohidratos) / 9))
    }
    avisos.push('La dieta cetogénica tiene poco respaldo para hipertrofia y entrenamientos de alta intensidad. Úsala solo por indicación.')
  } else {
    grasas = Math.max(grasaMin, Math.round((GRASA_PCT_KCAL[dieta] * kcal) / 9))
    carbohidratos = Math.round((kcal - 4 * proteina - 9 * grasas) / 4)
    if (carbohidratos < 0) {
      // Calorías muy bajas para esos macros: primero la grasa baja a su piso, luego la proteína a su mínimo.
      grasas = grasaMin
      carbohidratos = Math.round((kcal - 4 * proteina - 9 * grasas) / 4)
      if (carbohidratos < 0) {
        proteina = Math.max(proteinaMin, Math.round((kcal - 9 * grasas) / 4))
        carbohidratos = Math.max(0, Math.round((kcal - 4 * proteina - 9 * grasas) / 4))
      }
      avisos.push('Las calorías son muy bajas para la proteína y la grasa mínimas: se recortaron. Revisa el objetivo.')
    }
    if (dieta !== 'baja_carbohidratos' && carbohidratos < CARBOS_BAJOS_G_KG * pesoKg) {
      avisos.push(`Los carbohidratos quedan en ${(carbohidratos / pesoKg).toFixed(1).replace('.', ',')} g/kg: pueden ser pocos para entrenar fuerte.`)
    }
  }

  const kcalMinimas = sexo === 'masculino' ? KCAL_MINIMAS_HOMBRE : KCAL_MINIMAS_MUJER
  if (kcal < kcalMinimas) {
    avisos.push(`${kcal.toLocaleString('es-CO')} kcal es muy poco (referencia: no bajar de ${kcalMinimas.toLocaleString('es-CO')} sin supervisión profesional).`)
  }
  if (edad < 18) avisos.push('Las ecuaciones de gasto están validadas en adultos: con menores de 18 años úsalas solo como referencia.')
  if (gastoManual !== null) avisos.push('Estás usando un gasto energético ajustado a mano, no el estimado.')

  return { tmb, gasto, factor, ajustePct, kcal, proteina, carbohidratos, grasas, avisos }
}

// Estado calórico (el que ya usa la app) según las calorías frente al gasto: ±2 % = normocalórica.
export function estadoCaloricoDe(kcal, gasto) {
  if (!(kcal > 0) || !(gasto > 0)) return ''
  const razon = kcal / gasto - 1
  if (razon < -0.02) return 'deficit'
  if (razon > 0.02) return 'superavit'
  return 'normocalorica'
}

// ───────────── Porcentajes y reequilibrio ─────────────

// Porcentaje de las calorías objetivo que aporta cada macro (1 decimal). Con kcal vacío, de lo que suman.
export function porcentajes(estado) {
  const total = estado.kcal > 0 ? estado.kcal : kcalDeMacrosG(estado)
  const pct = (clave) => (total > 0 ? Math.round((KCAL_G[clave] * estado[clave] * 1000) / total) / 10 : 0)
  return { proteina: pct('proteina'), carbohidratos: pct('carbohidratos'), grasas: pct('grasas') }
}

// Lee el texto de un campo numérico. Devuelve { valor } o { error } (en español).
export function leerNumeroPlan(texto, etiqueta, { maximo = 10000, entero = true } = {}) {
  const n = aNumero(texto)
  if (n === null) return { error: `Escribe ${etiqueta}.` }
  if (Number.isNaN(n)) return { error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)}: escribe solo números.` }
  if (n < 0 || n > maximo) return { error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} debe estar entre 0 y ${maximo.toLocaleString('es-CO')}.` }
  if (entero && !Number.isInteger(n)) return { error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} debe ser un número entero.` }
  return { valor: n }
}

// REEQUILIBRIO. El entrenador cambia UNA cosa y los demás macros se ajustan para que el total
// siga siendo el de las calorías objetivo.
//   estado      { kcal, proteina, carbohidratos, grasas }  (gramos; kcal puede ser 0 = "sin calorías aún")
//   cambio      { campo: 'kcal' | 'proteina' | 'carbohidratos' | 'grasas', valor, unidad: 'g' | 'pct' }
//               ('pct' = % de las calorías; solo para macros)
//   bloqueados  macros que NO se tocan al repartir (el editado siempre se respeta)
// Reglas:
//   · Editar calorías: los macros bloqueados conservan sus gramos y los libres se escalan, en
//     proporción a lo que aportaban, hasta cuadrar con las nuevas calorías.
//   · Editar un macro: ese macro queda como se escribió (con tope: no puede pasar de las
//     calorías) y los demás libres absorben la diferencia en proporción a lo que aportaban.
//   · Si no hay calorías objetivo todavía, no se reparte nada: las calorías pasan a ser la suma.
// Devuelve { estado: nuevoEstado, avisos: [texto] }. No muta lo que recibe.
export function reequilibrar(estado, cambio, bloqueados = []) {
  const avisos = []
  const g = { proteina: estado.proteina, carbohidratos: estado.carbohidratos, grasas: estado.grasas }
  const fijos = new Set(bloqueados)
  let kcal = estado.kcal

  if (cambio.campo === 'kcal') {
    kcal = Math.round(cambio.valor)
  } else {
    const k = KCAL_G[cambio.campo]
    let gramos = cambio.unidad === 'pct' ? ((cambio.valor / 100) * (kcal > 0 ? kcal : 0)) / k : cambio.valor
    gramos = Math.max(0, gramos)
    if (kcal > 0 && gramos * k > kcal) {
      gramos = Math.floor(kcal / k)
      avisos.push(`No puede pasar de las calorías objetivo: ${ETIQUETA_MACRO[cambio.campo]} quedó en ${gramos} g.`)
    }
    g[cambio.campo] = Math.round(gramos)
    fijos.add(cambio.campo)
    if (!(kcal > 0)) {
      // Sin calorías objetivo todavía: no hay nada que cuadrar.
      return { estado: { kcal: kcalDeMacrosG(g), ...g }, avisos }
    }
  }

  const libres = CLAVES_MACRO.filter((c) => !fijos.has(c))
  const kcalFijos = CLAVES_MACRO.filter((c) => fijos.has(c)).reduce((s, c) => s + g[c] * KCAL_G[c], 0)
  const restante = kcal - kcalFijos

  if (libres.length === 0) {
    if (restante !== 0) {
      avisos.push(`Quedan ${Math.abs(Math.round(restante))} kcal ${restante > 0 ? 'sin repartir' : 'de más'}: desbloquea algún macro para que se ajuste.`)
    }
    return { estado: { kcal, ...g }, avisos }
  }
  if (restante < 0) {
    for (const c of libres) g[c] = 0
    avisos.push('Los macros fijados ya superan las calorías: desbloquea alguno o sube las calorías.')
    return { estado: { kcal, ...g }, avisos }
  }

  // Reparto proporcional a lo que cada libre aportaba (o en partes iguales si ninguno aportaba).
  const aporte = libres.map((c) => g[c] * KCAL_G[c])
  const suma = aporte.reduce((s, n) => s + n, 0)
  libres.forEach((c, i) => {
    const parte = suma > 0 ? aporte[i] / suma : 1 / libres.length
    g[c] = Math.max(0, Math.round((restante * parte) / KCAL_G[c]))
  })

  // Corrección del redondeo a gramos enteros: se absorbe en el macro libre de 4 kcal/g (carbohidratos,
  // si no proteína) y, si solo hay grasa libre, en la grasa. Así el total queda a ±2 kcal del objetivo.
  const dif = kcal - kcalDeMacrosG(g)
  const candidato = libres.includes('carbohidratos') ? 'carbohidratos' : libres.includes('proteina') ? 'proteina' : 'grasas'
  const ajuste = Math.round(dif / KCAL_G[candidato])
  if (g[candidato] + ajuste >= 0) g[candidato] += ajuste

  return { estado: { kcal, ...g }, avisos }
}
