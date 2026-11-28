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
import { cargarDescargaVigente } from '../lib/cargarDescarga'
import { cargarConCache } from '../lib/cacheOffline'
import { leerCola } from '../lib/colaOffline'
import { descargaVigenteHoy, unirDiasPendientes } from '../lib/vistaOffline'
import { useConexion } from '../lib/useConexion'
import { useCola } from '../lib/useCola'
import AvisoDescarga from '../components/AvisoDescarga'
import NotaDatosGuardados from '../components/NotaDatosGuardados'
import CicloActual from './CicloActual'

export default function Entrenar() {
  const { perfil } = useAuth()
  const { state } = useLocation()
  const [rutina, setRutina] = useState(null)
  // Días de la rutina que ya terminó ESTA semana (lunes a domingo, fecha local)
  const [realizados, setRealizados] = useState([])
  // Semana de descarga en curso (null si no hay); el entrenador la activa desde la ficha
  const [descarga, setDescarga] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardadoEn, setGuardadoEn] = useState(null) // si se ve una copia guardada (sin conexión)

  // useHoy hace que la pantalla se redibuje al cambiar el día; así, al llegar el lunes
  // los días vuelven a quedar disponibles aunque la app haya quedado abierta.
  const hoy = useHoy()
  const semana = inicioSemanaISO()
  // Al volver el internet o terminar de subir registros pendientes, la pantalla se recarga sola.
  const conectado = useConexion()
  const { subidos } = useCola(perfil.id)

  useEffect(() => {
    let cancelado = false
    // Con internet se lee de Supabase y se guarda copia; sin él se usa la última copia (cargarConCache).
    cargarConCache(perfil.id, 'entrenar', async () => {
      const [res, comp, des] = await Promise.all([
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
        cargarDescargaVigente(perfil.id, hoy),
      ])
      const errorBD = res.error ?? comp.error ?? des.errorBD
      if (errorBD) return { error: errorBD }
      return { rutina: res.data, realizados: comp.data, descarga: des.descarga, semanaCache: semana }
    }).then(async (r) => {
      const cola = await leerCola(perfil.id) // días terminados sin señal que aún no suben
      if (cancelado) return
      if (r.error) {
        setError(r.error.sinCache
          ? 'Sin conexión. Abre esta pantalla una vez con internet para poder usarla sin señal.'
          : 'No se pudo cargar tu rutina.')
      } else {
        setRutina(r.rutina)
        // Los días realizados de una copia vieja solo valen si es la misma semana
        setRealizados(unirDiasPendientes(r.semanaCache === semana ? r.realizados : [], cola, semana))
        setDescarga(descargaVigenteHoy(r.descarga, hoy))
        setGuardadoEn(r.desdeCache ? r.guardadoEn : null)
        setError('')
      }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [perfil.id, semana, hoy, conectado, subidos])

  const aviso = state?.rutinaCompletada ? (
    <p role="status" className="rounded-xl border border-exito/40 bg-exito/10 p-3 font-semibold text-exito">
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
      <AvisoDescarga descarga={descarga} hoy={hoy} />
      <NotaDatosGuardados guardadoEn={guardadoEn} />
        <div className={TARJETA}>
          <h2 className="text-xl font-bold">Entrenar</h2>
          <p className="mt-1 text-suave">Tu entrenador aún no te ha asignado una rutina.</p>
        </div>
      </div>
    )
  }

  const dias = [...rutina.routine_days].sort((a, b) => a.orden - b.orden)
  const hechos = dias.filter((d) => realizados.some((r) => r.routine_day_id === d.id)).length

  return (
    <div className="flex flex-col gap-4">
      {aviso}
      <CicloActual />
      <AvisoDescarga descarga={descarga} hoy={hoy} />
      <NotaDatosGuardados guardadoEn={guardadoEn} />
      <div className={`${TARJETA} flex flex-col gap-3`}>
        <div>
          <h2 className="text-xl font-bold md:text-2xl">{rutina.nombre}</h2>
          {rutina.objetivo && <p className="text-sm text-suave">Objetivo: {rutina.objetivo}</p>}
          {rutina.notas && <p className="mt-1 text-sm">{rutina.notas}</p>}
        </div>
        {/* Progreso de la semana: mismos números de antes, ahora con barra. */}
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-suave">Esta semana</span>
            <span className="font-semibold">{hechos} de {dias.length} días realizados</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-hundido" role="progressbar" aria-label="Días realizados esta semana" aria-valuemin={0} aria-valuemax={dias.length} aria-valuenow={hechos}>
            <div className="h-full rounded-full bg-exito" style={{ width: `${dias.length ? (hechos / dias.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <p className="text-sm text-suave">Elige el día que vas a entrenar hoy.</p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {dias.map((d) => {
          const hecho = realizados.find((r) => r.routine_day_id === d.id)
          // Día ya realizado esta semana: marcado; se puede abrir SOLO para ver su resumen
          // (EntrenarDia no deja registrar nada hasta el lunes).
          if (hecho) {
            return (
              <li key={d.id}>
                <Link to={`/atleta/entrenar/${d.id}`} className={`${TARJETA} flex h-full items-center justify-between gap-2 border-exito/40 transition-colors hover:bg-elevada`}>
                  <div>
                    <p className="font-semibold">{d.nombre}</p>
                    <p className="text-sm text-suave">Realizado el {formatearFecha(hecho.fecha)}. Toca para ver lo que hiciste.</p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-bold text-exito">Realizado ✓</span>
                </Link>
              </li>
            )
          }
          return (
          <li key={d.id}>
            <Link to={`/atleta/entrenar/${d.id}`} className={`${TARJETA} flex h-full items-center justify-between transition-colors hover:bg-elevada`}>
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
