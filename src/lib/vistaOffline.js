// =====================================================================
// src/lib/vistaOffline.js — funciones PURAS que arman lo que ve el atleta cuando parte de los
// datos está solo en el teléfono: (1) ajustar una copia guardada a "hoy" y (2) sumar encima los
// registros pendientes de subir. Sin acceso a red ni a IndexedDB: se prueban con ejemplos.
//
// Fechas: "YYYY-MM-DD" locales; las horas de series se pasan a fecha local con fechaLocalISO.
// =====================================================================
import { fechaLocalISO } from './fechas'

const ms = (iso) => Date.parse(iso)
// Más reciente primero (orden que espera calcularUltimaVez); a igual hora, número de serie mayor primero.
const masRecientePrimero = (a, b) => ms(b.realizado_en) - ms(a.realizado_en) || (b.numero_serie ?? 0) - (a.numero_serie ?? 0)
const fechaDeSerie = (s) => fechaLocalISO(new Date(s.realizado_en))

// La semana de descarga solo vale si hoy cae dentro de ella.
export const descargaVigenteHoy = (d, hoy) => (d && d.fecha_inicio <= hoy && hoy <= d.fecha_fin ? d : null)

// Copia guardada de UN día de entrenamiento -> lo que sigue siendo válido HOY.
// c: { d, previos, logsHoy, cierresHoy, completado, descarga, fechaCache, semanaCache }
//   - Mismo día: todo vale tal cual.
//   - Otro día: las series que eran "de hoy" cuando se guardó pasan a ser "la última vez"; los
//     cierres vuelven a vacío; "día realizado" solo vale si sigue siendo la misma semana.
export function ajustarCopiaDia(c, hoy, semana) {
  const descarga = descargaVigenteHoy(c.descarga, hoy)
  if (c.fechaCache === hoy) {
    return { previos: c.previos, logsHoy: c.logsHoy, cierresHoy: c.cierresHoy, completado: c.completado, descarga }
  }
  return {
    previos: [...c.logsHoy, ...c.previos].sort(masRecientePrimero),
    logsHoy: [],
    cierresHoy: [],
    completado: c.semanaCache === semana ? c.completado : null,
    descarga,
  }
}

// Suma los registros pendientes (cola) a lo que vino del servidor o de la copia guardada.
// base: { previos, logsHoy, cierresHoy, completado }; cola: items de leerCola(); ctx: { idsFilas, diaId, hoy, semana }.
// Lo pendiente lleva `pendiente: true`. Si algo ya aparece en el servidor (se acaba de subir), no se repite.
export function unirPendientesDia(base, cola, { idsFilas, diaId, hoy, semana }) {
  const vivos = cola.filter((i) => i.estado === 'pendiente')

  const series = vivos
    .filter((i) => i.tipo === 'serie' && idsFilas.includes(i.payload.routine_exercise_id))
    .map((i) => ({ ...i.payload, pendiente: true }))
    .filter((s) => !base.logsHoy.some((x) => x.id === s.id) && !base.previos.some((x) => x.id === s.id))
  const deHoy = series.filter((s) => fechaDeSerie(s) === hoy)
  const anteriores = series.filter((s) => fechaDeSerie(s) !== hoy)

  const cierres = vivos
    .filter((i) => i.tipo === 'cierre' && idsFilas.includes(i.payload.routine_exercise_id) && i.payload.fecha === hoy)
    .map((i) => ({ ...i.payload, pendiente: true }))
    .filter((c) => !base.cierresHoy.some((x) => x.routine_exercise_id === c.routine_exercise_id))

  const dia = vivos.find((i) => i.tipo === 'dia' && i.payload.routine_day_id === diaId && i.payload.semana_inicio === semana)

  return {
    previos: anteriores.length ? [...anteriores, ...base.previos].sort(masRecientePrimero) : base.previos,
    logsHoy: [...base.logsHoy, ...deHoy].sort((a, b) => (a.numero_serie ?? 0) - (b.numero_serie ?? 0)),
    cierresHoy: [...base.cierresHoy, ...cierres],
    completado: base.completado ?? (dia ? { ...dia.payload, pendiente: true } : null),
  }
}

// Lista de días ya realizados esta semana (pantalla Entrenar) + los pendientes de subir.
// realizados: filas { routine_day_id, fecha }.
export function unirDiasPendientes(realizados, cola, semana) {
  const extra = cola
    .filter((i) => i.estado === 'pendiente' && i.tipo === 'dia' && i.payload.semana_inicio === semana)
    .map((i) => ({ routine_day_id: i.payload.routine_day_id, fecha: i.payload.fecha, pendiente: true }))
    .filter((d) => !realizados.some((r) => r.routine_day_id === d.routine_day_id))
  return [...realizados, ...extra]
}
