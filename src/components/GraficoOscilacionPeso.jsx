// =====================================================================
// GraficoOscilacionPeso — cuánto sube y baja el peso entre una medición y la siguiente.
//   1) Línea del peso con su promedio (línea punteada): se ven los picos y valles.
//   2) Barras con el CAMBIO entre mediciones consecutivas: hacia arriba = subió,
//      hacia abajo = bajó. Así la oscilación se lee de un vistazo.
// Lo usan el atleta (Mis datos › Medidas) y el entrenador (ficha del atleta).
// Componente de presentación: los cálculos viven en lib/oscilacionPeso.js.
// Se carga de forma perezosa desde GraficoOscilacionPesoLazy.
// =====================================================================
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { COLOR } from '../lib/coloresGrafico'
import { TICK, REJILLA, CAJA } from '../lib/estiloGrafico'
import CajaGrafico from './CajaGrafico'
import { formatearFecha, formatearFechaCorta } from '../lib/fechas'
import { calcularOscilacionPeso, textoOscilacion } from '../lib/oscilacionPeso'
import LineaTemporal from './LineaTemporal'

const kg = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 })
const conSigno = (v) => `${v > 0 ? '+' : ''}${kg(v)} kg`

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-borde bg-hundido p-2 text-center">
      <p className="text-xs text-suave">{titulo}</p>
      <p className="font-bold">{valor}</p>
    </div>
  )
}

function CajaCambio({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={CAJA}>
      <p style={{ fontWeight: 600 }}>{formatearFecha(p.fecha)}</p>
      <p>{conSigno(p.cambio)} frente a la medición anterior</p>
    </div>
  )
}

export default function GraficoOscilacionPeso({ mediciones }) {
  const o = calcularOscilacionPeso(mediciones)

  if (!o.suficiente) {
    return (
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <h4 className="text-base font-bold">Oscilación del peso</h4>
        <p className="mt-1 text-sm text-suave" role="status">{textoOscilacion(o)}</p>
      </div>
    )
  }

  const cambios = o.puntos.filter((p) => p.cambio !== null)

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <h4 className="text-base font-bold">Oscilación del peso</h4>
      <p className="mb-3 text-sm text-suave">{textoOscilacion(o)}</p>

      <LineaTemporal
        datos={o.puntos} clave="peso" nombre="Peso" unidad=" kg" color={COLOR.peso}
        referencia={o.promedio} etiquetaReferencia={`Promedio ${kg(o.promedio)} kg`} margenY={0.5} altura={220}
        extra={(p) => (p.cambio === null ? 'Primera medición' : `${conSigno(p.cambio)} vs. anterior`)}
      />

      <p className="mb-1 mt-4 text-sm font-semibold">Cambio entre mediciones</p>
      <CajaGrafico etiqueta="Gráfico de barras con lo que subió o bajó el peso entre mediciones" altura={150}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cambios} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...REJILLA} />
            <XAxis dataKey="fecha" tickFormatter={formatearFechaCorta} tick={TICK} stroke={COLOR.rejilla} minTickGap={24} />
            <YAxis width={40} tick={TICK} stroke={COLOR.rejilla} tickFormatter={kg} />
            <Tooltip content={<CajaCambio />} cursor={{ fill: COLOR.rejilla, opacity: 0.4 }} />
            <ReferenceLine y={0} stroke={COLOR.texto} />
            <Bar dataKey="cambio" radius={[3, 3, 3, 3]} isAnimationActive={false}>
              {/* El color NO es lo único que distingue subir de bajar: la dirección de la barra y el tooltip también */}
              {cambios.map((c) => <Cell key={c.fecha} fill={c.cambio > 0 ? COLOR.alerta : COLOR.linea} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CajaGrafico>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-3 rounded-sm" style={{ background: COLOR.alerta }} />Subió
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-3 rounded-sm" style={{ background: COLOR.linea }} />Bajó
        </li>
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Dato titulo="Mínimo" valor={`${kg(o.min)} kg`} />
        <Dato titulo="Máximo" valor={`${kg(o.max)} kg`} />
        <Dato titulo="Mayor salto" valor={conSigno(Math.abs(o.mayorSubida) >= Math.abs(o.mayorBajada) ? o.mayorSubida : o.mayorBajada)} />
      </div>
      <p className="mt-2 text-xs text-suave">
        Es normal que el peso varíe de una medición a otra (agua, sal, comidas). Lo importante es la tendencia.
      </p>
    </div>
  )
}
