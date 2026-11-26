// =====================================================================
// src/lib/tendenciaPeso.js — tendencia del peso corporal en el tiempo.
//
// Función PURA (recibe mediciones, devuelve datos listos para dibujar): así se
// puede probar sin pantalla y la usan tanto el gráfico como sus textos.
//
// Cómo se calcula (regresión lineal, "la recta que mejor pasa por tus pesos"):
//   - El eje X es el número de DÍAS transcurridos, no la posición en la lista:
//     si pasas 10 días sin medirte, la recta lo sabe (el gráfico viejo
//     repartía las fechas a distancias iguales).
//   - La pendiente es cuántos kg cambia el peso por día; la multiplicamos por 7
//     para mostrarla por semana, que es más fácil de entender.
//
// Fechas: "YYYY-MM-DD" se convierte a "número de día" con Date.UTC SOLO como
// aritmética de calendario (restar días). No se usa para saber "qué día es hoy",
// así que no hay desfase por la zona horaria de Colombia.
// =====================================================================

const MS_POR_DIA = 24 * 60 * 60 * 1000

export const MIN_PUNTOS = 3 // con 2 puntos cualquier recta "encaja": no sería tendencia
export const MIN_DIAS = 7 // con menos de una semana de datos la pendiente es puro ruido
export const DIAS_PROYECCION = 14 // cuánto se extiende la recta hacia adelante
const UMBRAL_ESTABLE_KG_SEMANA = 0.05 // por debajo de esto decimos "estable"

// "2026-11-02" -> número entero de días (para restar fechas)
export function diaDesdeISO(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return Math.round(Date.UTC(anio, mes - 1, dia) / MS_POR_DIA)
}

// Operación inversa: número de días -> "2026-11-02"
export function isoDesdeDia(dia) {
  const f = new Date(dia * MS_POR_DIA)
  const mes = String(f.getUTCMonth() + 1).padStart(2, '0')
  const d = String(f.getUTCDate()).padStart(2, '0')
  return `${f.getUTCFullYear()}-${mes}-${d}`
}

// Calcula la tendencia. `mediciones` puede venir en cualquier orden y con
// medidas sin peso (se ignoran). Devuelve siempre un objeto:
//   { suficiente: false, motivo, puntos }                      -> no hay tendencia aún
//   { suficiente: true, filas, ticks, pendienteSemanal, sentido, pesoActualAjustado, pesoProyectado, diasProyeccion, puntos }
// `filas` son los datos del gráfico (una por medición + una al final de la proyección).
export function calcularTendenciaPeso(mediciones, diasProyeccion = DIAS_PROYECCION) {
  // [...] copia antes de ordenar: nunca se muta lo que llega por props.
  const puntos = [...mediciones]
    .filter((m) => m.peso_corporal_kg !== null && m.peso_corporal_kg !== undefined)
    .map((m) => ({ fecha: m.fecha, dia: diaDesdeISO(m.fecha), peso: Number(m.peso_corporal_kg) }))
    .filter((p) => Number.isFinite(p.peso))
    .sort((a, b) => a.dia - b.dia)

  if (puntos.length < MIN_PUNTOS) {
    return { suficiente: false, motivo: 'pocos_puntos', puntos: puntos.length }
  }

  const dia0 = puntos[0].dia
  const ultimoDia = puntos[puntos.length - 1].dia
  if (ultimoDia - dia0 < MIN_DIAS) {
    return { suficiente: false, motivo: 'pocos_dias', puntos: puntos.length }
  }

  // Mínimos cuadrados con x = días desde la primera medición (números pequeños,
  // así no se pierde precisión).
  const n = puntos.length
  const xs = puntos.map((p) => p.dia - dia0)
  const mediaX = xs.reduce((s, x) => s + x, 0) / n
  const mediaY = puntos.reduce((s, p) => s + p.peso, 0) / n
  let sxy = 0
  let sxx = 0
  puntos.forEach((p, i) => {
    sxy += (xs[i] - mediaX) * (p.peso - mediaY)
    sxx += (xs[i] - mediaX) ** 2
  })
  // sxx > 0 está garantizado: hay fechas distintas (único por atleta y día, y span >= 7).
  const pendienteDiaria = sxy / sxx
  const intercepto = mediaY - pendienteDiaria * mediaX
  const valorEn = (dia) => Math.round((intercepto + pendienteDiaria * (dia - dia0)) * 100) / 100

  const pendienteSemanal = pendienteDiaria * 7
  const sentido =
    Math.abs(pendienteSemanal) < UMBRAL_ESTABLE_KG_SEMANA ? 'estable' : pendienteSemanal < 0 ? 'baja' : 'sube'

  const diaFin = ultimoDia + diasProyeccion
  const filas = puntos.map((p) => ({
    dia: p.dia,
    fecha: p.fecha,
    peso: p.peso,
    tendencia: valorEn(p.dia),
    // La proyección arranca en la última medición para que la línea punteada
    // continúe a la continua sin hueco.
    proyeccion: p.dia === ultimoDia ? valorEn(p.dia) : null,
  }))
  filas.push({ dia: diaFin, fecha: isoDesdeDia(diaFin), peso: null, tendencia: null, proyeccion: valorEn(diaFin) })

  // 4 marcas del eje X repartidas de forma pareja (enteras: son días).
  const ticks = [0, 1, 2, 3].map((i) => Math.round(dia0 + ((diaFin - dia0) * i) / 3))

  return {
    suficiente: true,
    filas,
    ticks,
    pendienteSemanal,
    sentido,
    pesoActualAjustado: valorEn(ultimoDia),
    pesoProyectado: valorEn(diaFin),
    diasProyeccion,
    puntos: n,
  }
}

// Texto corto para el atleta. Ej.: "Tu peso baja unos 0,4 kg por semana."
export function textoTendencia(t) {
  if (!t.suficiente) {
    return t.motivo === 'pocos_dias'
      ? 'Necesitamos mediciones de al menos una semana de diferencia para calcular tu tendencia.'
      : `Necesitamos al menos ${MIN_PUNTOS} mediciones de peso para calcular tu tendencia.`
  }
  const kg = Math.abs(t.pendienteSemanal).toLocaleString('es-CO', { maximumFractionDigits: 2 })
  if (t.sentido === 'estable') return 'Tu peso se mantiene estable.'
  return `Tu peso ${t.sentido === 'baja' ? 'baja' : 'sube'} unos ${kg} kg por semana.`
}
