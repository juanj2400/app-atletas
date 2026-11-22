// Carga perezosa de las gráficas de récords (mismo patrón que GraficoEvolucionLazy):
// Recharts solo se descarga cuando alguien despliega un ejercicio.
import { lazy, Suspense } from 'react'

const GraficosRecord = lazy(() => import('./GraficosRecord'))

export default function GraficosRecordLazy(props) {
  return (
    <Suspense fallback={<p className="text-sm text-suave">Cargando gráficas...</p>}>
      <GraficosRecord {...props} />
    </Suspense>
  )
}
