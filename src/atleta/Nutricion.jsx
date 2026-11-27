// =====================================================================
// Nutricion — sección principal "Nutrición" del atleta (/atleta/nutricion), solo lectura.
// Es una pestaña de la barra inferior (junto a Entrenar y Mis datos). Muestra, en este orden:
//   1. Sus COMIDAS del día: qué comer en cada una y en qué cantidad (lo arma su entrenador).
//   2. Su objetivo diario: calorías, macros y notas del plan nutricional.
//   3. Cómo van sus calorías de los últimos 7 días frente a ese objetivo.
// Como es hija de PantallaAtleta, pasa por el portero del check-in igual que el resto.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { resumirMediciones } from '../lib/mediciones'
import { textoAdherencia } from '../lib/nutricion'
import { resumenComidas, ultimaActualizacion } from '../lib/comidas'
import { cargarComidas } from '../lib/cargarComidas'
import { fechaCortaDeTimestamp } from '../lib/records'
import { TARJETA } from '../lib/estilos'
import PlanNutricionalCard from '../components/PlanNutricionalCard'
import ListaComidas from '../components/ListaComidas'

export default function Nutricion() {
  const { perfil } = useAuth()
  const [plan, setPlan] = useState(null)
  const [mediciones, setMediciones] = useState([])
  const [comidas, setComidas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    Promise.all([
      supabase.from('nutrition_plans')
        .select('id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g, objetivo_calorico, vigente_desde, notas')
        .eq('user_id', perfil.id).is('vigente_hasta', null).maybeSingle(),
      supabase.from('metrics')
        .select('id, fecha, peso_corporal_kg, perimetro_cintura_cm, calorias_consumidas, estado_calorico, notas')
        .eq('user_id', perfil.id).order('fecha', { ascending: false }).limit(30),
      cargarComidas(perfil.id),
    ]).then(([p, m, c]) => {
      if (cancelado) return
      if (p.error || m.error || c.error) setError('No se pudo cargar tu información de nutrición.')
      else { setPlan(p.data); setMediciones(m.data); setComidas(c.comidas) }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [perfil.id])

  if (cargando) return <p className="text-suave">Cargando...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  // Estado vacío: el entrenador todavía no definió nada.
  if (!plan && comidas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Nutrición</h2>
        <div className={TARJETA}>
          <p className="font-semibold">Aún no hay plan</p>
          <p className="mt-1 text-sm text-suave">
            Tu entrenador todavía no te ha definido un plan nutricional ni tus comidas del día.
          </p>
        </div>
      </div>
    )
  }

  const { promedioKcal7, diasKcal7 } = resumirMediciones(mediciones)
  const adherencia = plan ? textoAdherencia(promedioKcal7, plan.calorias_objetivo) : null
  const actualizado = ultimaActualizacion(comidas)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Nutrición</h2>

      <section aria-labelledby="titulo-comidas" className="flex flex-col gap-3">
        <div>
          <h3 id="titulo-comidas" className="text-lg font-bold">Tus comidas del día</h3>
          {comidas.length > 0 && (
            <p className="text-sm text-suave">
              {resumenComidas(comidas)} · actualizado el {fechaCortaDeTimestamp(actualizado)}
            </p>
          )}
        </div>
        {comidas.length === 0 ? (
          <div className={TARJETA}>
            <p className="text-sm text-suave">Tu entrenador aún no ha armado tus comidas del día.</p>
          </div>
        ) : (
          <ListaComidas comidas={comidas} />
        )}
      </section>

      {plan && (
        <>
          <PlanNutricionalCard plan={plan} titulo="Tu objetivo diario" />

          <div className={TARJETA}>
            <p className="font-semibold">Tus últimos 7 días</p>
            {promedioKcal7 === null ? (
              <p className="mt-1 text-sm text-suave">Aún no hay calorías registradas en los últimos 7 días.</p>
            ) : (
              <>
                <p className="mt-1">
                  Promedio: <span className="font-bold">{promedioKcal7.toLocaleString('es-CO')} kcal</span>
                  {adherencia && <span className="text-suave"> · {adherencia}</span>}
                </p>
                <p className="text-xs text-suave">
                  Basado en {diasKcal7} {diasKcal7 === 1 ? 'día' : 'días'} con registro. Las calorías las carga tu entrenador.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
