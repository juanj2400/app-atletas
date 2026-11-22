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
