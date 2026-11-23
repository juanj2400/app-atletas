// =====================================================================
// src/lib/ciclos.js — lógica pura de macrociclos y mesociclos.
//
// macrociclo = bloque grande (ej. "Fuerza 2026", varios meses)
// mesociclo  = bloque dentro del macro (ej. "Acumulación", 4 semanas)
// Las fechas son texto "YYYY-MM-DD" (columnas `date` de Postgres) y se comparan
// como texto. "Hoy" se calcula en el celular (hora local), NO en UTC: por eso este
// cálculo se hace aquí y no en la vista v_current_training_cycle de la base de datos.
// =====================================================================
import { formatearFechaCorta } from './fechas'

export const FASES_SUGERIDAS = ['Acumulación', 'Intensificación', 'Realización', 'Descarga', 'Transición']

const DIA_MS = 24 * 60 * 60 * 1000

// Días entre dos fechas "YYYY-MM-DD". Se calcula con Date.UTC para que el horario de
// verano o la zona horaria no alteren el resultado.
export function diasEntre(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS)
}

export const semanasTotales = (ciclo) => Math.ceil((diasEntre(ciclo.fecha_inicio, ciclo.fecha_fin) + 1) / 7)
export const semanaActual = (ciclo, hoy) => Math.floor(diasEntre(ciclo.fecha_inicio, hoy) / 7) + 1
export const estaVigente = (ciclo, hoy) => ciclo.fecha_inicio <= hoy && hoy <= ciclo.fecha_fin

// El mesociclo en curso y su macrociclo. Cualquiera de los dos puede ser null.
export function cicloVigente(ciclos, hoy) {
  const meso = ciclos.find((c) => c.nivel === 'mesociclo' && estaVigente(c, hoy)) ?? null
  const macro = meso?.parent_id
    ? ciclos.find((c) => c.id === meso.parent_id) ?? null
    : ciclos.find((c) => c.nivel === 'macrociclo' && estaVigente(c, hoy)) ?? null
  return { macro, meso }
}

const seSolapan = (a, b) => a.fecha_inicio <= b.fecha_fin && b.fecha_inicio <= a.fecha_fin

// Valida un ciclo ANTES de guardarlo. Devuelve un mensaje de error o null si está bien.
// `datos`: { nivel, nombre, fecha_inicio, fecha_fin, parent_id }
// `ciclos`: todos los ciclos del atleta. `editandoId`: el que se está editando (para ignorarlo).
export function validarCiclo(datos, ciclos, editandoId = null) {
  const { nivel, nombre, fecha_inicio, fecha_fin, parent_id } = datos
  if (!nombre.trim()) return 'Escribe un nombre.'
  if (nombre.trim().length > 80) return 'El nombre es demasiado largo (máximo 80 caracteres).'
  if (!fecha_inicio || !fecha_fin) return 'Elige la fecha de inicio y la de fin.'
  if (fecha_fin < fecha_inicio) return 'La fecha de fin no puede ser anterior a la de inicio.'

  const otros = ciclos.filter((c) => c.id !== editandoId)
  const nuevo = { fecha_inicio, fecha_fin }

  if (nivel === 'mesociclo') {
    const macro = otros.find((c) => c.id === parent_id && c.nivel === 'macrociclo')
    if (!macro) return 'Elige el macrociclo al que pertenece.'
    if (fecha_inicio < macro.fecha_inicio || fecha_fin > macro.fecha_fin) {
      return `El mesociclo debe quedar dentro del macrociclo (${formatearFechaCorta(macro.fecha_inicio)} a ${formatearFechaCorta(macro.fecha_fin)}).`
    }
    const choque = otros.find((c) => c.nivel === 'mesociclo' && c.parent_id === parent_id && seSolapan(c, nuevo))
    if (choque) return `Se solapa con el mesociclo "${choque.nombre}".`
  } else {
    const choque = otros.find((c) => c.nivel === 'macrociclo' && seSolapan(c, nuevo))
    if (choque) return `Se solapa con el macrociclo "${choque.nombre}".`
    if (editandoId) {
      const fuera = otros.find((c) => c.parent_id === editandoId && (c.fecha_inicio < fecha_inicio || c.fecha_fin > fecha_fin))
      if (fuera) return `El mesociclo "${fuera.nombre}" quedaría fuera de estas fechas.`
    }
  }
  return null
}
