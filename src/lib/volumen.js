// =====================================================================
// src/lib/volumen.js — calcula las series SEMANALES por músculo de una rutina.
//
// Regla: cada ejercicio trabaja varios músculos, cada uno con un factor:
//   factor 1   -> músculo principal   (una serie cuenta como 1)
//   factor 0.5 -> músculo secundario  (una serie cuenta como 0.5)
// Ejemplo: press de banca 4 series -> pecho +4 (directas), tríceps +2 (indirectas).
//
// SUPUESTO: cada día de la rutina se entrena UNA vez por semana. Si algún día
// se repite, habría que contarlo dos veces (mejora futura).
//
// Es una función "pura": recibe datos y devuelve un resultado, sin tocar la
// pantalla ni la base de datos. Por eso es fácil de comprobar.
// =====================================================================
const redondear = (n) => Math.round(n * 10) / 10

// dias:     [{ routine_exercises: [{ series, exercise_id, exercises: { nombre } }] }]
// musculos: filas de exercise_muscles  [{ exercise_id, muscle, factor }]
// grupos:   catálogo ordenado           [{ codigo, nombre }]
export function calcularVolumen({ dias, musculos, grupos }) {
  // Índice: ejercicio -> sus músculos. Un Map permite buscar al instante por clave.
  const porEjercicio = new Map()
  for (const m of musculos) {
    const lista = porEjercicio.get(m.exercise_id) ?? []
    lista.push({ muscle: m.muscle, factor: Number(m.factor) })
    porEjercicio.set(m.exercise_id, lista)
  }

  const acumulado = {} // { pecho: { directas, indirectas }, ... }
  const sinMusculos = new Set() // ejercicios que aún no tienen músculos asignados

  for (const dia of dias) {
    for (const fila of dia.routine_exercises) {
      const asignados = porEjercicio.get(fila.exercise_id)
      if (!asignados) {
        sinMusculos.add(fila.exercises?.nombre ?? 'Ejercicio')
        continue
      }
      for (const { muscle, factor } of asignados) {
        const a = acumulado[muscle] ?? { directas: 0, indirectas: 0 }
        if (factor >= 1) a.directas += fila.series * factor
        else a.indirectas += fila.series * factor
        acumulado[muscle] = a
      }
    }
  }

  // Se devuelven TODOS los músculos del catálogo (también los que están en 0):
  // ver qué músculo no se trabaja es tan útil como ver cuáles sí.
  const filas = grupos.map((g) => {
    const a = acumulado[g.codigo] ?? { directas: 0, indirectas: 0 }
    return {
      codigo: g.codigo,
      nombre: g.nombre,
      directas: redondear(a.directas),
      indirectas: redondear(a.indirectas),
      total: redondear(a.directas + a.indirectas),
    }
  })

  return { filas, sinMusculos: [...sinMusculos].sort() }
}
