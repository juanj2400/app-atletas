// =====================================================================
// RecuperarContrasena — "¿Olvidaste tu contraseña?": pide el correo y Supabase envía
// un enlace. Ese enlace abre la app en /restablecer (ver RestablecerContrasena).
// =====================================================================
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { CAMPO, BOTON } from '../lib/estilos'
import PaginaCentrada from '../components/PaginaCentrada'

function traducirError(error) {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return 'Se pidieron demasiados correos seguidos. Espera unos minutos e inténtalo de nuevo.'
  }
  return 'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.'
}

export default function RecuperarContrasena() {
  const { recuperarContrasena } = useAuth()
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function manejarEnvio(evento) {
    evento.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await recuperarContrasena(email.trim())
    setEnviando(false)
    if (error) return setError(traducirError(error))
    // Supabase responde igual exista o no el correo (así nadie puede averiguar quién
    // tiene cuenta). Por eso el mensaje también es el mismo en ambos casos.
    setEnviado(true)
  }

  return (
    <PaginaCentrada>
      <div>
        <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
        <p className="mt-2 text-suave">
          Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
        </p>
      </div>

      {enviado ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4">
          <p className="font-semibold text-enlace">Revisa tu correo</p>
          <p className="text-sm text-suave">
            Si ese correo tiene una cuenta, te enviamos un enlace. Puede tardar unos minutos;
            mira también la carpeta de spam. El enlace vence pronto.
          </p>
        </div>
      ) : (
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
            className={CAMPO}
          />

          {error && <p role="alert" className="text-sm text-alerta">{error}</p>}

          <button type="submit" disabled={enviando} className={`${BOTON} mt-2`}>
            {enviando ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      )}

      <Link to="/login" className="inline-flex min-h-11 items-center justify-center text-sm text-enlace">
        ‹ Volver a iniciar sesión
      </Link>
    </PaginaCentrada>
  )
}
