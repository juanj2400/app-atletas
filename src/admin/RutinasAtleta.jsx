// =====================================================================
// RutinasAtleta — lista de rutinas de UN atleta + botón para crear una nueva.
// Se muestra dentro del detalle del atleta (zona del entrenador).
// =====================================================================
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { textoEstadoRutina } from '../lib/opciones'
import { CAMPO, BOTON, TARJETA } from '../lib/estilos'

const COLOR_ESTADO = { activa: 'text-enlace', borrador: 'text-alerta', archivada: 'text-suave' }

export default function RutinasAtleta({ atletaId }) {
  const { perfil } = useAuth()
  const navigate = useNavigate() // permite cambiar de pantalla desde el código
  const [rutinas, setRutinas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('routines')
      // routine_days(id) trae los días de cada rutina; solo los contamos.
      .select('id, nombre, estado, routine_days(id)')
      .eq('user_id', atletaId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setError('No se pudieron cargar las rutinas.')
        else setRutinas(data)
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId])

  async function crear(evento) {
    evento.preventDefault()
    if (!nombre.trim()) return setError('Escribe un nombre para la rutina.')
    setError('')
    setCreando(true)
    const { data, error } = await supabase
      .from('routines')
      .insert({ user_id: atletaId, nombre: nombre.trim(), creado_por: perfil.id })
      .select('id')
      .single()
    setCreando(false)
    if (error) return setError('No se pudo crear la rutina.')
    // Al crearla vamos directo al editor para que agregues días y ejercicios.
    navigate(`/admin/rutinas/${data.id}`)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Rutinas</h3>

      <form onSubmit={crear} className={`${TARJETA} flex flex-col gap-3`}>
        <label htmlFor="nueva-rutina" className="text-sm text-suave">Nueva rutina</label>
        <input
          id="nueva-rutina" value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Fuerza - semanas 1 a 4" className={CAMPO}
        />
        <button type="submit" disabled={creando} className={BOTON}>
          {creando ? 'Creando...' : 'Crear rutina'}
        </button>
      </form>

      {error && <p role="alert" className="text-alerta">{error}</p>}
      {cargando && <p className="text-suave">Cargando rutinas...</p>}
      {!cargando && rutinas.length === 0 && (
        <p className="text-suave">Este atleta aún no tiene rutinas.</p>
      )}

      <ul className="flex flex-col gap-3">
        {rutinas.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/rutinas/${r.id}`} className={`${TARJETA} flex items-center justify-between`}>
              <div>
                <p className="font-semibold">{r.nombre}</p>
                <p className="text-sm text-suave">
                  <span className={COLOR_ESTADO[r.estado]}>{textoEstadoRutina(r.estado)}</span>
                  {' · '}{r.routine_days.length} {r.routine_days.length === 1 ? 'día' : 'días'}
                </p>
              </div>
              <span className="text-xl text-enlace" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
