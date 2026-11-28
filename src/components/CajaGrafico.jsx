// Marco de una gráfica: da la altura (más alta en pantallas grandes) y la descripción para lectores de pantalla.
// NO importa Recharts (la gráfica va dentro como hijo con <ResponsiveContainer width="100%" height="100%">).
export default function CajaGrafico({ etiqueta, altura = 220, children }) {
  return (
    <div
      role="img"
      aria-label={etiqueta}
      style={{ '--alto': `${altura}px`, '--alto-md': `${Math.round(altura * 1.3)}px` }}
      className="h-(--alto) w-full min-w-0 md:h-(--alto-md)"
    >
      {children}
    </div>
  )
}
