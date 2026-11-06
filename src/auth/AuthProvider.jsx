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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sesionLista, setSesionLista] = useState(false) // ¿ya sabemos si hay sesión?
  const [perfil, setPerfil] = useState(null)
  const [perfilListo, setPerfilListo] = useState(false)

  // 1) Escuchar los cambios de sesión (entrar, salir, token renovado).
  //    Supabase guarda la sesión (un JWT) en el almacenamiento del navegador
  //    y la renueva sola. Al suscribirnos, dispara de inmediato el evento
  //    INITIAL_SESSION con la sesión guardada (si existe).
  //    REGLA DE ORO: dentro de este callback NO se hacen consultas a Supabase
  //    (puede bloquearse). Solo guardamos la sesión; la consulta va en el paso 2.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion)
      setSesionLista(true)
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
    iniciarSesion: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    cerrarSesion: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// Hook para usar el contexto: const { perfil, cerrarSesion } = useAuth()
export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
