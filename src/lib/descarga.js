// =====================================================================
// src/lib/descarga.js — semana de descarga (deload) con reglas FIJAS, sin IA.
//
// Idea: durante exactamente 7 días locales el atleta entrena la MISMA rutina, pero la app
// le muestra una versión más liviana calculada al vuelo. No se modifica nada de la rutina
// (ni series, ni progresión): al terminar la semana, o al cancelarla, todo sigue igual.
//
// Reglas (cambia las constantes de abajo si quieres ajustar el criterio):
//   - Volumen: series al 60 % (−40 %), mínimo 1 serie por ejercicio. Repeticiones iguales.
//   - Carga: musculación −10 %, halterofilia −20 % (técnica y velocidad, sin máximos).
//     Base = peso de trabajo de la última sesión NORMAL (las series de descarga no cuentan,
//     lo garantiza la base de datos). Se redondea a 0,5 kg. Peso corporal (0 kg) no cambia.
//   - Intensidad: RPE objetivo máximo 7 (al menos 3 repeticiones en reserva): nada al fallo.
//   - La progresión automática se pausa: no hay "meta de subir" durante la descarga.
//
// Fechas: todas son "YYYY-MM-DD" LOCAL (nunca new Date("YYYY-MM-DD")).
// =====================================================================
import { bloqueDe } from './bloques'
import { diasEntre } from './ciclos'
import { fechaLocalISO, formatearFecha } from './fechas'
import { calcularMeta, formatearKg, normalizarEscalera, textoMeta } from './progresion'

export const DIAS_DESCARGA = 7
export const FACTOR_SERIES = 0.6
export const FACTOR_CARGA = { musculacion: 0.9, halterofilia: 0.8 }
export const RPE_MAX_DESCARGA = 7
export const REDONDEO_KG = 0.5

// Texto de las reglas (sale de las constantes, así nunca se desincroniza de lo que se aplica).
export const REGLAS_DESCARGA = [
  `Series: ${Math.round((1 - FACTOR_SERIES) * 100)} % menos por ejercicio (mínimo 1). Las repeticiones no cambian.`,
  `Carga: −${Math.round((1 - FACTOR_CARGA.musculacion) * 100)} % en musculación y −${Math.round((1 - FACTOR_CARGA.halterofilia) * 100)} % en halterofilia, sobre el peso de trabajo de su última sesión normal.`,
  `Intensidad: RPE máximo ${RPE_MAX_DESCARGA} (al menos 3 repeticiones en reserva), sin máximos ni series al fallo.`,
  'La progresión automática queda en pausa y las series de la descarga no cuentan para calcularla.',
  `Dura ${DIAS_DESCARGA} días contados desde hoy. Después vuelven solas la rutina y la progresión de antes.`,
]

// Fin de la semana: inicio + 6 días (7 días con ambos extremos incluidos). Fecha local.
export function fechaFinDescarga(inicio) {
  const [a, m, d] = inicio.split('-').map(Number)
  return fechaLocalISO(new Date(a, m - 1, d + DIAS_DESCARGA - 1))
}

// De una lista de filas de deload_weeks, la que está en curso hoy (o null).
export function descargaVigente(lista, hoy) {
  return (lista ?? []).find((d) => !d.cancelada_en && d.fecha_inicio <= hoy && hoy <= d.fecha_fin) ?? null
}

// 'cancelada' | 'activa' | 'programada' | 'finalizada'
export function estadoDescarga(d, hoy) {
  if (d.cancelada_en) return 'cancelada'
  if (hoy < d.fecha_inicio) return 'programada'
  if (hoy > d.fecha_fin) return 'finalizada'
  return 'activa'
}

// Día de la semana de descarga (1 a 7) en el que está el atleta hoy.
export const diaDeDescarga = (descarga, hoy) => diasEntre(descarga.fecha_inicio, hoy) + 1

// "Día 3 de 7 · hasta dom, 29 nov"
export function textoVentanaDescarga(descarga, hoy) {
  return `Día ${diaDeDescarga(descarga, hoy)} de ${DIAS_DESCARGA} · hasta ${formatearFecha(descarga.fecha_fin)}`
}

// ---------------------------------------------------------------------
// Reglas por ejercicio
// ---------------------------------------------------------------------

// Halterofilia = bloque de halterofilia (rutina híbrida) o ejercicio de tipo "halterofilia".
export const esHalterofilia = (fila) =>
  bloqueDe(fila) === 'halterofilia' || fila.exercises?.tipo_ejercicio === 'halterofilia'

export const reducirSeries = (n) => Math.max(1, Math.round(Number(n) * FACTOR_SERIES))

// kg -> kg de descarga redondeado a 0,5. 0 (peso corporal) o vacío no cambian.
export function reducirCarga(kg, factor) {
  if (kg == null || !(kg > 0)) return kg
  return Math.max(REDONDEO_KG, Math.round((kg * factor) / REDONDEO_KG) * REDONDEO_KG)
}

// Meta del ejercicio durante la descarga. Siempre devuelve una meta (aunque el ejercicio no
// tenga progresión). seriesUltimaVez: series de la última sesión normal ({ peso_kg, repeticiones }).
//   { sistema: 'descarga', series, reps, peso_kg, pesoTrabajo, factorCarga, rpeMax, halterofilia, motivo: 'descarga' }
export function calcularMetaDescarga(fila, seriesUltimaVez) {
  const halterofilia = esHalterofilia(fila)
  const factorCarga = halterofilia ? FACTOR_CARGA.halterofilia : FACTOR_CARGA.musculacion

  const previas = (seriesUltimaVez ?? []).filter((s) => Number.isFinite(Number(s.peso_kg)) && Number(s.repeticiones) >= 1)
  const pesoTrabajo = previas.length ? Math.max(...previas.map((s) => Number(s.peso_kg))) : null
  const arranque = fila.peso_inicial_kg ?? fila.peso_sugerido_kg
  const pesoBase = pesoTrabajo ?? (arranque == null ? null : Number(arranque))

  // Series y repeticiones de partida: sin progresar (primer paso de la escalera o rango bajo).
  let series = fila.series
  let reps = fila.progresion_tipo === 'doble' ? (fila.reps_min ?? fila.reps_max) : (fila.reps_max ?? fila.reps_min)
  if (fila.progresion_tipo === 'escalera') {
    const primero = normalizarEscalera(fila.escalera)[0]
    if (primero) { series = primero.series; reps = primero.reps }
  }

  return {
    sistema: 'descarga',
    motivo: 'descarga',
    series: reducirSeries(series),
    reps: reps ?? null,
    peso_kg: reducirCarga(pesoBase, factorCarga),
    pesoTrabajo,
    factorCarga,
    rpeMax: RPE_MAX_DESCARGA,
    halterofilia,
  }
}

// La meta que ve el atleta hoy: la de descarga si hay una vigente; si no, la progresión normal.
export function metaDelDia(fila, ultimaVez, descarga) {
  return descarga ? calcularMetaDescarga(fila, ultimaVez?.series) : calcularMeta(fila, ultimaVez?.series)
}

// { titulo, nota } de una meta de descarga, listos para mostrar.
export function textoMetaDescarga(meta) {
  const { titulo } = textoMeta(meta) // "2 × 8 reps con 54 kg"
  const rebaja = Math.round((1 - meta.factorCarga) * 100)
  const base = meta.pesoTrabajo != null
    ? `${rebaja} % menos que tu peso de trabajo (${formatearKg(meta.pesoTrabajo)} kg). `
    : ''
  const enfoque = meta.halterofilia
    ? 'Cuida la técnica y la velocidad; no busques máximos.'
    : `RPE máximo ${meta.rpeMax}: deja al menos 3 repeticiones en reserva.`
  return { titulo, nota: `Semana de descarga. ${base}${enfoque}` }
}

// La fila con series/reps/RPE de descarga, para reutilizar `textoPrescripcion` sin duplicarlo.
export function prescripcionDescarga(fila, meta) {
  return {
    ...fila,
    series: meta.series,
    progresion_tipo: 'ninguna',
    escalera: null,
    reps_min: meta.reps,
    reps_max: meta.reps,
    rpe_objetivo: fila.rpe_objetivo == null ? meta.rpeMax : Math.min(Number(fila.rpe_objetivo), meta.rpeMax),
  }
}
