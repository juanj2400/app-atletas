// =====================================================================
// DetalleAtleta — pantalla del entrenador para UN atleta (/admin/atletas/:id).
//
// Como la ficha ya tiene muchas secciones, se ordena en TRES pestañas:
//   - Resumen:          el PANEL general (avisos + una tarjeta por apartado) y los check-ins.
//   - Entrenamiento:    rutinas, cargas, ciclos, volumen, lista negra, récords y series recientes.
//   - Cuerpo y nutrición: plan nutricional y mediciones.
// Al abrir la ficha siempre se ve el panel. Cada tarjeta del panel (y cada "chip" del índice
// de las otras pestañas) lleva directo a su sección: cambia de pestaña y baja hasta ella
// (`irA`). La barra de pestañas queda fija arriba para volver al panel en cualquier momento.
// (La pestaña activa es un simple estado local: al salir de la ficha vuelve a "Resumen".)
// Si el editor de comidas tiene cambios sin guardar, `irA` pregunta antes de cambiar de
// pestaña (al cambiar de pestaña esa sección se cierra y el borrador se perdería).
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import Mediciones from './Mediciones'
import PlanNutricional from './PlanNutricional'
import PlanComidas from './PlanComidas'
import RutinasAtleta from './RutinasAtleta'
import DescargaAtleta from './DescargaAtleta'
import CiclosAtleta from './CiclosAtleta'
import ListaNegraAtleta from './ListaNegraAtleta'
import VolumenMuscular from './VolumenMuscular'
import HistorialEntrenamiento from './HistorialEntrenamiento'
import HistorialRutina from './HistorialRutina'
import CargasAtleta from './CargasAtleta'
import FechaNacimientoAtleta from './FechaNacimientoAtleta'
import RecordsAtleta from '../components/RecordsAtleta'
import PanelAtleta from './PanelAtleta'
import { formatearFecha } from '../lib/fechas'
import { textoAnimo, textoSiNo, textoCumplimientoCalorias } from '../lib/opciones'
import { textoKg } from '../lib/records'

const PESTANAS = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'entrenamiento', texto: 'Entrenamiento' },
  { id: 'cuerpo', texto: 'Cuerpo y nutrición' },
]

// Secciones de cada pestaña (el id es el del contenedor que las envuelve más abajo)
const INDICE = {
  entrenamiento: [
    { id: 'seccion-rutinas', texto: 'Rutinas' },
    { id: 'seccion-descarga', texto: 'Descarga' },
    { id: 'seccion-cargas', texto: 'Cargas' },
    { id: 'seccion-ciclos', texto: 'Ciclos' },
    { id: 'seccion-volumen', texto: 'Volumen' },
    { id: 'seccion-listanegra', texto: 'Lista negra' },
    { id: 'seccion-records', texto: 'Récords' },
    { id: 'seccion-periodos', texto: 'Periodos' },
    { id: 'seccion-historial', texto: 'Historial' },
  ],
  cuerpo: [
    { id: 'seccion-plan', texto: 'Plan nutricional' },
    { id: 'seccion-comidas', texto: 'Comidas' },
    { id: 'seccion-mediciones', texto: 'Mediciones' },
  ],
}

// Fila de "chips" para saltar entre las secciones de una pestaña (se desliza a los lados).
function IndiceSecciones({ items, onIr, pestana }) {
  const chip = 'min-h-11 whitespace-nowrap rounded-full border border-borde bg-superficie px-4 text-sm font-semibold'
  return (
    <nav aria-label="Ir a una sección" className="-mx-4 flex gap-2 overflow-x-auto px-4">
      <button type="button" onClick={() => onIr('resumen', 'panel-atleta')} className={`${chip} text-enlace`}>‹ Panel</button>
      {items.map((i) => (
        <button key={i.id} type="button" onClick={() => onIr(pestana, i.id)} className={chip}>{i.texto}</button>
      ))}
    </nav>
  )
}

export default function DetalleAtleta() {
  // useParams lee los parámetros de la URL definidos en App.jsx con ":id".
  const { id } = useParams()

  const [atleta, setAtleta] = useState(null)
  const [checkIns, setCheckIns] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState('resumen')
  // Sección a la que hay que bajar tras cambiar de pestaña (objeto nuevo en cada salto)
  const [destino, setDestino] = useState(null)
  const [versionPlan, setVersionPlan] = useState(0) // sube cuando se cambia el plan, para refrescar el gráfico de Mediciones
  // ¿El editor de comidas tiene cambios sin guardar? Es una referencia (no un estado) porque
  // solo se consulta al cambiar de pestaña y no hace falta volver a dibujar la ficha.
  const comidasSinGuardar = useRef(false)
  const marcarComidasSinGuardar = useCallback((hay) => { comidasSinGuardar.current = hay }, [])

  // El efecto depende de [id]: si el id de la URL cambia, se vuelve a ejecutar.
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError('')
      // Promise.all lanza las dos consultas A LA VEZ y espera a que terminen ambas.
      const [resAtleta, resCheckIns] = await Promise.all([
        supabase.from('profiles').select('id, nombre_completo, email, fecha_nacimiento').eq('id', id).maybeSingle(),
        supabase
          .from('daily_check_ins')
          .select('fecha, calorias_ayer_cumplidas, cumplimiento_calorias, horas_sueno, peso_corporal_kg, estado_animo, se_siente_recuperado')
          .eq('user_id', id)
          .order('fecha', { ascending: false }) // los más recientes primero
          .limit(14),                            // solo las últimas 2 semanas
      ])
      if (cancelado) return
      if (resAtleta.error || resCheckIns.error) {
        setError('No se pudieron cargar los datos del atleta.')
      } else {
        setAtleta(resAtleta.data)
        setCheckIns(resCheckIns.data)
      }
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [id])

  // Cambia de pestaña y, si se indica una sección, baja hasta ella. Espera un instante a que
  // la pestaña nueva se dibuje (los contenedores existen desde el primer momento, aunque sus
  // datos lleguen después).
  function irA(nuevaPestana, seccion = null) {
    // Solo se pregunta si de verdad se sale de la pestaña (saltar entre secciones de la misma no la cierra).
    if (
      nuevaPestana !== pestana && comidasSinGuardar.current &&
      !window.confirm('Tienes cambios sin guardar en las comidas del día. Si cambias de pestaña se perderán. ¿Salir de todos modos?')
    ) return
    setPestana(nuevaPestana)
    setDestino(seccion ? { seccion } : null)
  }

  useEffect(() => {
    if (!destino) return
    const t = setTimeout(() => {
      const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      document.getElementById(destino.seccion)?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(t)
  }, [destino])

  return (
    <>
      <Encabezado titulo="Atleta" volverA="/admin" textoVolver="Atletas" />
      <main className="mx-auto max-w-3xl p-4">
        {cargando && <p className="text-suave">Cargando...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        {!cargando && !error && !atleta && (
          <p className="text-suave">No encontramos a este atleta.</p>
        )}

        {atleta && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-bold">{atleta.nombre_completo || 'Sin nombre'}</h2>
              <p className="text-suave">{atleta.email}</p>
              <FechaNacimientoAtleta
                atletaId={atleta.id}
                valor={atleta.fecha_nacimiento}
                onGuardado={(fecha) => setAtleta((anterior) => ({ ...anterior, fecha_nacimiento: fecha }))}
              />
            </div>

            {/* Selector de pestaña (botones tipo "segmentos") */}
            <div role="group" aria-label="Secciones de la ficha" className="sticky top-0 z-10 flex gap-1 rounded-2xl border border-borde bg-superficie p-1">
              {PESTANAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={pestana === p.id}
                  onClick={() => irA(p.id)}
                  className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-1 text-center text-sm font-semibold leading-tight ${
                    pestana === p.id ? 'bg-primario text-white' : 'text-suave'
                  }`}
                >
                  {p.texto}
                </button>
              ))}
            </div>

            {pestana === 'resumen' && (
              <>
                <PanelAtleta atletaId={atleta.id} checkIns={checkIns} onIr={irA} />

                <section id="seccion-checkins" className="scroll-mt-20">
                  <h3 className="mb-2 text-lg font-bold">Check-ins recientes</h3>
                  {checkIns.length === 0 ? (
                    <p className="text-suave">Este atleta aún no ha enviado check-ins.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {checkIns.map((c) => (
                        <li key={c.fecha} className="rounded-2xl border border-borde bg-superficie p-4">
                          <p className="font-semibold capitalize">{formatearFecha(c.fecha)}</p>
                          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <dt className="text-suave">Sueño</dt>
                            <dd>{c.horas_sueno === null ? '—' : `${c.horas_sueno} h`}</dd>
                            <dt className="text-suave">Peso (check-in)</dt>
                            <dd>{c.peso_corporal_kg === null ? '—' : `${textoKg(c.peso_corporal_kg)} kg`}</dd>
                            <dt className="text-suave">Ánimo</dt>
                            <dd>{textoAnimo(c.estado_animo)}</dd>
                            <dt className="text-suave">Recuperado</dt>
                            <dd>{textoSiNo(c.se_siente_recuperado)}</dd>
                            <dt className="text-suave">Calorías de ayer</dt>
                            <dd>{textoCumplimientoCalorias(c.cumplimiento_calorias, c.calorias_ayer_cumplidas)}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            {pestana === 'entrenamiento' && (
              <>
                <IndiceSecciones items={INDICE.entrenamiento} onIr={irA} pestana="entrenamiento" />
                <div id="seccion-rutinas" className="scroll-mt-20"><RutinasAtleta atletaId={atleta.id} /></div>
                <div id="seccion-descarga" className="scroll-mt-20"><DescargaAtleta atletaId={atleta.id} /></div>
                <div id="seccion-cargas" className="scroll-mt-20"><CargasAtleta atletaId={atleta.id} /></div>
                <div id="seccion-ciclos" className="scroll-mt-20"><CiclosAtleta atletaId={atleta.id} /></div>
                <div id="seccion-volumen" className="scroll-mt-20">
                  <VolumenMuscular atletaId={atleta.id} titulo="Volumen semanal (rutina activa)" />
                </div>
                <div id="seccion-listanegra" className="scroll-mt-20"><ListaNegraAtleta atletaId={atleta.id} /></div>
                <section id="seccion-records" className="flex scroll-mt-20 flex-col gap-3">
                  <h3 className="text-lg font-bold">Récords personales</h3>
                  <RecordsAtleta userId={atleta.id} />
                </section>
                <div id="seccion-periodos" className="scroll-mt-20"><HistorialRutina atletaId={atleta.id} /></div>
                <div id="seccion-historial" className="scroll-mt-20"><HistorialEntrenamiento atletaId={atleta.id} /></div>
              </>
            )}

            {pestana === 'cuerpo' && (
              <>
                <IndiceSecciones items={INDICE.cuerpo} onIr={irA} pestana="cuerpo" />
                <div id="seccion-plan" className="scroll-mt-20">
                  <PlanNutricional atletaId={atleta.id} fechaNacimiento={atleta.fecha_nacimiento} onCambio={() => setVersionPlan((v) => v + 1)} />
                </div>
                <div id="seccion-comidas" className="scroll-mt-20">
                  <PlanComidas atletaId={atleta.id} versionPlan={versionPlan} onCambiosSinGuardar={marcarComidasSinGuardar} />
                </div>
                {/* Componente autónomo: solo necesita saber de qué atleta es. */}
                <div id="seccion-mediciones" className="scroll-mt-20">
                  <Mediciones atletaId={atleta.id} versionPlan={versionPlan} />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  )
}
