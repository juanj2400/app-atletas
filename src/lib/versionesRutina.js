// =====================================================================
// src/lib/versionesRutina.js — historial de periodos de la rutina (funciones puras).
//
// Una "foto" es el JSON que guarda la base de datos (función `foto_rutina`, migración 22):
//   { rutina_nombre, modo_hibrido, dias: [{ id, nombre, ejercicios: [{ id, exercise_id, nombre,
//     series, reps_min, reps_max, rpe_objetivo, pide_rpe, descanso_seg, ... }] }] }
// Aquí solo se leen y se comparan; no se toca la pantalla ni la base de datos.
// =====================================================================
import { textoReps, textoDescanso } from './rutinas'
import { formatearKg } from './progresion'
import { fechaLocalISO, formatearFechaCorta, formatearFechaConAnio } from './fechas'

// Todos los ejercicios de una foto en una sola lista, con el nombre de su día.
export function ejerciciosDeFoto(foto) {
  return (foto?.dias ?? []).flatMap((dia) =>
    (dia.ejercicios ?? []).map((e) => ({ ...e, dia_id: dia.id, dia_nombre: dia.nombre })),
  )
}

function textoProgresion(e) {
  if (e.progresion_tipo === 'doble') return `Rango de repeticiones (+${formatearKg(e.incremento_kg)} kg)`
  if (e.progresion_tipo === 'escalera') return `Fuerza simple (+${formatearKg(e.incremento_kg)} kg)`
  return 'Sin progresión'
}

const kgONada = (n, vacio) => (n === null || n === undefined ? vacio : `${formatearKg(Number(n))} kg`)

// Cada dato de un ejercicio que importa al comparar: [etiqueta, texto]. Si el texto cambia,
// hay un cambio que contar. Las notas se comparan pero no se copian (pueden ser largas).
function descripcion(e) {
  return [
    ['Series', String(e.series)],
    ['Repeticiones', textoReps(e)],
    ['RPE objetivo', e.pide_rpe === false ? 'no se pide' : (e.rpe_objetivo === null || e.rpe_objetivo === undefined ? 'sin objetivo' : String(e.rpe_objetivo))],
    ['Descanso', e.descanso_seg === null || e.descanso_seg === undefined ? 'sin definir' : textoDescanso(e.descanso_seg)],
    ['Peso sugerido', kgONada(e.peso_sugerido_kg, 'sin peso')],
    ['Progresión', textoProgresion(e)],
    ['Peso inicial', kgONada(e.peso_inicial_kg, 'sin peso')],
    ['Bloque', e.bloque === 'halterofilia' ? 'halterofilia' : 'musculación'],
    ['Día', e.dia_nombre],
  ]
}

// Escalera de fuerza simple: se compara aparte porque no cabe en un texto corto.
const clave = (x) => JSON.stringify(x ?? null)

// Compara dos fotos y devuelve la lista de cambios de `nueva` respecto a `anterior`:
//   { tipo: 'agregado' | 'quitado' | 'reemplazado' | 'modificado' | 'rutina', nombre, dia, lineas }
// Los ejercicios se emparejan por su `id` de ejercicio de rutina; si el entrenador cambia el
// ejercicio en el mismo renglón (mismo id, otro exercise_id), cuenta como "reemplazado".
export function compararFotos(anterior, nueva) {
  const cambios = []

  if (Boolean(anterior?.modo_hibrido) !== Boolean(nueva?.modo_hibrido)) {
    cambios.push({
      tipo: 'rutina',
      nombre: 'Modo híbrido',
      dia: null,
      lineas: [nueva?.modo_hibrido ? 'Se activó' : 'Se desactivó'],
    })
  }

  const antes = new Map(ejerciciosDeFoto(anterior).map((e) => [e.id, e]))
  const ahora = ejerciciosDeFoto(nueva)
  const idsAhora = new Set(ahora.map((e) => e.id))

  for (const e of ahora) {
    const previo = antes.get(e.id)
    if (!previo) {
      cambios.push({ tipo: 'agregado', nombre: e.nombre, dia: e.dia_nombre, lineas: [] })
      continue
    }
    const lineas = []
    const reemplazado = previo.exercise_id !== e.exercise_id
    if (reemplazado) lineas.push(`Ejercicio: ${previo.nombre} → ${e.nombre}`)

    const antesDesc = new Map(descripcion(previo))
    for (const [etiqueta, texto] of descripcion(e)) {
      if (antesDesc.get(etiqueta) !== texto) lineas.push(`${etiqueta}: ${antesDesc.get(etiqueta)} → ${texto}`)
    }
    if (previo.progresion_tipo === 'escalera' && e.progresion_tipo === 'escalera' && clave(previo.escalera) !== clave(e.escalera)) {
      lineas.push('Escalera de fuerza simple: cambió')
    }
    if ((previo.notas ?? '') !== (e.notas ?? '')) lineas.push('Notas del ejercicio: cambiaron')

    if (lineas.length > 0) {
      cambios.push({ tipo: reemplazado ? 'reemplazado' : 'modificado', nombre: e.nombre, dia: e.dia_nombre, lineas })
    }
  }

  for (const [id, e] of antes) {
    if (!idsAhora.has(id)) cambios.push({ tipo: 'quitado', nombre: e.nombre, dia: e.dia_nombre, lineas: [] })
  }
  return cambios
}

// El periodo inmediatamente anterior de la MISMA rutina (null si es el primero o si la
// rutina ya se eliminó: entonces no hay forma segura de emparejarlos).
export function periodoAnterior(version, versiones) {
  if (!version.routine_id) return null
  return versiones.find((v) => v.routine_id === version.routine_id && v.numero === version.numero - 1) ?? null
}

// "2 nov – 23 nov 2026" o "9 nov 2026" (fechas locales del celular).
export function textoRangoPeriodo(desde, hasta) {
  const a = fechaLocalISO(new Date(desde))
  const b = fechaLocalISO(new Date(hasta))
  return a === b ? formatearFechaConAnio(a) : `${formatearFechaCorta(a)} – ${formatearFechaConAnio(b)}`
}

// Lo que hizo el atleta en un ejercicio durante un periodo (fila de `resumen_periodo_rutina`):
// "6 series en 2 días · mejor: 105 kg × 5"
export function textoActividad(fila) {
  const series = Number(fila.series)
  const dias = Number(fila.dias)
  const peso = Number(fila.peso_max_kg)
  const mejor = peso > 0 ? `${formatearKg(peso)} kg × ${fila.reps_peso_max}` : `peso corporal × ${fila.reps_peso_max}`
  return `${series} ${series === 1 ? 'serie' : 'series'} en ${dias} ${dias === 1 ? 'día' : 'días'} · mejor: ${mejor}`
}
