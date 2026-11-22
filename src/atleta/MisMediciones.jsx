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
import ResumenMediciones from '../components/ResumenMediciones'
import GraficoEvolucion from '../components/GraficoEvolucionLazy'

export default function MisMediciones() {
  const { perfil } = useAuth()
  const [mediciones, setMediciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [planes, setPlanes] = useState([]) // planes nutricionales (para la línea de objetivo)

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

  if (cargando) return <p className="text-suave">Cargando tus datos...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave">
        Tu entrenador registra estas mediciones. Aquí puedes ver tu progreso.
      </p>

      {mediciones.length === 0 ? (
        <p className="rounded-2xl border border-borde bg-superficie p-4 text-suave">
          Aún no tienes mediciones registradas. Cuando tu entrenador las cargue, las verás aquí.
        </p>
      ) : (
        <>
          <ResumenMediciones
            resumen={resumirMediciones(mediciones)}
            objetivoKcal={planes.find((p) => p.vigente_hasta === null)?.calorias_objetivo ?? null}
          />
          <GraficoEvolucion mediciones={mediciones} planes={planes} />

          <section>
            <h3 className="mb-2 font-semibold">Historial</h3>
            <ul className="flex flex-col gap-3">
              {mediciones.map((m) => (
                <li key={m.id} className="rounded-2xl border border-borde bg-superficie p-4">
                  <p className="font-semibold capitalize">{formatearFecha(m.fecha)}</p>
                  <p className="mt-1 text-sm text-suave">{textoMedicion(m)}</p>
                  {m.notas && <p className="mt-1 text-sm">{m.notas}</p>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
