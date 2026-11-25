// =====================================================================
// EntrenarDia — el atleta entrena un día: ve lo que le toca y anota CADA SERIE.
//
// Secuencia:
//   1) Se carga el día con sus ejercicios (lo prescrito por el entrenador).
//   2) Se cargan las series que ya anotó HOY (por si recarga la página).
//   3) Se cargan las del último entrenamiento previo, como referencia.
//   4) Cada vez que toca "Guardar serie" se guarda AL INSTANTE en la base de datos.
//      Así, si se cierra la app a mitad de entrenamiento, no se pierde nada.
// =====================================================================
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { aNumero } from '../lib/numeros'
import { formatearFechaCorta } from '../lib/fechas'
import { calcularUltimaVez, inicioDeHoyISO, textoPrescripcion, textoSerie } from '../lib/rutinas'
import { calcularMeta, textoMeta } from '../lib/progresion'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

// ---------------------------------------------------------------------
// Un ejercicio con su lista de series y el formulario de la siguiente
// ---------------------------------------------------------------------
function EjercicioEntrenamiento({ fila, seriesHoy, ultimaVez, userId, sesionId, onCambio }) {
  // Meta de hoy si el ejercicio tiene progresión automática (null si no). Sale de las
  // series del entrenamiento anterior, que no cambian mientras entrenas hoy.
  const meta = calcularMeta(fila, ultimaVez?.series)
  const textoDeMeta = meta ? textoMeta(meta) : null
  const seriesObjetivo = meta?.series ?? fila.series

  // Peso sugerido para la próxima serie: la última de hoy, si no la meta, si no la del
  // entrenamiento anterior, si no el peso sugerido por el entrenador.
  const pesoInicial = seriesHoy.at(-1)?.peso_kg ?? meta?.peso_kg ?? ultimaVez?.series[0]?.peso_kg ?? fila.peso_sugerido_kg ?? ''
  const [peso, setPeso] = useState(String(pesoInicial))
  const [reps, setReps] = useState(String(meta?.reps ?? fila.reps_max ?? fila.reps_min ?? ''))
  const [rpe, setRpe] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const siguiente = seriesHoy.reduce((max, s) => Math.max(max, s.numero_serie ?? 0), 0) + 1
  const completado = seriesHoy.length >= seriesObjetivo

  async function guardarSerie(evento) {
    evento.preventDefault()
    const repeticiones = aNumero(reps)
    const pesoKg = aNumero(peso)
    const rpeN = aNumero(rpe)

    if (repeticiones === null || pesoKg === null || rpeN === null || [repeticiones, pesoKg, rpeN].some(Number.isNaN)) {
      return setError('Completa peso, repeticiones y RPE con números.')
    }
    if (!Number.isInteger(repeticiones) || repeticiones < 1 || repeticiones > 100) {
      return setError('Las repeticiones deben ser un número entero entre 1 y 100.')
    }
    if (pesoKg < 0 || pesoKg > 1000) return setError('El peso debe estar entre 0 y 1000 kg (0 si es peso corporal).')
    if (rpeN < 1 || rpeN > 10) return setError('El RPE debe estar entre 1 y 10.')

    setError('')
    setGuardando(true)
    const { error: errorBD } = await supabase.from('routine_logs').insert({
      user_id: userId,
      exercise_id: fila.exercise_id,
      routine_exercise_id: fila.id, // enlaza la serie con lo prescrito
      sesion_id: sesionId,          // agrupa las series de este entrenamiento
      numero_serie: siguiente,
      repeticiones,
      peso_kg: pesoKg,
      rpe: rpeN,
    })
    setGuardando(false)
    if (errorBD) {
      // Los valores quedan escritos en el formulario para reintentar sin volver a teclear.
      setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    } else {
      setRpe('') // el peso y las reps suelen repetirse; el RPE se anota cada vez
      onCambio()
    }
  }

  async function borrarSerie(serie) {
    if (!window.confirm(`¿Eliminar la serie ${serie.numero_serie}?`)) return
    const { data, error: errorBD } = await supabase.from('routine_logs').delete().eq('id', serie.id).select('id')
    if (errorBD || !data || data.length === 0) setError('No se pudo eliminar la serie.')
    else onCambio()
  }

  const ej = fila.exercises
  return (
    <li className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold">{ej.nombre}</h3>
          <span className={`whitespace-nowrap text-sm font-semibold ${completado ? 'text-enlace' : 'text-suave'}`}>
            {seriesHoy.length} de {seriesObjetivo}{completado ? ' ✓' : ''}
          </span>
        </div>
        <p className="text-sm text-suave">{textoPrescripcion(fila)}</p>
        {textoDeMeta && (
          <div className="mt-2 rounded-xl border border-borde bg-hundido p-3">
            <p className="text-xs text-suave">Meta de hoy</p>
            <p className="font-semibold text-enlace">{textoDeMeta.titulo}</p>
            <p className="text-sm text-suave">{textoDeMeta.nota}</p>
          </div>
        )}
        {fila.notas && <p className="mt-1 text-sm">{fila.notas}</p>}
        {ultimaVez && (
          <p className="mt-1 text-sm text-suave">
            Última vez ({formatearFechaCorta(ultimaVez.fecha)}): {ultimaVez.series.map(textoSerie).join(' · ')}
          </p>
        )}
        {(ej.descripcion || ej.video_url) && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-enlace">Cómo se hace</summary>
            {ej.descripcion && <p className="mt-1 text-suave">{ej.descripcion}</p>}
            {ej.video_url && (
              <a href={ej.video_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-enlace">
                Ver video
              </a>
            )}
          </details>
        )}
      </div>

      {seriesHoy.length > 0 && (
        <ol className="flex flex-col gap-2">
          {seriesHoy.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-borde bg-hundido px-3 py-2">
              <span>Serie {s.numero_serie}: <span className="font-semibold">{textoSerie(s)}</span></span>
              <button type="button" onClick={() => borrarSerie(s)} className="min-h-11 px-2 text-sm text-alerta">
                Borrar
              </button>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={guardarSerie} className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Serie {siguiente}</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor={`p-${fila.id}`} className="text-xs text-suave">Peso (kg)</label>
            <input id={`p-${fila.id}`} inputMode="decimal" value={peso} onChange={(e) => { setPeso(e.target.value); setError('') }} className={CAMPO} />
          </div>
          <div>
            <label htmlFor={`r-${fila.id}`} className="text-xs text-suave">Reps</label>
            <input id={`r-${fila.id}`} inputMode="numeric" value={reps} onChange={(e) => { setReps(e.target.value); setError('') }} className={CAMPO} />
          </div>
          <div>
            <label htmlFor={`e-${fila.id}`} className="text-xs text-suave">RPE (1-10)</label>
            <input id={`e-${fila.id}`} inputMode="decimal" value={rpe} onChange={(e) => { setRpe(e.target.value); setError('') }} className={CAMPO} />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
        <button type="submit" disabled={guardando} className={BOTON}>
          {guardando ? 'Guardando...' : `Guardar serie ${siguiente}`}
        </button>
      </form>
    </li>
  )
}

// ---------------------------------------------------------------------
// Pantalla del día
// ---------------------------------------------------------------------
export default function EntrenarDia() {
  const { diaId } = useParams()
  const { perfil } = useAuth()
  const [dia, setDia] = useState(null)
  const [logsHoy, setLogsHoy] = useState([])
  const [ultimaVez, setUltimaVez] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  // Identificador de este entrenamiento. Si ya hay series de hoy, se reutiliza el
  // suyo; si no, se usa este nuevo. (La función dentro de useState se ejecuta solo una vez.)
  const [sesionNueva] = useState(() => crypto.randomUUID())

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const res = await supabase
        .from('routine_days')
        .select(`
          id, nombre, notas,
          routine_exercises (
            id, orden, exercise_id, series, reps_min, reps_max, rpe_objetivo, descanso_seg, peso_sugerido_kg, notas,
            progresion_tipo, escalera, incremento_kg, peso_inicial_kg,
            exercises ( nombre, grupo_muscular, descripcion, video_url )
          )
        `)
        .eq('id', diaId)
        .maybeSingle()
      if (cancelado) return
      if (res.error) { setError('No se pudo cargar el entrenamiento.'); setCargando(false); return }
      if (!res.data) { setDia(null); setError(''); setCargando(false); return }

      const d = res.data
      d.routine_exercises.sort((a, b) => a.orden - b.orden)
      const idsFilas = d.routine_exercises.map((x) => x.id)
      const idsEjercicios = d.routine_exercises.map((x) => x.exercise_id)
      const inicio = inicioDeHoyISO()
      const columnas = 'id, routine_exercise_id, exercise_id, sesion_id, numero_serie, repeticiones, peso_kg, rpe, realizado_en'

      const [hoy, previos] = await Promise.all([
        supabase.from('routine_logs').select(columnas)
          .eq('user_id', perfil.id).in('routine_exercise_id', idsFilas)
          .gte('realizado_en', inicio).order('numero_serie'),
        supabase.from('routine_logs').select(columnas)
          .eq('user_id', perfil.id).in('exercise_id', idsEjercicios)
          .lt('realizado_en', inicio).order('realizado_en', { ascending: false }).limit(150),
      ])
      if (cancelado) return
      if (hoy.error || previos.error) { setError('No se pudieron cargar tus series.'); setCargando(false); return }

      setDia(d)
      setLogsHoy(hoy.data)
      setUltimaVez(calcularUltimaVez(previos.data))
      setError('')
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [diaId, perfil.id, version])

  if (cargando) return <p className="text-suave">Cargando entrenamiento...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>
  if (!dia) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-suave">No encontramos este día de entrenamiento.</p>
        <Link to="/atleta/entrenar" className="text-enlace">‹ Volver a mi rutina</Link>
      </div>
    )
  }

  const sesionId = logsHoy.find((l) => l.sesion_id)?.sesion_id ?? sesionNueva

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/atleta/entrenar" className="text-sm text-enlace">‹ Mi rutina</Link>
        <h2 className="text-xl font-bold">{dia.nombre}</h2>
        {dia.notas && <p className="text-sm text-suave">{dia.notas}</p>}
      </div>

      <ul className="flex flex-col gap-4">
        {dia.routine_exercises.map((fila) => (
          <EjercicioEntrenamiento
            key={fila.id}
            fila={fila}
            seriesHoy={logsHoy.filter((l) => l.routine_exercise_id === fila.id)}
            ultimaVez={ultimaVez[fila.exercise_id]}
            userId={perfil.id}
            sesionId={sesionId}
            onCambio={() => setVersion((v) => v + 1)}
          />
        ))}
      </ul>

      <Link to="/atleta/entrenar" className={`${BOTON_SEC} flex items-center justify-center`}>
        Terminar y volver a mi rutina
      </Link>
    </div>
  )
}
