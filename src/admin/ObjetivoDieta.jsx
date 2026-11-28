// =====================================================================
// ObjetivoDieta — panel superior del creador de dieta (Comidas del día).
//
// El PLAN NUTRICIONAL es la única referencia: aquí NO se escriben calorías ni macros objetivo.
// Este panel muestra el objetivo vigente (solo lectura), cuánto llevan las comidas frente a él
// (en vivo) y los controles del ajuste automático:
//   - Ajuste automático: cada vez que agregas, quitas o cambias un alimento, o cambias el plan,
//     los gramos de los alimentos NO fijados se recalculan solos para cumplir los macros.
//     Si escribes tú los gramos de un alimento, ese alimento queda fijado y el resto se ajusta.
//   - "Reajustar al plan": recalcula ahora (también con el ajuste automático apagado).
//   - "Soltar gramos fijados": vuelve a dejar que el cálculo decida todos los gramos.
// No guarda nada: el guardado lo hace "Guardar comidas" en PlanComidas.
// =====================================================================
import { PASOS_REDONDEO, diferenciasDia, esDeCatalogo, objetivoDePlan, totalesDia } from '../lib/dieta'
import { textoEstadoCalorico } from '../lib/opciones'
import { INTENSIDADES, OBJETIVOS, TIPOS_DIETA } from '../lib/planNutricional'
import { CAMPO, BOTON_SEC, TARJETA } from '../lib/estilos'

const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })
const etiqueta = (lista, valor) => lista.find((o) => o.valor === valor)?.etiqueta
// Una diferencia de hasta 3 g o 3 % del objetivo se considera "cumplido" (los gramos se redondean).
const dentroDeTolerancia = (d) => Math.abs(d.diferencia) <= Math.max(3, d.objetivo * 0.03)

export default function ObjetivoDieta({
  plan, cargandoPlan, errorPlan, comidas, auto, paso, avisos,
  onAuto, onPaso, onReajustar, onLiberar, onPesoComida,
}) {
  const objetivo = objetivoDePlan(plan)
  const totales = totalesDia(comidas)
  const diferencias = objetivo ? diferenciasDia(totales, objetivo) : null
  const comidasConCatalogo = comidas.filter((c) => c.alimentos.some(esDeCatalogo))
  const hayFijos = comidas.some((c) => c.alimentos.some((a) => esDeCatalogo(a) && a.fijo))
  const desviado = diferencias ? diferencias.some((d) => !dentroDeTolerancia(d)) : false
  const config = plan && plan.objetivo_fisico
    ? [etiqueta(OBJETIVOS, plan.objetivo_fisico), etiqueta(INTENSIDADES, plan.intensidad), etiqueta(TIPOS_DIETA, plan.tipo_dieta)].filter(Boolean).join(' · ')
    : ''

  return (
    <div className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        <h4 className="font-semibold">Objetivo del día (Plan nutricional)</h4>
        <p className="text-sm text-suave">
          Las comidas se calculan con el plan nutricional del atleta. Para cambiar calorías o macros, edita el
          «Plan nutricional» (arriba) y las comidas se reajustan solas.
        </p>
      </div>

      {cargandoPlan && <p role="status" className="text-sm text-suave">Leyendo el plan nutricional...</p>}
      {errorPlan && <p role="alert" className="text-sm text-alerta">{errorPlan}</p>}

      {!cargandoPlan && !errorPlan && !plan && (
        <p role="status" className="rounded-xl bg-hundido p-3 text-sm text-alerta">
          Este atleta aún no tiene plan nutricional. Defínelo en «Plan nutricional» (arriba) para poder calcular los gramos.
        </p>
      )}
      {!cargandoPlan && !errorPlan && plan && !objetivo && (
        <p role="status" className="rounded-xl bg-hundido p-3 text-sm text-alerta">
          El plan vigente tiene {numero(plan.calorias_objetivo)} kcal pero no define proteína, carbohidratos y grasas.
          Complétalo en «Plan nutricional» para poder calcular los gramos.
        </p>
      )}

      {objetivo && (
        <>
          <div className="rounded-xl bg-hundido p-3">
            <p className="text-lg font-bold">
              {numero(plan.calorias_objetivo)} kcal
              {plan.objetivo_calorico && (
                <span className="text-sm font-normal text-suave"> · {textoEstadoCalorico(plan.objetivo_calorico)}</span>
              )}
            </p>
            {config && <p className="text-xs text-enlace">{config}</p>}
            <p className="text-sm text-suave">
              Proteína {numero(objetivo.proteina)} g · Carbohidratos {numero(objetivo.carbohidratos)} g · Grasas {numero(objetivo.grasas)} g
            </p>
          </div>

          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={auto} onChange={(e) => onAuto(e.target.checked)} />
            <span>
              <span className="font-semibold">Ajuste automático</span>
              <span className="block text-xs text-suave">
                Al agregar, quitar o cambiar alimentos, o al cambiar el plan, los gramos se recalculan solos. Si escribes
                los gramos de un alimento, queda fijado y el resto se ajusta a su alrededor.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onReajustar} className={BOTON_SEC}>Reajustar al plan</button>
            {hayFijos && (
              <button type="button" onClick={onLiberar} className={BOTON_SEC}>Soltar gramos fijados</button>
            )}
          </div>

          <details className="rounded-xl bg-hundido p-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Ajustes del cálculo</summary>
            <div className="mt-2">
              <label htmlFor="paso-redondeo" className="text-xs text-suave">Redondear los gramos a</label>
              <select id="paso-redondeo" value={paso} onChange={(e) => onPaso(Number(e.target.value))} className={CAMPO}>
                {PASOS_REDONDEO.map((p) => <option key={p} value={p}>{p} g</option>)}
              </select>
            </div>
            {comidasConCatalogo.length > 1 && (
              <>
                <p className="mt-3 text-sm font-semibold">Reparto entre comidas</p>
                <p className="text-xs text-suave">
                  Por defecto todas pesan igual (1). Pon 2 en una comida para que lleve el doble que una de 1. Se guarda con el menú.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {comidasConCatalogo.map((c, i) => (
                    <div key={c.clave}>
                      <label htmlFor={`peso-${c.clave}`} className="text-xs text-suave">{c.nombre.trim() || `Comida ${i + 1}`}</label>
                      <input id={`peso-${c.clave}`} inputMode="decimal" value={c.peso}
                        onChange={(e) => onPesoComida(c.clave, e.target.value)} className={CAMPO} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </details>

          {avisos.length > 0 && (
            <ul role="status" className="list-disc pl-5 text-sm text-alerta">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}

          {/* Lo que llevan las comidas frente al plan, en vivo */}
          <div className="rounded-xl bg-hundido p-3">
            <p className="text-sm font-semibold">Total del día (en vivo)</p>
            <p className="text-lg font-bold">
              {numero(totales.calorias)} <span className="text-sm font-normal text-suave">/ {numero(plan.calorias_objetivo)} kcal</span>
            </p>
            <ul className="mt-1 grid grid-cols-3 gap-2 text-center">
              {diferencias.map((d) => (
                <li key={d.clave}>
                  <p className="text-xs text-suave">{d.etiqueta}</p>
                  <p className="font-bold">{numero(d.actual)} / {numero(d.objetivo)} g</p>
                  <p className={`text-xs ${dentroDeTolerancia(d) ? 'text-suave' : 'text-alerta'}`}>
                    {d.diferencia === 0 ? 'justo' : `${d.diferencia > 0 ? '+' : ''}${numero(d.diferencia)} g`}
                  </p>
                </li>
              ))}
            </ul>
            {desviado && comidasConCatalogo.length > 0 && (
              <p role="status" className="mt-2 text-xs text-alerta">
                El menú se desvía del plan. {auto ? 'Revisa los avisos de arriba (por ejemplo, un macro sin alimento que lo cubra).' : 'Pulsa «Reajustar al plan».'}
              </p>
            )}
            {totales.sinMacros > 0 && (
              <p className="mt-1 text-xs text-suave">
                {totales.sinMacros} {totales.sinMacros === 1 ? 'alimento manual no suma' : 'alimentos manuales no suman'} (sin macros).
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
