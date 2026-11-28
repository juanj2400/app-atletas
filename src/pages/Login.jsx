// =====================================================================
// Login — formulario de correo y contraseña.
//
// Patrón de React llamado "componente controlado": el valor de cada campo
// vive en un estado (useState) y se actualiza en cada tecla (onChange).
// Así React siempre "sabe" qué hay escrito.
// =====================================================================
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import PaginaCentrada from '../components/PaginaCentrada'
import { BOTON, CAMPO, TARJETA } from '../lib/estilos'

// Supabase devuelve errores en inglés; los traducimos para el atleta.
function traducirError(error) {
  if (error.message?.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  // El entrenador desactivó el acceso (Auth bloquea el inicio de sesión).
  if (error.code === 'user_banned' || error.message?.includes('banned')) {
    return 'Tu acceso está desactivado. Habla con tu entrenador.'
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export default function Login() {
  const { session, cargando, iniciarSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Solo presentación: mostrar u ocultar lo que se escribe en la contraseña.
  const [verPassword, setVerPassword] = useState(false)

  // Si ya hay sesión, no tiene sentido ver el login: vamos a "/".
  if (!cargando && session) return <Navigate to="/" replace />

  async function manejarEnvio(evento) {
    evento.preventDefault() // evita que el navegador recargue la página
    setError('')
    setEnviando(true)
    const { error } = await iniciarSesion(email.trim(), password)
    if (error) setError(traducirError(error))
    // Si todo sale bien NO hacemos nada más: AuthProvider detecta la nueva
    // sesión, este componente se vuelve a dibujar y el <Navigate> de arriba
    // nos lleva a la pantalla correcta según el rol.
    setEnviando(false)
  }

  return (
    <PaginaCentrada>
      <div className="text-center">
        <h1 className="text-xl font-bold">Inicia sesión</h1>
        <p className="mt-1 text-sm text-suave">
          Ve tu plan y registra tu entrenamiento.
        </p>
      </div>

      <form onSubmit={manejarEnvio} className={`${TARJETA} flex flex-col gap-3 p-5 shadow-lg shadow-black/20`}>
        <label htmlFor="email" className="text-sm font-medium text-suave">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={CAMPO}
        />

        <label htmlFor="password" className="text-sm font-medium text-suave">Contraseña</label>
        <div className="relative">
          <input
            id="password"
            type={verPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${CAMPO} pr-24`}
          />
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            aria-pressed={verPassword}
            className="absolute inset-y-0 right-1 my-1 rounded-lg px-3 text-sm font-semibold text-enlace transition-colors hover:bg-elevada"
          >
            {verPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <Link to="/recuperar" className="inline-flex min-h-11 items-center self-start text-sm text-enlace hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>

        {error && <p role="alert" className="rounded-xl border border-alerta/40 bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}

        <button type="submit" disabled={enviando} className={`${BOTON} mt-1`}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-sm text-suave">
        App privada: solo para atletas invitados.
      </p>
    </PaginaCentrada>
  )
}
