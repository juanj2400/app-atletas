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
import { formatearFecha, inicioSemanaISO } from '../lib/fechas'
import { textoBloques } from '../lib/bloques'
import { useHoy } from '../lib/useHoy'
import CicloActual from './CicloActual'

export default function Entrenar() {
  const { perfil } = useAuth()
  const { state } = useLocation()
  const [rutina, setRutina] = useState(null)
  // Días de la rutina que ya terminó ESTA semana (lunes a domingo, fecha local)
  const [realizados, setRealizados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // useHoy hace que la pantalla se redibuje al cambiar el día; así, al llegar el lunes
  // los días vuelven a quedar disponibles aunque la app haya quedado abierta.
  useHoy()
  const semana = inicioSemanaISO()

  useEffect(() => {
    let cancelado = false
    Promise.all([
      supabase
        .from('routines')
        .select('id, nombre, objetivo, notas, modo_hibrido, routine_days ( id, orden, nombre, notas, routine_exercises ( id, bloque ) )')
        .eq('user_id', perfil.id)
        .eq('estado', 'activa')
        .maybeSingle(),
      supabase
        .from('routine_day_completions')
        .select('routine_day_id, fecha')
        .eq('user_id', perfil.id)
        .eq('semana_inicio', semana),
    ]).then(([res, comp]) => {
      if (cancelado) return
      if (res.error || comp.error) setError('No se pudo cargar tu rutina.')
      else { setRutina(res.data); setRealizados(comp.data); setError('') }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [perfil.id, semana])

  const aviso = state?.rutinaCompletada ? (
    <p role="status" className="rounded-xl bg-primario p-3 font-semibold text-white">
      ¡Rutina del día completada! ✓ Terminaste «{state.rutinaCompletada}».
    </p>
  ) : state?.checkInGuardado ? (
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

      <p className="text-sm text-suave">
        Elige el día que vas a entrenar hoy · Esta semana: {dias.filter((d) => realizados.some((r) => r.routine_day_id === d.id)).length} de {dias.length} días realizados
      </p>
      <ul className="flex flex-col gap-3">
        {dias.map((d) => {
          const hecho = realizados.find((r) => r.routine_day_id === d.id)
          // Día ya realizado esta semana: marcado; se puede abrir SOLO para ver su resumen
          // (EntrenarDia no deja registrar nada hasta el lunes).
          if (hecho) {
            return (
              <li key={d.id}>
                <Link to={`/atleta/entrenar/${d.id}`} className={`${TARJETA} flex items-center justify-between gap-2 border-primario`}>
                  <div>
                    <p className="font-semibold">{d.nombre}</p>
                    <p className="text-sm text-suave">Realizado el {formatearFecha(hecho.fecha)}. Toca para ver lo que hiciste.</p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-bold text-enlace">Realizado ✓</span>
                </Link>
              </li>
            )
          }
          return (
          <li key={d.id}>
            <Link to={`/atleta/entrenar/${d.id}`} className={`${TARJETA} flex items-center justify-between`}>
              <div>
                <p className="font-semibold">{d.nombre}</p>
                <p className="text-sm text-suave">
                  {d.routine_exercises.length} {d.routine_exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                  {rutina.modo_hibrido && ` · ${textoBloques(d.routine_exercises)}`}
                </p>
                {d.notas && <p className="text-sm text-suave">{d.notas}</p>}
              </div>
              <span className="text-xl text-enlace" aria-hidden="true">›</span>
            </Link>
          </li>
          )
        })}
      </ul>
    </div>
  )
}
