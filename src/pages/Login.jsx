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

// Supabase devuelve errores en inglés; los traducimos para el atleta.
function traducirError(error) {
  if (error.message?.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.'
}

export default function Login() {
  const { session, cargando, iniciarSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">MyProgress</h1>
        <p className="mt-2 text-suave">
          Inicia sesión para ver tu plan y registrar tu entrenamiento.
        </p>
      </div>

      <form
        onSubmit={manejarEnvio}
        className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4"
      >
        <label htmlFor="email" className="text-sm text-suave">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-xl border border-[#5B6372] bg-fondo px-3"
        />

        <label htmlFor="password" className="text-sm text-suave">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-xl border border-[#5B6372] bg-fondo px-3"
        />

        <Link to="/recuperar" className="inline-flex min-h-11 items-center self-start text-sm text-enlace">
          ¿Olvidaste tu contraseña?
        </Link>

        {error && <p role="alert" className="text-sm text-alerta">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="mt-2 min-h-11 rounded-xl bg-primario px-4 font-semibold text-white disabled:opacity-60"
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-sm text-suave">
        App privada: solo para atletas invitados.
      </p>
    </main>
  )
}
