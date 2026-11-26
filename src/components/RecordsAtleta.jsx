// =====================================================================
// RecordsAtleta — récords personales de UN atleta, con gráficas.
// Lo usan las DOS zonas (el atleta ve los suyos; el entrenador, los de cada atleta).
//
// Qué se ve:
//   1) Ranking visual: 1RM estimado de los ejercicios con mayor marca (barras). Solo entran
//      los compuestos, de fuerza y de halterofilia: los AISLADOS no tienen 1RM.
//   2) Una tarjeta por ejercicio (mejor serie y 1RM; en los aislados, el mayor peso sin
//      1RM). Al desplegarla:
//        - gráfica de la evolución del 1RM (no en los aislados),
//        - gráfica de repeticiones máximas con cada peso,
//        - "última vez" y la lista de marcas por peso.
//
// De dónde salen los datos (la base de datos resume, la app muestra):
//   - v_athlete_prs            1 fila por ejercicio (mejor serie; 1RM estimado solo si aplica_1rm).
//   - v_best_reps_by_weight    1 fila por ejercicio y PESO (mejores repeticiones).
//   - routine_logs             solo al desplegar: hasta 500 series recientes de ESE ejercicio.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularUltimaVez, textoSerie } from '../lib/rutinas'
import {
  calcularProgreso1RM, esRecordReciente, fechaCortaDeTimestamp, textoKg,
} from '../lib/records'
import { formatearFechaCorta } from '../lib/fechas'
import { BOTON_SEC, TARJETA } from '../lib/estilos'
import GraficosRecordLazy from './GraficosRecordLazy'

// ---------------------------------------------------------------------
// Ranking de 1RM (barras hechas con CSS: no necesitan cargar Recharts)
// ---------------------------------------------------------------------
function RankingRecords({ records }) {
  const top = records.filter((r) => r.aplica_1rm && r.e1rm_kg !== null).sort((a, b) => Number(b.e1rm_kg) - Number(a.e1rm_kg)).slice(0, 8)
  if (top.length === 0) return null // sin ejercicios con 1RM (por ejemplo, solo aislados): no hay ranking
  const maximo = Math.max(...top.map((r) => Number(r.e1rm_kg)), 1)
  return (
    <section className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        <h3 className="font-semibold">1RM estimado por ejercicio</h3>
        <p className="text-sm text-suave">
          {records.filter((r) => r.aplica_1rm).length > top.length ? `Los ${top.length} más altos. ` : ''}Es una referencia (fórmula de Epley): pierde
          fiabilidad con más de unas 10 repeticiones.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {top.map((r) => (
          <li key={r.exercise_id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm">{r.ejercicio}</span>
              <span className="text-sm font-bold">{textoKg(r.e1rm_kg)} kg</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-borde" role="img" aria-label={`${r.ejercicio}: ${textoKg(r.e1rm_kg)} kg`}>
              <div className="h-2 rounded-full bg-primario" style={{ width: `${(Number(r.e1rm_kg) / maximo) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------
// Detalle de un ejercicio (se carga SOLO cuando se despliega)
// ---------------------------------------------------------------------
function DetalleEjercicio({ userId, exerciseId, aplica1RM }) {
  const [marcas, setMarcas] = useState([])
  const [progreso, setProgreso] = useState([])
  const [ultimaVez, setUltimaVez] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    Promise.all([
      supabase.from('v_best_reps_by_weight')
        .select('peso_kg, reps_max, rpe, fecha_mejor, series_totales')
        .eq('user_id', userId).eq('exercise_id', exerciseId)
        .order('peso_kg', { ascending: false }),
      supabase.from('routine_logs')
        .select('exercise_id, numero_serie, repeticiones, peso_kg, rpe, realizado_en')
        .eq('user_id', userId).eq('exercise_id', exerciseId)
        .order('realizado_en', { ascending: false })
        .limit(500), // tope de seguridad: Supabase entrega máximo 1.000 filas
    ]).then(([m, l]) => {
      if (cancelado) return
      if (m.error || l.error) setError('No se pudieron cargar los datos del ejercicio.')
      else {
        setMarcas(m.data)
        setProgreso(aplica1RM ? calcularProgreso1RM(l.data) : []) // los aislados no tienen 1RM
        setUltimaVez(calcularUltimaVez(l.data)[exerciseId] ?? null)
      }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [userId, exerciseId, aplica1RM])

  if (cargando) return <p className="mt-3 text-sm text-suave">Cargando...</p>
  if (error) return <p role="alert" className="mt-3 text-sm text-alerta">{error}</p>

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-xl border border-borde bg-hundido p-3">
      <GraficosRecordLazy progreso={progreso} marcas={marcas} con1RM={aplica1RM} />

      {ultimaVez && (
        <p className="text-sm">
          <span className="text-suave">Última vez ({formatearFechaCorta(ultimaVez.fecha)}): </span>
          {ultimaVez.series.map(textoSerie).join(' · ')}
        </p>
      )}

      {marcas.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Mejores repeticiones con cada peso</p>
          <ul className="flex flex-col gap-2">
            {marcas.map((m, i) => (
              <li key={m.peso_kg} className="flex items-start justify-between gap-3 rounded-lg border border-borde bg-superficie px-3 py-2">
                <div>
                  <p className="font-semibold">
                    {textoKg(m.peso_kg)} kg → {m.reps_max} {m.reps_max === 1 ? 'repetición' : 'repeticiones'}
                  </p>
                  <p className="text-xs text-suave">
                    {m.rpe !== null && `RPE ${m.rpe} · `}
                    {fechaCortaDeTimestamp(m.fecha_mejor)} · {m.series_totales} {m.series_totales === 1 ? 'serie' : 'series'} con este peso
                  </p>
                </div>
                {i === 0 && <span className="whitespace-nowrap text-xs text-enlace">Mayor peso</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Lista de récords
// ---------------------------------------------------------------------
export default function RecordsAtleta({ userId }) {
  const [records, setRecords] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null) // id del ejercicio desplegado

  useEffect(() => {
    let cancelado = false
    supabase
      .from('v_athlete_prs')
      .select('exercise_id, ejercicio, grupo_muscular, peso_kg, repeticiones, rpe, e1rm_kg, fecha_pr, aplica_1rm')
      .eq('user_id', userId)
      .order('ejercicio')
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setError('No se pudieron cargar los récords.')
        else setRecords(data)
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [userId])

  if (cargando) return <p className="text-suave">Cargando récords...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>
  if (records.length === 0) {
    return <p className={`${TARJETA} text-suave`}>Aún no hay series registradas, así que todavía no hay récords.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <RankingRecords records={records} />

      <ul className="flex flex-col gap-3">
        {records.map((r) => (
          <li key={r.exercise_id} className={TARJETA}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.ejercicio}</p>
                <p className="text-sm text-suave">{r.grupo_muscular || 'Sin grupo'}</p>
              </div>
              {esRecordReciente(r.fecha_pr) && (
                <span className="rounded-full border border-borde px-2 py-1 text-xs text-enlace">Nuevo</span>
              )}
            </div>

            {r.aplica_1rm ? (
              <>
                <p className="mt-2 text-2xl font-bold">
                  {textoKg(r.e1rm_kg)} kg <span className="text-sm font-normal text-suave">1RM estimado</span>
                </p>
                <p className="text-sm text-suave">
                  Mejor serie: {textoSerie(r)} · {fechaCortaDeTimestamp(r.fecha_pr)}
                </p>
              </>
            ) : (
              // Ejercicio aislado: no se estima 1RM, solo se destaca el mayor peso movido
              <>
                <p className="mt-2 text-2xl font-bold">
                  {textoKg(r.peso_kg)} kg × {r.repeticiones} <span className="text-sm font-normal text-suave">mayor peso</span>
                </p>
                <p className="text-sm text-suave">
                  Ejercicio aislado: sin 1RM estimado · {fechaCortaDeTimestamp(r.fecha_pr)}
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => setAbierto(abierto === r.exercise_id ? null : r.exercise_id)}
              aria-expanded={abierto === r.exercise_id}
              className={`${BOTON_SEC} mt-3`}
            >
              {abierto === r.exercise_id ? 'Ocultar gráficas y marcas' : 'Ver gráficas y marcas por peso'}
            </button>
            {abierto === r.exercise_id && <DetalleEjercicio userId={userId} exerciseId={r.exercise_id} aplica1RM={r.aplica_1rm} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
