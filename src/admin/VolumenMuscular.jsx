// =====================================================================
// VolumenMuscular — series semanales por músculo de una rutina (solo entrenador).
//
// Dos formas de usarlo:
//   <VolumenMuscular rutinaId={...} />   una rutina concreta (dentro del editor)
//   <VolumenMuscular atletaId={...} />   la rutina ACTIVA de ese atleta (en su ficha)
// `version` sirve para volver a calcular cuando el editor cambia algo.
// =====================================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcularVolumen } from '../lib/volumen'
import { TARJETA } from '../lib/estilos'

export default function VolumenMuscular({ rutinaId, atletaId, version = 0, titulo = 'Volumen semanal por músculo' }) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [rutinaNombre, setRutinaNombre] = useState(null)
  const [resultado, setResultado] = useState(null) // null = no hay rutina que analizar

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      // 1) ¿Qué rutina analizamos?
      let id = rutinaId
      let nombre = null
      if (!id) {
        const r = await supabase.from('routines').select('id, nombre')
          .eq('user_id', atletaId).eq('estado', 'activa').maybeSingle()
        if (cancelado) return
        if (r.error) { setError('No se pudo cargar la rutina.'); setCargando(false); return }
        if (!r.data) { setResultado(null); setRutinaNombre(null); setError(''); setCargando(false); return }
        id = r.data.id
        nombre = r.data.nombre
      }

      // 2) Sus días y ejercicios (solo hace falta el nº de series y el ejercicio)
      const dias = await supabase.from('routine_days')
        .select('id, routine_exercises ( series, exercise_id, exercises ( nombre ) )')
        .eq('routine_id', id)
      if (cancelado) return
      if (dias.error) { setError('No se pudo calcular el volumen.'); setCargando(false); return }

      // 3) Los músculos de esos ejercicios y el catálogo de músculos
      const ids = [...new Set(dias.data.flatMap((d) => d.routine_exercises.map((e) => e.exercise_id)))]
      const [musculos, grupos] = await Promise.all([
        ids.length
          ? supabase.from('exercise_muscles').select('exercise_id, muscle, factor').in('exercise_id', ids)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('muscle_groups').select('codigo, nombre, orden').order('orden'),
      ])
      if (cancelado) return
      if (musculos.error || grupos.error) { setError('No se pudo calcular el volumen.'); setCargando(false); return }

      setRutinaNombre(nombre)
      setResultado(calcularVolumen({ dias: dias.data, musculos: musculos.data, grupos: grupos.data }))
      setError('')
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [rutinaId, atletaId, version])

  if (cargando) return <p className="text-suave">Calculando volumen...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  if (!resultado) {
    return (
      <section className={TARJETA}>
        <h3 className="text-lg font-bold">{titulo}</h3>
        <p className="mt-1 text-sm text-suave">Este atleta no tiene una rutina activa. Activa una para ver su volumen.</p>
      </section>
    )
  }

  const maximo = Math.max(...resultado.filas.map((f) => f.total), 1)

  return (
    <section className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        <h3 className="text-lg font-bold">{titulo}</h3>
        {rutinaNombre && <p className="text-sm text-suave">Rutina activa: {rutinaNombre}</p>}
        <p className="text-sm text-suave">Series por semana. Los ejercicios compuestos reparten su volumen entre varios músculos.</p>
      </div>

      {resultado.sinMusculos.length > 0 && (
        <p className="text-sm text-alerta">
          {resultado.sinMusculos.length === 1 ? 'Un ejercicio no tiene' : `${resultado.sinMusculos.length} ejercicios no tienen`}{' '}
          músculos asignados y no cuentan: {resultado.sinMusculos.join(', ')}.{' '}
          <Link to="/admin/ejercicios" className="underline">Asignarlos</Link>
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {resultado.filas.map((f) => (
          <li key={f.codigo}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={f.total === 0 ? 'text-suave' : 'font-semibold'}>{f.nombre}</span>
              <span className={f.total === 0 ? 'text-suave' : 'font-bold'}>{f.total}</span>
            </div>
            {/* Barra: el ancho es proporcional al músculo con más volumen */}
            <div className="mt-1 h-2 rounded-full bg-borde" role="img" aria-label={`${f.nombre}: ${f.total} series por semana`}>
              <div className="h-2 rounded-full bg-primario" style={{ width: `${(f.total / maximo) * 100}%` }} />
            </div>
            {f.total > 0 && (
              <p className="mt-1 text-xs text-suave">{f.directas} directas + {f.indirectas} indirectas</p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-suave">
        Supone que cada día de la rutina se entrena una vez por semana. Es una guía: tu criterio manda.
      </p>
    </section>
  )
}
