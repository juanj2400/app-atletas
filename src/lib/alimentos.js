// =====================================================================
// src/lib/alimentos.js — lógica PURA del catálogo de alimentos (tabla `foods`, migración 25).
//
// Cada alimento guarda sus macros por 100 g, su estado (crudo / cocido / n/a) y una categoría.
// Aquí vive lo que no necesita tocar la base de datos ni la pantalla: etiquetas, macro
// dominante, validar el formulario del entrenador y preparar el texto de búsqueda.
// =====================================================================
import { aNumero } from './numeros'
import { normalizarBusqueda } from './records'
import { kcalDeMacros } from './nutricion'

// Los valores son los que guarda la base de datos (CHECK de la migración 25).
export const CATEGORIAS = [
  { valor: 'proteina', etiqueta: 'Proteínas' },
  { valor: 'carbohidrato', etiqueta: 'Carbohidratos' },
  { valor: 'legumbre', etiqueta: 'Legumbres' },
  { valor: 'grasa', etiqueta: 'Grasas' },
  { valor: 'lacteo', etiqueta: 'Lácteos' },
  { valor: 'fruta', etiqueta: 'Frutas' },
  { valor: 'verdura', etiqueta: 'Verduras' },
  { valor: 'otro', etiqueta: 'Otros' },
]

export const ESTADOS = [
  { valor: 'crudo', etiqueta: 'Crudo' },
  { valor: 'cocido', etiqueta: 'Cocido' },
  { valor: 'n/a', etiqueta: 'No aplica' },
]

export const textoCategoria = (valor) => CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? 'Otros'
export const textoEstado = (valor) => ESTADOS.find((e) => e.valor === valor)?.etiqueta ?? 'No indicado'

// Nombres de las 3 macros tal como las guarda `macro_dominante` en la base de datos.
export const TEXTO_MACRO = { proteina: 'Proteína', carbohidratos: 'Carbohidratos', grasas: 'Grasas' }

// MISMA regla que la columna generada `macro_dominante` de la migración 25: gana la macro que
// más calorías aporta (4 kcal/g proteína y carbohidratos, 9 kcal/g grasa). Devuelve null si
// el alimento no tiene macros.
export function macroDominante({ proteina_g: p, carbohidratos_g: c, grasas_g: g }) {
  if (p > 0 && p * 4 >= c * 4 && p * 4 >= g * 9) return 'proteina'
  if (c > 0 && c * 4 >= g * 9) return 'carbohidratos'
  if (g > 0) return 'grasas'
  return null
}

// Quita lo que PostgREST o el patrón `ilike` interpretarían como instrucción (% _ \ * , ( )).
// Devuelve las palabras ya sin tildes ni mayúsculas: cada una debe aparecer en el nombre.
export function terminosBusqueda(texto) {
  return normalizarBusqueda(texto)
    .replace(/[%_\\*,()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// ---------------------------------------------------------------------
// Formulario del entrenador (crear / editar un alimento)
// ---------------------------------------------------------------------
export const FORM_ALIMENTO_VACIO = {
  nombre: '', categoria: 'proteina', estado: 'n/a',
  calorias: '', proteina: '', carbohidratos: '', grasas: '',
}

// De una fila de `foods` al formulario (números con coma decimal, como los escribiría el entrenador).
export function formDeAlimento(a) {
  const texto = (n) => String(n).replace('.', ',')
  return {
    nombre: a.nombre, categoria: a.categoria, estado: a.estado,
    calorias: texto(a.calorias), proteina: texto(a.proteina_g),
    carbohidratos: texto(a.carbohidratos_g), grasas: texto(a.grasas_g),
  }
}

// Lee un campo numérico del formulario con límites. Devuelve { valor } o { error }.
function leerNumero(texto, etiqueta, maximo, obligatorio = true) {
  const n = aNumero(texto)
  if (n === null) return obligatorio ? { error: `Escribe ${etiqueta}.` } : { valor: null }
  if (Number.isNaN(n)) return { error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} debe ser solo un número.` }
  if (n < 0 || n > maximo) return { error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} debe estar entre 0 y ${maximo}.` }
  // La base guarda 1 decimal: se avisa aquí para que lo guardado coincida con lo escrito.
  if (Math.round(n * 10) / 10 !== n) return { error: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} admite como máximo 1 decimal.` }
  return { valor: n }
}

// Valida el formulario. Devuelve { error: '' , datos } listo para insertar en `foods`,
// o { error: 'texto en español' }. Si las calorías se dejan vacías se calculan con los macros.
export function validarAlimento(form) {
  const nombre = form.nombre.trim()
  if (nombre.length < 2 || nombre.length > 80) return { error: 'El nombre necesita de 2 a 80 letras.' }
  if (!CATEGORIAS.some((c) => c.valor === form.categoria)) return { error: 'Elige una categoría.' }
  if (!ESTADOS.some((e) => e.valor === form.estado)) return { error: 'Elige el estado (crudo, cocido o no aplica).' }

  const p = leerNumero(form.proteina, 'la proteína por 100 g', 100)
  if (p.error) return p
  const c = leerNumero(form.carbohidratos, 'los carbohidratos por 100 g', 100)
  if (c.error) return c
  const g = leerNumero(form.grasas, 'las grasas por 100 g', 100)
  if (g.error) return g
  if (p.valor + c.valor + g.valor > 100.5) {
    return { error: 'Proteína + carbohidratos + grasas no pueden pasar de 100 g por cada 100 g de alimento.' }
  }

  const k = leerNumero(form.calorias, 'las calorías por 100 g', 1000, false)
  if (k.error) return k
  const calorias = k.valor ?? Math.round(kcalDeMacros(p.valor, c.valor, g.valor) * 10) / 10
  if (calorias > 1000) return { error: 'Las calorías por 100 g no pueden pasar de 1.000.' }

  return {
    error: '',
    datos: {
      nombre, categoria: form.categoria, estado: form.estado,
      calorias, proteina_g: p.valor, carbohidratos_g: c.valor, grasas_g: g.valor,
    },
  }
}

// Aviso (no bloquea el guardado): las calorías escritas se alejan mucho de lo que suman los
// macros. Las tablas reales difieren algo (fibra, agua), por eso solo avisa si pasa del 15 %
// y de 10 kcal. Devuelve '' si todo cuadra o no hay datos suficientes.
export function avisoCalorias(form) {
  const k = aNumero(form.calorias)
  const p = aNumero(form.proteina)
  const c = aNumero(form.carbohidratos)
  const g = aNumero(form.grasas)
  if ([k, p, c, g].some((n) => n === null || Number.isNaN(n))) return ''
  const calculadas = Math.round(kcalDeMacros(p, c, g))
  const diferencia = Math.abs(k - calculadas)
  if (diferencia > 10 && diferencia / Math.max(k, 1) > 0.15) {
    return `Con esos macros las calorías serían unas ${calculadas} kcal por 100 g. Revisa si es correcto.`
  }
  return ''
}
