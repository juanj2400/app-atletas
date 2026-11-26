// =====================================================================
// src/lib/oscilacionPeso.js — cuánto "sube y baja" el peso entre mediciones.
//
// Función PURA: recibe mediciones (en cualquier orden, algunas sin peso) y devuelve
// los puntos con su cambio respecto a la medición anterior y unas cifras de resumen.
// Complementa a tendenciaPeso.js: la tendencia dice HACIA DÓNDE va el peso; esto
// muestra cuánto OSCILA día a día (agua, sal, comidas), que es normal y no es lo mismo
// que ganar o perder grasa.
// =====================================================================
import { formatearFechaCorta } from './fechas'

const redondear = (n) => Math.round(n * 100) / 100 // evita 0,30000000000000004 al restar decimales

// Devuelve { suficiente:false, puntos } con menos de 2 pesos; si no:
// { suficiente:true, puntos:[{fecha, peso, cambio}], min, max, rango, promedio, mayorSubida, mayorBajada, fechaMin, fechaMax }
// `cambio` es null en la primera medición. mayorSubida/mayorBajada son 0 si nunca hubo subida/bajada.
export function calcularOscilacionPeso(mediciones) {
  // [...] copia antes de ordenar: nunca se muta lo que llega por props.
  const base = [...mediciones]
    .filter((m) => m.peso_corporal_kg !== null && m.peso_corporal_kg !== undefined)
    .map((m) => ({ fecha: m.fecha, peso: Number(m.peso_corporal_kg) }))
    .filter((p) => Number.isFinite(p.peso))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (base.length < 2) return { suficiente: false, puntos: base.length }

  const puntos = base.map((p, i) => ({ ...p, cambio: i === 0 ? null : redondear(p.peso - base[i - 1].peso) }))
  const pesos = puntos.map((p) => p.peso)
  const cambios = puntos.map((p) => p.cambio).filter((c) => c !== null)
  const min = Math.min(...pesos)
  const max = Math.max(...pesos)

  return {
    suficiente: true,
    puntos,
    min,
    max,
    rango: redondear(max - min),
    promedio: redondear(pesos.reduce((s, p) => s + p, 0) / pesos.length),
    mayorSubida: Math.max(0, ...cambios),
    mayorBajada: Math.min(0, ...cambios), // negativo (o 0)
    fechaMin: puntos.find((p) => p.peso === min).fecha,
    fechaMax: puntos.find((p) => p.peso === max).fecha,
  }
}

const kg = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })

// "Entre las mediciones tu peso se ha movido en un rango de 1,8 kg (de 79,2 kg el 3 nov a 81 kg el 12 nov)."
export function textoOscilacion(o) {
  if (!o.suficiente) return 'Necesitamos al menos 2 mediciones de peso para mostrar cómo oscila.'
  if (o.rango === 0) return `Tu peso ha sido el mismo (${kg(o.min)} kg) en todas las mediciones.`
  return `Tu peso se ha movido en un rango de ${kg(o.rango)} kg (de ${kg(o.min)} kg el ${formatearFechaCorta(o.fechaMin)} a ${kg(o.max)} kg el ${formatearFechaCorta(o.fechaMax)}).`
}
