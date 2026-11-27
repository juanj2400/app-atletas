// =====================================================================
// src/lib/comidas.js — lógica PURA de las comidas del día (el menú manual del atleta).
//
// El entrenador arma, para cada atleta, una lista de comidas (desayuno, almuerzo, cena,
// snacks...) y, dentro de cada una, los alimentos con su cantidad exacta. Aquí vive todo
// lo que se puede calcular sin tocar la base de datos ni la pantalla: validar, convertir
// entre el formato de la base y el del formulario, y escribir las cantidades en español.
//
// Formas de los datos:
//   - "comidas" (lo que se LEE de la base): [{ id, nombre, notas, created_at,
//        alimentos: [{ id, alimento, cantidad (número), unidad, nota }] }]
//   - "borrador" (lo que se EDITA en el formulario): igual, pero sin ids de base de datos,
//        con una `clave` local para React y la cantidad como TEXTO (el usuario escribe "1,5").
// =====================================================================
import { aNumero } from './numeros'

// Mismos límites que la migración 23 (la base de datos es la barrera real).
export const MAX_COMIDAS = 10
export const MAX_ALIMENTOS = 30
export const MAX_CANTIDAD = 10000

// Lo que se guarda es el texto simple ('g', 'porcion'...) y lo que se muestra, la etiqueta.
export const UNIDADES = [
  { valor: 'g', etiqueta: 'Gramos (g)' },
  { valor: 'ml', etiqueta: 'Mililitros (ml)' },
  { valor: 'unidad', etiqueta: 'Unidades' },
  { valor: 'porcion', etiqueta: 'Porciones' },
]

// Botones rápidos para agregar una comida; el entrenador puede escribir cualquier otro nombre.
export const COMIDAS_SUGERIDAS = ['Desayuno', 'Almuerzo', 'Cena', 'Snack']

const formatoNumero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

// 150 g · 3 unidades · 1 porción · 1,5 porciones · 250,5 ml
export function textoCantidad(cantidad, unidad) {
  const n = Number(cantidad)
  const numero = formatoNumero.format(n)
  if (unidad === 'g' || unidad === 'ml') return `${numero} ${unidad}`
  if (unidad === 'unidad') return `${numero} ${n === 1 ? 'unidad' : 'unidades'}`
  if (unidad === 'porcion') return `${numero} ${n === 1 ? 'porción' : 'porciones'}`
  return numero
}

// "3 comidas · 9 alimentos"
export function resumenComidas(comidas) {
  const alimentos = comidas.reduce((total, c) => total + c.alimentos.length, 0)
  const textoComidas = `${comidas.length} ${comidas.length === 1 ? 'comida' : 'comidas'}`
  const textoAlimentos = `${alimentos} ${alimentos === 1 ? 'alimento' : 'alimentos'}`
  return `${textoComidas} · ${textoAlimentos}`
}

// Une las filas de `meals` y de `meal_foods` (dos consultas planas) en una lista anidada y
// ordenada. Copia antes de ordenar: nunca se muta lo que llega.
export function armarComidas(filasComidas, filasAlimentos) {
  const alimentosDe = new Map()
  for (const a of [...filasAlimentos].sort((x, y) => x.orden - y.orden)) {
    if (!alimentosDe.has(a.meal_id)) alimentosDe.set(a.meal_id, [])
    alimentosDe.get(a.meal_id).push({
      id: a.id,
      alimento: a.alimento,
      cantidad: Number(a.cantidad), // la base entrega numeric; aquí queda como número
      unidad: a.unidad,
      nota: a.nota ?? '',
    })
  }
  return [...filasComidas]
    .sort((x, y) => x.orden - y.orden)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      notas: c.notas ?? '',
      created_at: c.created_at,
      alimentos: alimentosDe.get(c.id) ?? [],
    }))
}

// "Actualizado" = la fecha más reciente entre las comidas (cada guardado las recrea todas).
export function ultimaActualizacion(comidas) {
  const marcas = comidas.map((c) => c.created_at).filter(Boolean).sort()
  return marcas.length > 0 ? marcas[marcas.length - 1] : null
}

// ---------------------------------------------------------------------
// Borrador del formulario del entrenador
// ---------------------------------------------------------------------

// Las claves solo sirven para que React distinga cada fila y para los `id` de los campos;
// no se guardan en ningún sitio.
let contador = 0
const nuevaClave = () => `k${++contador}`

export function alimentoNuevo(unidad = 'g') {
  return { clave: nuevaClave(), alimento: '', cantidad: '', unidad, nota: '' }
}

export function comidaNueva(nombre = '') {
  return { clave: nuevaClave(), nombre, notas: '', alimentos: [] }
}

// De "comidas" (base de datos) a borrador (formulario). La cantidad pasa a texto con coma
// decimal, como la escribiría el entrenador.
export function aBorrador(comidas) {
  return comidas.map((c) => ({
    clave: nuevaClave(),
    nombre: c.nombre,
    notas: c.notas,
    alimentos: c.alimentos.map((a) => ({
      clave: nuevaClave(),
      alimento: a.alimento,
      cantidad: String(a.cantidad).replace('.', ','),
      unidad: a.unidad,
      nota: a.nota,
    })),
  }))
}

// Huella del contenido (sin las claves locales): sirve para saber si hay cambios sin guardar
// comparándola con la del último guardado, sin llevar una bandera aparte que se desincronice.
export function huellaBorrador(borrador) {
  return JSON.stringify(
    borrador.map((c) => [c.nombre, c.notas, c.alimentos.map((a) => [a.alimento, a.cantidad, a.unidad, a.nota])])
  )
}

// Devuelve una lista NUEVA con la comida de `indice` movida `delta` posiciones (-1 sube, +1 baja).
// Si no se puede mover (ya está en el borde), devuelve la lista tal cual.
export function moverComida(lista, indice, delta) {
  const destino = indice + delta
  if (destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
  return copia
}

// Revisa el borrador y devuelve el PRIMER error en español, o '' si todo está bien.
// (La base de datos vuelve a validar lo mismo: esto es comodidad para el entrenador.)
export function validarComidas(borrador) {
  if (borrador.length > MAX_COMIDAS) return `Un día puede tener como máximo ${MAX_COMIDAS} comidas.`

  for (let i = 0; i < borrador.length; i++) {
    const c = borrador[i]
    const nombre = c.nombre.trim()
    if (nombre.length < 2 || nombre.length > 40) {
      return `La comida ${i + 1} necesita un nombre de 2 a 40 letras.`
    }
    if (c.notas.trim().length > 200) return `Las notas de «${nombre}» no pueden pasar de 200 caracteres.`
    if (c.alimentos.length > MAX_ALIMENTOS) {
      return `«${nombre}» puede tener como máximo ${MAX_ALIMENTOS} alimentos.`
    }

    for (let j = 0; j < c.alimentos.length; j++) {
      const a = c.alimentos[j]
      const alimento = a.alimento.trim()
      if (alimento.length < 2 || alimento.length > 80) {
        return `En «${nombre}», el alimento ${j + 1} necesita un nombre de 2 a 80 letras.`
      }
      const cantidad = aNumero(a.cantidad)
      if (cantidad === null) return `En «${nombre}», escribe la cantidad de «${alimento}».`
      if (Number.isNaN(cantidad)) return `En «${nombre}», la cantidad de «${alimento}» debe ser solo un número.`
      if (cantidad <= 0 || cantidad > MAX_CANTIDAD) {
        return `En «${nombre}», la cantidad de «${alimento}» debe ser mayor que 0 y hasta 10.000.`
      }
      // La base guarda 2 decimales: se avisa aquí para que lo guardado coincida con lo escrito.
      if (Math.round(cantidad * 100) / 100 !== cantidad) {
        return `En «${nombre}», la cantidad de «${alimento}» admite como máximo 2 decimales.`
      }
      if (!UNIDADES.some((u) => u.valor === a.unidad)) {
        return `En «${nombre}», elige la unidad de «${alimento}».`
      }
      if (a.nota.trim().length > 120) {
        return `En «${nombre}», la nota de «${alimento}» no puede pasar de 120 caracteres.`
      }
    }
  }
  return ''
}

// Del borrador al formato que espera la función set_meal_plan de la base de datos.
// Llamar solo con un borrador ya validado (validarComidas devuelve '').
export function aPayload(borrador) {
  return borrador.map((c) => ({
    nombre: c.nombre.trim(),
    notas: c.notas.trim() || null,
    alimentos: c.alimentos.map((a) => ({
      alimento: a.alimento.trim(),
      cantidad: aNumero(a.cantidad), // número, no texto: la función SQL lo exige así
      unidad: a.unidad,
      nota: a.nota.trim() || null,
    })),
  }))
}
