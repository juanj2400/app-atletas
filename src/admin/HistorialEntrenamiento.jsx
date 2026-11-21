// =====================================================================
// HistorialEntrenamiento — el entrenador ve lo que el atleta ENTRENÓ (solo lectura).
// Agrupa las series por día y por ejercicio.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatearFecha } from '../lib/fechas'
import { agruparPorDia, textoSerie } from '../lib/rutinas'
import { TARJETA } from '../lib/estilos'

export default function HistorialEntrenamiento({ atletaId }) {
  const [logs, setLogs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    supabase
      .from('routine_logs')
      .select('id, exercise_id, numero_serie, repeticiones, peso_kg, rpe, realizado_en, exercises ( nombre )')
      .eq('user_id', atletaId)
      .order('realizado_en', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setError('No se pudo cargar el historial de entrenamiento.')
        else setLogs(data)
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId])

  const dias = agruparPorDia(logs).slice(0, 10) // los 10 entrenamientos más recientes

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Entrenamientos recientes</h3>
      {cargando && <p className="text-suave">Cargando...</p>}
      {error && <p role="alert" className="text-alerta">{error}</p>}
      {!cargando && !error && dias.length === 0 && (
        <p className="text-suave">Este atleta aún no ha registrado series.</p>
      )}
      <ul className="flex flex-col gap-3">
        {dias.map((dia) => (
          <li key={dia.fecha} className={TARJETA}>
            <p className="font-semibold capitalize">{formatearFecha(dia.fecha)}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {dia.ejercicios.map((e) => (
                <li key={e.id}>
                  <p className="text-sm font-semibold">{e.nombre}</p>
                  <p className="text-sm text-suave">{e.series.map(textoSerie).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
