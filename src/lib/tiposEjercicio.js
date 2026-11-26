// =====================================================================
// src/lib/tiposEjercicio.js — clasificación de los ejercicios de la biblioteca.
// Solo los compuestos, de fuerza y de halterofilia tienen 1RM estimado; los
// aislados guardan únicamente sus mejores repeticiones con cada peso.
// Los mismos valores están en el CHECK de exercises.tipo_ejercicio (migración 15).
// =====================================================================
export const TIPOS_EJERCICIO = [
  { valor: 'compuesto', etiqueta: 'Compuesto (varias articulaciones)' },
  { valor: 'fuerza', etiqueta: 'Fuerza (sentadilla, banca, peso muerto...)' },
  { valor: 'halterofilia', etiqueta: 'Halterofilia (arranque, envión...)' },
  { valor: 'aislado', etiqueta: 'Aislado (una articulación)' },
]

// ¿Se estima el 1RM de este tipo? Todo menos el aislado.
export function aplica1RM(tipo) {
  return tipo !== 'aislado'
}

// Texto corto para listas: "Aislado · sin 1RM", "Fuerza · con 1RM"
export function textoTipo(tipo) {
  const nombre = { compuesto: 'Compuesto', fuerza: 'Fuerza', halterofilia: 'Halterofilia', aislado: 'Aislado' }[tipo] ?? 'Sin clasificar'
  return `${nombre} · ${aplica1RM(tipo) ? 'con' : 'sin'} 1RM`
}
