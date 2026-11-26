// Carga PEREZOSA de la gráfica de oscilación del peso (mismo patrón que GraficoEvolucionLazy):
// Recharts solo se descarga cuando una pantalla la necesita.
import { lazy, Suspense } from 'react'

const GraficoOscilacionPeso = lazy(() => import('./GraficoOscilacionPeso'))

export default function GraficoOscilacionPesoLazy(props) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-borde bg-superficie p-4 text-suave">
          Cargando gráfico...
        </div>
      }
    >
      <GraficoOscilacionPeso {...props} />
    </Suspense>
  )
}
