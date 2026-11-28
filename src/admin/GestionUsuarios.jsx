// =====================================================================
// GestionUsuarios (/admin/usuarios) — el entrenador crea y edita atletas sin entrar al panel
// de Supabase: crear cuenta, editar nombre y fecha de nacimiento, activar/desactivar el
// acceso y poner una contraseña nueva. Lo sensible (crear cuentas, contraseñas, bloqueo) lo
// hace la Edge Function admin-usuarios; esta pantalla solo la llama.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import { MarcoAdmin } from '../components/MarcoApp'
import FormNuevoAtleta from './FormNuevoAtleta'
import EditarAtleta from './EditarAtleta'
import { BOTON, BOTON_SEC, CONTENIDO_ADMIN } from '../lib/estilos'

export default function GestionUsuarios() {
  const [atletas, setAtletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0) // sube para recargar la lista
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('profiles')
      .select('id, nombre_completo, email, fecha_nacimiento, activo')
      .eq('rol', 'client')
      .order('nombre_completo')
      .then(({ data, error: err }) => {
        if (cancelado) return
        if (err) setError('No se pudo cargar la lista de atletas.')
        else {
          setError('')
          setAtletas(data)
        }
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [version])

  const recargar = () => setVersion((v) => v + 1)
  const inactivos = atletas.filter((a) => a.activo === false).length

  return (
    <MarcoAdmin>
      <Encabezado titulo="Usuarios" volverA="/admin" textoVolver="Atletas" />
      <main className={CONTENIDO_ADMIN}>
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside aria-label="Crear atleta" className="lg:sticky lg:top-4">
            {!creando && (
              <button type="button" onClick={() => setCreando(true)} className={`${BOTON} w-full`}>
                Crear atleta
              </button>
            )}
            {creando && <FormNuevoAtleta onCreado={recargar} onCerrar={() => setCreando(false)} />}
          </aside>

          <section className="flex min-w-0 flex-col gap-3" aria-label="Lista de atletas">
        {cargando && <p className="text-suave">Cargando atletas...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        {!cargando && !error && atletas.length === 0 && (
          <p className="text-suave">Aún no hay atletas. Crea el primero con el botón de arriba.</p>
        )}
        {!cargando && !error && atletas.length > 0 && (
          <p className="text-sm text-suave">
            {atletas.length} atletas{inactivos > 0 ? ` · ${inactivos} con acceso desactivado` : ''}
          </p>
        )}

        <ul className="divide-y divide-borde-suave overflow-hidden rounded-2xl border border-borde bg-superficie">
          {atletas.map((a) => {
            const abierto = editandoId === a.id
            return (
              <li key={a.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.nombre_completo || 'Sin nombre'}</p>
                    <p className="truncate text-sm text-suave">{a.email}</p>
                    {a.activo === false && <p className="text-sm text-alerta">Acceso desactivado</p>}
                  </div>
                  <button
                    type="button"
                    aria-expanded={abierto}
                    onClick={() => setEditandoId(abierto ? null : a.id)}
                    className={`${BOTON_SEC} shrink-0 md:min-h-9`}
                  >
                    {abierto ? 'Cerrar' : 'Editar'}
                  </button>
                </div>
                {abierto && <EditarAtleta atleta={a} onCambio={recargar} onCerrar={() => setEditandoId(null)} />}
              </li>
            )
          })}
        </ul>
          </section>
        </div>
      </main>
    </MarcoAdmin>
  )
}
