// =====================================================================
// Zona del admin. Ya hace una consulta REAL para demostrar RLS:
// pedimos todos los perfiles con rol 'client'. Como TÚ eres admin, la
// política "profiles_select" de la base de datos te los entrega todos.
// Si un atleta ejecutara exactamente la misma consulta, recibiría solo su
// propia fila: el filtrado lo hace la base de datos, no React.
// =====================================================================
import { useEffect, useState } from 'react'
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
  }, []) // [] = ejecutar solo una vez, cuando la pantalla aparece

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
            <li key={a.id} className="rounded-2xl border border-borde bg-superficie p-4">
              <p className="font-semibold">{a.nombre_completo || 'Sin nombre'}</p>
              <p className="text-sm text-suave">{a.email}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
