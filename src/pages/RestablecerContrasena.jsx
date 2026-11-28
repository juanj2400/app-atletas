// =====================================================================
// RestablecerContrasena — aquí aterriza el enlace del correo de recuperación.
//
// Al abrir ese enlace, Supabase inicia una sesión temporal (AuthProvider la detecta
// sola). Con esa sesión basta con escribir la contraseña nueva. La misma pantalla sirve
// para cambiar la contraseña estando dentro (/restablecer).
// =====================================================================
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Cargando } from '../components/Estados'
import { CAMPO, BOTON } from '../lib/estilos'
import PaginaCentrada from '../components/PaginaCentrada'

// Es la comodidad del navegador: el mínimo real lo fija Supabase en
// Authentication > Sign In / Providers > Email ("Minimum password length").
const MINIMO = 8

function traducirError(error) {
  if (error.code === 'same_password') return 'La contraseña nueva debe ser distinta de la actual.'
  if (error.code === 'weak_password') {
    return 'Esa contraseña es muy fácil de adivinar. Prueba con una más larga o con otros caracteres.'
  }
  if (error.code === 'session_not_found' || error.status === 401) {
    return 'El enlace venció. Pide uno nuevo desde "¿Olvidaste tu contraseña?".'
  }
  return 'No se pudo cambiar la contraseña. Inténtalo de nuevo.'
}

export default function RestablecerContrasena() {
  const { session, cargando, cambiarContrasena } = useAuth()
  const navigate = useNavigate()
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)

  if (cargando) return <Cargando />

  // Sin sesión: el enlace ya se usó, venció o se abrió sin pasar por el correo.
  if (!session) {
    return (
      <PaginaCentrada separacion="gap-4">
        <h1 className="text-2xl font-bold">Enlace no válido</h1>
        <p role="alert" className="text-suave">
          Este enlace ya se usó o venció. Pide uno nuevo para crear tu contraseña.
        </p>
        <Link to="/recuperar" className={`${BOTON} inline-flex items-center justify-center`}>
          Pedir un enlace nuevo
        </Link>
        <Link to="/login" className="inline-flex min-h-11 items-center justify-center text-sm text-enlace">
          ‹ Volver a iniciar sesión
        </Link>
      </PaginaCentrada>
    )
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    if (nueva.length < MINIMO) return setError(`La contraseña debe tener al menos ${MINIMO} caracteres.`)
    if (nueva !== repetida) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    const { error } = await cambiarContrasena(nueva)
    setGuardando(false)
    if (error) return setError(traducirError(error))
    setListo(true)
  }

  if (listo) {
    return (
      <PaginaCentrada separacion="gap-4">
        <h1 className="text-2xl font-bold">Contraseña actualizada</h1>
        <p role="status" className="text-enlace">Ya puedes usar tu contraseña nueva.</p>
        {/* "/" redirige a la zona que corresponde según el rol. */}
        <button type="button" onClick={() => navigate('/', { replace: true })} className={BOTON}>
          Continuar
        </button>
      </PaginaCentrada>
    )
  }

  return (
    <PaginaCentrada>
      <div>
        <h1 className="text-2xl font-bold">Contraseña nueva</h1>
        <p className="mt-2 text-suave">Elige una contraseña de al menos {MINIMO} caracteres.</p>
      </div>

      <form
        onSubmit={guardar}
        className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4"
      >
        <label htmlFor="nueva" className="text-sm text-suave">Contraseña nueva</label>
        <input
          id="nueva"
          type="password"
          autoComplete="new-password"
          required
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className={CAMPO}
        />

        <label htmlFor="repetida" className="text-sm text-suave">Repite la contraseña</label>
        <input
          id="repetida"
          type="password"
          autoComplete="new-password"
          required
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          className={CAMPO}
        />

        {error && <p role="alert" className="text-sm text-alerta">{error}</p>}

        <button type="submit" disabled={guardando} className={`${BOTON} mt-2`}>
          {guardando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </PaginaCentrada>
  )
}
