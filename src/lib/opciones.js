// =====================================================================
// src/lib/opciones.js — valores que se repiten en varias pantallas.
//
// El estado de ánimo se GUARDA en la base de datos como texto simple
// ('mal' | 'regular' | 'bien'; así lo definimos en el CHECK de la tabla),
// pero se MUESTRA con emoji. Separar "lo que se guarda" de "cómo se ve"
// permite cambiar los emojis cuando quieras sin tocar la base de datos.
// =====================================================================
export const ANIMOS = [
  { valor: 'mal', emoji: '😞', etiqueta: 'Mal' },
  { valor: 'regular', emoji: '😐', etiqueta: 'Regular' },
  { valor: 'bien', emoji: '😄', etiqueta: 'Bien' },
]

// Dado 'bien' devuelve '😄 Bien'. Si no hay dato (null) devuelve un guion.
export function textoAnimo(valor) {
  const animo = ANIMOS.find((a) => a.valor === valor)
  return animo ? `${animo.emoji} ${animo.etiqueta}` : '—'
}

// true -> 'Sí', false -> 'No', null -> '—'
export function textoSiNo(valor) {
  if (valor === true) return 'Sí'
  if (valor === false) return 'No'
  return '—'
}

// Cumplimiento de las calorías de ayer (check-in diario, columna cumplimiento_calorias).
// Se guarda 'cumplio' | 'menos' | 'mas' (CHECK de la migración 17) y se muestra con estas frases.
export const CUMPLIMIENTO_CALORIAS = [
  { valor: 'cumplio', etiqueta: 'Cumplí las calorías' },
  { valor: 'menos', etiqueta: 'Consumí menos de las estipuladas' },
  { valor: 'mas', etiqueta: 'Consumí más de las estipuladas' },
]

// `valor` es cumplimiento_calorias; `legado` es el booleano antiguo (calorias_ayer_cumplidas).
// Los check-ins anteriores a la migración 17 con "no" no tienen detalle: no sabemos si fue de
// más o de menos, y no lo inventamos.
export function textoCumplimientoCalorias(valor, legado = null) {
  const opcion = CUMPLIMIENTO_CALORIAS.find((o) => o.valor === valor)
  if (opcion) return opcion.etiqueta
  if (legado === true) return CUMPLIMIENTO_CALORIAS[0].etiqueta
  if (legado === false) return 'No cumplió (sin detalle)'
  return '—'
}

// Estado calórico de una medición. Se guarda 'deficit' | 'superavit' |
// 'normocalorica' (así lo restringe la tabla metrics) y se muestra con tilde.
export const ESTADOS_CALORICOS = [
  { valor: 'deficit', etiqueta: 'Déficit' },
  { valor: 'superavit', etiqueta: 'Superávit' },
  { valor: 'normocalorica', etiqueta: 'Normocalórica' },
]

export function textoEstadoCalorico(valor) {
  // ?. = "si es undefined no falles"; ?? = "si queda vacío, usa este valor"
  return ESTADOS_CALORICOS.find((e) => e.valor === valor)?.etiqueta ?? '—'
}

// Estados de una rutina. En la base de datos se guarda el texto simple.
export const ESTADOS_RUTINA = { borrador: 'Borrador', activa: 'Activa', archivada: 'Archivada' }

export function textoEstadoRutina(valor) {
  return ESTADOS_RUTINA[valor] ?? '—'
}

// De dónde viene un plan nutricional (columna `origen` de nutrition_plans).
export const ORIGENES_PLAN = { manual: 'Manual', ia_aceptada: 'IA (aceptada)', ia_editada: 'IA (editada por ti)' }

export function textoOrigenPlan(valor) {
  return ORIGENES_PLAN[valor] ?? '—'
}
