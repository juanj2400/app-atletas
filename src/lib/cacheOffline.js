// =====================================================================
// src/lib/cacheOffline.js — "lee de internet y, si no hay, de lo último que guardé".
//
//   const r = await cargarConCache(userId, 'nutricion', async () => {
//     ...consultas a Supabase...
//     return hayError ? { error } : { plan, comidas }      // los datos o { error }
//   })
//   r.error                -> falló y no hay nada guardado (r.error.sinCache = no hay copia)
//   r.desdeCache / r.guardadoEn -> son datos guardados (sin conexión)
//
// Solo se guardan respuestas EXITOSAS. Sin conexión (o en "sesión local") ni siquiera se
// intenta la consulta. Los datos viajan por clave de usuario: nunca se cruzan entre atletas.
// =====================================================================
import { guardarCache, leerCache } from './almacenLocal'
import { enLinea, esErrorDeRed } from './conexion'

export async function cargarConCache(userId, clave, cargar) {
  let res
  if (enLinea()) {
    try { res = await cargar() } catch (e) { res = { error: e } }
    if (!res.error) {
      await guardarCache(userId, clave, res)
      return { ...res, desdeCache: false }
    }
    if (!esErrorDeRed(res.error)) return res // la base rechazó algo: no se oculta con datos viejos
  }
  const guardado = await leerCache(userId, clave)
  if (guardado) return { ...guardado.valor, desdeCache: true, guardadoEn: guardado.guardadoEn }
  return { error: { message: 'Sin conexión y sin datos guardados', sinCache: true } }
}
