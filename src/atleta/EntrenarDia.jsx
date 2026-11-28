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
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { aNumero } from '../lib/numeros'
import { fechaLocalISO, formatearFecha, formatearFechaCorta, inicioDeFechaISO, inicioSemanaISO, inicioSemanaSiguienteISO } from '../lib/fechas'
import { calcularUltimaVez, inicioDeHoyISO, textoPrescripcion, textoSerie } from '../lib/rutinas'
import { textoMeta } from '../lib/progresion'
import { metaDelDia, prescripcionDescarga, textoMetaDescarga } from '../lib/descarga'
import { cargarDescargaVigente } from '../lib/cargarDescarga'
import { cargarConCache } from '../lib/cacheOffline'
import { CLAVES, leerCola, quitarPendiente, registrar } from '../lib/colaOffline'
import { exigirConexion } from '../lib/conexion'
import { ajustarCopiaDia, unirPendientesDia } from '../lib/vistaOffline'
import { useConexion } from '../lib/useConexion'
import { useCola } from '../lib/useCola'
import AvisoDescarga from '../components/AvisoDescarga'
import NotaDatosGuardados from '../components/NotaDatosGuardados'
import { agruparPorBloque, textoBloques } from '../lib/bloques'
import { estadoEjercicio, resumenDiaRealizado, resumenRutinaDia, seriesObjetivoDe, validarNotaCierre, NOTA_MAX } from '../lib/cierres'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import ResumenDiaRealizado from '../components/ResumenDiaRealizado'

const COLUMNAS_LOG = 'id, routine_exercise_id, exercise_id, sesion_id, numero_serie, repeticiones, peso_kg, rpe, realizado_en'

// ---------------------------------------------------------------------
// Un ejercicio con su lista de series y el formulario de la siguiente
// ---------------------------------------------------------------------
function EjercicioEntrenamiento({ fila, bloque, seriesHoy, ultimaVez, cierre, descarga, userId, sesionId, onCambio }) {
  // Meta de hoy: la de la semana de descarga si hay una en curso; si no, la progresión
  // automática (null si el ejercicio no la tiene). Sale de las series del entrenamiento
  // anterior NORMAL (la base ignora las de descarga), que no cambian mientras entrenas hoy.
  const meta = metaDelDia(fila, ultimaVez, descarga)
  const textoDeMeta = meta ? (descarga ? textoMetaDescarga(meta) : textoMeta(meta)) : null
  const seriesObjetivo = meta?.series ?? fila.series

  // Peso sugerido para la próxima serie: la última de hoy, si no la meta, si no la del
  // entrenamiento anterior, si no el peso sugerido por el entrenador.
  const pesoInicial = seriesHoy.at(-1)?.peso_kg ?? meta?.peso_kg ?? ultimaVez?.series[0]?.peso_kg ?? fila.peso_sugerido_kg ?? ''
  const [peso, setPeso] = useState(String(pesoInicial))
  const [reps, setReps] = useState(String(meta?.reps ?? fila.reps_max ?? fila.reps_min ?? ''))
  const [rpe, setRpe] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  // Panel para finalizar el ejercicio sin completar las series (pide una nota con el motivo)
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')

  const siguiente = seriesHoy.reduce((max, s) => Math.max(max, s.numero_serie ?? 0), 0) + 1
  // Tope: no se pueden anotar más series de las que tocan hoy. Al completarlas, el formulario
  // desaparece (si borra una serie, vuelve a aparecer). La base de datos también lo comprueba.
  const completado = seriesHoy.length >= seriesObjetivo
  // Finalizado a mano con nota (solo cuenta si no completó todas: si completó, manda "completado").
  const cerrado = !completado && Boolean(cierre)
  // El entrenador decide por ejercicio si se pide RPE (si la columna no llegó, se pide).
  const pideRpe = fila.pide_rpe !== false

  async function guardarSerie(evento) {
    evento.preventDefault()
    if (completado) return setError('Ya registraste todas las series de este ejercicio.')
    const repeticiones = aNumero(reps)
    const pesoKg = aNumero(peso)
    const rpeN = pideRpe ? aNumero(rpe) : null

    if (repeticiones === null || pesoKg === null || (pideRpe && rpeN === null) || [repeticiones, pesoKg, rpeN].some(Number.isNaN)) {
      return setError(pideRpe ? 'Completa peso, repeticiones y RPE con números.' : 'Completa peso y repeticiones con números.')
    }
    if (!Number.isInteger(repeticiones) || repeticiones < 1 || repeticiones > 100) {
      return setError('Las repeticiones deben ser un número entero entre 1 y 100.')
    }
    if (pesoKg < 0 || pesoKg > 1000) return setError('El peso debe estar entre 0 y 1000 kg (0 si es peso corporal).')
    if (pideRpe && (rpeN < 1 || rpeN > 10)) return setError('El RPE debe estar entre 1 y 10.')

    setError('')
    setGuardando(true)
    // El id y la hora los pone el celular AHORA: si no hay señal, la serie espera en el teléfono y
    // al subir conserva su hora real (de eso depende "día realizado" y la semana lunes–domingo).
    const ahora = new Date()
    const r = await registrar({
      userId,
      tipo: 'serie',
      fecha: fechaLocalISO(ahora),
      payload: {
        id: crypto.randomUUID(),
        user_id: userId,
        exercise_id: fila.exercise_id,
        routine_exercise_id: fila.id, // enlaza la serie con lo prescrito
        sesion_id: sesionId,          // agrupa las series de este entrenamiento
        numero_serie: siguiente,
        repeticiones,
        peso_kg: pesoKg,
        rpe: rpeN, // null si el entrenador no pide RPE en este ejercicio
        realizado_en: ahora.toISOString(),
      },
    })
    setGuardando(false)
    if (r.estado === 'rechazado' && r.error?.code === 'P0001') {
      // La base de datos dice que ya están todas las series (pantalla desactualizada o doble
      // toque). Su mensaje ya viene redactado en español; recargamos para mostrar lo real.
      setError(r.error.message)
      onCambio()
    } else if (r.estado === 'rechazado') {
      // Los valores quedan escritos en el formulario para reintentar sin volver a teclear.
      setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    } else if (r.estado === 'sin_almacen') {
      setError('Sin conexión y este navegador no puede guardar en el teléfono. Conéctate e inténtalo de nuevo.')
    } else {
      // 'subido' o 'en_cola' (sin señal: queda guardada en el teléfono y se sube sola)
      setRpe('') // el peso y las reps suelen repetirse; el RPE se anota cada vez
      onCambio()
    }
  }

  async function borrarSerie(serie) {
    if (!window.confirm(`¿Eliminar la serie ${serie.numero_serie}?`)) return
    // Una serie que aún no subió solo existe en el teléfono: basta quitarla de la cola (sin internet).
    if (serie.pendiente) {
      await quitarPendiente(userId, CLAVES.serie(serie))
      return onCambio()
    }
    const sinRed = exigirConexion('borrar una serie ya guardada')
    if (sinRed) return setError(sinRed)
    const { data, error: errorBD } = await supabase.from('routine_logs').delete().eq('id', serie.id).select('id')
    if (errorBD || !data || data.length === 0) setError('No se pudo eliminar la serie.')
    else onCambio()
  }

  // Finalizar el ejercicio sin completar las series: la nota con el motivo es obligatoria.
  async function finalizarSinCompletar(evento) {
    evento.preventDefault()
    const v = validarNotaCierre(nota)
    if (!v.ok) return setError(v.mensaje)
    setError('')
    setGuardando(true)
    const fecha = fechaLocalISO() // día local del atleta
    const r = await registrar({
      userId,
      tipo: 'cierre',
      fecha,
      payload: {
        user_id: userId,
        exercise_id: fila.exercise_id,
        routine_exercise_id: fila.id,
        fecha,
        nota: v.nota,
        series_hechas: seriesHoy.length, // foto del momento del cierre
        series_objetivo: seriesObjetivo,
      },
    })
    setGuardando(false)
    if (r.estado === 'rechazado' || r.estado === 'sin_almacen') {
      setError('No se pudo finalizar el ejercicio. Revisa tu conexión e inténtalo de nuevo.')
    } else {
      // 'subido' (incluye "ya estaba finalizado") o 'en_cola' (sin señal)
      setAbierto(false)
      setNota('')
      onCambio()
    }
  }

  // Reabrir: quita el cierre para poder seguir anotando series.
  async function reabrir() {
    setError('')
    // Un cierre que aún no subió solo existe en el teléfono: se quita de la cola.
    if (cierre.pendiente) {
      await quitarPendiente(userId, CLAVES.cierre(cierre))
      return onCambio()
    }
    const sinRed = exigirConexion('reabrir un ejercicio ya finalizado')
    if (sinRed) return setError(sinRed)
    const { data, error: errorBD } = await supabase.from('exercise_closures').delete().eq('id', cierre.id).select('id')
    if (errorBD || !data || data.length === 0) setError('No se pudo reabrir el ejercicio.')
    else onCambio()
  }

  const ej = fila.exercises
  return (
    <li className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        {/* Rutina híbrida: etiqueta del bloque en cada ejercicio para no confundirlos al registrar */}
        {bloque && (
          <p className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
            bloque === 'halterofilia' ? 'bg-primario text-white' : 'border border-enlace text-enlace'
          }`}>
            {bloque === 'halterofilia' ? 'Halterofilia' : 'Musculación'}
          </p>
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold">{ej.nombre}</h3>
          <span className={`whitespace-nowrap text-sm font-semibold ${completado ? 'text-enlace' : cerrado ? 'text-alerta' : 'text-suave'}`}>
            {seriesHoy.length} de {seriesObjetivo}{completado ? ' ✓' : cerrado ? ' · finalizado' : ''}
          </span>
        </div>
        <p className="text-sm text-suave">{textoPrescripcion(descarga && meta ? prescripcionDescarga(fila, meta) : fila)}</p>
        {textoDeMeta && (
          <div className="mt-2 rounded-xl border border-borde bg-hundido p-3">
            <p className="text-xs text-suave">{descarga ? 'Meta de hoy · Descarga' : 'Meta de hoy'}</p>
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
              <span>
                Serie {s.numero_serie}: <span className="font-semibold">{textoSerie(s)}</span>
                {s.pendiente && <span className="ml-2 text-xs text-suave">sin subir</span>}
              </span>
              <button type="button" onClick={() => borrarSerie(s)} className="min-h-11 px-2 text-sm text-alerta">
                Borrar
              </button>
            </li>
          ))}
        </ol>
      )}

      {completado ? (
        <>
          <p role="status" className="rounded-xl border border-borde bg-hundido px-3 py-2 text-sm font-semibold text-enlace">
            Completaste las {seriesObjetivo} {seriesObjetivo === 1 ? 'serie' : 'series'} de este ejercicio ✓
          </p>
          {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
        </>
      ) : cerrado ? (
        <div className="flex flex-col gap-2 rounded-xl border border-alerta bg-hundido p-3">
          <p role="status" className="text-sm font-semibold text-alerta">
            Ejercicio finalizado con {seriesHoy.length} de {seriesObjetivo} series
          </p>
          <p className="text-sm"><span className="text-suave">Tu nota:</span> {cierre.nota}</p>
          {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
          <button type="button" onClick={reabrir} className={BOTON_SEC}>
            Reabrir ejercicio
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={guardarSerie} className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Serie {siguiente} de {seriesObjetivo}</p>
            <div className={`grid gap-2 ${pideRpe ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label htmlFor={`p-${fila.id}`} className="text-xs text-suave">Peso (kg)</label>
                <input id={`p-${fila.id}`} inputMode="decimal" value={peso} onChange={(e) => { setPeso(e.target.value); setError('') }} className={CAMPO} />
              </div>
              <div>
                <label htmlFor={`r-${fila.id}`} className="text-xs text-suave">Reps</label>
                <input id={`r-${fila.id}`} inputMode="numeric" value={reps} onChange={(e) => { setReps(e.target.value); setError('') }} className={CAMPO} />
              </div>
              {pideRpe && (
                <div>
                  <label htmlFor={`e-${fila.id}`} className="text-xs text-suave">RPE (1-10)</label>
                  <input id={`e-${fila.id}`} inputMode="decimal" value={rpe} onChange={(e) => { setRpe(e.target.value); setError('') }} className={CAMPO} />
                </div>
              )}
            </div>
            {!abierto && error && <p role="alert" className="text-sm text-alerta">{error}</p>}
            <button type="submit" disabled={guardando} className={BOTON}>
              {guardando ? 'Guardando...' : `Guardar serie ${siguiente}`}
            </button>
          </form>

          {!abierto ? (
            <button type="button" onClick={() => { setError(''); setAbierto(true) }} className="min-h-11 text-sm font-semibold text-enlace">
              Finalizar sin completar las series
            </button>
          ) : (
            <form onSubmit={finalizarSinCompletar} className="flex flex-col gap-2 rounded-xl border border-borde bg-hundido p-3">
              <label htmlFor={`n-${fila.id}`} className="text-sm font-semibold">
                ¿Por qué dejas este ejercicio con {seriesHoy.length} de {seriesObjetivo} series?
              </label>
              <textarea
                id={`n-${fila.id}`}
                rows={3}
                maxLength={NOTA_MAX}
                value={nota}
                onChange={(e) => { setNota(e.target.value); setError('') }}
                placeholder="Ej.: me dolió el hombro, no había máquina..."
                className={`${CAMPO} py-2`}
              />
              {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setAbierto(false); setError('') }} className={BOTON_SEC}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className={BOTON}>
                  {guardando ? 'Guardando...' : 'Finalizar ejercicio'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// Pantalla del día
// ---------------------------------------------------------------------
export default function EntrenarDia() {
  const { diaId } = useParams()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [dia, setDia] = useState(null)
  // Si ya terminó este día esta semana: { fecha }. Entonces no puede volver a registrarlo.
  const [realizado, setRealizado] = useState(null)
  // Series y cierres de la semana, solo para el resumen de lectura de un día ya realizado
  const [datosSemana, setDatosSemana] = useState({ logs: [], cierres: [] })
  const [terminando, setTerminando] = useState(false)
  const [errorTerminar, setErrorTerminar] = useState('')
  const [logsHoy, setLogsHoy] = useState([])
  const [cierresHoy, setCierresHoy] = useState([])
  const [ultimaVez, setUltimaVez] = useState({})
  // Semana de descarga en curso (null si no hay)
  const [descarga, setDescarga] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  // Identificador de este entrenamiento. Si ya hay series de hoy, se reutiliza el
  // suyo; si no, se usa este nuevo. (La función dentro de useState se ejecuta solo una vez.)
  const [sesionNueva] = useState(() => crypto.randomUUID())

  // Al volver el internet o terminar de subir registros pendientes, la pantalla se recarga sola.
  const conectado = useConexion()
  const { subidos } = useCola(perfil.id)
  const [guardadoEn, setGuardadoEn] = useState(null) // si se ve una copia guardada (sin conexión)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      // Con internet se lee de Supabase y se guarda una copia de este día; sin él se usa esa copia
      // (cargarConCache). La meta de la progresión se calcula acá con esas series guardadas.
      const r = await cargarConCache(perfil.id, `dia:${diaId}`, async () => {
        const res = await supabase
          .from('routine_days')
          .select(`
            id, routine_id, nombre, notas,
            routines ( modo_hibrido ),
            routine_exercises (
              id, orden, bloque, exercise_id, series, reps_min, reps_max, rpe_objetivo, descanso_seg, peso_sugerido_kg, notas,
              progresion_tipo, escalera, incremento_kg, peso_inicial_kg, pide_rpe,
              exercises ( nombre, grupo_muscular, descripcion, video_url, tipo_ejercicio )
            )
          `)
          .eq('id', diaId)
          .maybeSingle()
        if (res.error) return { error: res.error }
        if (!res.data) return { d: null }

        const d = res.data
        d.routine_exercises.sort((a, b) => a.orden - b.orden)
        const idsFilas = d.routine_exercises.map((x) => x.id)
        const idsEjercicios = d.routine_exercises.map((x) => x.exercise_id)
        const inicio = inicioDeHoyISO()

        const [hoy, previos, cierres, completado, des] = await Promise.all([
          supabase.from('routine_logs').select(COLUMNAS_LOG)
            .eq('user_id', perfil.id).in('routine_exercise_id', idsFilas)
            .gte('realizado_en', inicio).order('numero_serie'),
          // Últimas series de CADA ejercicio por separado (migración 21): así la meta de la
          // progresión no se pierde aunque pasen semanas sin entrenar un ejercicio.
          supabase.rpc('ultimas_series_por_ejercicio', {
            p_user_id: perfil.id, p_exercise_ids: idsEjercicios, p_antes: inicio,
          }),
          // Ejercicios que el atleta finalizó hoy sin completar las series (con su nota)
          supabase.from('exercise_closures').select('id, routine_exercise_id, nota, series_hechas, series_objetivo')
            .eq('user_id', perfil.id).eq('fecha', fechaLocalISO()).in('routine_exercise_id', idsFilas),
          // ¿Ya terminó este día en la semana actual (lunes a domingo, fecha local)?
          supabase.from('routine_day_completions').select('fecha')
            .eq('user_id', perfil.id).eq('routine_day_id', diaId).eq('semana_inicio', inicioSemanaISO()).maybeSingle(),
          // ¿Hay una semana de descarga en curso hoy (fecha local)?
          cargarDescargaVigente(perfil.id, fechaLocalISO()),
        ])
        const errorBD = hoy.error ?? previos.error ?? cierres.error ?? completado.error ?? des.errorBD
        if (errorBD) return { error: errorBD }

        // Día ya realizado: se traen las series y cierres de la SEMANA (el atleta pudo entrenarlo
        // en varios días antes de pulsar "Terminar rutina") para mostrar un resumen de lectura.
        // Es una consulta aparte y solo ocurre en este caso; la base solo le devuelve lo suyo (RLS).
        let semana = { logs: [], cierres: [] }
        if (completado.data) {
          const desde = inicioDeFechaISO(inicioSemanaISO())
          const hasta = inicioDeFechaISO(inicioSemanaSiguienteISO())
          const [logsSemana, cierresSemana] = await Promise.all([
            supabase.from('routine_logs').select(COLUMNAS_LOG)
              .eq('user_id', perfil.id).in('routine_exercise_id', idsFilas)
              .gte('realizado_en', desde).lt('realizado_en', hasta).order('realizado_en').limit(500),
            supabase.from('exercise_closures').select('id, routine_exercise_id, fecha, nota, series_hechas, series_objetivo')
              .eq('user_id', perfil.id).in('routine_exercise_id', idsFilas)
              .gte('fecha', inicioSemanaISO()).lt('fecha', inicioSemanaSiguienteISO()),
          ])
          const errorSemana = logsSemana.error ?? cierresSemana.error
          if (errorSemana) return { error: errorSemana }
          semana = { logs: logsSemana.data, cierres: cierresSemana.data }
        }

        return {
          d, previos: previos.data, logsHoy: hoy.data, cierresHoy: cierres.data,
          completado: completado.data, descarga: des.descarga, datosSemana: semana,
          fechaCache: fechaLocalISO(), semanaCache: inicioSemanaISO(),
        }
      })
      if (cancelado) return
      if (r.error) {
        setError(r.error.sinCache
          ? 'Sin conexión. Abre este día una vez con internet para poder entrenarlo sin señal.'
          : 'No se pudo cargar el entrenamiento.')
        setCargando(false)
        return
      }
      if (!r.d) { setDia(null); setError(''); setCargando(false); return }

      const hoyISO = fechaLocalISO()
      const semanaISO = inicioSemanaISO()
      const d = r.d
      const idsFilas = d.routine_exercises.map((x) => x.id)
      // 1) la copia se ajusta a hoy (si es de otro día, lo de ayer pasa a ser "última vez"); 2) se le
      // suma lo hecho sin señal que aún no sube (series, ejercicios finalizados, día terminado).
      const base = ajustarCopiaDia(r, hoyISO, semanaISO)
      const cola = await leerCola(perfil.id)
      if (cancelado) return
      const u = unirPendientesDia(base, cola, { idsFilas, diaId, hoy: hoyISO, semana: semanaISO })

      // Resumen del día realizado: lo guardado de la semana + lo de hoy (puede ser un cierre pendiente)
      const ids = new Set()
      const logsSemana = [...r.datosSemana.logs, ...u.logsHoy].filter((l) => !ids.has(l.id) && ids.add(l.id))
      const vistos = new Set()
      const cierresSemana = [...r.datosSemana.cierres, ...u.cierresHoy]
        .filter((c) => !vistos.has(c.routine_exercise_id) && vistos.add(c.routine_exercise_id))

      setDia(d)
      setDatosSemana({ logs: logsSemana, cierres: cierresSemana })
      setLogsHoy(u.logsHoy)
      setCierresHoy(u.cierresHoy)
      setRealizado(u.completado)
      setDescarga(base.descarga)
      setUltimaVez(calcularUltimaVez(u.previos))
      setGuardadoEn(r.desdeCache ? r.guardadoEn : null)
      setError('')
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [diaId, perfil.id, version, conectado, subidos])

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

  // Día ya realizado esta semana: aviso + resumen corto de solo lectura (no se puede registrar,
  // borrar ni reabrir nada; el trigger bloquear_dia_realizado también lo impide en la base).
  if (realizado) {
    const resumenHecho = resumenDiaRealizado(dia.routine_exercises, datosSemana.logs, datosSemana.cierres, Boolean(dia.routines?.modo_hibrido))
    return (
      <div className="flex flex-col gap-4">
        <Link to="/atleta/entrenar" className="text-sm text-enlace">‹ Mi rutina</Link>
        <div role="status" className={`${TARJETA} border-primario`}>
          <h2 className="text-xl font-bold">{dia.nombre}</h2>
          <p className="mt-1 font-semibold text-enlace">Día realizado ✓</p>
          <p className="mt-1 text-sm text-suave">
            Lo completaste el {formatearFecha(realizado.fecha)}. Podrás volver a entrenarlo desde el {formatearFecha(inicioSemanaSiguienteISO())}.
          </p>
        </div>
        <ResumenDiaRealizado resumen={resumenHecho} />
        <Link to="/atleta/entrenar" className={`${BOTON_SEC} flex items-center justify-center`}>
          Volver a mi rutina
        </Link>
      </div>
    )
  }

  const sesionId = logsHoy.find((l) => l.sesion_id)?.sesion_id ?? sesionNueva

  // Estado de cada ejercicio (completo / finalizado con nota / pendiente) y de la rutina del día
  const estados = dia.routine_exercises.map((fila) => {
    const hechas = logsHoy.filter((l) => l.routine_exercise_id === fila.id).length
    const objetivo = seriesObjetivoDe(fila, ultimaVez[fila.exercise_id], descarga)
    return estadoEjercicio(hechas, objetivo, cierresHoy.find((c) => c.routine_exercise_id === fila.id))
  })
  const resumen = resumenRutinaDia(estados)
  // Rutina híbrida: los ejercicios se muestran en dos bloques (halterofilia y musculación)
  const hibrido = Boolean(dia.routines?.modo_hibrido)
  const grupos = agruparPorBloque(dia.routine_exercises, hibrido)

  // Cierra el día: queda registrado como realizado en esta semana y se bloquea repetirlo.
  async function terminarRutina() {
    setTerminando(true)
    setErrorTerminar('')
    // Sin señal el día queda terminado en el teléfono y se sube solo. La cola respeta el orden: las
    // series anotadas antes suben ANTES que este cierre (si no, el trigger de la base las rechazaría).
    const fecha = fechaLocalISO()
    const r = await registrar({
      userId: perfil.id,
      tipo: 'dia',
      fecha,
      payload: {
        user_id: perfil.id,
        routine_day_id: dia.id,
        fecha,
        semana_inicio: inicioSemanaISO(),
        ejercicios_completos: resumen.completos,
        ejercicios_finalizados: resumen.cerrados,
      },
    })
    // 'subido' incluye "ya estaba registrado" (23505): se trata como éxito
    if (r.estado === 'rechazado' || r.estado === 'sin_almacen') {
      setTerminando(false)
      return setErrorTerminar('No se pudo cerrar la rutina. Revisa tu conexión e inténtalo de nuevo.')
    }
    navigate('/atleta/entrenar', { state: { rutinaCompletada: dia.nombre } })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/atleta/entrenar" className="text-sm text-enlace">‹ Mi rutina</Link>
        <h2 className="text-xl font-bold">{dia.nombre}</h2>
        {dia.notas && <p className="text-sm text-suave">{dia.notas}</p>}
      </div>

      {resumen.terminada && (
        <div role="status" className="rounded-2xl bg-primario p-4 text-white">
          <p className="text-lg font-bold">¡Rutina del día completada! ✓</p>
          <p className="text-sm">
            {resumen.completos} {resumen.completos === 1 ? 'ejercicio completo' : 'ejercicios completos'}
            {resumen.cerrados > 0 && ` · ${resumen.cerrados} ${resumen.cerrados === 1 ? 'finalizado' : 'finalizados'} con nota`}
          </p>
        </div>
      )}

      <AvisoDescarga descarga={descarga} hoy={fechaLocalISO()} />
      <NotaDatosGuardados guardadoEn={guardadoEn} />

      {hibrido && (
        <p className={`${TARJETA} text-sm`}>
          <span className="font-semibold">Sesión híbrida:</span> {textoBloques(dia.routine_exercises)}. Primero halterofilia y después musculación.
        </p>
      )}

      {grupos.map((grupo) => (
        <section key={grupo.valor ?? 'unico'} className="flex flex-col gap-3" aria-label={grupo.titulo ?? undefined}>
          {grupo.titulo && (
            <h3 className={`border-l-4 pl-3 text-lg font-bold ${grupo.valor === 'halterofilia' ? 'border-primario' : 'border-enlace'}`}>
              Bloque de {grupo.titulo.toLowerCase()}
              <span className="ml-2 text-sm font-normal text-suave">
                {grupo.filas.length} {grupo.filas.length === 1 ? 'ejercicio' : 'ejercicios'}
              </span>
            </h3>
          )}
          <ul className="flex flex-col gap-4">
            {grupo.filas.map((fila) => (
              <EjercicioEntrenamiento
                key={fila.id}
                fila={fila}
                bloque={hibrido ? grupo.valor : null}
                seriesHoy={logsHoy.filter((l) => l.routine_exercise_id === fila.id)}
                ultimaVez={ultimaVez[fila.exercise_id]}
                cierre={cierresHoy.find((c) => c.routine_exercise_id === fila.id)}
                descarga={descarga}
                userId={perfil.id}
                sesionId={sesionId}
                onCambio={() => setVersion((v) => v + 1)}
              />
            ))}
          </ul>
        </section>
      ))}

      {resumen.terminada ? (
        // Al cerrar la rutina completada, el día queda marcado como realizado esta semana
        <>
          {errorTerminar && <p role="alert" className="text-sm text-alerta">{errorTerminar}</p>}
          <button type="button" onClick={terminarRutina} disabled={terminando} className={BOTON}>
            {terminando ? 'Guardando...' : 'Terminar rutina'}
          </button>
        </>
      ) : (
        <>
          {resumen.total > 0 && (
            <p className="text-center text-sm text-suave">
              Te {resumen.pendientes === 1 ? 'falta 1 ejercicio' : `faltan ${resumen.pendientes} ejercicios`} por completar o finalizar.
            </p>
          )}
          <Link to="/atleta/entrenar" className={`${BOTON_SEC} flex items-center justify-center`}>
            Terminar y volver a mi rutina
          </Link>
        </>
      )}
    </div>
  )
}
