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
import { hayMacros, resumenComidas, totalesAsignados, ultimaActualizacion } from '../lib/comidas'
import { cargarComidas } from '../lib/cargarComidas'
import { cargarConCache } from '../lib/cacheOffline'
import { useConexion } from '../lib/useConexion'
import { fechaCortaDeTimestamp } from '../lib/records'
import { TARJETA } from '../lib/estilos'
import PlanNutricionalCard from '../components/PlanNutricionalCard'
import ListaComidas from '../components/ListaComidas'
import NotaDatosGuardados from '../components/NotaDatosGuardados'

export default function Nutricion() {
  const { perfil } = useAuth()
  const [plan, setPlan] = useState(null)
  const [mediciones, setMediciones] = useState([])
  const [comidas, setComidas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardadoEn, setGuardadoEn] = useState(null) // si se ve una copia guardada (sin conexión)
  const conectado = useConexion() // al volver el internet se recarga con datos frescos

  useEffect(() => {
    let cancelado = false
    // Con internet se lee de Supabase y se guarda copia (plan, comidas y mediciones); sin él se usa la copia.
    cargarConCache(perfil.id, 'nutricion', async () => {
      const [p, m, c] = await Promise.all([
        supabase.from('nutrition_plans')
          .select('id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g, objetivo_calorico, vigente_desde, notas')
          .eq('user_id', perfil.id).is('vigente_hasta', null).maybeSingle(),
        supabase.from('metrics')
          .select('id, fecha, peso_corporal_kg, perimetro_cintura_cm, calorias_consumidas, estado_calorico, notas')
          .eq('user_id', perfil.id).order('fecha', { ascending: false }).limit(30),
        cargarComidas(perfil.id),
      ])
      const errorBD = p.error ?? m.error ?? c.errorBD
      if (errorBD) return { error: errorBD }
      return { plan: p.data, mediciones: m.data, comidas: c.comidas }
    }).then((r) => {
      if (cancelado) return
      if (r.error) {
        setError(r.error.sinCache
          ? 'Sin conexión. Abre Nutrición una vez con internet para poder verla sin señal.'
          : 'No se pudo cargar tu información de nutrición.')
      } else {
        setPlan(r.plan); setMediciones(r.mediciones); setComidas(r.comidas)
        setGuardadoEn(r.desdeCache ? r.guardadoEn : null)
        setError('')
      }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [perfil.id, conectado])

  if (cargando) return <p className="text-suave">Cargando...</p>
  if (error) return <p role="alert" className="text-alerta">{error}</p>

  // Estado vacío: el entrenador todavía no definió nada.
  if (!plan && comidas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Nutrición</h2>
        <NotaDatosGuardados guardadoEn={guardadoEn} />
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
  // Total del día de las comidas (suma de los macros guardados con cada alimento del catálogo)
  const totalComidas = hayMacros(comidas)
    ? totalesAsignados(comidas.flatMap((c) => c.alimentos))
    : null
  const num = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Nutrición</h2>
      <NotaDatosGuardados guardadoEn={guardadoEn} />

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
        {totalComidas && (
          <div className={TARJETA}>
            <p className="text-sm text-suave">Total de tus comidas del día</p>
            <p className="text-2xl font-bold">
              {num(totalComidas.calorias)} <span className="text-base font-normal text-suave">kcal</span>
            </p>
            <p className="text-sm text-suave">
              Proteína {num(totalComidas.proteina)} g · Carbohidratos {num(totalComidas.carbohidratos)} g · Grasas {num(totalComidas.grasas)} g
            </p>
            {totalComidas.sinMacros > 0 && (
              <p className="text-xs text-suave">No incluye {totalComidas.sinMacros} {totalComidas.sinMacros === 1 ? 'alimento' : 'alimentos'} sin macros calculados.</p>
            )}
          </div>
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
