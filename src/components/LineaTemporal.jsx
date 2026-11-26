// =====================================================================
// LineaTemporal — línea simple "valor a lo largo de los días", reutilizable.
// La usan GraficoOscilacionPeso (peso corporal) y GraficosRecord (peso máximo y
// repeticiones de un ejercicio), para que todas se vean y se comporten igual.
//
// IMPORTANTE: importa Recharts. Por eso NUNCA se importa desde un componente que
// se cargue al abrir la app: solo desde componentes que ya son perezosos
// (GraficoOscilacionPesoLazy y GraficosRecordLazy).
//
// Props:
//   datos       [{ fecha: 'YYYY-MM-DD', ...cualquier campo }], de más antiguo a más reciente
//   clave       campo numérico a dibujar
//   nombre      texto del tooltip y del aria-label ("Peso", "Repeticiones")
//   unidad      " kg", "" ...
//   referencia  (opcional) valor de una línea punteada horizontal (promedio, récord)
//   margenY     holgura del eje vertical; el eje NO empieza en 0 para que se vean los cambios pequeños
//   extra       (opcional) función punto => texto para una segunda línea en el tooltip
// =====================================================================
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { COLOR } from '../lib/coloresGrafico'
import { formatearFecha, formatearFechaCorta } from '../lib/fechas'

const TICK = { fill: COLOR.texto, fontSize: 12 }
const CAJA = {
  background: COLOR.fondo, border: `1px solid ${COLOR.rejilla}`, borderRadius: 12,
  padding: '8px 12px', color: COLOR.titulo, fontSize: 13,
}
const num = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 })

// Caja que aparece al tocar un punto. Vive FUERA del componente para que React no la recree en cada dibujo.
function Caja({ active, payload, clave, nombre, unidad, extra }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={CAJA}>
      <p style={{ fontWeight: 600 }}>{formatearFecha(p.fecha)}</p>
      <p>{nombre}: {num(p[clave])}{unidad}</p>
      {extra && <p style={{ color: COLOR.texto }}>{extra(p)}</p>}
    </div>
  )
}

export default function LineaTemporal({
  datos, clave, nombre, unidad = '', color = COLOR.linea, altura = 200,
  referencia = null, etiquetaReferencia = '', margenY = 1, entero = false, extra = null,
}) {
  return (
    <div role="img" aria-label={`Gráfico de ${nombre.toLowerCase()} por fecha`}>
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
          {/* minTickGap evita que las fechas se amontonen cuando hay muchos puntos */}
          <XAxis dataKey="fecha" tickFormatter={formatearFechaCorta} tick={TICK} stroke={COLOR.rejilla} minTickGap={24} />
          <YAxis
            width={40} tick={TICK} stroke={COLOR.rejilla} allowDecimals={!entero}
            domain={[(min) => Math.max(0, Math.floor(min - margenY)), (max) => Math.ceil(max + margenY)]}
          />
          <Tooltip content={(props) => <Caja {...props} clave={clave} nombre={nombre} unidad={unidad} extra={extra} />} />
          {referencia !== null && (
            <ReferenceLine
              y={referencia} stroke={COLOR.alerta} strokeDasharray="4 4"
              label={etiquetaReferencia ? { value: etiquetaReferencia, fill: COLOR.alerta, fontSize: 11, position: 'insideTopRight' } : undefined}
            />
          )}
          <Line dataKey={clave} type="linear" stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
