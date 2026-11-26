// =====================================================================
// CargasAtleta — gestión de CARGAS de UN atleta (zona del entrenador).
// Muestra, por ejercicio de su rutina activa, la progresión, el incremento de peso, el
// peso inicial, lo que hizo la última vez y la próxima meta, y permite ajustarlos.
//
// Rutina híbrida: halterofilia y musculación se gestionan POR SEPARADO (un selector muestra
// una disciplina a la vez); así no se mezclan en una sola lista. Sin modo híbrido todo es
// musculación y se ve una sola lista.
//
// Los ajustes se guardan con la función set_progresion (la misma del editor de rutinas).
// La escalera de fuerza simple se arma en el editor de la rutina; aquí solo se muestra.
// =====================================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { aNumero } from '../lib/numeros'
import { BLOQUES, cargasPorDisciplina } from '../lib/bloques'
import { calcularUltimaVez, textoSerie, textoPrescripcion } from '../lib/rutinas'
import {
  SISTEMAS_PROGRESION, calcularMeta, textoMeta, textoEscalera, normalizarEscalera, formatearKg,
} from '../lib/progresion'
import { formatearFechaCorta } from '../lib/fechas'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

const NOMBRE_SISTEMA = { ninguna: 'Sin progresión', doble: 'Rango de repeticiones', escalera: 'Fuerza simple' }
const claseToggle = (activo) =>
  `min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold ${activo ? 'border-primario bg-primario text-white' : 'border-borde'}`

// ---------------------------------------------------------------------
// Un ejercicio: datos de carga + formulario para ajustarlos
// ---------------------------------------------------------------------
function FilaCarga({ fila, rutinaId, ultimaVez, onGuardado }) {
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    tipo: fila.progresion_tipo ?? 'ninguna',
    incremento: String(Number(fila.incremento_kg) || 2.5).replace('.', ','),
    pesoInicial: fila.peso_inicial_kg == null ? '' : String(Number(fila.peso_inicial_kg)).replace('.', ','),
  })
  const cambiar = (campo, valor) => { setF((a) => ({ ...a, [campo]: valor })); setError('') }

  const tipoActual = fila.progresion_tipo ?? 'ninguna'
  const meta = calcularMeta(fila, ultimaVez?.series)
  const textoMetaActual = meta ? textoMeta(meta) : null

  async function guardar() {
    const incremento = aNumero(f.incremento)
    const pesoInicial = aNumero(f.pesoInicial)
    if (incremento === null || Number.isNaN(incremento) || incremento <= 0 || incremento > 20) {
      return setError('El incremento debe ser un número mayor que 0 y de máximo 20 kg.')
    }
    if (Number.isNaN(pesoInicial) || (pesoInicial !== null && (pesoInicial < 0 || pesoInicial > 1000))) {
      return setError('El peso inicial debe estar entre 0 y 1.000 kg.')
    }
    // Estas dos comprobaciones evitan un viaje a la base de datos; la función las repite igual.
    if (f.tipo === 'doble' && (fila.reps_min == null || fila.reps_max == null || fila.reps_max <= fila.reps_min)) {
      return setError('Para progresar por rango, define reps mínimas y máximas distintas en el editor de la rutina.')
    }
    if (f.tipo === 'escalera' && normalizarEscalera(fila.escalera).length < 2) {
      return setError('Para fuerza simple, arma la escalera (mínimo 2 pasos) en el editor de la rutina.')
    }

    setGuardando(true)
    const { error: errorBD } = await supabase.rpc('set_progresion', {
      p_routine_exercise_id: fila.id,
      p_tipo: f.tipo,
      p_escalera: f.tipo === 'escalera' ? fila.escalera : null,
      p_incremento_kg: incremento,
      p_peso_inicial_kg: f.tipo === 'ninguna' ? null : pesoInicial,
    })
    setGuardando(false)
    if (errorBD) {
      // Los mensajes de la función ya vienen en español (P0001 o 42501).
      const redactado = errorBD.code === 'P0001' || errorBD.code === '42501'
      return setError(redactado ? errorBD.message : 'No se pudo guardar el ajuste. Inténtalo de nuevo.')
    }
    setAbierto(false)
    onGuardado(`Ajuste guardado: ${fila.exercises.nombre}.`)
  }

  return (
    <li className="rounded-xl border border-borde bg-hundido p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{fila.exercises.nombre}</p>
          <p className="text-sm text-suave">{textoPrescripcion(fila)}</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-borde px-2 py-1 text-xs">
          {NOMBRE_SISTEMA[tipoActual]}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-suave">Incremento</dt>
        <dd>{tipoActual === 'ninguna' ? '—' : `${formatearKg(Number(fila.incremento_kg) || 2.5)} kg`}</dd>
        <dt className="text-suave">Peso inicial</dt>
        <dd>{fila.peso_inicial_kg == null ? '—' : `${formatearKg(Number(fila.peso_inicial_kg))} kg`}</dd>
        {tipoActual === 'escalera' && (
          <>
            <dt className="text-suave">Escalera</dt>
            <dd>{textoEscalera(fila.escalera) || '—'}</dd>
          </>
        )}
        <dt className="text-suave">Última vez</dt>
        <dd>
          {ultimaVez
            ? `${formatearFechaCorta(ultimaVez.fecha)}: ${ultimaVez.series.map(textoSerie).join(' · ')}`
            : 'Sin registros'}
        </dd>
        <dt className="text-suave">Próxima meta</dt>
        <dd>{textoMetaActual ? textoMetaActual.titulo : tipoActual === 'ninguna' ? 'Sin progresión' : 'Sin datos para calcularla'}</dd>
      </dl>
      {textoMetaActual && <p className="mt-1 text-xs text-suave">{textoMetaActual.nota}</p>}

      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className={`${BOTON_SEC} mt-3`}>
          Ajustar progresión y pesos
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-borde p-3">
          <label htmlFor={`cg-t-${fila.id}`} className="text-xs text-suave">Progresión</label>
          <select id={`cg-t-${fila.id}`} value={f.tipo} onChange={(e) => cambiar('tipo', e.target.value)} className={CAMPO}>
            {SISTEMAS_PROGRESION.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
          </select>

          <label htmlFor={`cg-i-${fila.id}`} className="text-xs text-suave">Incremento de peso al llegar al tope (kg)</label>
          <input id={`cg-i-${fila.id}`} inputMode="decimal" value={f.incremento} disabled={f.tipo === 'ninguna'}
            onChange={(e) => cambiar('incremento', e.target.value)} className={`${CAMPO} disabled:opacity-50`} />

          <label htmlFor={`cg-p-${fila.id}`} className="text-xs text-suave">Peso inicial de este atleta (kg, opcional)</label>
          <input id={`cg-p-${fila.id}`} inputMode="decimal" value={f.pesoInicial} disabled={f.tipo === 'ninguna'}
            onChange={(e) => cambiar('pesoInicial', e.target.value)} className={`${CAMPO} disabled:opacity-50`} />

          {f.tipo === 'escalera' && (
            <p className="text-xs text-suave">
              Los pasos de la escalera se arman en el{' '}
              <Link to={`/admin/rutinas/${rutinaId}`} className="text-enlace underline">editor de la rutina</Link>.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setAbierto(false); setError('') }} className={BOTON_SEC}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className={BOTON}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// Sección principal
// ---------------------------------------------------------------------
export default function CargasAtleta({ atletaId }) {
  const [rutina, setRutina] = useState(null)
  const [ultimas, setUltimas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [version, setVersion] = useState(0)
  const [disciplina, setDisciplina] = useState('halterofilia')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const res = await supabase
        .from('routines')
        .select(`
          id, nombre, modo_hibrido,
          routine_days (
            id, orden, nombre,
            routine_exercises (
              id, orden, bloque, exercise_id, series, reps_min, reps_max, rpe_objetivo, descanso_seg,
              progresion_tipo, escalera, incremento_kg, peso_inicial_kg, peso_sugerido_kg,
              exercises ( nombre )
            )
          )
        `)
        .eq('user_id', atletaId)
        .eq('estado', 'activa')
        .maybeSingle()
      if (cancelado) return
      if (res.error) { setError('No se pudieron cargar las cargas del atleta.'); setCargando(false); return }
      if (!res.data) { setRutina(null); setUltimas({}); setError(''); setCargando(false); return }

      const ids = [...new Set(res.data.routine_days.flatMap((d) => d.routine_exercises.map((e) => e.exercise_id)))]
      let logs = []
      if (ids.length > 0) {
        const r = await supabase
          .from('routine_logs')
          .select('exercise_id, numero_serie, repeticiones, peso_kg, realizado_en')
          .eq('user_id', atletaId).in('exercise_id', ids)
          .order('realizado_en', { ascending: false })
          .limit(800) // tope explícito: Supabase entrega máximo 1.000 filas por consulta
        if (cancelado) return
        if (r.error) { setError('No se pudieron cargar las cargas del atleta.'); setCargando(false); return }
        logs = r.data
      }
      setRutina(res.data)
      setUltimas(calcularUltimaVez(logs))
      // Si no es híbrida solo hay una lista (musculación)
      if (!res.data.modo_hibrido) setDisciplina('musculacion')
      setError('')
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [atletaId, version])

  if (cargando) return <p className="text-suave">Cargando cargas...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  const titulo = <h3 className="text-lg font-bold">Cargas y progresión</h3>
  if (!rutina) {
    return (
      <section className="flex flex-col gap-3">
        {titulo}
        <p className={`${TARJETA} text-suave`}>Este atleta no tiene una rutina activa: no hay cargas que gestionar.</p>
      </section>
    )
  }

  const porDisciplina = cargasPorDisciplina(rutina)
  const total = (d) => porDisciplina[d].reduce((n, g) => n + g.filas.length, 0)
  const hibrido = Boolean(rutina.modo_hibrido)
  const mostrar = hibrido ? disciplina : 'musculacion'
  const grupos = porDisciplina[mostrar]

  return (
    <section className="flex flex-col gap-3">
      {titulo}
      <p className="text-sm text-suave">
        Rutina activa: {rutina.nombre}.{' '}
        {hibrido
          ? 'Es una rutina híbrida: revisa y ajusta cada disciplina por separado.'
          : 'No es híbrida: todos los ejercicios son de musculación.'}
      </p>

      {hibrido && (
        <div className="flex gap-2" role="group" aria-label="Disciplina">
          {BLOQUES.map((b) => (
            <button key={b.valor} type="button" aria-pressed={disciplina === b.valor}
              onClick={() => { setDisciplina(b.valor); setMensaje('') }} className={claseToggle(disciplina === b.valor)}>
              {b.titulo} ({total(b.valor)})
            </button>
          ))}
        </div>
      )}

      {mensaje && <p role="status" className="rounded-xl border border-borde bg-superficie p-3 text-enlace">{mensaje}</p>}

      {grupos.length === 0 && (
        <p className={`${TARJETA} text-suave`}>
          {hibrido ? `La rutina no tiene ejercicios de ${mostrar === 'halterofilia' ? 'halterofilia' : 'musculación'}.` : 'La rutina no tiene ejercicios.'}
        </p>
      )}

      {grupos.map((g) => (
        <div key={g.diaId} className="flex flex-col gap-2">
          <h4 className={`border-l-4 pl-3 font-semibold ${mostrar === 'halterofilia' ? 'border-primario' : 'border-enlace'}`}>{g.dia}</h4>
          <ul className="flex flex-col gap-3">
            {g.filas.map((fila) => (
              <FilaCarga
                key={fila.id}
                fila={fila}
                rutinaId={rutina.id}
                ultimaVez={ultimas[fila.exercise_id]}
                onGuardado={(texto) => { setMensaje(texto); setVersion((v) => v + 1) }}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
