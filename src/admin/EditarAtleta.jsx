// =====================================================================
// EditarAtleta — panel del entrenador para editar a UN atleta (se abre dentro de la lista).
//   · Datos: nombre y fecha de nacimiento  -> RPC set_perfil_atleta (migración 20, solo admin).
//   · Acceso: activar / desactivar         -> Edge Function admin-usuarios (bloquea el login).
//   · Contraseña: poner una nueva          -> Edge Function admin-usuarios.
// El rol NO se cambia aquí a propósito (el único admin se asigna a mano en el SQL Editor).
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHoy } from '../lib/useHoy'
import { validarFechaNacimiento } from '../lib/cumpleanos'
import { validarNombre, validarContrasena, generarContrasena, textoAcceso } from '../lib/usuarios'
import { llamarAdminUsuarios, copiarTexto } from '../lib/adminUsuarios'
import { CAMPO, BOTON, BOTON_SEC } from '../lib/estilos'

function Mensajes({ error, aviso }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
      {aviso && <p role="status" className="text-sm text-suave">{aviso}</p>}
    </>
  )
}

function SeccionDatos({ atleta, onCambio }) {
  const hoy = useHoy()
  const [nombre, setNombre] = useState(atleta.nombre_completo ?? '')
  const [fecha, setFecha] = useState(atleta.fecha_nacimiento ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function guardar() {
    setAviso('')
    const problema = validarNombre(nombre) || validarFechaNacimiento(fecha, hoy)
    if (problema) return setError(problema)
    setGuardando(true)
    setError('')
    const { error: err } = await supabase.rpc('set_perfil_atleta', {
      p_atleta: atleta.id,
      p_nombre: nombre.trim(),
      p_fecha: fecha === '' ? null : fecha,
    })
    setGuardando(false)
    // P0001 = mensaje ya redactado en español por la función; lo demás, texto genérico.
    if (err) return setError(err.code === 'P0001' ? err.message : 'No se pudieron guardar los datos. Intenta de nuevo.')
    setAviso('Datos guardados.')
    onCambio()
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Datos del atleta">
      <h3 className="font-bold">Datos</h3>
      <label htmlFor={`nombre-${atleta.id}`} className="text-sm text-suave">Nombre completo</label>
      <input id={`nombre-${atleta.id}`} type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
      <label htmlFor={`fecha-${atleta.id}`} className="text-sm text-suave">Fecha de nacimiento (opcional)</label>
      <input id={`fecha-${atleta.id}`} type="date" min="1900-01-01" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
      <p className="text-sm text-suave">Correo: {atleta.email} (no se cambia desde la app).</p>
      <Mensajes error={error} aviso={aviso} />
      <button type="button" disabled={guardando} onClick={guardar} className={`${BOTON} self-start`}>
        {guardando ? 'Guardando...' : 'Guardar datos'}
      </button>
    </section>
  )
}

function SeccionAcceso({ atleta, onCambio }) {
  const activo = atleta.activo !== false
  const [confirmando, setConfirmando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  async function cambiar(nuevoEstado) {
    setTrabajando(true)
    setError('')
    const { error: err } = await llamarAdminUsuarios({ accion: 'estado', atleta_id: atleta.id, activo: nuevoEstado })
    setTrabajando(false)
    if (err) return setError(err)
    setConfirmando(false)
    onCambio()
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Acceso a la app">
      <h3 className="font-bold">Acceso a la app</h3>
      <p className="text-sm text-suave">
        Estado: <span className={activo ? 'text-texto' : 'text-alerta'}>{activo ? 'Activo' : 'Desactivado'}</span>
        {!activo && ' · no puede entrar; sus datos se conservan.'}
      </p>
      <Mensajes error={error} />
      {!activo && (
        <button type="button" disabled={trabajando} onClick={() => cambiar(true)} className={`${BOTON} self-start`}>
          {trabajando ? 'Reactivando...' : 'Reactivar acceso'}
        </button>
      )}
      {activo && !confirmando && (
        <button type="button" onClick={() => setConfirmando(true)} className={`${BOTON_SEC} self-start text-alerta`}>
          Desactivar acceso
        </button>
      )}
      {activo && confirmando && (
        <div className="flex flex-col gap-2 rounded-xl border border-borde bg-hundido p-3">
          <p className="text-sm">
            ¿Desactivar el acceso de {atleta.nombre_completo || 'este atleta'}? No podrá entrar hasta que lo reactives. No se borra nada.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={trabajando} onClick={() => cambiar(false)} className={BOTON}>
              {trabajando ? 'Desactivando...' : 'Sí, desactivar'}
            </button>
            <button type="button" disabled={trabajando} onClick={() => setConfirmando(false)} className={BOTON_SEC}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function SeccionContrasena({ atleta }) {
  const [password, setPassword] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [cambiada, setCambiada] = useState(false) // true tras guardar: habilita "Copiar acceso"
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  function escribir(valor) {
    setPassword(valor)
    setCambiada(false)
    setAviso('')
  }

  async function guardar() {
    setAviso('')
    const problema = validarContrasena(password)
    if (problema) return setError(problema)
    setTrabajando(true)
    setError('')
    const { error: err } = await llamarAdminUsuarios({ accion: 'contrasena', atleta_id: atleta.id, password })
    setTrabajando(false)
    if (err) return setError(err)
    setCambiada(true)
    setAviso('Contraseña cambiada. Compártela con el atleta.')
  }

  async function copiar() {
    const ok = await copiarTexto(textoAcceso({ nombre: atleta.nombre_completo, email: atleta.email, password, url: window.location.origin }))
    setAviso(ok ? 'Copiado.' : 'No se pudo copiar. Anótala a mano.')
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Contraseña">
      <h3 className="font-bold">Contraseña</h3>
      <label htmlFor={`password-${atleta.id}`} className="text-sm text-suave">Contraseña nueva (mínimo 8 caracteres)</label>
      <div className="flex gap-2">
        <input
          id={`password-${atleta.id}`}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={password}
          onChange={(e) => escribir(e.target.value)}
          className={`${CAMPO} font-mono`}
        />
        <button type="button" onClick={() => escribir(generarContrasena())} className={`${BOTON_SEC} shrink-0`}>
          Generar
        </button>
      </div>
      <Mensajes error={error} aviso={aviso} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={trabajando || password === ''} onClick={guardar} className={BOTON}>
          {trabajando ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
        {cambiada && (
          <button type="button" onClick={copiar} className={BOTON_SEC}>Copiar acceso</button>
        )}
      </div>
    </section>
  )
}

export default function EditarAtleta({ atleta, onCambio, onCerrar }) {
  return (
    <div className="mt-3 flex flex-col gap-5 border-t border-borde pt-4">
      <SeccionDatos atleta={atleta} onCambio={onCambio} />
      <SeccionAcceso atleta={atleta} onCambio={onCambio} />
      <SeccionContrasena atleta={atleta} />
      <button type="button" onClick={onCerrar} className={`${BOTON_SEC} self-start`}>Cerrar</button>
    </div>
  )
}
