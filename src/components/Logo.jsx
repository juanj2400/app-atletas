// Marca MyProgress: una línea que sube en zigzag (forma de "M") sobre un cuadro azul.
// Los colores vienen de los tokens (fill-primario); el archivo public/favicon.svg es la misma marca.
export function Marca({ tamano = 32, className = '' }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="22" className="fill-primario" />
      <path d="M22 70 L38 38 L50 58 L72 28" fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" className="stroke-white" />
      <circle cx="78" cy="22" r="6" className="fill-white" />
    </svg>
  )
}

// Marca + nombre. `grande` se usa en el login.
export default function Logo({ grande = false }) {
  return (
    <div className="flex items-center gap-3">
      <Marca tamano={grande ? 48 : 32} />
      <span className={`${grande ? 'text-2xl' : 'text-lg'} font-bold tracking-tight`}>MyProgress</span>
    </div>
  )
}
