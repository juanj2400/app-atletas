// =====================================================================
// AvisoDescarga — tarjeta que avisa al atleta que está en semana de descarga.
// No decide nada: solo muestra el estado que ya calculó la pantalla.
// =====================================================================
import { TARJETA } from '../lib/estilos'
import { textoVentanaDescarga } from '../lib/descarga'

export default function AvisoDescarga({ descarga, hoy }) {
  if (!descarga) return null
  return (
    <div role="status" className={`${TARJETA} border-alerta`}>
      <p className="font-bold text-alerta">Semana de descarga</p>
      <p className="text-sm text-suave">{textoVentanaDescarga(descarga, hoy)}</p>
      <p className="mt-1 text-sm">
        Esta semana haces menos series y con menos carga para recuperar mejor. Al terminar vuelves
        a tu rutina y progresión de siempre.
      </p>
    </div>
  )
}
