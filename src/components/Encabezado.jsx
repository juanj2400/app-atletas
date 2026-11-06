import { useAuth } from '../auth/AuthProvider'

export default function Encabezado({ titulo }) {
  const { perfil, cerrarSesion } = useAuth()
  return (
    <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
      <div>
        <h1 className="text-lg font-bold">{titulo}</h1>
        <p className="text-sm text-suave">{perfil?.nombre_completo || perfil?.email}</p>
      </div>
      <button
        onClick={cerrarSesion}
        className="min-h-11 rounded-xl border border-borde bg-superficie px-4 text-sm font-semibold"
      >
        Salir
      </button>
    </header>
  )
}
