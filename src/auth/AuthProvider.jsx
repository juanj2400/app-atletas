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
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { esErrorDeRed, marcarSesionLocal } from '../lib/conexion'
import { borrarIdentidad, guardarIdentidad, hayTokenGuardado, leerIdentidad } from '../lib/identidadLocal'
import { pedirPersistencia, limpiarCache } from '../lib/almacenLocal'
import { resumenCola } from '../lib/colaOffline'

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
  const usuarioCargado = useRef(null) // a qué usuario pertenece el perfil que ya cargamos

  // 1) Escuchar los cambios de sesión (entrar, salir, token renovado).
  //    Supabase guarda la sesión (un JWT) en el almacenamiento del navegador
  //    y la renueva sola. Al suscribirnos, dispara de inmediato el evento
  //    INITIAL_SESSION con la sesión guardada (si existe).
  //    REGLA DE ORO: dentro de este callback NO se hacen consultas a Supabase
  //    (puede bloquearse). Solo guardamos la sesión; la consulta va en el paso 2.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      // Abrir la app SIN red con el token vencido (dura ~1 h): Supabase no puede renovarlo y
      // entrega sesión vacía, aunque el usuario nunca cerró sesión. Si recordamos quién es y su
      // sesión sigue guardada en el teléfono, lo dejamos entrar en "sesión local" (usa los datos
      // guardados y la cola). En cuanto vuelva el internet, Supabase renueva y llega la sesión real.
      // (Esto solo guarda estado: ninguna consulta dentro del callback.)
      if (evento === 'INITIAL_SESSION' && !nuevaSesion) {
        const identidad = leerIdentidad()
        if (identidad && hayTokenGuardado()) {
          setSession({ user: { id: identidad.perfil.id }, local: true })
          setSesionLista(true)
          return
        }
      }
      if (evento === 'SIGNED_OUT') borrarIdentidad()
      setSession(nuevaSesion)
      setSesionLista(true)
      // También solo guarda estado (sin consultas): App.jsx lleva a /restablecer.
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    // Función de limpieza: React la ejecuta al desmontar para evitar fugas.
    return () => data.subscription.unsubscribe()
  }, [])

  // La sesión local no es una sesión real: mientras dure, la app se comporta como "sin conexión".
  const sesionLocal = Boolean(session?.local)
  useEffect(() => {
    marcarSesionLocal(sesionLocal)
    if (!sesionLocal) return
    // Intentar renovar la sesión real cuando haya red (al volver el internet o a los pocos segundos).
    const renovar = () => { if (navigator.onLine) supabase.auth.getSession() }
    window.addEventListener('online', renovar)
    const intervalo = setInterval(renovar, 15000)
    return () => { window.removeEventListener('online', renovar); clearInterval(intervalo) }
  }, [sesionLocal])
  useEffect(() => { pedirPersistencia() }, []) // que el navegador no borre los datos guardados

  // 2) Cuando cambia el usuario, cargar su perfil (rol y nombre).
  //    Dependemos del ID (un texto) y no del objeto session entero, para no
  //    repetir la consulta cada vez que el token se renueva.
  const userId = session?.user?.id
  useEffect(() => {
    if (!sesionLista) return
    if (!userId) {
      usuarioCargado.current = null
      setPerfil(null)
      setPerfilListo(true)
      return
    }
    let cancelado = false // evita guardar un resultado "viejo" si el usuario cambió
    // Solo se muestra "Cargando" cuando CAMBIA el usuario. Si es el mismo (la sesión local pasó a
    // ser real al volver el internet), el perfil se refresca sin desmontar la pantalla: así no se
    // pierde lo que el atleta esté escribiendo.
    if (usuarioCargado.current !== userId) {
      usuarioCargado.current = userId
      setPerfilListo(false)
    }
    supabase
      .from('profiles')
      .select('id, rol, nombre_completo, email, activo')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return
        if (!error) {
          setPerfil(data)
          guardarIdentidad(data) // para poder abrir la app sin internet la próxima vez
        } else {
          // Sin red (o en sesión local) se usa el perfil recordado en vez de mostrar "sin perfil".
          const identidad = leerIdentidad()
          const sirveRecordado = identidad?.perfil?.id === userId && (sesionLocal || esErrorDeRed(error))
          setPerfil(sirveRecordado ? identidad.perfil : null)
        }
        setPerfilListo(true)
      })
    return () => { cancelado = true }
  }, [sesionLista, userId, sesionLocal])

  const valor = {
    session,
    perfil,
    cargando: !sesionLista || !perfilListo,
    recuperando, // true mientras falta elegir la contraseña nueva tras abrir el enlace del correo
    iniciarSesion: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    cerrarSesion: async () => {
      // Los registros hechos sin señal que aún no subieron se CONSERVAN en el teléfono (se suben
      // cuando esta persona vuelva a entrar), pero conviene avisar antes de salir.
      const { pendientes } = userId ? await resumenCola(userId) : { pendientes: 0 }
      if (pendientes > 0 && !window.confirm(
        `Tienes ${pendientes} ${pendientes === 1 ? 'registro' : 'registros'} sin subir. Si sales ahora se subirán cuando vuelvas a entrar con tu cuenta y tengas internet. ¿Salir de todos modos?`
      )) return
      borrarIdentidad()
      if (userId) await limpiarCache(userId) // datos guardados de esta persona: fuera del teléfono
      return supabase.auth.signOut()
    },
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
