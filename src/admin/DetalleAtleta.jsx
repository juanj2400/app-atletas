// =====================================================================
// DetalleAtleta — pantalla del entrenador para UN atleta (/admin/atletas/:id).
//
// Como la ficha ya tiene muchas secciones, se ordena en TRES pestañas:
//   - Resumen:          check-ins de la semana y su historial.
//   - Entrenamiento:    rutinas, ciclos, volumen, lista negra, récords y series recientes.
//   - Cuerpo y nutrición: plan nutricional y mediciones.
// (La pestaña activa es un simple estado local: al salir de la ficha vuelve a "Resumen".)
// =====================================================================
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import Mediciones from './Mediciones'
import PlanNutricional from './PlanNutricional'
import RutinasAtleta from './RutinasAtleta'
import CiclosAtleta from './CiclosAtleta'
import ListaNegraAtleta from './ListaNegraAtleta'
import VolumenMuscular from './VolumenMuscular'
import HistorialEntrenamiento from './HistorialEntrenamiento'
import RecordsAtleta from '../components/RecordsAtleta'
import { fechaLocalISO, formatearFecha } from '../lib/fechas'
import { textoAnimo, textoSiNo } from '../lib/opciones'

const PESTANAS = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'entrenamiento', texto: 'Entrenamiento' },
  { id: 'cuerpo', texto: 'Cuerpo y nutrición' },
]

export default function DetalleAtleta() {
  // useParams lee los parámetros de la URL definidos en App.jsx con ":id".
  const { id } = useParams()

  const [atleta, setAtleta] = useState(null)
  const [checkIns, setCheckIns] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState('resumen')
  const [versionPlan, setVersionPlan] = useState(0) // sube cuando se cambia el plan, para refrescar el gráfico de Mediciones

  // El efecto depende de [id]: si el id de la URL cambia, se vuelve a ejecutar.
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError('')
      // Promise.all lanza las dos consultas A LA VEZ y espera a que terminen ambas.
      const [resAtleta, resCheckIns] = await Promise.all([
        supabase.from('profiles').select('id, nombre_completo, email').eq('id', id).maybeSingle(),
        supabase
          .from('daily_check_ins')
          .select('fecha, calorias_ayer_cumplidas, horas_sueno, estado_animo, se_siente_recuperado')
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

  // ---- Datos DERIVADOS: se calculan en cada dibujado a partir del estado.
  // Las fechas son texto "YYYY-MM-DD", y comparar ese texto equivale a comparar fechas.
  const hace6Dias = fechaLocalISO(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
  const ultimos7 = checkIns.filter((c) => c.fecha >= hace6Dias)
  const horas = ultimos7.filter((c) => c.horas_sueno !== null).map((c) => Number(c.horas_sueno))
  const promedioSueno = horas.length
    ? horas.reduce((suma, h) => suma + h, 0) / horas.length // reduce: acumula una suma
    : null

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
            </div>

            {/* Selector de pestaña (botones tipo "segmentos") */}
            <div role="group" aria-label="Secciones de la ficha" className="flex gap-1 rounded-2xl border border-borde bg-superficie p-1">
              {PESTANAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={pestana === p.id}
                  onClick={() => setPestana(p.id)}
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-borde bg-superficie p-4">
                    <p className="text-sm text-suave">Check-ins (7 días)</p>
                    <p className="text-2xl font-bold">{ultimos7.length} de 7</p>
                  </div>
                  <div className="rounded-2xl border border-borde bg-superficie p-4">
                    <p className="text-sm text-suave">Sueño promedio</p>
                    <p className="text-2xl font-bold">
                      {promedioSueno === null ? '—' : `${promedioSueno.toFixed(1)} h`}
                    </p>
                  </div>
                </div>

                <section>
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
                            <dt className="text-suave">Ánimo</dt>
                            <dd>{textoAnimo(c.estado_animo)}</dd>
                            <dt className="text-suave">Recuperado</dt>
                            <dd>{textoSiNo(c.se_siente_recuperado)}</dd>
                            <dt className="text-suave">Cumplió kcal ayer</dt>
                            <dd>{textoSiNo(c.calorias_ayer_cumplidas)}</dd>
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
                <RutinasAtleta atletaId={atleta.id} />
                <CiclosAtleta atletaId={atleta.id} />
                <VolumenMuscular atletaId={atleta.id} titulo="Volumen semanal (rutina activa)" />
                <ListaNegraAtleta atletaId={atleta.id} />
                <section className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold">Récords personales</h3>
                  <RecordsAtleta userId={atleta.id} />
                </section>
                <HistorialEntrenamiento atletaId={atleta.id} />
              </>
            )}

            {pestana === 'cuerpo' && (
              <>
                <PlanNutricional atletaId={atleta.id} onCambio={() => setVersionPlan((v) => v + 1)} />
                {/* Componente autónomo: solo necesita saber de qué atleta es. */}
                <Mediciones atletaId={atleta.id} versionPlan={versionPlan} />
              </>
            )}
          </div>
        )}
      </main>
    </>
  )
}
