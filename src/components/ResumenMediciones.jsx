// Las 4 tarjetas de resumen. Es un componente "de presentación": no pide datos
// ni guarda estado, solo DIBUJA lo que recibe. Lo usan el admin y el atleta.
import { formatearFechaCorta } from '../lib/fechas'
import { textoEstadoCalorico } from '../lib/opciones'

function Tarjeta({ titulo, valor, detalle }) {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-4">
      <p className="text-sm text-suave">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
      {detalle && <p className="text-sm text-suave">{detalle}</p>}
    </div>
  )
}

export default function ResumenMediciones({ resumen, objetivoKcal = null }) {
  const { pesoActual, delta, cinturaActual, estadoActual, promedioKcal7, diasKcal7 } = resumen
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tarjeta
        titulo="Peso actual"
        valor={pesoActual ? `${pesoActual.peso_corporal_kg} kg` : '—'}
        detalle={
          delta !== null
            ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg vs. anterior`
            : pesoActual && `Medido el ${formatearFechaCorta(pesoActual.fecha)}`
        }
      />
      <Tarjeta
        titulo="Cintura actual"
        valor={cinturaActual ? `${cinturaActual.perimetro_cintura_cm} cm` : '—'}
        detalle={cinturaActual && `Medida el ${formatearFechaCorta(cinturaActual.fecha)}`}
      />
      <Tarjeta
        titulo="Calorías (prom. 7 días)"
        valor={promedioKcal7 === null ? '—' : promedioKcal7.toLocaleString('es-CO')}
        detalle={
          [
            diasKcal7 > 0 && `${diasKcal7} ${diasKcal7 === 1 ? 'día' : 'días'} con registro`,
            objetivoKcal && `objetivo ${objetivoKcal.toLocaleString('es-CO')}`,
          ].filter(Boolean).join(' · ') || null
        }
      />
      <Tarjeta
        titulo="Estado calórico"
        valor={estadoActual ? textoEstadoCalorico(estadoActual) : '—'}
      />
    </div>
  )
}
