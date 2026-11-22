// =====================================================================
// PlanNutricional — el entrenador define el plan de UN atleta (calorías y macros).
//
// Cómo funciona el "cambio de plan":
//   - Nunca se EDITA un plan: se crea uno NUEVO y el anterior pasa al historial.
//     Así queda registro de cada ajuste y se puede ver cómo evolucionó el atleta.
//   - Lo hace una función de la base de datos (set_nutrition_plan, migración 08):
//     cierra el plan vigente y crea el nuevo en una sola operación (todo o nada).
//   - El atleta ve el plan nuevo al instante.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aNumero } from '../lib/numeros'
import { diferenciaMacrosPct, kcalDeMacros } from '../lib/nutricion'
import { ESTADOS_CALORICOS, textoEstadoCalorico, textoOrigenPlan } from '../lib/opciones'
import { fechaCortaDeTimestamp } from '../lib/records'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import PlanNutricionalCard from '../components/PlanNutricionalCard'

const COLUMNAS = 'id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g, objetivo_calorico, origen, vigente_desde, vigente_hasta, notas'

// El formulario arranca con los valores del plan vigente para que ajustes solo lo que cambie.
// Las notas NO se copian: son propias de cada plan.
function formDe(plan) {
  return {
    kcal: String(plan?.calorias_objetivo ?? ''),
    proteina: String(plan?.proteina_g ?? ''),
    carbos: String(plan?.carbohidratos_g ?? ''),
    grasas: String(plan?.grasas_g ?? ''),
    objetivo: plan?.objetivo_calorico ?? '',
    notas: '',
  }
}

export default function PlanNutricional({ atletaId, onCambio }) {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState(() => formDe(null))
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('nutrition_plans')
      .select(COLUMNAS)
      .eq('user_id', atletaId)
      .order('vigente_desde', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setErrorCarga('No se pudo cargar el plan nutricional.')
        else {
          setPlanes(data)
          setForm(formDe(data.find((p) => p.vigente_hasta === null)))
          setErrorCarga('')
        }
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId, version])

  const activo = planes.find((p) => p.vigente_hasta === null) ?? null
  const anteriores = planes.filter((p) => p.vigente_hasta !== null)

  const actualizar = (campo, valor) => { setForm((a) => ({ ...a, [campo]: valor })); setMensaje(null) }

  // Aviso en vivo: ¿los macros suman (más o menos) las calorías objetivo?
  const kcal = aNumero(form.kcal)
  const p = aNumero(form.proteina)
  const c = aNumero(form.carbos)
  const g = aNumero(form.grasas)
  const macrosCompletos = [p, c, g].every((n) => n !== null && !Number.isNaN(n))
  const kcalValida = kcal !== null && !Number.isNaN(kcal) && kcal > 0
  const sumaMacros = macrosCompletos ? kcalDeMacros(p, c, g) : null
  const diferencia = macrosCompletos && kcalValida ? diferenciaMacrosPct(kcal, p, c, g) : null

  async function guardar(evento) {
    evento.preventDefault()
    setMensaje(null)
    const error = (texto) => setMensaje({ tipo: 'error', texto })

    if (kcal === null || Number.isNaN(kcal)) return error('Escribe las calorías objetivo (solo números).')
    if (!Number.isInteger(kcal) || kcal < 500 || kcal > 10000) {
      return error('Las calorías deben ser un número entero entre 500 y 10.000.')
    }
    for (const [nombre, valor] of [['La proteína', p], ['Los carbohidratos', c], ['Las grasas', g]]) {
      if (Number.isNaN(valor)) return error(`${nombre}: escribe solo números.`)
      if (valor !== null && (!Number.isInteger(valor) || valor < 0 || valor > 1000)) {
        return error(`${nombre} deben ser un número entero entre 0 y 1.000 g.`)
      }
    }

    setGuardando(true)
    const { error: errorBD } = await supabase.rpc('set_nutrition_plan', {
      p_user_id: atletaId,
      p_calorias: kcal,
      p_proteina_g: p,
      p_carbohidratos_g: c,
      p_grasas_g: g,
      p_objetivo: form.objetivo || null, // el <select> vacío da '' y la base de datos espera NULL
      p_notas: form.notas.trim() || null,
    })
    setGuardando(false)

    if (errorBD) {
      // P0001 = mensaje que escribimos nosotros en la función (ya viene en español).
      return error(errorBD.code === 'P0001' ? errorBD.message : 'No se pudo guardar el plan. Inténtalo de nuevo.')
    }
    setMensaje({ tipo: 'ok', texto: 'Plan guardado. El atleta ya lo ve.' })
    setVersion((v) => v + 1)
    onCambio?.() // avisa a la ficha para que el gráfico de calorías actualice su línea de objetivo
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
    setVersion((v) => v + 1)
    onCambio?.()
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

          <form onSubmit={guardar} className={`${TARJETA} flex flex-col gap-3`}>
            <h4 className="font-semibold">{activo ? 'Cambiar plan' : 'Definir plan'}</h4>

            <label htmlFor="plan-kcal" className="text-sm text-suave">Calorías objetivo (por día)</label>
            <input id="plan-kcal" inputMode="numeric" placeholder="Ej: 2600" value={form.kcal}
              onChange={(e) => actualizar('kcal', e.target.value)} className={CAMPO} />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="plan-p" className="text-xs text-suave">Proteína (g)</label>
                <input id="plan-p" inputMode="numeric" value={form.proteina}
                  onChange={(e) => actualizar('proteina', e.target.value)} className={CAMPO} />
              </div>
              <div>
                <label htmlFor="plan-c" className="text-xs text-suave">Carbos (g)</label>
                <input id="plan-c" inputMode="numeric" value={form.carbos}
                  onChange={(e) => actualizar('carbos', e.target.value)} className={CAMPO} />
              </div>
              <div>
                <label htmlFor="plan-g" className="text-xs text-suave">Grasas (g)</label>
                <input id="plan-g" inputMode="numeric" value={form.grasas}
                  onChange={(e) => actualizar('grasas', e.target.value)} className={CAMPO} />
              </div>
            </div>

            {sumaMacros !== null && (
              <p className={`text-sm ${diferencia !== null && Math.abs(diferencia) > 10 ? 'text-alerta' : 'text-suave'}`}>
                Los macros suman {sumaMacros.toLocaleString('es-CO')} kcal
                {diferencia !== null && (Math.abs(diferencia) > 10
                  ? ` (${diferencia > 0 ? '+' : ''}${diferencia} % respecto al objetivo: revisa los números).`
                  : ' (coherente con el objetivo).')}
              </p>
            )}

            <label htmlFor="plan-objetivo" className="text-sm text-suave">Estado calórico (opcional)</label>
            <select id="plan-objetivo" value={form.objetivo} onChange={(e) => actualizar('objetivo', e.target.value)} className={CAMPO}>
              <option value="">Sin definir</option>
              {ESTADOS_CALORICOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>

            <label htmlFor="plan-notas" className="text-sm text-suave">Notas para el atleta (opcional)</label>
            <textarea id="plan-notas" rows={2} maxLength={300} value={form.notas}
              onChange={(e) => actualizar('notas', e.target.value)}
              className="w-full rounded-xl border border-[#5B6372] bg-fondo p-3" />

            {mensaje && (
              <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={colorMensaje[mensaje.tipo]}>
                {mensaje.texto}
              </p>
            )}
            <p className="text-xs text-suave">
              Al guardar, el plan actual pasa al historial y el atleta ve el nuevo al instante.
            </p>
            <button type="submit" disabled={guardando} className={BOTON}>
              {guardando ? 'Guardando...' : 'Guardar nuevo plan'}
            </button>
          </form>

          {anteriores.length > 0 && (
            <div>
              <h4 className="mb-2 font-semibold">Planes anteriores</h4>
              <ul className="flex flex-col gap-2">
                {anteriores.map((a) => (
                  <li key={a.id} className={TARJETA}>
                    <p className="font-semibold">{a.calorias_objetivo.toLocaleString('es-CO')} kcal</p>
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
