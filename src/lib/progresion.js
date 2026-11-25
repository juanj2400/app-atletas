// =====================================================================
// src/lib/progresion.js — progresión automática de repeticiones y carga.
// Son funciones "puras": reciben datos y devuelven resultados. No tocan la
// pantalla ni la base de datos, por eso es fácil comprobar que funcionan.
//
// Se configura por ejercicio de la rutina (columnas de la migración 11):
//
//  - 'doble' (rango de repeticiones): el entrenador da reps_min y reps_max. Cada
//    sesión se intenta UNA repetición más que la mejor serie de la vez anterior.
//    Si no mejoró, la meta se mantiene. Al llegar a reps_max se sugiere subir
//    (incremento_kg) y la secuencia vuelve a empezar en reps_min.
//
//  - 'escalera' (fuerza simple): el entrenador marca pasos [series, reps] (por ejemplo
//    [3,2] = 3 series de 2 repeticiones). Se recorren ordenados por repeticiones y luego
//    por series: primero suben las series y luego las repeticiones. Al terminar el
//    último paso se sugiere subir el peso y se vuelve al primero.
//
// Qué se compara: SIEMPRE las series de la última sesión hechas con el peso más alto
// de esa sesión (el "peso de trabajo"). Así, si el atleta subió el peso por su cuenta,
// el sistema lo detecta solo, sin que nadie tenga que avisarle.
// =====================================================================

export const SISTEMAS_PROGRESION = [
  { valor: 'ninguna', texto: 'Sin progresión automática' },
  { valor: 'doble', texto: 'Rango de repeticiones (una más cada semana)' },
  { valor: 'escalera', texto: 'Fuerza simple (series, luego repeticiones, luego peso)' },
]
export const SALTOS_PESO = [2.5, 5]

// Casillas que ofrece el editor para armar la escalera.
// (La base de datos admite más: series 1–20, repeticiones 1–100 y hasta 40 pasos.)
export const SERIES_ESQUEMA = [2, 3, 4, 5, 6]
export const REPS_ESQUEMA = [1, 2, 3, 4, 5]

// "82.5" -> "82,5" (en español se escribe con coma)
export function formatearKg(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

// ---------------------------------------------------------------------
// Escalera. En la base de datos es una lista de parejas: [[2,1],[3,1],[2,2]].
// ---------------------------------------------------------------------

// Lo guardado -> [{ series, reps }] ordenado por repeticiones y luego por series, sin
// repetidos. Ignora lo que no sea una pareja de enteros positivos.
export function normalizarEscalera(escalera) {
  if (!Array.isArray(escalera)) return []
  const vistos = new Set()
  const lista = []
  for (const par of escalera) {
    if (!Array.isArray(par) || par.length !== 2) continue
    const series = Number(par[0])
    const reps = Number(par[1])
    if (!Number.isInteger(series) || !Number.isInteger(reps) || series < 1 || reps < 1) continue
    const clave = `${series}x${reps}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    lista.push({ series, reps })
  }
  return lista.sort((a, b) => a.reps - b.reps || a.series - b.series)
}

// [{ series, reps }] -> [[series, reps], ...] ordenado, listo para enviar a la base de datos.
export function escaleraAPares(lista) {
  return [...lista].sort((a, b) => a.reps - b.reps || a.series - b.series).map((e) => [e.series, e.reps])
}

export function tieneEsquema(escalera, series, reps) {
  return normalizarEscalera(escalera).some((e) => e.series === series && e.reps === reps)
}

// Marca o desmarca un paso y devuelve la escalera nueva (lista de parejas ordenada).
export function alternarEsquema(escalera, series, reps) {
  const lista = normalizarEscalera(escalera)
  const hay = lista.some((e) => e.series === series && e.reps === reps)
  const nueva = hay ? lista.filter((e) => !(e.series === series && e.reps === reps)) : [...lista, { series, reps }]
  return escaleraAPares(nueva)
}

// "2 × 1 · 3 × 1 · 2 × 2"
export function textoEscalera(escalera) {
  return normalizarEscalera(escalera).map((e) => `${e.series} × ${e.reps}`).join(' · ')
}

// ---------------------------------------------------------------------
// La meta del día
// ---------------------------------------------------------------------

const IGUAL = (a, b) => Math.abs(a - b) < 0.001 // los pesos son decimales: no se comparan con ===

// seriesUltimaVez: las series del entrenamiento anterior de ese ejercicio (lista de
// { peso_kg, repeticiones }). Devuelve null si el ejercicio no tiene progresión o si
// faltan datos para calcularla; si no, un objeto:
//   { sistema, series, reps, peso_kg, motivo, mejor?, pesoAnterior?, salto }
// motivo: 'inicio' | 'subir_rep' | 'subir_series' | 'subir_reps' | 'subir_peso' | 'reintentar'
export function calcularMeta(fila, seriesUltimaVez) {
  const sistema = fila.progresion_tipo
  if (sistema !== 'doble' && sistema !== 'escalera') return null

  const salto = Number(fila.incremento_kg) || 2.5
  // Peso con el que arranca el atleta la primera vez: el inicial de este atleta o, si no hay, el sugerido.
  const pesoArranque = fila.peso_inicial_kg ?? fila.peso_sugerido_kg
  const pesoInicial = pesoArranque == null ? null : Number(pesoArranque)
  const previas = (seriesUltimaVez ?? []).filter(
    (s) => Number.isFinite(Number(s.peso_kg)) && Number(s.repeticiones) >= 1
  )
  const pesoTrabajo = previas.length ? Math.max(...previas.map((s) => Number(s.peso_kg))) : null
  const alPeso = pesoTrabajo === null ? [] : previas.filter((s) => IGUAL(Number(s.peso_kg), pesoTrabajo))
  const subido = pesoTrabajo === null ? null : Math.round((pesoTrabajo + salto) * 100) / 100

  if (sistema === 'doble') {
    const min = fila.reps_min
    const max = fila.reps_max
    if (min == null || max == null) return null
    const base = { sistema, series: fila.series, salto }

    if (alPeso.length === 0) return { ...base, reps: min, peso_kg: pesoInicial, motivo: 'inicio' }

    const mejor = Math.max(...alPeso.map((s) => Number(s.repeticiones)))
    if (mejor >= max) {
      return { ...base, reps: min, peso_kg: subido, motivo: 'subir_peso', mejor, pesoAnterior: pesoTrabajo }
    }
    // Si no mejoró, "mejor + 1" repite la meta de la vez anterior: se mantiene sola.
    return { ...base, reps: Math.max(mejor + 1, min), peso_kg: pesoTrabajo, motivo: 'subir_rep', mejor }
  }

  // escalera
  const pasos = normalizarEscalera(fila.escalera)
  if (pasos.length === 0) return null
  const primero = pasos[0]
  const base = { sistema, salto }

  if (alPeso.length === 0) {
    return { ...base, series: primero.series, reps: primero.reps, peso_kg: pesoInicial, motivo: 'inicio' }
  }

  // Un paso está "cumplido" si hubo al menos N series con M repeticiones o más.
  const cumplido = (e) => alPeso.filter((s) => Number(s.repeticiones) >= e.reps).length >= e.series
  let logrado = -1
  pasos.forEach((e, i) => { if (cumplido(e)) logrado = i })

  if (logrado === -1) {
    return { ...base, series: primero.series, reps: primero.reps, peso_kg: pesoTrabajo, motivo: 'reintentar' }
  }
  if (logrado === pasos.length - 1) {
    return {
      ...base, series: primero.series, reps: primero.reps, peso_kg: subido,
      motivo: 'subir_peso', pesoAnterior: pesoTrabajo,
    }
  }
  const actual = pasos[logrado]
  const siguiente = pasos[logrado + 1]
  return {
    ...base, series: siguiente.series, reps: siguiente.reps, peso_kg: pesoTrabajo,
    motivo: siguiente.reps === actual.reps ? 'subir_series' : 'subir_reps',
  }
}

// Meta -> { titulo, nota } listos para mostrar al atleta.
export function textoMeta(meta) {
  const peso = meta.peso_kg == null
    ? ''
    : meta.peso_kg === 0 ? ' con peso corporal' : ` con ${formatearKg(meta.peso_kg)} kg`
  const titulo = `${meta.series} × ${meta.reps} reps${peso}`

  let nota
  switch (meta.motivo) {
    case 'inicio':
      nota = 'Primera vez con esta progresión: empieza aquí.'
      break
    case 'subir_rep':
      nota = `Una repetición más que tu mejor serie de la última vez (${meta.mejor}).`
      break
    case 'subir_series':
      nota = 'Una serie más que la última vez, con las mismas repeticiones.'
      break
    case 'subir_reps':
      nota = 'Completaste las series del paso anterior: ahora más repeticiones por serie.'
      break
    case 'subir_peso':
      nota = meta.pesoAnterior === 0
        ? `Llegaste al tope: agrega ${formatearKg(meta.salto)} kg de lastre y vuelve a empezar la secuencia.`
        : `Llegaste al tope: sube ${formatearKg(meta.salto)} kg (antes ${formatearKg(meta.pesoAnterior)} kg) y vuelve a empezar la secuencia.`
      break
    default:
      nota = 'La última vez no completaste el primer paso: repítelo.'
  }
  return { titulo, nota }
}
