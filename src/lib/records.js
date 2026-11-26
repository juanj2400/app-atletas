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

// ---------------------------------------------------------------------
// Evolución del PESO y de las REPETICIONES de un ejercicio (¿he mejorado?)
// ---------------------------------------------------------------------
// UN punto por día de entrenamiento (en hora LOCAL, igual que calcularProgreso1RM):
//   - peso: el mayor peso movido ese día.
//   - reps: las repeticiones de la serie con ese peso (si hay varias con el mismo peso, la de más reps).
// Se compara siempre al peso más alto del día para no mezclar series de calentamiento con las
// de trabajo. A diferencia del 1RM, aquí SÍ entra el peso 0 (peso corporal): en dominadas o
// fondos la mejora está en las repeticiones. Sirve también para los ejercicios aislados.
// Devuelve los puntos de más antiguo a más reciente: [{ fecha, peso, reps }]
export function calcularEvolucionPesoReps(series) {
  const porDia = new Map()
  for (const s of series) {
    const peso = Number(s.peso_kg)
    if (!Number.isFinite(peso) || peso < 0 || !(s.repeticiones > 0)) continue
    const fecha = fechaLocalISO(new Date(s.realizado_en))
    const actual = porDia.get(fecha)
    if (!actual || peso > actual.peso || (peso === actual.peso && s.repeticiones > actual.reps)) {
      porDia.set(fecha, { fecha, peso, reps: s.repeticiones })
    }
  }
  return [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Compara el primer y el último entrenamiento disponibles. Devuelve null con menos de 2 días.
// { desde, hasta, conPeso, peso:{inicio, fin, delta}, reps:{inicio, fin, delta} }
// conPeso = false si todo el historial es con peso corporal (0 kg): no tiene sentido hablar de kg.
export function resumirMejoraEjercicio(puntos) {
  if (puntos.length < 2) return null
  const a = puntos[0]
  const b = puntos[puntos.length - 1]
  return {
    desde: a.fecha,
    hasta: b.fecha,
    conPeso: puntos.some((p) => p.peso > 0),
    peso: { inicio: a.peso, fin: b.peso, delta: Math.round((b.peso - a.peso) * 100) / 100 },
    reps: { inicio: a.reps, fin: b.reps, delta: b.reps - a.reps },
  }
}

// Frases para el atleta/entrenador. Ej.: "Peso máximo: subió de 60 a 70 kg (+10 kg)."
export function textoMejoraPeso(r) {
  if (!r || !r.conPeso) return null
  const { inicio, fin, delta } = r.peso
  if (delta === 0) return `Peso máximo: se mantiene en ${textoKg(fin)} kg.`
  return `Peso máximo: ${delta > 0 ? 'subió' : 'bajó'} de ${textoKg(inicio)} a ${textoKg(fin)} kg (${delta > 0 ? '+' : ''}${textoKg(delta)} kg).`
}

export function textoMejoraReps(r) {
  if (!r) return null
  const { inicio, fin, delta } = r.reps
  const cuando = r.conPeso ? 'con tu peso más alto' : 'por serie'
  if (delta === 0) return `Repeticiones ${cuando}: se mantienen en ${fin}.`
  return `Repeticiones ${cuando}: ${delta > 0 ? 'subieron' : 'bajaron'} de ${inicio} a ${fin} (${delta > 0 ? '+' : ''}${delta}).`
}
