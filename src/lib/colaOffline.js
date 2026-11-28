// =====================================================================
// src/lib/colaOffline.js — cola de registros del atleta que se hacen SIN señal.
//
// Qué se encola (cada tipo = una tabla de Supabase):
//   checkin -> daily_check_ins        serie  -> routine_logs
//   cierre  -> exercise_closures      dia    -> routine_day_completions
//
// Reglas que hacen segura la subida diferida:
//   - El registro se guarda con TODOS sus datos finales: el `id` (series) y la fecha/hora
//     (`fecha` local YYYY-MM-DD, `realizado_en`) los genera el celular al registrar. Así, al
//     subir horas después, la base de datos los ve con su hora REAL (el trigger
//     `bloquear_dia_realizado` y la semana lunes–domingo usan `realizado_en`, no la de subida).
//   - Es IDEMPOTENTE: si el registro ya existía (error 23505 "ya existe": por un reintento o
//     porque se hizo desde otro dispositivo), se da por subido. Nunca se duplica.
//   - Sin duplicados en la cola: la `clave` de cada registro es única (almacenLocal.js).
//   - Se sube EN ORDEN. Si se cae la red a mitad, se detiene y conserva el resto en su sitio.
//   - Si la base de datos RECHAZA un registro (por una regla, no por red), queda marcado
//     `error` con un mensaje en español y no bloquea a los demás.
// =====================================================================
import { supabase } from './supabase'
import {
  actualizarEnCola, agregarACola, guardarCache, listarCola, quitarDeCola, quitarPorClave,
} from './almacenLocal'
import { enLinea, esErrorDeRed } from './conexion'
import { formatearFechaCorta } from './fechas'

export const TABLAS = {
  checkin: 'daily_check_ins',
  serie: 'routine_logs',
  cierre: 'exercise_closures',
  dia: 'routine_day_completions',
}

// Clave única de cada registro: dos registros con la misma clave son "el mismo".
export const CLAVES = {
  checkin: (p) => `checkin:${p.fecha}`,
  serie: (p) => `serie:${p.sesion_id}:${p.routine_exercise_id}:${p.numero_serie}`,
  cierre: (p) => `cierre:${p.routine_exercise_id}:${p.fecha}`,
  dia: (p) => `dia:${p.routine_day_id}:${p.semana_inicio}`,
}

// ---------------------------------------------------------------------
// Avisos a la pantalla (useCola.js se suscribe)
// ---------------------------------------------------------------------
const oyentes = new Set()
export function suscribirCola(funcion) {
  oyentes.add(funcion)
  return () => oyentes.delete(funcion)
}
const avisar = (evento) => oyentes.forEach((f) => { try { f(evento) } catch { /* un oyente roto no frena a los demás */ } })

let sincronizando = false
export const estaSincronizando = () => sincronizando

// ---------------------------------------------------------------------
// Subir UN registro
// ---------------------------------------------------------------------
// 'ok' (subido o ya existía) | 'reintentar' (sin red / servidor caído) | 'rechazado' (regla de la BD)
export function clasificarRespuesta({ error, status }) {
  if (!error) return 'ok'
  if (error.code === '23505') return 'ok'
  if (esErrorDeRed(error) || status === 0) return 'reintentar'
  if (status === 401 || status === 408 || status === 429 || status >= 500) return 'reintentar'
  return 'rechazado'
}

export async function ejecutarItem(item, cliente = supabase) {
  const respuesta = await cliente.from(TABLAS[item.tipo]).insert(item.payload)
  return { resultado: clasificarRespuesta(respuesta), error: respuesta.error }
}

// Mensaje en español para el atleta cuando la base de datos rechaza un registro guardado.
export function mensajeRechazo(item, error) {
  if (error?.code === 'P0001' && error.message) return error.message // ya viene redactado en español
  if (item.tipo === 'checkin') {
    return `El check-in del ${formatearFechaCorta(item.fecha)} ya no se pudo subir: solo se aceptan check-ins de ayer, hoy o mañana.`
  }
  if (error?.code === '42501' || error?.code === '23503') {
    return 'Tu entrenador cambió o desactivó la rutina, y este registro ya no aplica.'
  }
  return 'El servidor no aceptó este registro.'
}

// ---------------------------------------------------------------------
// Registrar: guardar YA si hay internet, o dejar en la cola
// ---------------------------------------------------------------------
// item: { userId, tipo, fecha, payload }.  Devuelve { estado, ... }:
//   'subido'    se guardó en Supabase ahora mismo
//   'en_cola'   quedó en el teléfono; se subirá solo al volver la señal (duplicado: true si ya estaba)
//   'rechazado' la base de datos lo rechazó (error)
//   'sin_almacen' no hay dónde guardar sin conexión (error)
export async function registrar({ userId, tipo, fecha, payload }) {
  const item = {
    userId, tipo, fecha, payload,
    clave: CLAVES[tipo](payload),
    creadoEn: Date.now(),
    estado: 'pendiente', intentos: 0, error: null,
  }

  let hayPendientes = false
  try {
    hayPendientes = (await listarCola(userId)).some((i) => i.estado === 'pendiente')
  } catch { /* sin almacenamiento local: solo se puede guardar directo */ }

  // Con internet y la cola vacía se guarda directo (como siempre). Si ya hay algo esperando,
  // este va DETRÁS para respetar el orden (p. ej. no subir la serie 3 antes que la 2).
  if (enLinea() && !hayPendientes) {
    const r = await ejecutarItem(item)
    if (r.resultado === 'ok') return { estado: 'subido' }
    if (r.resultado === 'rechazado') return { estado: 'rechazado', error: r.error }
    // 'reintentar' (la señal se cayó justo ahora): sigue a la cola
  }

  try {
    const { duplicado } = await agregarACola(item)
    avisar({ tipo: 'cola' })
    if (enLinea()) sincronizarCola(userId) // en segundo plano, sin esperar
    return { estado: 'en_cola', duplicado }
  } catch (e) {
    return { estado: 'sin_almacen', error: e }
  }
}

// ---------------------------------------------------------------------
// Sincronizar toda la cola de un usuario
// ---------------------------------------------------------------------
async function correr(userId, cliente) {
  let subidos = 0
  const pendientes = (await listarCola(userId)).filter((i) => i.estado === 'pendiente')
  for (const item of pendientes) {
    const r = await ejecutarItem(item, cliente)
    if (r.resultado === 'ok') {
      await quitarDeCola(item.seq)
      subidos += 1
      // Que la copia guardada del día sepa que el check-in ya está hecho (si luego se abre sin red).
      if (item.tipo === 'checkin') await guardarCache(userId, `checkin:${item.payload.fecha}`, { hecho: true })
    } else if (r.resultado === 'rechazado') {
      await actualizarEnCola({ ...item, estado: 'error', error: mensajeRechazo(item, r.error), intentos: item.intentos + 1 })
    } else {
      await actualizarEnCola({ ...item, intentos: item.intentos + 1 })
      break // sin red: se conserva el orden y se reintenta más tarde
    }
  }
  return subidos
}

// Sube lo pendiente en orden. Seguro de llamar muchas veces: si ya hay una subida en curso (en
// esta pestaña o en otra, vía navigator.locks) no hace nada. Devuelve { subidos }.
export async function sincronizarCola(userId, cliente = supabase) {
  if (sincronizando || !enLinea()) return { subidos: 0 }
  sincronizando = true
  avisar({ tipo: 'inicio' })
  let subidos = 0
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      subidos = await navigator.locks.request('myprogress-sync', { ifAvailable: true }, (candado) =>
        candado ? correr(userId, cliente) : 0)
    } else {
      subidos = await correr(userId, cliente)
    }
  } catch {
    // IndexedDB no disponible o caído: no hay nada que subir ahora
  } finally {
    sincronizando = false
    avisar({ tipo: 'fin', subidos })
  }
  return { subidos }
}

// ---------------------------------------------------------------------
// Consultas y limpieza
// ---------------------------------------------------------------------
// { pendientes, errores, primerError } — lo que muestra el indicador.
export async function resumenCola(userId) {
  try {
    const cola = await listarCola(userId)
    const conError = cola.filter((i) => i.estado === 'error')
    return {
      pendientes: cola.filter((i) => i.estado === 'pendiente').length,
      errores: conError.length,
      primerError: conError[0]?.error ?? null,
    }
  } catch {
    return { pendientes: 0, errores: 0, primerError: null }
  }
}

// Registros pendientes (y con error) de un usuario, en orden. [] si no hay almacenamiento.
export async function leerCola(userId) {
  try { return await listarCola(userId) } catch { return [] }
}

// El atleta borra una serie/cierre que aún NO se subió: basta quitarla de la cola.
export async function quitarPendiente(userId, clave) {
  try {
    const quitado = await quitarPorClave(userId, clave)
    if (quitado) avisar({ tipo: 'cola' })
    return quitado
  } catch { return false }
}

// Descarta los registros que la base de datos rechazó (el atleta los vio y decidió soltarlos).
export async function descartarConError(userId) {
  try {
    const cola = await listarCola(userId)
    for (const i of cola.filter((x) => x.estado === 'error')) await quitarDeCola(i.seq)
    avisar({ tipo: 'cola' })
  } catch { /* nada que descartar */ }
}
