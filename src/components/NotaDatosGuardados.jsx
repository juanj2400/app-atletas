// =====================================================================
// NotaDatosGuardados — avisa que lo que se ve es la última copia guardada en el teléfono
// (no hay internet). No muestra nada si los datos vienen en vivo (guardadoEn = null).
// =====================================================================
export default function NotaDatosGuardados({ guardadoEn }) {
  if (!guardadoEn) return null
  const cuando = new Date(guardadoEn).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
  return (
    <p role="status" className="text-xs text-suave">
      Sin conexión: estás viendo lo último que se guardó en tu teléfono ({cuando}).
    </p>
  )
}
