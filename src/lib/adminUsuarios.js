// =====================================================================
// src/lib/adminUsuarios.js — habla con la Edge Function "admin-usuarios" (crear usuarios,
// cambiar contraseñas, activar/desactivar acceso) y copia texto al portapapeles.
//
// Por qué una Edge Function: crear cuentas y cambiar contraseñas exige la clave service_role,
// que JAMÁS puede estar en el frontend. La función comprueba que quien llama sea admin.
// Devuelve siempre { data } o { error } (texto en español, nunca el error crudo de Supabase).
// =====================================================================
import { supabase } from './supabase'

async function mensajeDeError(error) {
  const respuesta = error?.context
  // Respuesta de nuestra función: { error: "mensaje ya redactado en español" }.
  try {
    if (respuesta && typeof respuesta.json === 'function') {
      const cuerpo = await respuesta.json()
      if (typeof cuerpo?.error === 'string') return cuerpo.error
    }
  } catch {
    // el cuerpo no era JSON: seguimos con los mensajes genéricos
  }
  if (respuesta?.status === 404) return 'La función de usuarios aún no está desplegada en Supabase.'
  if (respuesta?.status === 401) return 'Tu sesión venció. Cierra sesión y vuelve a entrar.'
  if (error?.name === 'FunctionsFetchError') return 'No hay conexión. Revisa tu internet e intenta de nuevo.'
  return 'No se pudo completar la acción. Intenta de nuevo.'
}

export async function llamarAdminUsuarios(cuerpo) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: cuerpo })
  if (error) return { error: await mensajeDeError(error) }
  if (data?.error) return { error: data.error }
  return { data }
}

// true si se pudo copiar. Puede fallar (permiso del navegador o conexión no segura).
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
