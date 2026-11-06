// Ruta "/": no muestra nada propio, solo REDIRIGE según el rol.
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Cargando, SinPerfil } from '../components/Estados'

export default function Inicio() {
  const { session, perfil, cargando } = useAuth()

  if (cargando) return <Cargando />
  if (!session) return <Navigate to="/login" replace />
  if (!perfil) return <SinPerfil />

  return <Navigate to={perfil.rol === 'admin' ? '/admin' : '/atleta'} replace />
}
