// Carga PEREZOSA de la gráfica de tendencia del peso (mismo patrón que
// GraficoEvolucionLazy): Recharts se descarga solo cuando esta pantalla la pide,
// no al abrir el login. Mientras llega, <Suspense> muestra el "fallback".
import { lazy, Suspense } from 'react'

const GraficoTendenciaPeso = lazy(() => import('./GraficoTendenciaPeso'))

export default function GraficoTendenciaPesoLazy(props) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-borde bg-superficie p-4 text-suave">
          Cargando gráfico...
        </div>
      }
    >
      <GraficoTendenciaPeso {...props} />
    </Suspense>
  )
}
