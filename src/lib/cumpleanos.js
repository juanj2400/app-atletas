// =====================================================================
// src/lib/cumpleanos.js — cumpleaños de los atletas (funciones puras).
//
// Todas las fechas son texto "YYYY-MM-DD" y "hoy" lo entrega quien llama (la fecha LOCAL
// del celular, con useHoy/fechaLocalISO). Aquí NUNCA se usa new Date("YYYY-MM-DD") ni la
// fecha UTC para saber qué día es hoy: Date.UTC solo se usa como aritmética de calendario
// (contar días entre dos fechas), igual que en tendenciaPeso.js.
//
// Regla del 29 de febrero: en los años que no son bisiestos el cumpleaños se celebra el
// 28 de febrero (convención más común; si prefieres el 1 de marzo, cambia FEB29_EN_NO_BISIESTO).
// =====================================================================

export const DIAS_ADELANTE = 30 // ventana de "próximos cumpleaños" (cubre lo que resta del mes actual)
const MIN_ANIO = 1900 // la base de datos rechaza fechas anteriores a 1900
const EDAD_MIN = 5 // comodidad del navegador: evita errores de dedo evidentes
const EDAD_MAX = 100
const FEB29_EN_NO_BISIESTO = 28

const dosDigitos = (n) => String(n).padStart(2, '0')
const aISO = (anio, mes, dia) => `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`

function partes(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return { anio, mes, dia }
}

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

// ¿"2026-02-30" existe de verdad? (el formato solo no basta)
function esFechaReal(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const { anio, mes, dia } = partes(iso)
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

// Días de calendario entre dos fechas ISO (b - a).
function diasEntre(aIso, bIso) {
  const a = partes(aIso)
  const b = partes(bIso)
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86_400_000)
}

// Edad cumplida en la fecha de referencia (normalmente hoy).
export function edadEnFecha(nacimientoISO, referenciaISO) {
  const n = partes(nacimientoISO)
  const r = partes(referenciaISO)
  let edad = r.anio - n.anio
  if (r.mes < n.mes || (r.mes === n.mes && r.dia < n.dia)) edad -= 1
  return edad
}

// Devuelve '' si la fecha es aceptable o el mensaje (en español) si no. Texto vacío = aceptable
// (significa "sin fecha"). La barrera real está en la base de datos (CHECK + trigger).
export function validarFechaNacimiento(iso, hoyISO) {
  const texto = String(iso ?? '').trim()
  if (texto === '') return ''
  if (!esFechaReal(texto)) return 'Escribe una fecha válida.'
  if (partes(texto).anio < MIN_ANIO) return `La fecha no puede ser anterior a ${MIN_ANIO}.`
  if (texto > hoyISO) return 'La fecha de nacimiento no puede ser futura.'
  const edad = edadEnFecha(texto, hoyISO)
  if (edad < EDAD_MIN) return `Revisa el año: el atleta tendría menos de ${EDAD_MIN} años.`
  if (edad > EDAD_MAX) return `Revisa el año: el atleta tendría más de ${EDAD_MAX} años.`
  return ''
}

// Día del cumpleaños en un año dado (ajusta el 29 de febrero).
function cumpleEnAnio(nacimientoISO, anio) {
  const { mes, dia } = partes(nacimientoISO)
  const diaReal = mes === 2 && dia === 29 && !esBisiesto(anio) ? FEB29_EN_NO_BISIESTO : dia
  return aISO(anio, mes, diaReal)
}

// Próximo cumpleaños desde hoy (incluido hoy): fecha, días que faltan, edad que cumple y si es hoy.
export function proximoCumpleanos(nacimientoISO, hoyISO) {
  const anioHoy = partes(hoyISO).anio
  let fechaISO = cumpleEnAnio(nacimientoISO, anioHoy)
  let anio = anioHoy
  if (fechaISO < hoyISO) {
    anio = anioHoy + 1
    fechaISO = cumpleEnAnio(nacimientoISO, anio)
  }
  const dias = diasEntre(hoyISO, fechaISO)
  return { fechaISO, dias, edad: anio - partes(nacimientoISO).anio, esHoy: dias === 0 }
}

// Resumen para la lista del entrenador. `atletas`: [{ id, nombre_completo, fecha_nacimiento }].
//  - proximos: de hoy a `diasAdelante` días, ordenados por cercanía (empate: por nombre).
//    `esteMes` marca los que caen en el mes actual.
//  - yaEsteMes: cumpleaños de este mes que ya pasaron (para saludarlos tarde si hace falta).
//  - sinFecha: cuántos atletas no tienen fecha de nacimiento anotada.
export function resumirCumpleanos(atletas, hoyISO, diasAdelante = DIAS_ADELANTE) {
  const mesHoy = hoyISO.slice(0, 7)
  const proximos = []
  const yaEsteMes = []
  let sinFecha = 0

  for (const atleta of atletas) {
    if (!atleta.fecha_nacimiento) {
      sinFecha += 1
      continue
    }
    const prox = proximoCumpleanos(atleta.fecha_nacimiento, hoyISO)
    if (prox.dias <= diasAdelante) {
      proximos.push({ atleta, ...prox, esteMes: prox.fechaISO.slice(0, 7) === mesHoy })
    }
    const esteAnio = cumpleEnAnio(atleta.fecha_nacimiento, partes(hoyISO).anio)
    if (esteAnio.slice(0, 7) === mesHoy && esteAnio < hoyISO) {
      yaEsteMes.push({ atleta, fechaISO: esteAnio })
    }
  }

  const porNombre = (a, b) => (a.atleta.nombre_completo || '').localeCompare(b.atleta.nombre_completo || '', 'es')
  proximos.sort((a, b) => a.dias - b.dias || porNombre(a, b))
  yaEsteMes.sort((a, b) => a.fechaISO.localeCompare(b.fechaISO) || porNombre(a, b))
  return { proximos, yaEsteMes, sinFecha }
}

// "¡Hoy!", "Mañana" o "en 5 días".
export function textoFaltan(dias) {
  if (dias === 0) return '¡Hoy!'
  if (dias === 1) return 'Mañana'
  return `en ${dias} días`
}
