// =====================================================================
// MisMediciones (sección "Medidas" de Mis datos) — el atleta VE sus mediciones (peso, cintura, calorías). Solo lectura.
//
// Fíjate en lo que NO hay aquí: ningún formulario, ningún botón de guardar o
// borrar. Y aunque los hubiera, la base de datos no se lo permitiría (RLS).
// Son DOS capas: la pantalla no ofrece la acción, y la base de datos la prohíbe.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { formatearFecha } from '../lib/fechas'
import { resumirMediciones, textoMedicion } from '../lib/mediciones'
import { combinarPesos } from '../lib/pesoCombinado'
import ResumenMediciones from '../components/ResumenMediciones'
import GraficoEvolucion from '../components/GraficoEvolucionLazy'
import GraficoTendenciaPeso from '../components/GraficoTendenciaPesoLazy'
import GraficoOscilacionPeso from '../components/GraficoOscilacionPesoLazy'

export default function MisMediciones() {
  const { perfil } = useAuth()
  const [mediciones, setMediciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [planes, setPlanes] = useState([]) // planes nutricionales (para la línea de objetivo)
  // Pesos que el atleta declara en su check-in diario (solo lectura; se suman a la VISTA, no a metrics)
  const [checkIns, setCheckIns] = useState([])

  useEffect(() => {
    let cancelado = false
    supabase
      .from('metrics')
      .select('id, fecha, peso_corporal_kg, perimetro_cintura_cm, calorias_consumidas, estado_calorico, notas')
      // Este .eq NO es lo que protege tus datos (RLS ya devolvería solo tus filas);
      // lo ponemos para que la intención sea explícita y la consulta, más eficiente.
      .eq('user_id', perfil.id)
      .order('fecha', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setError('No se pudieron cargar tus datos.')
        else setMediciones(data)
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [perfil.id])

  // Planes nutricionales del atleta. Si falla no es grave: el gráfico simplemente no muestra la línea.
  useEffect(() => {
    let cancelado = false
    supabase
      .from('nutrition_plans')
      .select('calorias_objetivo, vigente_desde, vigente_hasta')
      .eq('user_id', perfil.id)
      .order('vigente_desde')
      .then(({ data }) => { if (!cancelado && data) setPlanes(data) })
    return () => { cancelado = true }
  }, [perfil.id])

  // Check-ins con peso (1 por día). Si falla no es grave: se muestran solo las mediciones oficiales.
  // Se pide por la fecha de HOY hacia atrás (60 días de check-ins como máximo).
  useEffect(() => {
    let cancelado = false
    supabase
      .from('daily_check_ins')
      .select('fecha, peso_corporal_kg')
      .eq('user_id', perfil.id)
      .not('peso_corporal_kg', 'is', null)
      .order('fecha', { ascending: false })
      .limit(60)
      .then(({ data }) => { if (!cancelado && data) setCheckIns(data) })
    return () => { cancelado = true }
  }, [perfil.id])

  if (cargando) return <p className="text-suave">Cargando tus datos...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  // Oficial + declarado (si el mismo día hay medición oficial con peso, manda esa)
  const pesos = combinarPesos(mediciones, checkIns)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {pesos.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-superficie p-4 text-suave lg:col-span-2">
          Aún no tienes mediciones registradas. Cuando tu entrenador las cargue o anotes tu peso en el check-in, las verás aquí.
        </p>
      ) : (
        <>
          {/* Lo primero que ve el atleta: hacia dónde va su peso (tendencia + proyección). */}
          <GraficoTendenciaPeso mediciones={pesos} />
          <GraficoOscilacionPeso mediciones={pesos} />
          <p className="text-sm text-suave lg:col-span-2">
            Tu entrenador registra las mediciones oficiales. El peso que anotas en tu check-in diario también cuenta para tu tendencia y tu peso actual; si el mismo día hay medición oficial, manda esa.
          </p>
          <div className="lg:col-span-2">
            <ResumenMediciones
              resumen={resumirMediciones(pesos)}
              objetivoKcal={planes.find((p) => p.vigente_hasta === null)?.calorias_objetivo ?? null}
            />
          </div>
          {mediciones.length > 0 && <div className="lg:col-span-2"><GraficoEvolucion mediciones={mediciones} planes={planes} /></div>}

          {mediciones.length > 0 && <section className="lg:col-span-2">
            <h3 className="mb-2 text-lg font-bold">Historial</h3>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {mediciones.map((m) => (
                <li key={m.id} className="rounded-2xl border border-borde bg-superficie p-4">
                  <p className="font-semibold capitalize">{formatearFecha(m.fecha)}</p>
                  <p className="mt-1 text-sm text-suave">{textoMedicion(m)}</p>
                  {m.notas && <p className="mt-1 text-sm">{m.notas}</p>}
                </li>
              ))}
            </ul>
          </section>}
        </>
      )}
    </div>
  )
}
