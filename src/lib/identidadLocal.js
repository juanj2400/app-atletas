// =====================================================================
// src/lib/identidadLocal.js — recuerda QUIÉN es el usuario (perfil mínimo) para poder abrir la
// app sin internet. Es un dato chico y sincrónico, por eso va en localStorage (el resto del
// offline vive en IndexedDB, ver almacenLocal.js).
//
// No es una credencial: no guarda contraseñas ni tokens. Solo se usa si el navegador conserva
// además la sesión de Supabase (hayTokenGuardado), y se borra al cerrar sesión.
// =====================================================================
const CLAVE = 'myprogress:identidad'

export function guardarIdentidad(perfil) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ perfil, guardadoEn: Date.now() })) } catch { /* lleno o bloqueado */ }
}

export function leerIdentidad() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    const dato = crudo ? JSON.parse(crudo) : null
    return dato?.perfil?.id ? dato : null
  } catch { return null }
}

export function borrarIdentidad() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
}

// supabase-js guarda su sesión en localStorage como "sb-<proyecto>-auth-token". Si sigue ahí
// es que el usuario NO cerró sesión y el servidor no la invalidó (un error de red no la borra).
export function hayTokenGuardado() {
  try {
    const proyecto = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    return Boolean(localStorage.getItem(`sb-${proyecto}-auth-token`))
  } catch { return false }
}
