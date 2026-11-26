// =====================================================================
// src/lib/bloques.js — rutina híbrida: bloque de halterofilia + bloque de musculación.
// Funciones puras. Cuando la rutina NO es híbrida (routines.modo_hibrido = false)
// todo funciona como siempre: una sola lista, sin bloques.
// =====================================================================

// Halterofilia va primero: se entrena antes, con el atleta fresco y la técnica limpia.
export const BLOQUES = [
  { valor: 'halterofilia', titulo: 'Halterofilia', corto: 'Halterofilia' },
  { valor: 'musculacion', titulo: 'Musculación', corto: 'Musculación' },
]

export const bloqueDe = (fila) => (fila.bloque === 'halterofilia' ? 'halterofilia' : 'musculacion')

// Agrupa los ejercicios de un día. No muta la lista original.
// Híbrida: [{ valor, titulo, filas }] solo con los bloques que tienen ejercicios, cada uno
// ordenado por `orden`. No híbrida: un único grupo sin título (valor null).
export function agruparPorBloque(filas, hibrido) {
  const ordenadas = [...filas].sort((a, b) => a.orden - b.orden)
  if (!hibrido) return [{ valor: null, titulo: null, filas: ordenadas }]
  return BLOQUES
    .map((b) => ({ valor: b.valor, titulo: b.titulo, filas: ordenadas.filter((f) => bloqueDe(f) === b.valor) }))
    .filter((g) => g.filas.length > 0)
}

// "2 de halterofilia + 5 de musculación" (solo los bloques que tienen ejercicios)
export function textoBloques(filas) {
  const partes = BLOQUES
    .map((b) => ({ b, n: filas.filter((f) => bloqueDe(f) === b.valor).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} de ${x.b.titulo.toLowerCase()}`)
  return partes.join(' + ')
}

// Ejercicios de una rutina separados por disciplina y agrupados por día, para la gestión de
// cargas del entrenador. Devuelve { halterofilia: [...], musculacion: [...] }; cada lista es
// [{ diaId, dia, filas }] con los días en orden y solo los días que tienen ejercicios de esa
// disciplina. Si la rutina NO es híbrida, todo cuenta como musculación.
export function cargasPorDisciplina(rutina) {
  const hibrido = Boolean(rutina.modo_hibrido)
  const salida = { halterofilia: [], musculacion: [] }
  const dias = [...rutina.routine_days].sort((a, b) => a.orden - b.orden)
  for (const d of dias) {
    const filas = [...d.routine_exercises].sort((a, b) => a.orden - b.orden)
    for (const b of BLOQUES) {
      const delBloque = filas.filter((f) => (hibrido ? bloqueDe(f) : 'musculacion') === b.valor)
      if (delBloque.length > 0) salida[b.valor].push({ diaId: d.id, dia: d.nombre, filas: delBloque })
    }
  }
  return salida
}
