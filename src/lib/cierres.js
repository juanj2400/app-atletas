// =====================================================================
// src/lib/cierres.js — lógica pura del cierre de ejercicios y de la rutina del día.
// "Cerrar" un ejercicio = el atleta lo da por terminado sin completar todas las
// series, explicando el motivo en una nota (tabla exercise_closures).
// =====================================================================
import { metaDelDia } from './descarga'
import { bloqueDe } from './bloques'

export const NOTA_MIN = 3
export const NOTA_MAX = 500

// Series que tocan hoy en un ejercicio (la meta de la progresión manda sobre lo prescrito).
// Es la misma cuenta que usa cada tarjeta de ejercicio.
// `descarga`: la semana de descarga en curso (o null); si hay una, manda su reducción de series.
export function seriesObjetivoDe(fila, ultimaVez, descarga = null) {
  return metaDelDia(fila, ultimaVez, descarga)?.series ?? fila.series
}

// 'completo' (hizo todas las series), 'cerrado' (finalizado con nota) o 'pendiente'.
export function estadoEjercicio(seriesHechas, seriesObjetivo, cierre) {
  if (seriesHechas >= seriesObjetivo) return 'completo'
  return cierre ? 'cerrado' : 'pendiente'
}

// Resume el día: la rutina está terminada cuando ningún ejercicio queda pendiente.
export function resumenRutinaDia(estados) {
  const completos = estados.filter((e) => e === 'completo').length
  const cerrados = estados.filter((e) => e === 'cerrado').length
  const pendientes = estados.length - completos - cerrados
  return { total: estados.length, completos, cerrados, pendientes, terminada: estados.length > 0 && pendientes === 0 }
}

// Valida la nota del motivo. Devuelve { ok, nota } o { ok: false, mensaje }.
export function validarNotaCierre(texto) {
  const nota = (texto ?? '').trim()
  if (nota.length < NOTA_MIN) return { ok: false, mensaje: 'Escribe brevemente por qué dejas el ejercicio así (mínimo 3 letras).' }
  if (nota.length > NOTA_MAX) return { ok: false, mensaje: `La nota no puede superar los ${NOTA_MAX} caracteres.` }
  return { ok: true, nota }
}

// Une los cierres con los días agrupados por agruparPorDia (historial del entrenador).
// Un ejercicio cerrado sin ninguna serie también aparece. Días más recientes primero.
export function unirCierres(dias, cierres) {
  const porFecha = new Map(dias.map((d) => [d.fecha, { ...d, ejercicios: d.ejercicios.map((e) => ({ ...e })) }]))
  for (const c of cierres) {
    if (!porFecha.has(c.fecha)) porFecha.set(c.fecha, { fecha: c.fecha, ejercicios: [] })
    const dia = porFecha.get(c.fecha)
    let ej = dia.ejercicios.find((e) => e.id === c.exercise_id)
    if (!ej) {
      ej = { id: c.exercise_id, nombre: c.exercises?.nombre ?? 'Ejercicio', series: [] }
      dia.ejercicios.push(ej)
    }
    ej.cierre = c
  }
  return [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}

// ---------------------------------------------------------------------
// Resumen de solo lectura de un día ya realizado (el atleta lo ve en "Entrenar")
// ---------------------------------------------------------------------

// Resume las series de un ejercicio en pocas palabras: agrupa las consecutivas iguales.
// [8×60, 8×60, 6×60] -> "2 × 8 con 60 kg · 1 × 6 con 60 kg". Peso 0 = peso corporal.
export function textoResumenSeries(series) {
  const grupos = []
  for (const s of series) {
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.peso_kg === s.peso_kg && ultimo.repeticiones === s.repeticiones) ultimo.n += 1
    else grupos.push({ peso_kg: s.peso_kg, repeticiones: s.repeticiones, n: 1 })
  }
  return grupos
    .map((g) => `${g.n} × ${g.repeticiones} ${g.peso_kg > 0 ? `con ${g.peso_kg} kg` : 'con peso corporal'}`)
    .join(' · ')
}

// Une lo prescrito con lo que hizo el atleta durante la semana del día realizado.
//   filas:   ejercicios del día (routine_exercises con `exercises ( nombre )`)
//   logs:    series de esa semana (routine_logs)
//   cierres: cierres con nota de esa semana (exercise_closures)
// Devuelve { ejercicios: [...], completos, cerrados }. No muta nada.
// Estado: 'cerrado' si hay un cierre y hizo menos series que las del cierre (si luego las
// completó, manda 'completo'); 'completo' si hizo series; 'sin_registro' si no hay ninguna.
export function resumenDiaRealizado(filas, logs, cierres, hibrido = false) {
  const ejercicios = [...filas]
    .sort((a, b) => a.orden - b.orden)
    .map((fila) => {
      const series = logs
        .filter((l) => l.routine_exercise_id === fila.id)
        .sort((a, b) => (a.realizado_en < b.realizado_en ? -1 : a.realizado_en > b.realizado_en ? 1 : (a.numero_serie ?? 0) - (b.numero_serie ?? 0)))
      // Si hubiera varios cierres (de días distintos de la semana), vale el más reciente.
      const cierre = cierres
        .filter((c) => c.routine_exercise_id === fila.id)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] ?? null
      let estado = series.length > 0 ? 'completo' : 'sin_registro'
      if (cierre && series.length < cierre.series_objetivo) estado = 'cerrado'
      return {
        id: fila.id,
        nombre: fila.exercises?.nombre ?? 'Ejercicio',
        bloque: hibrido ? bloqueDe(fila) : null,
        estado,
        hechas: series.length,
        objetivo: cierre?.series_objetivo ?? null,
        texto: textoResumenSeries(series),
        nota: estado === 'cerrado' ? cierre.nota : null,
      }
    })
  return {
    ejercicios,
    completos: ejercicios.filter((e) => e.estado === 'completo').length,
    cerrados: ejercicios.filter((e) => e.estado === 'cerrado').length,
  }
}
