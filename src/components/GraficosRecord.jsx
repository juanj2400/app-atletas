// =====================================================================
// GraficosRecord — las dos gráficas de UN ejercicio:
//   1) Evolución del 1RM estimado a lo largo del tiempo (línea) — solo si el ejercicio
//      aplica a 1RM (con1RM); los aislados no la muestran.
//   2) Repeticiones máximas logradas con cada peso (barras).
// Recibe los datos ya preparados por props; no consulta nada.
// =====================================================================
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { COLOR } from '../lib/coloresGrafico'
import { formatearFecha, formatearFechaCorta } from '../lib/fechas'
import { fechaCortaDeTimestamp, textoKg } from '../lib/records'

const TICK = { fill: COLOR.texto, fontSize: 12 }
const CAJA = {
  background: COLOR.fondo, border: `1px solid ${COLOR.rejilla}`, borderRadius: 12,
  padding: '8px 12px', color: COLOR.titulo, fontSize: 13,
}

// Caja que aparece al tocar un punto de la línea
function TooltipProgreso({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={CAJA}>
      <p style={{ fontWeight: 600 }}>{formatearFecha(p.fecha)}</p>
      <p>1RM estimado: {textoKg(p.e1rm)} kg</p>
      <p style={{ color: COLOR.texto }}>Mejor serie: {textoKg(p.peso)} kg × {p.reps}</p>
    </div>
  )
}

// Caja que aparece al tocar una barra
function TooltipBarras({ active, payload }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div style={CAJA}>
      <p style={{ fontWeight: 600 }}>{textoKg(b.peso)} kg → {b.reps} {b.reps === 1 ? 'repetición' : 'repeticiones'}</p>
      <p style={{ color: COLOR.texto }}>
        {b.rpe !== null && `RPE ${b.rpe} · `}{fechaCortaDeTimestamp(b.fecha)}
      </p>
    </div>
  )
}

export default function GraficosRecord({ progreso, marcas, con1RM = true }) {
  // Las marcas llegan del peso mayor al menor; en el gráfico se leen de menor a mayor.
  const barras = [...marcas]
    .sort((a, b) => Number(a.peso_kg) - Number(b.peso_kg))
    .map((m) => ({ peso: Number(m.peso_kg), reps: m.reps_max, rpe: m.rpe, fecha: m.fecha_mejor }))
  const record = progreso.length ? Math.max(...progreso.map((p) => p.e1rm)) : null

  return (
    <div className="flex flex-col gap-4">
      {con1RM && (
      <div>
        <p className="mb-1 text-sm font-semibold">Evolución del 1RM estimado</p>
        {progreso.length < 2 ? (
          <p className="text-sm text-suave">
            Registra al menos 2 entrenamientos de este ejercicio para ver su evolución.
          </p>
        ) : (
          <>
            <div role="img" aria-label="Gráfico de la evolución del 1RM estimado">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={progreso} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
                  <XAxis dataKey="fecha" tickFormatter={formatearFechaCorta} tick={TICK} stroke={COLOR.rejilla} />
                  {/* El eje NO empieza en 0: si no, una mejora de 5 kg se vería como una línea plana. */}
                  <YAxis
                    width={40} tick={TICK} stroke={COLOR.rejilla}
                    domain={[(min) => Math.floor(min - 2), (max) => Math.ceil(max + 2)]}
                  />
                  <Tooltip content={<TooltipProgreso />} />
                  <ReferenceLine y={record} stroke={COLOR.alerta} strokeDasharray="4 4" />
                  <Line dataKey="e1rm" type="monotone" stroke={COLOR.linea} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-suave">La línea punteada marca tu mejor 1RM estimado.</p>
          </>
        )}
      </div>
      )}

      <div>
        <p className="mb-1 text-sm font-semibold">Repeticiones máximas con cada peso</p>
        {barras.length === 0 ? (
          <p className="text-sm text-suave">Aún no hay series con peso en este ejercicio.</p>
        ) : (
          <div role="img" aria-label="Gráfico de repeticiones máximas por peso">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barras} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLOR.rejilla} vertical={false} />
                <XAxis dataKey="peso" tickFormatter={(v) => `${textoKg(v)} kg`} tick={TICK} stroke={COLOR.rejilla} />
                <YAxis width={32} allowDecimals={false} tick={TICK} stroke={COLOR.rejilla} />
                <Tooltip content={<TooltipBarras />} cursor={{ fill: COLOR.rejilla, opacity: 0.4 }} />
                <Bar dataKey="reps" fill={COLOR.kcal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
