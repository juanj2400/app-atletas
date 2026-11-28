// Pantallas pequeñas de estado reutilizables.
import { useAuth } from '../auth/AuthProvider'
import PaginaCentrada from './PaginaCentrada'
import { BOTON_SEC } from '../lib/estilos'

export function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-suave">
      Cargando...
    </div>
  )
}

// El entrenador desactivó el acceso de este atleta (profiles.activo = false).
export function CuentaDesactivada() {
  const { cerrarSesion } = useAuth()
  return (
    <PaginaCentrada separacion="gap-4">
      <h1 className="text-xl font-bold">Tu acceso está desactivado</h1>
      <p className="text-suave">Habla con tu entrenador para volver a entrar.</p>
      <button
        onClick={cerrarSesion}
        className={BOTON_SEC}
      >
        Cerrar sesión
      </button>
    </PaginaCentrada>
  )
}

// Caso raro: el usuario existe en Auth pero no tiene fila en "profiles"
// (por ejemplo, si se creó antes de instalar el trigger). Lo explicamos.
export function SinPerfil() {
  const { cerrarSesion } = useAuth()
  return (
    <PaginaCentrada separacion="gap-4">
      <h1 className="text-xl font-bold">No encontramos tu perfil</h1>
      <p className="text-suave">
        Tu usuario existe, pero aún no tiene perfil asignado. Avisa a tu entrenador.
      </p>
      <button
        onClick={cerrarSesion}
        className={BOTON_SEC}
      >
        Cerrar sesión
      </button>
    </PaginaCentrada>
  )
}
