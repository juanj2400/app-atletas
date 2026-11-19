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
