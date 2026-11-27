// =====================================================================
// HistorialRutina — el entrenador consulta los PERIODOS de la rutina de un atleta (solo lectura).
//
// Cada periodo es una foto de cómo estaba prescrita la rutina mientras el atleta la entrenó
// (la guarda un trigger de la base de datos justo antes de un ajuste, migración 22), con el
// rango real de sus series. Al abrir un periodo se ve qué cambió respecto al anterior, la
// prescripción de ese momento y lo que el atleta hizo en cada ejercicio.
// Arriba aparece la rutina actual comparada con el último periodo guardado.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { textoPrescripcion } from '../lib/rutinas'
import {
  compararFotos, periodoAnterior, textoRangoPeriodo, textoActividad,
} from '../lib/versionesRutina'
import { TARJETA } from '../lib/estilos'

const ETIQUETA = {
  agregado: 'Agregado',
  quitado: 'Quitado',
  reemplazado: 'Reemplazado',
  modificado: 'Ajustado',
  rutina: 'Rutina',
}

function ListaCambios({ cambios }) {
  return (
    <ul className="flex flex-col gap-2">
      {cambios.map((c, i) => (
        <li key={`${c.tipo}-${c.nombre}-${i}`} className="rounded-xl bg-hundido p-2 text-sm">
          <p>
            <span className="font-semibold text-enlace">{ETIQUETA[c.tipo]}</span>{' '}
            <span className="font-semibold">{c.nombre}</span>
            {c.dia && <span className="text-suave"> · {c.dia}</span>}
          </p>
          {c.lineas.map((linea) => (
            <p key={linea} className="text-suave">{linea}</p>
          ))}
        </li>
      ))}
    </ul>
  )
}

// Un periodo guardado. La actividad del atleta se pide (resumida en la base de datos) solo
// al abrirlo.
function PeriodoCard({ version, anterior }) {
  const [abierto, setAbierto] = useState(false)
  const [actividad, setActividad] = useState(null) // { [exercise_id]: fila } cuando ya llegó
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto || actividad) return
    let cancelado = false
    supabase.rpc('resumen_periodo_rutina', { p_version_id: version.id }).then(({ data, error: err }) => {
      if (cancelado) return
      if (err) { setError('No se pudo cargar lo que hizo el atleta en este periodo.'); return }
      setError('')
      setActividad(Object.fromEntries(data.map((fila) => [fila.exercise_id, fila])))
    })
    return () => { cancelado = true }
  }, [abierto, actividad, version.id])

  const foto = version.foto
  const cambios = anterior ? compararFotos(anterior.foto, foto) : null

  return (
    <li className={TARJETA}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex min-h-11 w-full flex-col items-start text-left"
      >
        <span className="font-semibold">Periodo {version.numero} · {foto.rutina_nombre}</span>
        <span className="text-sm text-suave">
          {textoRangoPeriodo(version.desde, version.hasta)} · {version.series_registradas}{' '}
          {version.series_registradas === 1 ? 'serie' : 'series'}
        </span>
      </button>

      {abierto && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm font-semibold">Qué cambió respecto al periodo anterior</p>
            {cambios === null && (
              <p className="text-sm text-suave">No hay un periodo anterior guardado con el que comparar.</p>
            )}
            {cambios && cambios.length === 0 && <p className="text-sm text-suave">Sin cambios.</p>}
            {cambios && cambios.length > 0 && <ListaCambios cambios={cambios} />}
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold">Prescripción en ese periodo y lo que hizo el atleta</p>
            {error && <p role="alert" className="mb-2 text-sm text-alerta">{error}</p>}
            {!actividad && !error && <p className="mb-2 text-sm text-suave">Cargando...</p>}
            <div className="flex flex-col gap-3">
              {foto.dias.map((dia) => (
                <div key={dia.id}>
                  <p className="text-sm font-semibold text-enlace">{dia.nombre}</p>
                  <ul className="mt-1 flex flex-col gap-2">
                    {dia.ejercicios.map((e) => {
                      const hecho = actividad?.[e.exercise_id]
                      return (
                        <li key={e.id} className="rounded-xl bg-hundido p-2 text-sm">
                          <p className="font-semibold">
                            {e.nombre}
                            {foto.modo_hibrido && (
                              <span className="font-normal text-suave">
                                {' '}· {e.bloque === 'halterofilia' ? 'halterofilia' : 'musculación'}
                              </span>
                            )}
                          </p>
                          <p className="text-suave">{textoPrescripcion(e)}</p>
                          {actividad && (
                            <p>{hecho ? textoActividad(hecho) : 'El atleta no registró series de este ejercicio.'}</p>
                          )}
                        </li>
                      )
                    })}
                    {dia.ejercicios.length === 0 && <li className="text-sm text-suave">Día sin ejercicios.</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

export default function HistorialRutina({ atletaId }) {
  const [versiones, setVersiones] = useState([])
  const [actual, setActual] = useState(null) // { nombre, cambios, seriesDesde } de la rutina activa
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const [resVersiones, resActiva] = await Promise.all([
        supabase
          .from('routine_versions')
          .select('id, routine_id, numero, desde, hasta, series_registradas, foto')
          .eq('user_id', atletaId)
          .order('desde', { ascending: false })
          .limit(50),
        supabase.from('routines').select('id, nombre').eq('user_id', atletaId).eq('estado', 'activa').maybeSingle(),
      ])
      if (cancelado) return
      if (resVersiones.error || resActiva.error) {
        setError('No se pudo cargar el historial de la rutina.')
        setCargando(false)
        return
      }

      let infoActual = null
      const activa = resActiva.data
      if (activa) {
        // Último periodo guardado de ESTA rutina (la lista viene de la más reciente a la más antigua)
        const ultimo = resVersiones.data.find((v) => v.routine_id === activa.id) ?? null
        const [resFoto, resConteo] = await Promise.all([
          supabase.rpc('foto_rutina', { p_routine_id: activa.id }),
          ultimo
            ? supabase
              .from('routine_logs')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', atletaId)
              .gt('realizado_en', ultimo.hasta)
            : Promise.resolve({ count: null, error: null }),
        ])
        if (cancelado) return
        if (resFoto.error || resConteo.error) {
          setError('No se pudo cargar el historial de la rutina.')
          setCargando(false)
          return
        }
        infoActual = {
          nombre: activa.nombre,
          hayPeriodos: Boolean(ultimo),
          cambios: ultimo ? compararFotos(ultimo.foto, resFoto.data) : [],
          seriesDesde: resConteo.count ?? 0,
        }
      }
      setVersiones(resVersiones.data)
      setActual(infoActual)
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [atletaId])

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Periodos de la rutina</h3>
      <p className="text-sm text-suave">
        Cada vez que ajustas una rutina en la que el atleta ya registró series, se guarda cómo estaba
        mientras la entrenó. Lo que hizo el atleta nunca se modifica.
      </p>
      {cargando && <p className="text-suave">Cargando...</p>}
      {error && <p role="alert" className="text-alerta">{error}</p>}

      {!cargando && !error && actual && (
        <div className={TARJETA}>
          <p className="font-semibold">Rutina actual · {actual.nombre}</p>
          {!actual.hayPeriodos && (
            <p className="text-sm text-suave">Todavía no hay periodos guardados de esta rutina.</p>
          )}
          {actual.hayPeriodos && (
            <>
              <p className="text-sm text-suave">
                {actual.seriesDesde} {actual.seriesDesde === 1 ? 'serie registrada' : 'series registradas'} desde el último periodo guardado.
              </p>
              <p className="mb-1 mt-2 text-sm font-semibold">Cambios respecto al último periodo</p>
              {actual.cambios.length === 0
                ? <p className="text-sm text-suave">Sin cambios.</p>
                : <ListaCambios cambios={actual.cambios} />}
            </>
          )}
        </div>
      )}

      {!cargando && !error && versiones.length === 0 && (
        <p className="text-suave">Aún no hay periodos guardados para este atleta.</p>
      )}
      <ul className="flex flex-col gap-3">
        {versiones.map((v) => (
          <PeriodoCard key={v.id} version={v} anterior={periodoAnterior(v, versiones)} />
        ))}
      </ul>
      {!cargando && !error && (
        <p className="text-xs text-suave">
          Los ajustes hechos antes de esta función no tienen foto: el primer periodo de una rutina
          que ya se estaba entrenando puede incluirlos.
        </p>
      )}
    </section>
  )
}
