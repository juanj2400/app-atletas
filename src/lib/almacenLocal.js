// =====================================================================
// src/lib/almacenLocal.js — almacenamiento local del celular (IndexedDB), sin dependencias.
//
// Dos "cajones" en una sola base (`myprogress-offline`):
//   - cache: lo último que se vio con internet (rutina, plan nutricional...). Una fila por
//            usuario y clave: "<userId>|<clave>". Así los datos de un atleta nunca se mezclan
//            con los de otro que use el mismo celular.
//   - cola:  registros hechos SIN señal que esperan subir a Supabase (check-in, series...).
//            `seq` se autonumera: es el ORDEN de subida. El índice único (userId, clave)
//            impide guardar dos veces el mismo registro (prevención de duplicados).
//
// Todo es "mejor esfuerzo": si el navegador no ofrece IndexedDB (modo privado, por ejemplo),
// el caché simplemente no guarda nada y la cola avisa con un error en vez de romper la app.
// =====================================================================
const NOMBRE_BD = 'myprogress-offline'
const VERSION = 1
let promesaBD = null

function abrir() {
  if (!promesaBD) {
    promesaBD = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('sin_indexeddb'))
      const peticion = indexedDB.open(NOMBRE_BD, VERSION)
      peticion.onupgradeneeded = () => {
        const bd = peticion.result
        bd.createObjectStore('cache', { keyPath: 'k' })
        const cola = bd.createObjectStore('cola', { keyPath: 'seq', autoIncrement: true })
        cola.createIndex('porUsuario', 'userId')
        cola.createIndex('porClave', ['userId', 'clave'], { unique: true })
      }
      peticion.onsuccess = () => resolve(peticion.result)
      peticion.onerror = () => reject(peticion.error)
    }).catch((e) => { promesaBD = null; throw e })
  }
  return promesaBD
}

// Ejecuta una operación en una transacción y devuelve el resultado de la petición.
function operar(almacen, modo, accion) {
  return abrir().then((bd) => new Promise((resolve, reject) => {
    const tx = bd.transaction(almacen, modo)
    let peticion
    try { peticion = accion(tx.objectStore(almacen)) } catch (e) { return reject(e) }
    tx.oncomplete = () => resolve(peticion ? peticion.result : undefined)
    tx.onerror = () => reject(tx.error ?? peticion?.error)
    tx.onabort = () => reject(tx.error)
  }))
}

// Pide al navegador que no borre estos datos por falta de espacio (en iPhone, Safari puede
// limpiar el almacenamiento de webs que no se usan en una semana; instalada como app, no).
export function pedirPersistencia() {
  try { navigator.storage?.persist?.().catch(() => {}) } catch { /* sin soporte: no pasa nada */ }
}

// ---------------------------------------------------------------------
// Caché de lectura
// ---------------------------------------------------------------------
export async function guardarCache(userId, clave, valor) {
  try {
    await operar('cache', 'readwrite', (a) => a.put({ k: `${userId}|${clave}`, valor, guardadoEn: Date.now() }))
    return true
  } catch { return false }
}

// { valor, guardadoEn } o null
export async function leerCache(userId, clave) {
  try {
    const fila = await operar('cache', 'readonly', (a) => a.get(`${userId}|${clave}`))
    return fila ? { valor: fila.valor, guardadoEn: fila.guardadoEn } : null
  } catch { return null }
}

// Borra TODO el caché de un usuario (al cerrar sesión). La cola NO se toca.
export async function limpiarCache(userId) {
  try {
    await operar('cache', 'readwrite', (a) => a.delete(IDBKeyRange.bound(`${userId}|`, `${userId}|\uffff`)))
  } catch { /* nada que limpiar */ }
}

// ---------------------------------------------------------------------
// Cola de registros pendientes
// ---------------------------------------------------------------------

// Guarda un registro. Si ya había uno con la misma clave devuelve { duplicado: true } y no
// agrega nada. Lanza error si no hay almacenamiento disponible.
export async function agregarACola(item) {
  try {
    const seq = await operar('cola', 'readwrite', (a) => a.add(item))
    return { duplicado: false, seq }
  } catch (e) {
    if (e?.name === 'ConstraintError') return { duplicado: true }
    throw e
  }
}

// Registros de un usuario en orden de creación (seq ascendente).
export async function listarCola(userId) {
  const filas = await operar('cola', 'readonly', (a) => a.index('porUsuario').getAll(userId))
  return [...filas].sort((x, y) => x.seq - y.seq)
}

export const actualizarEnCola = (item) => operar('cola', 'readwrite', (a) => a.put(item))
export const quitarDeCola = (seq) => operar('cola', 'readwrite', (a) => a.delete(seq))

// Quita el registro con esa clave (true si existía).
export async function quitarPorClave(userId, clave) {
  const fila = await operar('cola', 'readonly', (a) => a.index('porClave').get([userId, clave]))
  if (!fila) return false
  await quitarDeCola(fila.seq)
  return true
}
