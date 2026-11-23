// =====================================================================
// Entrenar — el atleta ve su rutina ACTIVA y elige qué día entrenar hoy.
// Si el entrenador aún no le asignó una (o está en borrador), no aparece nada:
// lo decide la base de datos (RLS), no esta pantalla.
//
// Novedad: si llega aquí justo después de guardar el check-in, muestra un aviso.
// El aviso viaja en "location.state" (un dato que se pasa al navegar).
// =====================================================================
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { TARJETA } from '../lib/estilos'
import CicloActual from './CicloActual'

export default function Entrenar() {
  const { perfil } = useAuth()
  const { state } = useLocation()
  const [rutina, setRutina] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    supabase
      .from('routines')
      .select('id, nombre, objetivo, notas, routine_days ( id, orden, nombre, notas, routine_exercises ( id ) )')
      .eq('user_id', perfil.id)
      .eq('estado', 'activa')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setError('No se pudo cargar tu rutina.')
        else setRutina(data)
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [perfil.id])

  const aviso = state?.checkInGuardado ? (
    <p role="status" className="rounded-xl border border-borde bg-superficie p-3 text-enlace">
      Check-in guardado. ¡Buen entrenamiento!
    </p>
  ) : null

  if (cargando) return <p className="text-suave">Cargando tu rutina...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>
  if (!rutina) {
    return (
      <div className="flex flex-col gap-4">
        {aviso}
        <CicloActual />
        <div className={TARJETA}>
          <h2 className="text-xl font-bold">Entrenar</h2>
          <p className="mt-1 text-suave">Tu entrenador aún no te ha asignado una rutina.</p>
        </div>
      </div>
    )
  }

  const dias = [...rutina.routine_days].sort((a, b) => a.orden - b.orden)

  return (
    <div className="flex flex-col gap-4">
      {aviso}
      <CicloActual />
      <div>
        <h2 className="text-xl font-bold">{rutina.nombre}</h2>
        {rutina.objetivo && <p className="text-sm text-suave">Objetivo: {rutina.objetivo}</p>}
        {rutina.notas && <p className="mt-1 text-sm">{rutina.notas}</p>}
      </div>

      <p className="text-sm text-suave">Elige el día que vas a entrenar hoy:</p>
      <ul className="flex flex-col gap-3">
        {dias.map((d) => (
          <li key={d.id}>
            <Link to={`/atleta/entrenar/${d.id}`} className={`${TARJETA} flex items-center justify-between`}>
              <div>
                <p className="font-semibold">{d.nombre}</p>
                <p className="text-sm text-suave">
                  {d.routine_exercises.length} {d.routine_exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                </p>
                {d.notas && <p className="text-sm text-suave">{d.notas}</p>}
              </div>
              <span className="text-xl text-enlace" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
