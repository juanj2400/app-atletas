// =====================================================================
// src/lib/dieta.js — motor de AUTOCÁLCULO de la dieta (100 % JavaScript, sin IA).
//
// Qué resuelve: el entrenador elige alimentos del catálogo (con su estado crudo/cocido),
// define las comidas y los macros objetivo del día, y este módulo calcula los GRAMOS de cada
// alimento para cumplirlos, descontando los macros "indirectos" (por ejemplo, el arroz también
// aporta algo de proteína y el pollo casi nada de carbohidratos).
//
// Cómo funciona (explicado simple):
//   1. Cada alimento tiene un ROL: la macro que debe cubrir (por defecto su macro dominante;
//      el entrenador puede cambiarlo: p. ej. el huevo es "grasa" por calorías, pero lo usa
//      como fuente de proteína).
//   2. El objetivo de cada macro se reparte entre las comidas según su peso (por defecto, en
//      partes iguales) pero SOLO entre las comidas que tienen un alimento con ese rol.
//   3. Dentro de cada comida se resuelve por rondas (método de Gauss-Seidel): se calculan los
//      gramos de las fuentes de proteína, luego de carbohidratos, luego de grasas, restando lo
//      que los demás ya aportan; se repite hasta que los gramos dejan de cambiar.
//   4. Los alimentos con "gramos fijos" (o manuales, sin macros) no se tocan: su aporte se
//      resta del objetivo antes de repartir.
//   5. Los gramos se redondean al paso elegido (1 g, 5 g...).
//
// Es DETERMINISTA: los mismos datos dan siempre el mismo resultado (sin azar ni IA).
//
// Formas de los datos (las del borrador de lib/comidas.js):
//   fila de alimento: { clave, alimento, cantidad (TEXTO), unidad, foodId, estado,
//                       base: { calorias, proteina_g, carbohidratos_g, grasas_g } | null,
//                       rol: '' | 'proteina' | 'carbohidratos' | 'grasas', fijo: boolean }
//   comida: { clave, nombre, alimentos: [fila] }
// =====================================================================
import { aNumero } from './numeros'
import { macroDominante } from './alimentos'

export const MACROS = [
  { clave: 'proteina', etiqueta: 'Proteína', campoBase: 'proteina_g' },
  { clave: 'carbohidratos', etiqueta: 'Carbohidratos', campoBase: 'carbohidratos_g' },
  { clave: 'grasas', etiqueta: 'Grasas', campoBase: 'grasas_g' },
]
const CAMPO_BASE = Object.fromEntries(MACROS.map((m) => [m.clave, m.campoBase]))
const ETIQUETA = Object.fromEntries(MACROS.map((m) => [m.clave, m.etiqueta.toLowerCase()]))

export const PASOS_REDONDEO = [1, 5, 10]
const MAX_GRAMOS = 10000 // mismo tope que la base de datos
const MAX_RONDAS_COMIDA = 500
const MAX_RONDAS_DIA = 50
const TOLERANCIA_G = 0.001

// ---------------------------------------------------------------------
// Macros de una fila / comida / día
// ---------------------------------------------------------------------

// Gramos escritos en la fila (0 si está vacío o no es un número válido).
function gramosDe(fila) {
  const g = aNumero(fila.cantidad)
  return g !== null && Number.isFinite(g) && g > 0 ? g : 0
}

// ¿Es un alimento del catálogo medido en gramos (el único que trae macros)?
export const esDeCatalogo = (fila) => Boolean(fila.base) && fila.unidad === 'g'

// Macros de `gramos` de un alimento cuya base son los valores por 100 g. Se calcula con enteros
// (decimas × centesimas) y se redondea a 1 decimal "hacia arriba en la mitad", igual que
// `round()` de PostgreSQL: así lo que ve el entrenador coincide con lo que guarda la base.
export function macroAsignado(valorPor100g, gramos) {
  const decimas = Math.round(valorPor100g * 10)
  const centesimas = Math.round(gramos * 100)
  return Math.floor((decimas * centesimas + 5000) / 10000) / 10
}

// Macros asignados a una fila: { calorias, proteina, carbohidratos, grasas } o null si el
// alimento es manual (sin macros).
export function macrosDeFila(fila) {
  if (!esDeCatalogo(fila)) return null
  const g = gramosDe(fila)
  return {
    calorias: macroAsignado(fila.base.calorias, g),
    proteina: macroAsignado(fila.base.proteina_g, g),
    carbohidratos: macroAsignado(fila.base.carbohidratos_g, g),
    grasas: macroAsignado(fila.base.grasas_g, g),
  }
}

// Suma una lista de macros (ignora los null). Se suma en decimas enteras: sin errores de coma flotante.
export function sumarMacros(lista) {
  const total = { calorias: 0, proteina: 0, carbohidratos: 0, grasas: 0 }
  for (const m of lista) {
    if (!m) continue
    for (const k of Object.keys(total)) total[k] += Math.round(m[k] * 10)
  }
  return {
    calorias: total.calorias / 10, proteina: total.proteina / 10,
    carbohidratos: total.carbohidratos / 10, grasas: total.grasas / 10,
  }
}

// Totales de una comida + cuántos alimentos NO suman (manuales, sin macros).
export function totalesComida(comida) {
  const macros = comida.alimentos.map(macrosDeFila)
  return { ...sumarMacros(macros), sinMacros: macros.filter((m) => m === null).length }
}

// Totales del día (todas las comidas).
export function totalesDia(comidas) {
  const porComida = comidas.map(totalesComida)
  return {
    ...sumarMacros(porComida),
    sinMacros: porComida.reduce((n, t) => n + t.sinMacros, 0),
  }
}

// ---------------------------------------------------------------------
// Objetivo del día
// ---------------------------------------------------------------------

// Lee los tres campos del objetivo (texto) y devuelve { objetivo: {proteina, carbohidratos, grasas} }
// o { error } en español.
export function validarObjetivo({ proteina, carbohidratos, grasas }) {
  const campos = [
    ['proteina', proteina, 'la proteína'],
    ['carbohidratos', carbohidratos, 'los carbohidratos'],
    ['grasas', grasas, 'las grasas'],
  ]
  const objetivo = {}
  for (const [clave, texto, etiqueta] of campos) {
    const n = aNumero(texto)
    if (n === null) return { error: `Escribe el objetivo de ${etiqueta} (en gramos).` }
    if (Number.isNaN(n)) return { error: `El objetivo de ${etiqueta} debe ser solo un número.` }
    if (n < 0 || n > 2000) return { error: `El objetivo de ${etiqueta} debe estar entre 0 y 2.000 g.` }
    objetivo[clave] = n
  }
  return { objetivo }
}

// ---------------------------------------------------------------------
// Cálculo automático de gramos
// ---------------------------------------------------------------------

// Rol efectivo de una fila: el elegido por el entrenador o, si no eligió, la macro dominante.
export function rolDeFila(fila) {
  if (!fila.base) return null
  return fila.rol || macroDominante(fila.base)
}

// Calcula los gramos de todos los alimentos del catálogo que no estén fijados.
//   comidas  borrador de comidas
//   objetivo { proteina, carbohidratos, grasas } en gramos para TODO el día
//   pesos    { [clave de comida]: número } reparto del día entre comidas (por defecto 1 para todas)
//   paso     redondeo de los gramos (1, 5 o 10)
// Devuelve { gramos: { [clave de alimento]: número }, avisos: [texto], convergio: boolean }.
// No modifica nada de lo que recibe.
export function calcularGramos({ comidas, objetivo, pesos = {}, paso = 1 }) {
  const avisos = []
  const pasoValido = PASOS_REDONDEO.includes(paso) ? paso : 1

  // 1. Clasificar los alimentos de cada comida: variables (se calculan) y fijos (se respetan).
  const info = comidas.map((comida) => {
    const variables = [] // { fila, rol, coef }  coef = macro del rol por gramo
    const fijos = []     // filas del catálogo con gramos que no se tocan
    for (const fila of comida.alimentos) {
      if (!esDeCatalogo(fila)) continue
      const rol = rolDeFila(fila)
      const coef = rol ? fila.base[CAMPO_BASE[rol]] / 100 : 0
      if (fila.fijo) fijos.push(fila)
      else if (!rol || !(coef > 0)) {
        avisos.push(`«${fila.alimento}» no aporta ${rol ? ETIQUETA[rol] : 'macros'}: cambia su rol. Se dejó con sus gramos actuales.`)
        fijos.push(fila)
      } else variables.push({ fila, rol, coef })
    }
    const w = Number(pesos[comida.clave])
    return { comida, variables, fijos, peso: Number.isFinite(w) && w >= 0 ? w : 1 }
  })

  const manuales = comidas.reduce((n, c) => n + c.alimentos.filter((f) => !esDeCatalogo(f)).length, 0)
  if (manuales > 0) {
    avisos.push(`${manuales} ${manuales === 1 ? 'alimento manual no entra' : 'alimentos manuales no entran'} al cálculo (sin macros en el catálogo).`)
  }

  // Aporte exacto (sin redondear) de gramos de una fila a una macro.
  const aporte = (fila, macro, gramos) => (fila.base[CAMPO_BASE[macro]] / 100) * gramos
  const fijoDe = (fi, macro) => fi.fijos.reduce((s, f) => s + aporte(f, macro, gramosDe(f)), 0)

  // Gramos actuales de cada variable (arrancan en 0) — clave de alimento -> gramos
  const g = new Map()
  for (const fi of info) for (const v of fi.variables) g.set(v.fila.clave, 0)

  // Aporte de las variables de una comida a una macro con los gramos actuales
  const aporteVariables = (fi, macro, salvoRol = null) =>
    fi.variables.reduce(
      (s, v) => (v.rol === salvoRol ? s : s + aporte(v.fila, macro, g.get(v.fila.clave))), 0
    )

  // Comidas "elegibles" para cada macro: las que tienen al menos un alimento variable con ese rol.
  const elegibles = Object.fromEntries(
    MACROS.map((m) => [m.clave, info.filter((fi) => fi.variables.some((v) => v.rol === m.clave))])
  )
  for (const m of MACROS) {
    if (elegibles[m.clave].length === 0 && objetivo[m.clave] > 0) {
      avisos.push(`Ningún alimento cubre ${ETIQUETA[m.clave]}: agrega una fuente de ${ETIQUETA[m.clave]} para llegar a ${objetivo[m.clave]} g.`)
    }
  }

  // 2. Rondas del día: se reparte cada macro entre sus comidas elegibles y se resuelve cada comida.
  let convergio = false
  for (let ronda = 0; ronda < MAX_RONDAS_DIA; ronda++) {
    const antes = new Map(g)

    // Objetivo efectivo de cada macro: el del día menos lo que aportan las comidas que NO
    // pueden ajustarla (sus fijos y lo que aportan de forma indirecta con los gramos actuales).
    const objetivoComida = new Map() // clave de comida -> { proteina, carbohidratos, grasas }
    for (const m of MACROS) {
      const elegibles_k = new Set(elegibles[m.clave].map((fi) => fi.comida.clave))
      let fuera = 0
      for (const fi of info) {
        if (elegibles_k.has(fi.comida.clave)) continue
        fuera += fijoDe(fi, m.clave) + aporteVariables(fi, m.clave)
      }
      const efectivo = objetivo[m.clave] - fuera
      const sumaPesos = elegibles[m.clave].reduce((s, fi) => s + fi.peso, 0)
      for (const fi of elegibles[m.clave]) {
        // Si todas las comidas elegibles tienen peso 0, se reparte en partes iguales.
        const parte = sumaPesos > 0 ? fi.peso / sumaPesos : 1 / elegibles[m.clave].length
        const previo = objetivoComida.get(fi.comida.clave) ?? {}
        objetivoComida.set(fi.comida.clave, { ...previo, [m.clave]: efectivo * parte })
      }
    }

    // Cada comida por separado (Gauss-Seidel dentro de la comida).
    for (const fi of info) {
      const metas = objetivoComida.get(fi.comida.clave)
      if (!metas || fi.variables.length === 0) continue
      for (let r = 0; r < MAX_RONDAS_COMIDA; r++) {
        let cambio = 0
        for (const m of MACROS) {
          const grupo = fi.variables.filter((v) => v.rol === m.clave)
          if (grupo.length === 0) continue
          // Lo que debe aportar este grupo = meta de la comida - fijos - lo que aportan los otros roles
          const resto = metas[m.clave] - fijoDe(fi, m.clave) - aporteVariables(fi, m.clave, m.clave)
          const porAlimento = resto / grupo.length // el grupo reparte la macro en partes iguales
          for (const v of grupo) {
            const nuevo = Math.min(MAX_GRAMOS, Math.max(0, porAlimento / v.coef))
            cambio = Math.max(cambio, Math.abs(nuevo - g.get(v.fila.clave)))
            g.set(v.fila.clave, nuevo)
          }
        }
        if (cambio < TOLERANCIA_G) break
      }
    }

    let cambioDia = 0
    for (const [clave, valor] of g) cambioDia = Math.max(cambioDia, Math.abs(valor - antes.get(clave)))
    if (cambioDia < TOLERANCIA_G) { convergio = true; break }
  }
  if (!convergio) avisos.push('El cálculo no terminó de estabilizarse: revisa los gramos resultantes.')

  // 3. Redondeo y avisos por alimento
  const gramos = {}
  for (const fi of info) {
    for (const v of fi.variables) {
      const redondeado = Math.min(MAX_GRAMOS, Math.max(0, Math.round(g.get(v.fila.clave) / pasoValido) * pasoValido))
      gramos[v.fila.clave] = redondeado
      if (redondeado === 0) {
        avisos.push(`«${v.fila.alimento}» quedó en 0 g: otros alimentos ya cubren ese macro. Quítalo o cambia su rol.`)
      }
    }
  }
  return { gramos, avisos, convergio }
}

// Devuelve una copia de las comidas con los gramos calculados aplicados (cantidad como texto
// con coma decimal, como la escribiría el entrenador). No muta lo que recibe.
export function aplicarGramos(comidas, gramos) {
  return comidas.map((c) => ({
    ...c,
    alimentos: c.alimentos.map((a) => (
      Object.hasOwn(gramos, a.clave) ? { ...a, cantidad: String(gramos[a.clave]).replace('.', ',') } : a
    )),
  }))
}

// Diferencia del día frente al objetivo: [{ clave, etiqueta, objetivo, actual, diferencia }]
// (diferencia > 0 = se pasó). Sirve para mostrar cuánto falta o sobra en vivo.
export function diferenciasDia(totales, objetivo) {
  return MACROS.map((m) => ({
    clave: m.clave,
    etiqueta: m.etiqueta,
    objetivo: objetivo[m.clave],
    actual: totales[m.clave],
    diferencia: Math.round((totales[m.clave] - objetivo[m.clave]) * 10) / 10,
  }))
}
