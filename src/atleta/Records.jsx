// Sección "Récords" dentro de Mis datos: mejores marcas por ejercicio, con gráficas (solo lectura).
import { useAuth } from '../auth/AuthProvider'
import RecordsAtleta from '../components/RecordsAtleta'

export default function Records() {
  const { perfil } = useAuth()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave">
        Tus mejores marcas por ejercicio y cuántas repeticiones has logrado con cada peso.
      </p>
      <RecordsAtleta userId={perfil.id} />
    </div>
  )
}
