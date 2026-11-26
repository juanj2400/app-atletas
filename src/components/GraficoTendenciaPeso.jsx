// =====================================================================
// GraficoTendenciaPeso — peso real, línea de tendencia y proyección a futuro.
//
// Es la primera tarjeta que ve el atleta en Mis datos › Medidas. Responde a una
// pregunta simple: "¿hacia dónde va mi peso?".
//   - Puntos + línea fina: tus pesos reales.
//   - Línea continua: la tendencia (la recta que mejor encaja con tus pesos).
//   - Línea punteada: esa misma recta prolongada unos días hacia adelante.
//
// Componente de PRESENTACIÓN: recibe las mediciones por props; los cálculos
// viven en lib/tendenciaPeso.js (función pura). Se carga de forma PEREZOSA
// desde GraficoTendenciaPesoLazy para no meter Recharts en el paquete principal.
// El eje X es una escala numérica de DÍAS (no categorías), así los huecos
// entre mediciones se ven como huecos reales.
// =====================================================================
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatearFecha, formatearFechaCorta } from '../lib/fechas'
import { COLOR } from '../lib/coloresGrafico'
import { calcularTendenciaPeso, textoTendencia, isoDesdeDia } from '../lib/tendenciaPeso'

const TICK = { fill: COLOR.texto, fontSize: 12 }
const kg = (v) => `${Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`

export default function GraficoTendenciaPeso({ mediciones }) {
  const t = calcularTendenciaPeso(mediciones)

  if (!t.suficiente) {
    return (
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <h4 className="font-semibold">Tendencia de tu peso</h4>
        <p className="mt-1 text-sm text-suave" role="status">{textoTendencia(t)}</p>
      </div>
    )
  }

  const resumen = `${textoTendencia(t)} Si sigues así, en ${t.diasProyeccion} días estarías cerca de ${kg(t.pesoProyectado)}.`

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <h4 className="font-semibold">Tendencia de tu peso</h4>
      <p className="mb-3 text-sm text-suave">{resumen}</p>

      <div role="img" aria-label={`Gráfico de tendencia del peso. ${resumen}`}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={t.filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
            <XAxis
              dataKey="dia" type="number" scale="linear"
              domain={[t.ticks[0], t.ticks[3]]} ticks={t.ticks}
              tickFormatter={(d) => formatearFechaCorta(isoDesdeDia(d))}
              tick={TICK} stroke={COLOR.rejilla}
            />
            <YAxis
              width={38} tick={TICK} stroke={COLOR.rejilla}
              // El eje NO empieza en 0: si no, una variación de 1-2 kg se vería plana.
              domain={[(min) => Math.floor(min - 1), (max) => Math.ceil(max + 1)]}
            />
            <Tooltip
              contentStyle={{ background: COLOR.fondo, border: `1px solid ${COLOR.rejilla}`, borderRadius: 12 }}
              labelStyle={{ color: COLOR.titulo }}
              labelFormatter={(d) => formatearFecha(isoDesdeDia(d))}
              formatter={(v, nombre) => [kg(v), nombre]}
            />

            {/* Pesos reales: línea fina y puntos */}
            <Line
              dataKey="peso" name="Peso real" type="linear" connectNulls
              stroke={COLOR.peso} strokeOpacity={0.55} strokeWidth={1.5} dot={{ r: 3 }} isAnimationActive={false}
            />
            {/* Tendencia: la recta de mejor ajuste sobre los días medidos */}
            <Line
              dataKey="tendencia" name="Tendencia" type="linear" connectNulls
              stroke={COLOR.linea} strokeWidth={3} dot={false} isAnimationActive={false}
            />
            {/* Proyección: la misma recta, punteada, hacia adelante */}
            <Line
              dataKey="proyeccion" name="Proyección" type="linear" connectNulls
              stroke={COLOR.alerta} strokeWidth={3} strokeDasharray="6 5" dot={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda propia en HTML: en celular la de Recharts se ve apretada y esta es más legible */}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR.peso }} />Peso real
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-1 w-4 rounded" style={{ background: COLOR.linea }} />Tendencia
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-1 w-4 rounded" style={{ background: COLOR.alerta }} />Proyección ({t.diasProyeccion} días)
        </li>
      </ul>
      <p className="mt-2 text-xs text-suave">
        Es una estimación con tus últimas {t.puntos} mediciones de peso; no es una promesa.
      </p>
    </div>
  )
}
