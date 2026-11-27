// =====================================================================
// src/lib/fechas.js — utilidades de fechas.
//
// ¿Por qué un archivo aparte? Porque la lógica de fechas es delicada y la
// vamos a necesitar en muchas pantallas (check-in, métricas, rutinas).
// Escribirla UNA vez y reutilizarla evita errores repetidos.
//
// EL PROBLEMA DE LAS ZONAS HORARIAS (el error más común con fechas):
//   new Date().toISOString() devuelve la fecha en hora UTC. Colombia está en
//   UTC-5, así que a las 8:00 p. m. del día 30 en Colombia, UTC ya marca el
//   día 31. Si guardáramos esa fecha, el check-in caería en el día equivocado.
//   Solución: construir "YYYY-MM-DD" con la fecha LOCAL del celular.
// =====================================================================

// Devuelve la fecha local como texto "YYYY-MM-DD" (el formato de las
// columnas `date` de Postgres). Ejemplo: "2026-11-02".
export function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0') // los meses empiezan en 0
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

// Convierte "2026-11-02" en un texto legible: "lun, 2 nov".
// OJO: NO usamos new Date("2026-11-02") porque JavaScript lo interpreta como
// medianoche UTC y en Colombia mostraría el día ANTERIOR. Construimos la
// fecha con sus partes (año, mes, día), que sí se interpreta como local.
export function formatearFecha(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Versión corta para ejes de gráficos: "2026-10-30" -> "30 oct"
export function formatearFechaCorta(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// Versión con año: "1996-02-29" -> "29 feb 1996" (por ejemplo, fecha de nacimiento).
export function formatearFechaConAnio(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Lunes de la semana de la fecha dada (hora LOCAL), como "YYYY-MM-DD". La semana de
// entrenamiento va de lunes a domingo. Se construye con partes locales (nunca con
// new Date("YYYY-MM-DD")) para no tener el desfase UTC de Colombia.
export function inicioSemanaISO(fecha = new Date()) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // getDay(): domingo = 0 -> lunes = 0 tras el ajuste
  return fechaLocalISO(d)
}

// Lunes de la semana SIGUIENTE (cuando se vuelve a habilitar un día ya realizado).
export function inicioSemanaSiguienteISO(fecha = new Date()) {
  const [anio, mes, dia] = inicioSemanaISO(fecha).split('-').map(Number)
  return fechaLocalISO(new Date(anio, mes - 1, dia + 7))
}

// Medianoche LOCAL de una fecha "YYYY-MM-DD" como instante ISO (para filtrar `realizado_en`,
// que Postgres guarda en UTC). Se construye con partes locales, nunca con new Date("YYYY-MM-DD").
export function inicioDeFechaISO(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toISOString()
}
