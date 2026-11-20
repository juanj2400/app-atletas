// =====================================================================
// src/lib/mediciones.js — lógica COMPARTIDA sobre mediciones.
//
// ¿Por qué existe? Hasta ahora el admin calculaba "peso actual", "cambio",
// etc. dentro de su componente. Ahora el ATLETA necesita exactamente lo
// mismo. Copiar y pegar el código sería un error: si luego corriges algo en un
// sitio, olvidas el otro. Cuando algo se usa en dos lugares, se extrae a un
// archivo común (principio DRY: Don't Repeat Yourself).
// =====================================================================
import { fechaLocalISO } from './fechas'
import { textoEstadoCalorico } from './opciones'

// Recibe las mediciones ORDENADAS de la más reciente a la más antigua
// (así las pedimos a Supabase) y calcula los datos del resumen.
export function resumirMediciones(mediciones) {
  const conPeso = mediciones.filter((m) => m.peso_corporal_kg !== null)
  const pesoActual = conPeso[0] ?? null
  const pesoPrevio = conPeso[1] ?? null
  const delta = pesoActual && pesoPrevio
    ? Number(pesoActual.peso_corporal_kg) - Number(pesoPrevio.peso_corporal_kg)
    : null

  const cinturaActual = mediciones.find((m) => m.perimetro_cintura_cm !== null) ?? null
  const estadoActual = mediciones.find((m) => m.estado_calorico !== null)?.estado_calorico ?? null

  // Promedio de calorías de los últimos 7 días (hoy y los 6 anteriores).
  const desde = fechaLocalISO(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
  const kcal7 = mediciones
    .filter((m) => m.fecha >= desde && m.calorias_consumidas !== null)
    .map((m) => m.calorias_consumidas)
  const promedioKcal7 = kcal7.length
    ? Math.round(kcal7.reduce((suma, k) => suma + k, 0) / kcal7.length)
    : null

  return { pesoActual, delta, cinturaActual, estadoActual, promedioKcal7, diasKcal7: kcal7.length }
}

// "82.4 kg · cintura 88 cm · 2.600 kcal · Déficit"
export function textoMedicion(m) {
  return [
    m.peso_corporal_kg !== null && `${m.peso_corporal_kg} kg`,
    m.perimetro_cintura_cm !== null && `cintura ${m.perimetro_cintura_cm} cm`,
    m.calorias_consumidas !== null && `${m.calorias_consumidas.toLocaleString('es-CO')} kcal`,
    m.estado_calorico && textoEstadoCalorico(m.estado_calorico),
  ]
    .filter(Boolean)
    .join(' · ')
}
