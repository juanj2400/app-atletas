// =====================================================================
// src/lib/numeros.js — convertir lo que se escribe en un campo en un número.
//
// Un <input> SIEMPRE entrega texto, aunque escribas "82.4". Y en español
// muchos teclados escriben "82,4" con coma. Esta función resuelve ambos casos
// y distingue TRES resultados (por eso es útil):
//   null   -> el campo estaba vacío (dato opcional, no es un error)
//   NaN    -> escribió algo que no es un número ("abc", "7..5")
//   número -> valor válido
// =====================================================================
export function aNumero(texto) {
  const limpio = String(texto ?? '').trim().replace(',', '.')
  if (limpio === '') return null
  // Number("7abc") da NaN (estricto). parseFloat("7abc") daría 7 (permisivo e
  // inseguro para datos de salud), por eso usamos Number.
  const n = Number(limpio)
  return Number.isFinite(n) ? n : NaN
}
