// =====================================================================
// Nutricion — sección "Nutrición" de Mis datos (solo lectura).
// El atleta ve el plan que su entrenador le definió y cómo van sus calorías
// de los últimos 7 días frente a ese objetivo.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { resumirMediciones } from '../lib/mediciones'
import { textoAdherencia } from '../lib/nutricion'
import { TARJETA } from '../lib/estilos'
import PlanNutricionalCard from '../components/PlanNutricionalCard'

export default function Nutricion() {
  const { perfil } = useAuth()
  const [plan, setPlan] = useState(null)
  const [mediciones, setMediciones] = useState([])
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
    ]).then(([p, m]) => {
      if (cancelado) return
      if (p.error || m.error) setError('No se pudo cargar tu información de nutrición.')
      else { setPlan(p.data); setMediciones(m.data) }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [perfil.id])

  if (cargando) return <p className="text-suave">Cargando...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  if (!plan) {
    return (
      <div className={TARJETA}>
        <p className="font-semibold">Nutrición</p>
        <p className="mt-1 text-sm text-suave">Tu entrenador aún no te ha definido un plan nutricional.</p>
      </div>
    )
  }

  const { promedioKcal7, diasKcal7 } = resumirMediciones(mediciones)
  const adherencia = textoAdherencia(promedioKcal7, plan.calorias_objetivo)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave">Este es el plan que definió tu entrenador.</p>
      <PlanNutricionalCard plan={plan} titulo="Tu plan actual" />

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
    </div>
  )
}
