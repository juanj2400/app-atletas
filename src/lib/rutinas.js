// =====================================================================
// src/lib/rutinas.js — funciones auxiliares de rutinas y series.
// Son funciones "puras": reciben datos y devuelven texto o listas. No tocan la
// pantalla ni la base de datos, por eso es fácil comprobar que funcionan.
// =====================================================================
import { fechaLocalISO } from './fechas'
import { textoEscalera } from './progresion'

// "5-6", "5" o "—"
export function textoReps(fila) {
  const { reps_min: min, reps_max: max } = fila
  if (min && max) return min === max ? `${min}` : `${min}-${max}`
  return String(min ?? max ?? '—')
}

// 120 -> "2 min", 90 -> "90 s"
export function textoDescanso(seg) {
  if (seg >= 60 && seg % 60 === 0) return `${seg / 60} min`
  return `${seg} s`
}

// "4 × 5-6 reps · RPE 8 · descanso 2 min"
// En fuerza simple (escalera) no hay un "series × reps" fijo: lo que se muestra es la escalera
// ("Escalera 2 × 1 · 3 × 1 · 2 × 2"); la meta concreta del día va aparte.
export function textoPrescripcion(fila) {
  const base = fila.progresion_tipo === 'escalera' && fila.escalera
    ? `Escalera ${textoEscalera(fila.escalera)}`
    : `${fila.series} × ${textoReps(fila)} reps`
  return [
    base,
    // Si el entrenador no pide RPE en este ejercicio, tampoco se muestra el objetivo.
    fila.pide_rpe !== false && fila.rpe_objetivo !== null && `RPE ${fila.rpe_objetivo}`,
    fila.descanso_seg !== null && `descanso ${textoDescanso(fila.descanso_seg)}`,
  ].filter(Boolean).join(' · ')
}

// "80 kg × 5 @ RPE 8"
export function textoSerie(serie) {
  return `${serie.peso_kg} kg × ${serie.repeticiones}${serie.rpe !== null ? ` @ RPE ${serie.rpe}` : ''}`
}

// Medianoche de HOY en la hora del celular, en formato que entiende la base de datos.
// (Postgres guarda en UTC; por eso no basta con comparar solo la fecha.)
export function inicioDeHoyISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// De todas las series anteriores, se queda con las del ENTRENAMIENTO MÁS RECIENTE
// de cada ejercicio. Resultado: { [exercise_id]: { fecha, series: [...] } }
// Recibe los registros ordenados del más reciente al más antiguo.
export function calcularUltimaVez(previos) {
  const mapa = {}
  for (const l of previos) {
    const fecha = fechaLocalISO(new Date(l.realizado_en))
    const actual = mapa[l.exercise_id]
    if (!actual) mapa[l.exercise_id] = { fecha, series: [l] }
    else if (actual.fecha === fecha) actual.series.push(l)
  }
  for (const k of Object.keys(mapa)) {
    mapa[k].series.sort((a, b) => (a.numero_serie ?? 0) - (b.numero_serie ?? 0))
  }
  return mapa
}

// Agrupa las series por día y ejercicio para mostrar el historial:
// [{ fecha, ejercicios: [{ id, nombre, series: [...] }] }]  (días más recientes primero)
export function agruparPorDia(logs) {
  const dias = new Map() // Map conserva el orden en que se insertan los elementos
  for (const l of logs) {
    const fecha = fechaLocalISO(new Date(l.realizado_en))
    if (!dias.has(fecha)) dias.set(fecha, new Map())
    const ejercicios = dias.get(fecha)
    if (!ejercicios.has(l.exercise_id)) {
      ejercicios.set(l.exercise_id, { id: l.exercise_id, nombre: l.exercises?.nombre ?? 'Ejercicio', series: [] })
    }
    ejercicios.get(l.exercise_id).series.push(l)
  }
  return [...dias.entries()].map(([fecha, ejercicios]) => ({
    fecha,
    ejercicios: [...ejercicios.values()].map((e) => ({
      ...e,
      series: e.series.sort((a, b) => (a.numero_serie ?? 0) - (b.numero_serie ?? 0)),
    })),
  }))
}
