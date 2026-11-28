// =====================================================================
// src/lib/conexion.js — "¿hay internet?" y "¿este error es de red?".
//
// navigator.onLine solo dice si el teléfono tiene una red conectada, NO si hay internet de
// verdad (una señal débil o un wifi sin salida dan onLine = true). Por eso, además, los
// errores de fetch se reconocen por su mensaje (esErrorDeRed) y se tratan igual que estar
// sin conexión.
//
// "Sesión local": si el atleta abre la app sin red con el token vencido, AuthProvider lo deja
// entrar con su perfil guardado, pero Supabase aún no lo reconoce (cualquier consulta iría
// sin permiso y devolvería listas vacías). Mientras dure, se trata como SIN conexión.
// =====================================================================
let sesionLocal = false
const oyentes = new Set()
const avisar = () => oyentes.forEach((f) => f())

export function marcarSesionLocal(valor) {
  if (sesionLocal === valor) return
  sesionLocal = valor
  avisar()
}

// true si se puede hablar con Supabase ahora mismo (a lo mejor).
export function enLinea() {
  if (sesionLocal) return false
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

// Para useSyncExternalStore (useConexion.js): se avisa al cambiar la red o la sesión local.
export function suscribirConexion(callback) {
  oyentes.add(callback)
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    oyentes.delete(callback)
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const PATRON_DE_RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed|internet connection|timed? ?out|aborted/i

// ¿Falló por falta de conexión (y no porque la base de datos rechazó algo)? Los errores de
// Postgres/PostgREST traen `code`; los de fetch no.
export function esErrorDeRed(error) {
  if (!error) return false
  if (error.name === 'FunctionsFetchError' || error.name === 'AuthRetryableFetchError') return true
  if (error.code) return false
  return !enLinea() || PATRON_DE_RED.test(String(error.message ?? error))
}

// Para acciones que SIEMPRE necesitan internet (administración, IA): devuelve el aviso en
// español si no hay conexión, o null si se puede continuar.
export function exigirConexion(accion = 'esta acción') {
  return enLinea() ? null : `Sin conexión: ${accion} necesita internet. Vuelve a intentarlo cuando tengas señal.`
}
