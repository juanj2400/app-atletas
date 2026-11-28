// =====================================================================
// CalculadoraDieta — panel del creador de dieta: objetivos del día + botón "Calcular gramos".
//
// El entrenador define los macros objetivo (se precargan del plan nutricional vigente), ajusta
// si quiere cuánto pesa cada comida en el reparto y el redondeo de los gramos, y pulsa
// "Calcular gramos": lib/dieta.js reparte los gramos de los alimentos del catálogo (sin IA).
// Después puede editar cualquier gramo a mano en las comidas: el resumen de abajo se actualiza
// en vivo con lo que falta o sobra frente al objetivo.
//
// Este componente NO guarda nada en la base de datos: solo devuelve las comidas con los gramos
// aplicados (onAplicar). El guardado lo hace "Guardar comidas" en PlanComidas.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aNumero } from '../lib/numeros'
import {
  PASOS_REDONDEO, aplicarGramos, calcularGramos, diferenciasDia, esDeCatalogo, totalesDia, validarObjetivo,
} from '../lib/dieta'
import { CAMPO, BOTON, TARJETA } from '../lib/estilos'

const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

// De un plan nutricional (fila) a los textos del formulario de objetivos.
function objetivoDePlan(plan) {
  const texto = (n) => (n === null || n === undefined ? '' : String(n))
  return { proteina: texto(plan?.proteina_g), carbohidratos: texto(plan?.carbohidratos_g), grasas: texto(plan?.grasas_g) }
}

export default function CalculadoraDieta({ atletaId, comidas, onAplicar }) {
  const [objetivo, setObjetivo] = useState({ proteina: '', carbohidratos: '', grasas: '' })
  const [kcalPlan, setKcalPlan] = useState(null)
  const [planCargado, setPlanCargado] = useState(false)
  const [errorPlan, setErrorPlan] = useState('')
  const [pesos, setPesos] = useState({}) // clave de comida -> texto
  const [paso, setPaso] = useState(1)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'error' | 'ok', texto }
  const [avisos, setAvisos] = useState([])

  // Carga UNA fila (el plan vigente) para precargar el objetivo. Solo al abrir.
  useEffect(() => {
    let cancelado = false
    supabase.from('nutrition_plans')
      .select('calorias_objetivo, proteina_g, carbohidratos_g, grasas_g')
      .eq('user_id', atletaId).is('vigente_hasta', null).maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setErrorPlan('No se pudo leer el plan nutricional: escribe el objetivo a mano.')
        else if (data) {
          setObjetivo(objetivoDePlan(data))
          setKcalPlan(data.calorias_objetivo)
        }
        setPlanCargado(true)
      })
    return () => { cancelado = true }
  }, [atletaId])

  const cambiarObjetivo = (campo, valor) => { setObjetivo((o) => ({ ...o, [campo]: valor })); setMensaje(null) }

  const comidasConCatalogo = comidas.filter((c) => c.alimentos.some(esDeCatalogo))
  const totales = totalesDia(comidas)
  const lectura = validarObjetivo(objetivo)
  const diferencias = lectura.objetivo ? diferenciasDia(totales, lectura.objetivo) : null

  function calcular() {
    setMensaje(null)
    setAvisos([])
    if (lectura.error) return setMensaje({ tipo: 'error', texto: lectura.error })
    if (comidasConCatalogo.length === 0) {
      return setMensaje({ tipo: 'error', texto: 'Agrega alimentos del catálogo a las comidas para poder calcular.' })
    }
    // Pesos de las comidas: vacío o inválido = 1 (partes iguales)
    const pesosNumericos = {}
    for (const c of comidasConCatalogo) {
      const n = aNumero(pesos[c.clave] ?? '1')
      if (n === null) continue
      if (Number.isNaN(n) || n < 0 || n > 100) {
        return setMensaje({ tipo: 'error', texto: `El peso de «${c.nombre.trim() || 'una comida'}» debe ser un número entre 0 y 100.` })
      }
      pesosNumericos[c.clave] = n
    }

    const { gramos, avisos: avisosCalculo } = calcularGramos({ comidas, objetivo: lectura.objetivo, pesos: pesosNumericos, paso })
    onAplicar(aplicarGramos(comidas, gramos))
    setAvisos(avisosCalculo)
    setMensaje({ tipo: 'ok', texto: 'Gramos calculados. Puedes ajustarlos a mano abajo; los totales se actualizan al instante.' })
  }

  const colorMensaje = { error: 'text-alerta', ok: 'text-enlace' }

  return (
    <div className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        <h4 className="font-semibold">Calculadora de gramos</h4>
        <p className="text-sm text-suave">
          Calcula los gramos exactos de los alimentos del catálogo para cumplir los macros del día (sin IA).
          Los alimentos manuales no entran al cálculo.
        </p>
      </div>

      <p className="text-sm font-semibold">Objetivo del día (g)</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['proteina', 'Proteína'],
          ['carbohidratos', 'Carbohidratos'],
          ['grasas', 'Grasas'],
        ].map(([campo, etiqueta]) => (
          <div key={campo}>
            <label htmlFor={`obj-${campo}`} className="text-xs text-suave">{etiqueta}</label>
            <input id={`obj-${campo}`} inputMode="decimal" value={objetivo[campo]}
              onChange={(e) => cambiarObjetivo(campo, e.target.value)} placeholder="0" className={CAMPO} />
          </div>
        ))}
      </div>
      {planCargado && kcalPlan !== null && (
        <p className="text-xs text-suave">
          Precargado del plan nutricional vigente ({numero(kcalPlan)} kcal). Puedes cambiarlo solo para este cálculo.
        </p>
      )}
      {planCargado && kcalPlan === null && !errorPlan && (
        <p className="text-xs text-suave">El atleta no tiene plan nutricional vigente: escribe el objetivo a mano.</p>
      )}
      {errorPlan && <p role="alert" className="text-xs text-alerta">{errorPlan}</p>}

      {comidasConCatalogo.length > 1 && (
        <details className="rounded-xl bg-hundido p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
            Reparto entre comidas (opcional)
          </summary>
          <p className="text-xs text-suave">
            Por defecto todas las comidas pesan igual (1). Pon 2 en una comida para que lleve el doble que una de 1.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {comidasConCatalogo.map((c, i) => (
              <div key={c.clave}>
                <label htmlFor={`peso-${c.clave}`} className="text-xs text-suave">{c.nombre.trim() || `Comida ${i + 1}`}</label>
                <input id={`peso-${c.clave}`} inputMode="decimal" value={pesos[c.clave] ?? '1'}
                  onChange={(e) => { setPesos((p) => ({ ...p, [c.clave]: e.target.value })); setMensaje(null) }}
                  className={CAMPO} />
              </div>
            ))}
          </div>
        </details>
      )}

      <div>
        <label htmlFor="paso-redondeo" className="text-xs text-suave">Redondear los gramos a</label>
        <select id="paso-redondeo" value={paso} onChange={(e) => setPaso(Number(e.target.value))} className={CAMPO}>
          {PASOS_REDONDEO.map((p) => <option key={p} value={p}>{p} g</option>)}
        </select>
      </div>

      <button type="button" onClick={calcular} className={BOTON}>Calcular gramos</button>

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${colorMensaje[mensaje.tipo]}`}>{mensaje.texto}</p>
      )}
      {avisos.length > 0 && (
        <ul role="status" className="list-disc pl-5 text-sm text-alerta">
          {avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}

      {/* Resumen en vivo del día: se recalcula con cada gramo que cambies */}
      <div className="rounded-xl bg-hundido p-3">
        <p className="text-sm font-semibold">Total del día (en vivo)</p>
        <p className="text-lg font-bold">
          {numero(totales.calorias)} kcal
          {kcalPlan !== null && <span className="text-sm font-normal text-suave"> · plan: {numero(kcalPlan)} kcal</span>}
        </p>
        {diferencias ? (
          <ul className="mt-1 grid grid-cols-3 gap-2 text-center">
            {diferencias.map((d) => (
              <li key={d.clave}>
                <p className="text-xs text-suave">{d.etiqueta}</p>
                <p className="font-bold">{numero(d.actual)} / {numero(d.objetivo)} g</p>
                <p className={`text-xs ${Math.abs(d.diferencia) <= 2 ? 'text-suave' : 'text-alerta'}`}>
                  {d.diferencia === 0 ? 'justo' : `${d.diferencia > 0 ? '+' : ''}${numero(d.diferencia)} g`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">
            P {numero(totales.proteina)} · C {numero(totales.carbohidratos)} · G {numero(totales.grasas)} g
          </p>
        )}
        {totales.sinMacros > 0 && (
          <p className="mt-1 text-xs text-suave">
            {totales.sinMacros} {totales.sinMacros === 1 ? 'alimento manual no suma' : 'alimentos manuales no suman'} (sin macros).
          </p>
        )}
      </div>
    </div>
  )
}
