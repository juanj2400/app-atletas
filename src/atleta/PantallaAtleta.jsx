// =====================================================================
// PantallaAtleta — el MARCO de la zona del atleta (encabezado + barra inferior).
//
// Aquí se sabe si el atleta YA llenó el check-in de hoy, y es la PUERTA de la zona:
//   - Pendiente: lo único accesible es el formulario del check-in. Cualquier otra
//                dirección (Entrenar, Mis datos, un enlace guardado...) lo REDIRIGE
//                al check-in, y la barra inferior no se muestra.
//   - Hecho:     se habilitan todas las secciones hasta el día siguiente (12 a. m.).
// OJO: es una regla de EXPERIENCIA (pantalla). La base de datos no impide leer ni
// registrar series sin check-in; ver "Deuda técnica" en docs/ARQUITECTURA.md.
// Esta información se comparte con las pantallas hijas mediante el "contexto
// del Outlet": <Outlet context={...} /> y, en la hija, useOutletContext().
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useHoy } from '../lib/useHoy'
import { useConexion } from '../lib/useConexion'
import { useSincronizacion } from '../lib/useCola'
import { cargarConCache } from '../lib/cacheOffline'
import { leerCola } from '../lib/colaOffline'
import Encabezado from '../components/Encabezado'
import IndicadorConexion from '../components/IndicadorConexion'

export default function PantallaAtleta() {
  const { perfil } = useAuth()
  const hoy = useHoy()
  const { pathname } = useLocation()
  // null = todavía no sabemos | true = ya lo llenó hoy | false = pendiente
  const [hecho, setHecho] = useState(null)
  const conectado = useConexion()
  // Día (y usuario) para el que ya se verificó el check-in: permite re-confirmar en silencio al volver el internet.
  const verificadoPara = useRef(null)

  // Sube solo los registros hechos sin señal (check-in, series...) al abrir la app y al volver el internet.
  useSincronizacion(perfil.id)

  // Cada vez que cambia el día (o el usuario, o vuelve el internet), se vuelve a preguntar.
  // Sin conexión se usa lo último que se supo de HOY (copia guardada) y los check-ins que esperan subir.
  useEffect(() => {
    let cancelado = false
    // Al cambiar de día (o de usuario) se vuelve a "Cargando": invariante 4, nada se muestra sin verificar.
    // Si solo cambió la conexión, se confirma en silencio sin desmontar lo que el atleta esté llenando.
    if (verificadoPara.current !== `${perfil.id}|${hoy}`) setHecho(null)
    async function averiguar() {
      // La cola se lee ANTES de preguntar al servidor: si justo termina de subir en medio, la
      // pregunta al servidor ya lo incluye (al revés, el check-in parecería pendiente por un instante).
      // Un check-in guardado en el teléfono que aún no sube cuenta como hecho (el atleta ya lo llenó).
      const enCola = (await leerCola(perfil.id)).some((i) => i.tipo === 'checkin' && i.payload.fecha === hoy)
      const r = await cargarConCache(perfil.id, `checkin:${hoy}`, async () => {
        const { data, error } = await supabase
          .from('daily_check_ins').select('id').eq('user_id', perfil.id).eq('fecha', hoy).maybeSingle()
        return error ? { error } : { hecho: Boolean(data) }
      })
      if (cancelado) return
      // Error o sin copia: se trata como pendiente (lo más seguro; si ya existía, la base rechaza el duplicado).
      verificadoPara.current = `${perfil.id}|${hoy}`
      setHecho(Boolean(r.hecho) || enCola)
    }
    averiguar()
    return () => { cancelado = true }
  }, [perfil.id, hoy, conectado])

  // Pendiente y fuera del check-in: se manda al check-in. Se quitan las barras finales
  // ("/atleta/") para que la comparación no falle por un detalle de la dirección.
  const enCheckIn = pathname.replace(/\/+$/, '') === '/atleta'
  if (hecho === false && !enCheckIn) return <Navigate to="/atleta" replace />

  // Las pestañas solo existen con el check-in hecho: antes no hay a dónde ir.
  // (El check-in no es una pestaña: es la puerta del día y desaparece al completarse.)
  const pestanas = [
    { a: '/atleta/entrenar', texto: 'Entrenar', fin: false },
    { a: '/atleta/nutricion', texto: 'Nutrición', fin: false },
    { a: '/atleta/datos', texto: 'Mis datos', fin: false },
  ]

  return (
    <>
      <Encabezado titulo="Mi entrenamiento" />
      <main className="mx-auto max-w-md p-4 pb-28">
        {hecho === false && (
          <p role="status" className="mb-4 rounded-2xl border border-borde bg-superficie p-4 text-sm text-suave">
            Completa el check-in de hoy para entrar a tu entrenamiento, tu nutrición y tus datos.
          </p>
        )}
        <IndicadorConexion userId={perfil.id} />
        {/* Mientras no sepamos si hay check-in (hecho === null) no se dibuja ninguna pantalla:
            así no se alcanzan a pedir datos de otras secciones antes de tiempo. */}
        {hecho === null ? (
          <p className="text-suave">Cargando...</p>
        ) : (
          <Outlet context={{ hoy, hecho, marcarHecho: () => setHecho(true) }} />
        )}
      </main>

      {hecho === true && (
        <nav
          aria-label="Secciones"
          className="fixed inset-x-0 bottom-0 flex border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)]"
        >
          {pestanas.map((p) => (
            <NavLink
              key={p.a}
              to={p.a}
              end={p.fin}
              className={({ isActive }) =>
                `flex min-h-14 flex-1 items-center justify-center text-sm font-semibold ${
                  isActive ? 'text-enlace' : 'text-suave'
                }`
              }
            >
              {p.texto}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
