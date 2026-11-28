// =====================================================================
// GraficoEvolucion — peso (línea) y calorías (barras) a lo largo del tiempo.
//
// ¿Por qué Recharts? Dibuja gráficos con COMPONENTES de React (<Line>, <Bar>),
// así que se programa igual que el resto de la app: declaras qué quieres ver y
// la librería lo dibuja. Alternativas: Chart.js (más imperativo, pide manipular
// un <canvas>) o D3 (muy potente pero de bajo nivel y curva de aprendizaje alta).
//
// Es un componente REUTILIZABLE: recibe las mediciones por props y no sabe si
// lo ve el admin o el atleta. Qué datos le llegan lo decide Supabase (RLS).
// =====================================================================
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatearFecha, formatearFechaCorta } from '../lib/fechas'
import { COLOR } from '../lib/coloresGrafico'
import { kcalObjetivoEnFecha } from '../lib/nutricion'

const TICK = { fill: COLOR.texto, fontSize: 12 }

export default function GraficoEvolucion({ mediciones, planes = [] }) {
  // 1) Preparar los datos. Supabase las entrega de la más reciente a la más
  //    antigua; un gráfico necesita el orden contrario (izquierda = pasado).
  //    [...mediciones] hace una COPIA antes de ordenar, porque .sort() modifica
  //    el arreglo original y en React nunca se modifican los datos recibidos.
  const datos = [...mediciones]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({
      fecha: m.fecha,
      peso: m.peso_corporal_kg === null ? null : Number(m.peso_corporal_kg),
      kcal: m.calorias_consumidas,
      // Objetivo de calorías que regía ese día (null si no había plan)
      objetivo: kcalObjetivoEnFecha(planes, m.fecha),
    }))

  const hayPeso = datos.some((d) => d.peso !== null)
  const hayKcal = datos.some((d) => d.kcal !== null)
  const hayObjetivo = datos.some((d) => d.objetivo !== null)
  const usaKcal = hayKcal || hayObjetivo // el eje de calorías también sirve para la línea de objetivo

  // Con menos de 2 puntos no hay "evolución" que mostrar.
  if (datos.length < 2) {
    return (
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <h4 className="font-semibold">Evolución</h4>
        <p className="mt-1 text-sm text-suave">
          Se necesitan al menos 2 mediciones para dibujar la evolución.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <h4 className="font-semibold">Evolución</h4>
      <p className="mb-3 text-sm text-suave">Peso (línea) y calorías (barras) por fecha de medición.{hayObjetivo && ' La línea punteada es el objetivo de calorías.'}</p>

      {/* ResponsiveContainer ocupa el ANCHO del padre y se adapta al celular.
          Necesita una altura fija. */}
      <div role="img" aria-label="Gráfico de evolución del peso y las calorías">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={datos} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={formatearFechaCorta} tick={TICK} stroke={COLOR.rejilla} />

            {/* DOS ejes verticales porque kg y kcal tienen escalas muy distintas
                (80 frente a 2.600). Cada serie se asocia a su eje con yAxisId. */}
            {hayPeso && (
              <YAxis
                yAxisId="peso" width={38} tick={TICK} stroke={COLOR.rejilla}
                // El eje del peso NO empieza en 0 (si no, la línea se vería plana).
                domain={[(min) => Math.floor(min - 1), (max) => Math.ceil(max + 1)]}
              />
            )}
            {usaKcal && (
              <YAxis
                yAxisId="kcal" orientation="right" width={46} tick={TICK} stroke={COLOR.rejilla}
                tickFormatter={(v) => v.toLocaleString('es-CO')}
              />
            )}

            <Tooltip
              contentStyle={{ background: COLOR.fondo, border: `1px solid ${COLOR.rejilla}`, borderRadius: 12 }}
              labelStyle={{ color: COLOR.titulo }}
              labelFormatter={formatearFecha}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            {hayKcal && (
              <Bar yAxisId="kcal" dataKey="kcal" name="Calorías" fill={COLOR.kcal} fillOpacity={0.6} radius={[4, 4, 0, 0]} />
            )}
            {hayPeso && (
              // connectNulls: si un día solo se midieron calorías (peso = null),
              // la línea del peso une los puntos vecinos en vez de cortarse.
              <Line
                yAxisId="peso" dataKey="peso" name="Peso (kg)" type="monotone"
                stroke={COLOR.peso} strokeWidth={2} dot={{ r: 3 }} connectNulls
              />
            )}
            {hayObjetivo && (
              // stepAfter: el objetivo cambia de golpe en la fecha en que el entrenador define un plan nuevo.
              <Line
                yAxisId="kcal" dataKey="objetivo" name="Objetivo (kcal)" type="stepAfter"
                stroke={COLOR.alerta} strokeWidth={2} strokeDasharray="5 4" dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
