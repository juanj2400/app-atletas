// =====================================================================
// src/lib/pesoCombinado.js — une el peso OFICIAL (metrics, lo mide el entrenador) con el peso
// que el atleta DECLARA en su check-in diario (daily_check_ins), solo para MOSTRAR.
//
// Por qué se combina aquí y no en la base de datos: AGENTS.md (invariante 2) prohíbe copiar
// el peso del check-in a `metrics`, y `metrics` solo la escribe el admin. Así el atleta no
// puede crear, editar ni borrar mediciones oficiales; el dato declarado sigue siendo suyo y
// aparte, y aquí solo se suma a la vista (tendencia, oscilación y "peso actual").
//
// Regla: por cada día, si hay medición oficial CON peso, manda esa y el check-in de ese día
// no se usa. Fechas: "YYYY-MM-DD" locales, se comparan como texto.
// =====================================================================

// mediciones: filas de metrics (cualquier orden). checkIns: filas { fecha, peso_corporal_kg }.
// Devuelve una lista NUEVA (no muta nada), de la fecha más reciente a la más antigua, con
// `origen`: 'oficial' (metrics) o 'checkin' (declarado). Las filas de metrics sin peso se
// conservan (cintura y calorías las siguen usando); las de check-in solo traen peso.
export function combinarPesos(mediciones, checkIns) {
  const oficiales = (mediciones ?? []).map((m) => ({ ...m, origen: 'oficial' }))
  const diasConPesoOficial = new Set(
    oficiales.filter((m) => m.peso_corporal_kg !== null && m.peso_corporal_kg !== undefined).map((m) => m.fecha)
  )
  const declarados = (checkIns ?? [])
    .filter((c) => c.peso_corporal_kg !== null && c.peso_corporal_kg !== undefined)
    .filter((c) => !diasConPesoOficial.has(c.fecha))
    .map((c) => ({
      id: `checkin-${c.fecha}`,
      fecha: c.fecha,
      peso_corporal_kg: c.peso_corporal_kg,
      perimetro_cintura_cm: null,
      calorias_consumidas: null,
      estado_calorico: null,
      notas: null,
      origen: 'checkin',
    }))
  // Orden estable: fecha descendente; en empate, primero la oficial.
  return [...oficiales, ...declarados].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
}
