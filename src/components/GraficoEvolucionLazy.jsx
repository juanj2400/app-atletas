// =====================================================================
// Carga PEREZOSA del gráfico (code splitting).
//
// Recharts es pesada (~450 KB sin comprimir). Si la importamos normal, va dentro
// del paquete principal y TODOS la descargan al abrir la app, incluso en el
// login, donde no hay ningún gráfico. Con lazy(() => import(...)), Vite la
// separa en un archivo aparte que el navegador pide SOLO cuando una pantalla
// necesita dibujar el gráfico. Mientras llega, <Suspense> muestra el "fallback".
//
// Se usa igual que el gráfico normal: <GraficoEvolucionLazy mediciones={...} />
// =====================================================================
import { lazy, Suspense } from 'react'

const GraficoEvolucion = lazy(() => import('./GraficoEvolucion'))

export default function GraficoEvolucionLazy(props) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-borde bg-superficie p-4 text-suave">
          Cargando gráfico...
        </div>
      }
    >
      <GraficoEvolucion {...props} />
    </Suspense>
  )
}
