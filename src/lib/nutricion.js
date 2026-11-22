// =====================================================================
// src/lib/nutricion.js — cálculos puros del plan nutricional.
// =====================================================================
import { fechaLocalISO } from './fechas'

// Calorías que aportan los macros: 4 por gramo de proteína y de carbohidratos,
// 9 por gramo de grasa.
export function kcalDeMacros(proteina, carbos, grasas) {
  return 4 * proteina + 4 * carbos + 9 * grasas
}

// Diferencia (%) entre lo que suman los macros y las calorías objetivo.
// Positivo = los macros suman MÁS que el objetivo.
export function diferenciaMacrosPct(kcalObjetivo, proteina, carbos, grasas) {
  return Math.round(((kcalDeMacros(proteina, carbos, grasas) - kcalObjetivo) / kcalObjetivo) * 100)
}

const fechaLocal = (timestamp) => fechaLocalISO(new Date(timestamp))

// ¿Qué objetivo de calorías regía en una fecha ("YYYY-MM-DD")?
// Se usa para dibujar la línea de objetivo en el gráfico: como el entrenador puede
// cambiar el plan, la línea cambia de golpe en la fecha del cambio.
//   - Si hubo varios planes ese día, manda el más reciente.
//   - Si el plan se finalizó antes de esa fecha, devuelve null (no había objetivo).
export function kcalObjetivoEnFecha(planes, fecha) {
  const aplicable = planes
    .filter((p) => fechaLocal(p.vigente_desde) <= fecha)
    .sort((a, b) => new Date(a.vigente_desde) - new Date(b.vigente_desde))
    .at(-1)
  if (!aplicable) return null
  if (aplicable.vigente_hasta && fecha > fechaLocal(aplicable.vigente_hasta)) return null
  return aplicable.calorias_objetivo
}

// "4 % por encima del objetivo" / "2 % por debajo del objetivo" / "justo en el objetivo"
export function textoAdherencia(promedio, objetivo) {
  if (promedio === null || !objetivo) return null
  const pct = Math.round(((promedio - objetivo) / objetivo) * 100)
  if (pct === 0) return 'justo en el objetivo'
  return `${Math.abs(pct)} % ${pct > 0 ? 'por encima' : 'por debajo'} del objetivo`
}
