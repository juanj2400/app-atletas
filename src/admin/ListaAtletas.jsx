// =====================================================================
// Lista de atletas (admin). Novedad: cada atleta es ahora un ENLACE a su
// pantalla de detalle. El id del atleta viaja en la URL: /admin/atletas/<id>
// =====================================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import { MarcoAdmin } from '../components/MarcoApp'
import CumpleanosAtletas from './CumpleanosAtletas'
import { useHoy } from '../lib/useHoy'

export default function ListaAtletas() {
  const hoy = useHoy() // fecha local; se actualiza sola a medianoche (para los cumpleaños)
  const [atletas, setAtletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, nombre_completo, email, fecha_nacimiento, activo')
      .eq('rol', 'client')
      .order('nombre_completo')
      .then(({ data, error }) => {
        if (error) setError('No se pudo cargar la lista de atletas.')
        else setAtletas(data)
        setCargando(false)
      })
  }, [])

  const activos = atletas.filter((a) => a.activo !== false)

  return (
    <MarcoAdmin>
      <Encabezado titulo="Atletas" />
      <main className={CONTENIDO_ADMIN}>
        {/* En escritorio estos accesos están en la barra lateral. */}
        <div className="mb-4 flex flex-col gap-2 md:hidden">
          <Link to="/admin/usuarios" className="flex min-h-11 items-center justify-center rounded-xl border border-borde bg-superficie px-4 text-sm font-semibold">
            Usuarios: crear y editar atletas
          </Link>
          <Link to="/admin/ejercicios" className="flex min-h-11 items-center justify-center rounded-xl border border-borde bg-superficie px-4 text-sm font-semibold">
            Biblioteca de ejercicios y músculos
          </Link>
          <Link to="/admin/alimentos" className="flex min-h-11 items-center justify-center rounded-xl border border-borde bg-superficie px-4 text-sm font-semibold">
            Catálogo de alimentos (crudo y cocido)
          </Link>
        </div>
        {/* Los cumpleaños solo cuentan atletas con acceso activo. */}
        {!cargando && !error && activos.length > 0 && <CumpleanosAtletas atletas={activos} hoy={hoy} />}
        {cargando && <p className="text-suave">Cargando atletas...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        {!cargando && !error && atletas.length === 0 && (
          <p className="text-suave">Aún no hay atletas registrados.</p>
        )}
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {atletas.map((a) => (
            <li key={a.id}>
              {/* Las comillas invertidas (`...`) permiten insertar variables con ${...}.
                  Resultado: /admin/atletas/3f2a-... */}
              <Link
                to={`/admin/atletas/${a.id}`}
                className="flex items-center justify-between rounded-2xl border border-borde bg-superficie p-4"
              >
                <div>
                  <p className="font-semibold">{a.nombre_completo || 'Sin nombre'}</p>
                  <p className="text-sm text-suave">{a.email}</p>
                  {a.activo === false && <p className="text-sm text-alerta">Acceso desactivado</p>}
                </div>
                <span className="text-xl text-enlace" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarcoAdmin>
  )
}
