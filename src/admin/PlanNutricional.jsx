// =====================================================================
// PlanNutricional — el entrenador define el plan de UN atleta con un CONFIGURADOR inteligente.
//
// El formulario (ConfiguradorPlan) calcula calorías y macros desde el objetivo y los datos del
// atleta; este componente carga el plan vigente, el historial y los datos físicos del perfil.
// Cómo funciona el "cambio de plan":
//   - Nunca se EDITA un plan: se crea uno NUEVO y el anterior pasa al historial.
//   - Lo hace una función de la base de datos (set_nutrition_plan, migraciones 08 y 26):
//     cierra el plan vigente y crea el nuevo en una sola operación (todo o nada).
//   - El atleta ve el plan nuevo al instante y «Comidas del día» lo usa como única referencia.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { textoEstadoCalorico, textoOrigenPlan } from '../lib/opciones'
import { INTENSIDADES, OBJETIVOS, TIPOS_DIETA } from '../lib/planNutricional'
import { fechaCortaDeTimestamp } from '../lib/records'
import { BOTON_SEC, TARJETA } from '../lib/estilos'
import PlanNutricionalCard from '../components/PlanNutricionalCard'
import ConfiguradorPlan from './ConfiguradorPlan'

const COLUMNAS = 'id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g, objetivo_calorico, origen, vigente_desde, vigente_hasta, notas, objetivo_fisico, intensidad, tipo_dieta, tmb_kcal, gasto_kcal, peso_base_kg'
const etiqueta = (lista, valor) => lista.find((o) => o.valor === valor)?.etiqueta

export default function PlanNutricional({ atletaId, fechaNacimiento = null, onCambio }) {
  const [planes, setPlanes] = useState([])
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let cancelado = false
    Promise.all([
      supabase.from('nutrition_plans').select(COLUMNAS).eq('user_id', atletaId)
        .order('vigente_desde', { ascending: false }).limit(20),
      // Datos físicos guardados en el perfil (migración 26); solo el entrenador puede cambiarlos
      supabase.from('profiles').select('sexo, estatura_cm, nivel_actividad').eq('id', atletaId).maybeSingle(),
    ]).then(([p, f]) => {
      if (cancelado) return
      if (p.error || f.error) setErrorCarga('No se pudo cargar el plan nutricional.')
      else {
        setPlanes(p.data)
        setPerfil(f.data)
        setErrorCarga('')
      }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [atletaId, version])

  const activo = planes.find((p) => p.vigente_hasta === null) ?? null
  const anteriores = planes.filter((p) => p.vigente_hasta !== null)

  function alGuardar() {
    setVersion((v) => v + 1)
    onCambio?.() // avisa a la ficha: actualiza el gráfico de calorías y reajusta «Comidas del día»
  }

  async function finalizar() {
    if (!window.confirm('¿Finalizar el plan actual? El atleta se quedará sin plan vigente hasta que definas uno nuevo.')) return
    // Aquí SÍ usamos un instante exacto (toISOString) porque vigente_hasta es una marca
    // de tiempo; lo que está prohibido es usarlo para fechas de negocio (YYYY-MM-DD).
    const { data, error } = await supabase
      .from('nutrition_plans')
      .update({ vigente_hasta: new Date().toISOString() })
      .eq('id', activo.id)
      .select('id') // RLS no avisa cuando bloquea: comprobamos que sí se modificó una fila
    if (error || !data || data.length === 0) {
      return setMensaje({ tipo: 'error', texto: 'No se pudo finalizar el plan.' })
    }
    setMensaje({ tipo: 'ok', texto: 'Plan finalizado.' })
    alGuardar()
  }

  const colorMensaje = { error: 'text-alerta', ok: 'text-enlace' }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Plan nutricional</h3>

      {cargando && <p className="text-suave">Cargando plan...</p>}
      {errorCarga && <p role="alert" className="text-alerta">{errorCarga}</p>}

      {!cargando && !errorCarga && (
        <>
          <PlanNutricionalCard plan={activo} />
          {activo && (
            <button type="button" onClick={finalizar} className={`${BOTON_SEC} text-alerta`}>
              Finalizar plan actual
            </button>
          )}
          {mensaje && (
            <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={colorMensaje[mensaje.tipo]}>{mensaje.texto}</p>
          )}

          {/* key: al guardar un plan nuevo el formulario arranca de nuevo con sus valores */}
          <ConfiguradorPlan
            key={activo?.id ?? 'sin-plan'}
            atletaId={atletaId}
            fechaNacimiento={fechaNacimiento}
            activo={activo}
            perfil={perfil}
            onGuardado={alGuardar}
          />

          {anteriores.length > 0 && (
            <div>
              <h4 className="mb-2 font-semibold">Planes anteriores</h4>
              <ul className="flex flex-col gap-2">
                {anteriores.map((a) => (
                  <li key={a.id} className={TARJETA}>
                    <p className="font-semibold">{a.calorias_objetivo.toLocaleString('es-CO')} kcal</p>
                    {a.objetivo_fisico && (
                      <p className="text-xs text-enlace">
                        {[etiqueta(OBJETIVOS, a.objetivo_fisico), etiqueta(INTENSIDADES, a.intensidad), etiqueta(TIPOS_DIETA, a.tipo_dieta)].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-sm text-suave">
                      {[
                        a.proteina_g !== null && `P ${a.proteina_g} g`,
                        a.carbohidratos_g !== null && `C ${a.carbohidratos_g} g`,
                        a.grasas_g !== null && `G ${a.grasas_g} g`,
                        a.objetivo_calorico && textoEstadoCalorico(a.objetivo_calorico),
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-suave">
                      {fechaCortaDeTimestamp(a.vigente_desde)} – {fechaCortaDeTimestamp(a.vigente_hasta)} · {textoOrigenPlan(a.origen)}
                    </p>
                    {a.notas && <p className="mt-1 text-sm">{a.notas}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
