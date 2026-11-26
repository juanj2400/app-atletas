// =====================================================================
// AvisoActualizacion — avisa cuando hay una versión nueva de la app.
//
// Cómo funciona: cada vez que publicas en Netlify, el navegador descarga la versión
// nueva en segundo plano pero la deja "en espera". Este aviso le pregunta al atleta
// cuándo quiere cambiarse (así no pierde lo que esté escribiendo en medio de una serie).
// Requiere `registerType: 'prompt'` en vite.config.js.
// =====================================================================
import { useRegisterSW } from 'virtual:pwa-register/react'
import { BOTON, BOTON_SEC } from '../lib/estilos'

// Una app instalada puede quedar abierta días sin recargarse: por eso se busca
// una versión nueva cada hora y también cada vez que el atleta vuelve a ella.
const CADA_CUANTO_MS = 60 * 60 * 1000

export default function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registro) {
      if (!registro) return
      const buscar = () => {
        // Sin internet no hay nada que buscar (y evitamos errores en consola).
        if (navigator.onLine) registro.update().catch(() => {})
      }
      setInterval(buscar, CADA_CUANTO_MS)
      // Estos "oyentes" viven mientras viva la app, por eso no hay limpieza.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') buscar()
      })
    },
  })

  if (!hayVersionNueva) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl border border-borde bg-superficie p-3 shadow-lg">
        <div>
          <p className="font-semibold">Hay una versión nueva de MyProgress</p>
          <p className="text-sm text-suave">
            Al actualizar, la app se recarga. Termina de guardar lo que estés escribiendo.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => updateServiceWorker(true)} className={`${BOTON} flex-1`}>
            Actualizar
          </button>
          <button type="button" onClick={() => setHayVersionNueva(false)} className={BOTON_SEC}>
            Después
          </button>
        </div>
      </div>
    </div>
  )
}
