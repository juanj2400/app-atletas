// =====================================================================
// PantallaAtleta — el MARCO de la zona del atleta (encabezado + barra inferior).
//
// NOVEDAD: aquí se sabe si el atleta YA llenó el check-in de hoy.
//   - Pendiente: aparece la pestaña "Check-in".
//   - Hecho:     la pestaña DESAPARECE hasta el día siguiente (a las 12 a. m.).
// Esta información se comparte con las pantallas hijas mediante el "contexto
// del Outlet": <Outlet context={...} /> y, en la hija, useOutletContext().
// =====================================================================
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useHoy } from '../lib/useHoy'
import Encabezado from '../components/Encabezado'

export default function PantallaAtleta() {
  const { perfil } = useAuth()
  const hoy = useHoy()
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

  const pestanas = [
    // La pestaña de check-in solo existe mientras esté pendiente.
    ...(hecho === false ? [{ a: '/atleta', texto: 'Check-in', fin: true }] : []),
    { a: '/atleta/entrenar', texto: 'Entrenar', fin: false },
    { a: '/atleta/datos', texto: 'Mis datos', fin: false },
  ]

  return (
    <>
      <Encabezado titulo="Mi entrenamiento" />
      <main className="mx-auto max-w-md p-4 pb-28">
        <Outlet context={{ hoy, hecho, marcarHecho: () => setHecho(true) }} />
      </main>

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
    </>
  )
}
