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
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useHoy } from '../lib/useHoy'
import Encabezado from '../components/Encabezado'

export default function PantallaAtleta() {
  const { perfil } = useAuth()
  const hoy = useHoy()
  const { pathname } = useLocation()
  // null = todavía no sabemos | true = ya lo llenó hoy | false = pendiente
  const [hecho, setHecho] = useState(null)

  // Cada vez que cambia el día (o el usuario), se vuelve a preguntar a la base de datos.
  useEffect(() => {
    let cancelado = false
    setHecho(null)
    supabase
      .from('daily_check_ins')
      .select('id')
      .eq('user_id', perfil.id)
      .eq('fecha', hoy)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        // Si hubo un error de red, lo tratamos como pendiente: es lo más seguro
        // (si en realidad ya existía, la base de datos rechazará el duplicado).
        setHecho(error ? false : Boolean(data))
      })
    return () => { cancelado = true }
  }, [perfil.id, hoy])

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
