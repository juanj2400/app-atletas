// =====================================================================
// Lista de atletas (admin). Novedad: cada atleta es ahora un ENLACE a su
// pantalla de detalle. El id del atleta viaja en la URL: /admin/atletas/<id>
// =====================================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'

export default function ListaAtletas() {
  const [atletas, setAtletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, nombre_completo, email')
      .eq('rol', 'client')
      .order('nombre_completo')
      .then(({ data, error }) => {
        if (error) setError('No se pudo cargar la lista de atletas.')
        else setAtletas(data)
        setCargando(false)
      })
  }, [])

  return (
    <>
      <Encabezado titulo="Atletas" />
      <main className="mx-auto max-w-3xl p-4">
        {cargando && <p className="text-suave">Cargando atletas...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        {!cargando && !error && atletas.length === 0 && (
          <p className="text-suave">Aún no hay atletas registrados.</p>
        )}
        <ul className="flex flex-col gap-3">
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
                </div>
                <span className="text-xl text-enlace" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
