// =====================================================================
// src/lib/cierres.js — lógica pura del cierre de ejercicios y de la rutina del día.
// "Cerrar" un ejercicio = el atleta lo da por terminado sin completar todas las
// series, explicando el motivo en una nota (tabla exercise_closures).
// =====================================================================
import { calcularMeta } from './progresion'

export const NOTA_MIN = 3
export const NOTA_MAX = 500

// Series que tocan hoy en un ejercicio (la meta de la progresión manda sobre lo prescrito).
// Es la misma cuenta que usa cada tarjeta de ejercicio.
export function seriesObjetivoDe(fila, ultimaVez) {
  return calcularMeta(fila, ultimaVez?.series)?.series ?? fila.series
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
