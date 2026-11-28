// Estilo COMÚN de todas las gráficas (ejes, rejilla y cajita del tooltip), para que se vean iguales.
// Solo presentación: no importa Recharts, así que es seguro importarlo desde cualquier gráfica.
import { COLOR } from './coloresGrafico'

export const TICK = { fill: COLOR.texto, fontSize: 12 }
// Rejilla: líneas horizontales punteadas y suaves.
export const REJILLA = { stroke: COLOR.rejilla, strokeDasharray: '3 4', vertical: false }
// Cajita que aparece al tocar un punto (versión para <div style>).
export const CAJA = {
  background: COLOR.fondo, border: `1px solid ${COLOR.rejilla}`, borderRadius: 12,
  padding: '8px 12px', color: COLOR.titulo, fontSize: 13,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
}
// Misma cajita para el <Tooltip contentStyle> de Recharts.
export const CAJA_RECHARTS = { background: COLOR.fondo, border: `1px solid ${COLOR.rejilla}`, borderRadius: 12, boxShadow: CAJA.boxShadow }
// Línea vertical que acompaña al dedo/cursor.
export const CURSOR = { stroke: COLOR.rejilla, strokeWidth: 1 }
