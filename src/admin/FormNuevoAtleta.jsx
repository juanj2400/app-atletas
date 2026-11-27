// =====================================================================
// FormNuevoAtleta — formulario del entrenador para crear la cuenta de un atleta.
// La cuenta se crea en la Edge Function "admin-usuarios" (necesita la clave service_role,
// que nunca está en la app). Se entrega una contraseña TEMPORAL que el entrenador comparte;
// se muestra una sola vez al crear (después no se puede volver a ver, solo cambiar).
// =====================================================================
import { useState } from 'react'
import { useHoy } from '../lib/useHoy'
import { validarFechaNacimiento } from '../lib/cumpleanos'
import { validarNombre, validarEmail, validarContrasena, generarContrasena, textoAcceso } from '../lib/usuarios'
import { llamarAdminUsuarios, copiarTexto } from '../lib/adminUsuarios'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

export default function FormNuevoAtleta({ onCreado, onCerrar }) {
  const hoy = useHoy()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generarContrasena())
  const [fecha, setFecha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [creado, setCreado] = useState(null) // datos del atleta recién creado (para compartir el acceso)
  const [aviso, setAviso] = useState('')

  async function enviar(evento) {
    evento.preventDefault()
    const problema =
      validarNombre(nombre) || validarEmail(email) || validarContrasena(password) || validarFechaNacimiento(fecha, hoy)
    if (problema) return setError(problema)

    setEnviando(true)
    setError('')
    const { error: err } = await llamarAdminUsuarios({
      accion: 'crear',
      email: email.trim(),
      password,
      nombre_completo: nombre.trim(),
      fecha_nacimiento: fecha === '' ? null : fecha,
    })
    setEnviando(false)
    if (err) return setError(err)
    setCreado({ nombre: nombre.trim(), email: email.trim().toLowerCase(), password })
    onCreado() // la lista de atrás se recarga sola
  }

  async function copiar() {
    const ok = await copiarTexto(textoAcceso({ ...creado, url: window.location.origin }))
    setAviso(ok ? 'Copiado. Pégalo en WhatsApp o donde quieras enviarlo.' : 'No se pudo copiar. Anota los datos a mano.')
  }

  // ---- Paso final: atleta creado ----
  if (creado) {
    return (
      <section className={`${TARJETA} mb-4 flex flex-col gap-3`} aria-label="Atleta creado">
        <h2 className="text-lg font-bold">Atleta creado</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-suave">Nombre</dt>
          <dd>{creado.nombre}</dd>
          <dt className="text-suave">Correo</dt>
          <dd className="break-all">{creado.email}</dd>
          <dt className="text-suave">Contraseña</dt>
          <dd className="font-mono">{creado.password}</dd>
        </dl>
        <p className="text-sm text-alerta">
          Cópiala ahora: no se vuelve a mostrar. Si se pierde, puedes poner una contraseña nueva desde Editar.
        </p>
        {aviso && <p role="status" className="text-sm text-suave">{aviso}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copiar} className={BOTON}>Copiar acceso</button>
          <button type="button" onClick={onCerrar} className={BOTON_SEC}>Listo</button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={enviar} className={`${TARJETA} mb-4 flex flex-col gap-3`} aria-label="Crear atleta">
      <h2 className="text-lg font-bold">Crear atleta</h2>

      <label htmlFor="nuevo-nombre" className="text-sm text-suave">Nombre completo</label>
      <input id="nuevo-nombre" type="text" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />

      <label htmlFor="nuevo-email" className="text-sm text-suave">Correo (con el que entrará)</label>
      <input id="nuevo-email" type="email" autoComplete="off" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} />

      <label htmlFor="nuevo-password" className="text-sm text-suave">Contraseña temporal (mínimo 8 caracteres)</label>
      <div className="flex gap-2">
        <input
          id="nuevo-password"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${CAMPO} font-mono`}
        />
        <button type="button" onClick={() => setPassword(generarContrasena())} className={`${BOTON_SEC} shrink-0`}>
          Generar otra
        </button>
      </div>

      <label htmlFor="nuevo-fecha" className="text-sm text-suave">Fecha de nacimiento (opcional)</label>
      <input id="nuevo-fecha" type="date" min="1900-01-01" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />

      {error && <p role="alert" className="text-sm text-alerta">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={BOTON}>
          {enviando ? 'Creando...' : 'Crear atleta'}
        </button>
        <button type="button" disabled={enviando} onClick={onCerrar} className={BOTON_SEC}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
