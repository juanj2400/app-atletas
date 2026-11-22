// =====================================================================
// src/lib/records.js — ayudas para mostrar récords personales.
// Funciones puras: reciben un dato y devuelven texto o un sí/no.
// =====================================================================
import { fechaLocalISO, formatearFechaCorta } from './fechas'

// Un récord se marca como "Nuevo" si se logró en los últimos 14 días.
export const DIAS_RECORD_NUEVO = 14

// Convierte la marca de tiempo de la base de datos (UTC) en "14 nov" en hora LOCAL.
export function fechaCortaDeTimestamp(timestamp) {
  return formatearFechaCorta(fechaLocalISO(new Date(timestamp)))
}

export function esRecordReciente(timestamp, ahora = Date.now()) {
  return ahora - new Date(timestamp).getTime() <= DIAS_RECORD_NUEVO * 24 * 60 * 60 * 1000
}

// 116.7 -> "116,7"; 120 -> "120"
export function textoKg(kg) {
  return Number(kg).toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

// ---------------------------------------------------------------------
// 1RM estimado (fórmula de Epley). Es la MISMA fórmula de la vista v_athlete_prs
// de la base de datos: con 1 repetición es el propio peso.
// ---------------------------------------------------------------------
export function estimar1RM(peso, repeticiones) {
  const kg = Number(peso)
  return repeticiones === 1 ? kg : Math.round(kg * (1 + repeticiones / 30) * 10) / 10
}

// Evolución del 1RM estimado: UN punto por día de entrenamiento (la mejor serie de ese día).
// Los días se agrupan en HORA LOCAL del celular; si se agruparan en UTC, un
// entrenamiento nocturno en Colombia caería en el día siguiente.
// Devuelve los puntos de más antiguo a más reciente: [{ fecha, e1rm, peso, reps }]
export function calcularProgreso1RM(series) {
  const porDia = new Map()
  for (const s of series) {
    const peso = Number(s.peso_kg)
    if (!(peso > 0)) continue // el peso corporal (0 kg) no tiene 1RM
    const fecha = fechaLocalISO(new Date(s.realizado_en))
    const e1rm = estimar1RM(peso, s.repeticiones)
    const actual = porDia.get(fecha)
    if (!actual || e1rm > actual.e1rm) porDia.set(fecha, { fecha, e1rm, peso, reps: s.repeticiones })
  }
  return [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}
