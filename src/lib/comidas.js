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
//        alimentos: [{ id, alimento, cantidad (número), unidad, nota,
//                      foodId, estado, base, asignado }] }]
//        Los 4 últimos son el SNAPSHOT de la migración 25: de qué alimento del catálogo viene,
//        su estado (crudo/cocido/n/a), sus macros por 100 g (`base`) y los macros de esos
//        gramos exactos (`asignado`). Son null/'' en los alimentos manuales y en los menús
//        guardados antes de la migración 25.
//   - "borrador" (lo que se EDITA en el formulario): igual, pero sin ids de base de datos,
//        con una `clave` local para React y la cantidad como TEXTO (el usuario escribe "1,5").
//        Cada alimento del borrador también lleva `rol` y `fijo` (solo para el cálculo de
//        lib/dieta.js; no se guardan).
// =====================================================================
import { aNumero } from './numeros'
import { sumarMacros } from './dieta'

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
    const conSnapshot = a.base_calorias !== null && a.base_calorias !== undefined
    alimentosDe.get(a.meal_id).push({
      id: a.id,
      alimento: a.alimento,
      cantidad: Number(a.cantidad), // la base entrega numeric; aquí queda como número
      unidad: a.unidad,
      nota: a.nota ?? '',
      foodId: a.food_id ?? null,
      estado: a.estado ?? '',
      base: conSnapshot ? {
        calorias: Number(a.base_calorias),
        proteina_g: Number(a.base_proteina_g),
        carbohidratos_g: Number(a.base_carbohidratos_g),
        grasas_g: Number(a.base_grasas_g),
      } : null,
      asignado: conSnapshot ? {
        calorias: Number(a.calorias),
        proteina: Number(a.proteina_g),
        carbohidratos: Number(a.carbohidratos_g),
        grasas: Number(a.grasas_g),
      } : null,
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

// Totales (kcal y macros) de una lista de alimentos LEÍDOS de la base, sumando los macros
// asignados que se guardaron (snapshot). `sinMacros` = alimentos manuales que no suman.
export function totalesAsignados(alimentos) {
  return {
    ...sumarMacros(alimentos.map((a) => a.asignado)),
    sinMacros: alimentos.filter((a) => !a.asignado).length,
  }
}

// ¿Esta lista de comidas tiene al menos un alimento con macros guardados?
export const hayMacros = (comidas) => comidas.some((c) => c.alimentos.some((a) => a.asignado))

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
  return {
    clave: nuevaClave(), alimento: '', cantidad: '', unidad, nota: '',
    foodId: null, estado: '', base: null, rol: '', fijo: false,
  }
}

// Datos del catálogo (fila de `foods`) que se copian a la fila del borrador. La unidad pasa a
// gramos: los macros del catálogo son por 100 g.
function datosDeCatalogo(alimento) {
  return {
    alimento: alimento.nombre,
    unidad: 'g',
    foodId: alimento.id,
    estado: alimento.estado,
    base: {
      calorias: Number(alimento.calorias),
      proteina_g: Number(alimento.proteina_g),
      carbohidratos_g: Number(alimento.carbohidratos_g),
      grasas_g: Number(alimento.grasas_g),
    },
    rol: '', // al cambiar de alimento vuelve a su macro dominante
  }
}

// Fila nueva a partir de un alimento del catálogo (sin gramos todavía).
export function filaDeCatalogo(alimento) {
  return { ...alimentoNuevo('g'), ...datosDeCatalogo(alimento) }
}

// INTERCAMBIO: la misma fila (misma posición, gramos, nota y "fijo") pasa a otro alimento
// del catálogo. Devuelve una fila nueva; no muta la original.
export function aplicarAlimentoCatalogo(fila, alimento) {
  return { ...fila, ...datosDeCatalogo(alimento) }
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
      foodId: a.foodId,
      estado: a.estado,
      base: a.base,
      rol: '',
      fijo: false,
    })),
  }))
}

// Huella del contenido (sin las claves locales): sirve para saber si hay cambios sin guardar
// comparándola con la del último guardado, sin llevar una bandera aparte que se desincronice.
export function huellaBorrador(borrador) {
  return JSON.stringify(
    borrador.map((c) => [
      c.nombre, c.notas,
      c.alimentos.map((a) => [a.alimento, a.cantidad, a.unidad, a.nota, a.foodId, a.estado, a.base]),
    ])
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
      // Los macros del catálogo son por 100 g: un alimento del catálogo solo se mide en gramos.
      if (a.base && a.unidad !== 'g') {
        return `En «${nombre}», «${alimento}» es del catálogo y debe medirse en gramos.`
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
      // Snapshot (migración 25): solo los alimentos del catálogo lo llevan. La base de datos
      // calcula los macros asignados a partir de esta base y de los gramos.
      ...(a.base ? { food_id: a.foodId, estado: a.estado || 'n/a', base: a.base } : {}),
    })),
  }))
}
