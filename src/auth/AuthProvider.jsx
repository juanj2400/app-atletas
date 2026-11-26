// =====================================================================
// src/auth/AuthProvider.jsx — "¿quién está usando la app y qué rol tiene?"
//
// Problema: muchas pantallas necesitan saber quién inició sesión. Pasar esa
// información de componente en componente sería un caos. React ofrece el
// "Context": un almacén global al que cualquier componente accede con un hook.
//   - <AuthProvider> envuelve la app y guarda la sesión + el perfil.
//   - useAuth() lo lee desde cualquier pantalla.
//
// Dos cosas distintas (no confundirlas):
//   - session: viene de Supabase Auth (tabla interna auth.users). Dice QUIÉN eres.
//   - perfil:  viene de NUESTRA tabla public.profiles. Dice tu ROL y tu nombre.
// =====================================================================
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// ¿Se abrió la app desde el enlace del correo de "recuperar contraseña"? Supabase pone
// "type=recovery" en la URL y la borra enseguida; se lee aquí, al cargar el módulo (antes de
// que la borre), porque el evento PASSWORD_RECOVERY puede dispararse antes de que React
// empiece a escuchar. Así, aunque el enlace aterrice en otra página, se manda a /restablecer.
const ABIERTA_POR_ENLACE_DE_RECUPERACION =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sesionLista, setSesionLista] = useState(false) // ¿ya sabemos si hay sesión?
  const [perfil, setPerfil] = useState(null)
  const [perfilListo, setPerfilListo] = useState(false)
  const [recuperando, setRecuperando] = useState(ABIERTA_POR_ENLACE_DE_RECUPERACION)

  // 1) Escuchar los cambios de sesión (entrar, salir, token renovado).
  //    Supabase guarda la sesión (un JWT) en el almacenamiento del navegador
  //    y la renueva sola. Al suscribirnos, dispara de inmediato el evento
  //    INITIAL_SESSION con la sesión guardada (si existe).
  //    REGLA DE ORO: dentro de este callback NO se hacen consultas a Supabase
  //    (puede bloquearse). Solo guardamos la sesión; la consulta va en el paso 2.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      setSession(nuevaSesion)
      setSesionLista(true)
      // También solo guarda estado (sin consultas): App.jsx lleva a /restablecer.
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    // Función de limpieza: React la ejecuta al desmontar para evitar fugas.
    return () => data.subscription.unsubscribe()
  }, [])

  // 2) Cuando cambia el usuario, cargar su perfil (rol y nombre).
  //    Dependemos del ID (un texto) y no del objeto session entero, para no
  //    repetir la consulta cada vez que el token se renueva.
  const userId = session?.user?.id
  useEffect(() => {
    if (!sesionLista) return
    if (!userId) {
      setPerfil(null)
      setPerfilListo(true)
      return
    }
    let cancelado = false // evita guardar un resultado "viejo" si el usuario cambió
    setPerfilListo(false)
    supabase
      .from('profiles')
      .select('id, rol, nombre_completo, email')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return
        setPerfil(error ? null : data)
        setPerfilListo(true)
      })
    return () => { cancelado = true }
  }, [sesionLista, userId])

  const valor = {
    session,
    perfil,
    cargando: !sesionLista || !perfilListo,
    recuperando, // true mientras falta elegir la contraseña nueva tras abrir el enlace del correo
    iniciarSesion: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    cerrarSesion: () => supabase.auth.signOut(),
    // El enlace del correo regresa a /restablecer. Esa dirección debe estar permitida en
    // Supabase (Authentication > URL Configuration > Redirect URLs).
    recuperarContrasena: (email) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/restablecer` }),
    cambiarContrasena: async (nueva) => {
      const resultado = await supabase.auth.updateUser({ password: nueva })
      if (!resultado.error) setRecuperando(false)
      return resultado
    },
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// Hook para usar el contexto: const { perfil, cerrarSesion } = useAuth()
export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
