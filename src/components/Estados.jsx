// Pantallas pequeñas de estado reutilizables.
import { useAuth } from '../auth/AuthProvider'

export function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-suave">
      Cargando...
    </div>
  )
}

// Caso raro: el usuario existe en Auth pero no tiene fila en "profiles"
// (por ejemplo, si se creó antes de instalar el trigger). Lo explicamos.
export function SinPerfil() {
  const { cerrarSesion } = useAuth()
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">No encontramos tu perfil</h1>
      <p className="text-suave">
        Tu usuario existe, pero aún no tiene perfil asignado. Avisa a tu entrenador.
      </p>
      <button
        onClick={cerrarSesion}
        className="min-h-11 rounded-xl border border-borde bg-superficie px-4 font-semibold"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
