// =====================================================================
// IndicadorConexion — franja discreta con el estado de la conexión y los registros que esperan
// subir. Va arriba de la zona del atleta (PantallaAtleta). Sin conexión y sin pendientes sale una
// línea corta; con internet y sin pendientes no sale nada.
//
// AvisoSoloConConexion — para el ENTRENADOR: sus acciones (guardar rutinas, usuarios, IA...)
// necesitan internet. Se avisa arriba, sin tocar el resto de la pantalla.
// =====================================================================
import { useConexion } from '../lib/useConexion'
import { useCola } from '../lib/useCola'
import { descartarConError } from '../lib/colaOffline'

const FRANJA = 'mb-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs'

export default function IndicadorConexion({ userId }) {
  const conectado = useConexion()
  const { pendientes, errores, primerError, sincronizando } = useCola(userId)

  if (errores > 0) {
    return (
      <div role="alert" className={`${FRANJA} border-alerta text-alerta`}>
        <span>
          {errores === 1 ? '1 registro no se pudo subir' : `${errores} registros no se pudieron subir`}
          {primerError ? `: ${primerError}` : '.'}
        </span>
        <button type="button" onClick={() => descartarConError(userId)} className="min-h-11 shrink-0 px-2 font-semibold underline">
          Descartar
        </button>
      </div>
    )
  }

  if (!conectado) {
    return (
      <p role="status" className={`${FRANJA} border-borde bg-superficie text-suave`}>
        <span>
          Sin conexión.{' '}
          {pendientes > 0
            ? `${pendientes} ${pendientes === 1 ? 'registro' : 'registros'} por subir.`
            : 'Lo que anotes se guardará en tu teléfono.'}
        </span>
      </p>
    )
  }

  if (pendientes > 0) {
    return (
      <p role="status" className={`${FRANJA} border-borde bg-superficie text-suave`}>
        <span>
          {sincronizando ? 'Subiendo' : 'Por subir:'} {pendientes} {pendientes === 1 ? 'registro' : 'registros'}
          {sincronizando ? '...' : '.'}
        </span>
      </p>
    )
  }

  return null
}

export function AvisoSoloConConexion() {
  const conectado = useConexion()
  if (conectado) return null
  return (
    <p role="status" className="border-b border-alerta bg-superficie px-4 py-2 text-sm text-alerta">
      Sin conexión. Las acciones del entrenador (guardar, crear, cambiar planes) necesitan internet: vuelve a
      intentarlo cuando tengas señal.
    </p>
  )
}
