// =====================================================================
// src/lib/panelAtleta.js — lógica pura del panel general de un atleta (zona del entrenador).
// Reciben datos ya cargados y devuelven números, textos o listas: no tocan la pantalla ni
// la base de datos. Las fechas "YYYY-MM-DD" son LOCALES (nunca new Date("YYYY-MM-DD")).
// =====================================================================
import { diasEntre } from './ciclos'
import { fechaLocalISO } from './fechas'

// Umbrales de los avisos "Atención" (ajustables aquí).
export const DIAS_SIN_CHECKIN = 2
export const DIAS_SIN_MEDICION = 14
export const DIAS_SIN_ENTRENAR = 7

// "2026-11-26" menos n días -> "2026-11-20" (con partes locales).
export function restarDiasISO(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  return fechaLocalISO(new Date(a, m - 1, d - n))
}

// Días desde un instante de la base de datos (UTC) hasta hoy, contando en fecha LOCAL.
export function diasDesdeTimestamp(timestamp, hoy) {
  return diasEntre(fechaLocalISO(new Date(timestamp)), hoy)
}

// 0 -> "Hoy", 1 -> "Ayer", n -> "Hace n días"
export function textoHace(dias) {
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

// Check-ins (ordenados del más reciente al más antiguo): los de los últimos 7 días (hoy y
// los 6 anteriores), el sueño promedio y los días desde el último check-in (null si no hay).
export function resumenCheckIns(checkIns, hoy) {
  const desde = restarDiasISO(hoy, 6)
  const ultimos7 = checkIns.filter((c) => c.fecha >= desde && c.fecha <= hoy)
  const horas = ultimos7.filter((c) => c.horas_sueno !== null).map((c) => Number(c.horas_sueno))
  return {
    en7: ultimos7.length,
    promedioSueno: horas.length ? horas.reduce((s, h) => s + h, 0) / horas.length : null,
    diasSinCheckIn: checkIns.length ? diasEntre(checkIns[0].fecha, hoy) : null,
  }
}

// Días de la rutina activa que ya se terminaron ESTA semana.
export function diasRealizadosSemana(rutina, completados) {
  if (!rutina) return { hechos: 0, total: 0 }
  const ids = new Set(rutina.routine_days.map((d) => d.id))
  const hechos = new Set(completados.filter((c) => ids.has(c.routine_day_id)).map((c) => c.routine_day_id)).size
  return { hechos, total: ids.size }
}

// Lista de cosas que el entrenador debería mirar, de más a menos importante.
// Cada aviso dice a qué sección ir: { id, texto, pestana, seccion }.
export function alertasAtleta({ hoy, resumenChk, rutinaActiva, ultimaSerie, plan, ultimaMedicionFecha }) {
  const avisos = []
  const checkin = { pestana: 'resumen', seccion: 'seccion-checkins' }

  if (resumenChk.diasSinCheckIn === null) {
    avisos.push({ id: 'checkin', texto: 'Aún no ha enviado ningún check-in.', ...checkin })
  } else if (resumenChk.diasSinCheckIn >= DIAS_SIN_CHECKIN) {
    avisos.push({ id: 'checkin', texto: `Lleva ${resumenChk.diasSinCheckIn} días sin enviar el check-in.`, ...checkin })
  }

  if (!rutinaActiva) {
    avisos.push({ id: 'rutina', texto: 'No tiene una rutina activa.', pestana: 'entrenamiento', seccion: 'seccion-rutinas' })
  } else if (!ultimaSerie) {
    avisos.push({ id: 'series', texto: 'Aún no ha registrado series de entrenamiento.', pestana: 'entrenamiento', seccion: 'seccion-historial' })
  } else {
    const dias = diasDesdeTimestamp(ultimaSerie, hoy)
    if (dias >= DIAS_SIN_ENTRENAR) {
      avisos.push({ id: 'series', texto: `Lleva ${dias} días sin registrar series.`, pestana: 'entrenamiento', seccion: 'seccion-historial' })
    }
  }

  if (!plan) {
    avisos.push({ id: 'plan', texto: 'No tiene un plan nutricional vigente.', pestana: 'cuerpo', seccion: 'seccion-plan' })
  }

  if (!ultimaMedicionFecha) {
    avisos.push({ id: 'medicion', texto: 'Aún no tiene mediciones registradas.', pestana: 'cuerpo', seccion: 'seccion-mediciones' })
  } else {
    const dias = diasEntre(ultimaMedicionFecha, hoy)
    if (dias >= DIAS_SIN_MEDICION) {
      avisos.push({ id: 'medicion', texto: `Su última medición fue hace ${dias} días.`, pestana: 'cuerpo', seccion: 'seccion-mediciones' })
    }
  }
  return avisos
}
