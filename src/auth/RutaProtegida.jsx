// =====================================================================
// RutaProtegida — el "portero" de cada pantalla.
//
// Uso en App.jsx:
//   <RutaProtegida rol="admin"><PantallaAdmin /></RutaProtegida>
//
// ⚠️ CONCEPTO CLAVE DE SEGURIDAD ⚠️
// Este componente solo mejora la EXPERIENCIA (no mostrar al atleta una
// pantalla que no le sirve). NO es seguridad real: el código de React vive
// en el navegador y cualquiera puede alterarlo. La seguridad de verdad está
// en la base de datos: aunque alguien se saltara este portero, las políticas
// RLS de Supabase le devolverían cero datos ajenos.
// =====================================================================
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Cargando, SinPerfil, CuentaDesactivada } from '../components/Estados'

export default function RutaProtegida({ rol, children }) {
  const { session, perfil, cargando } = useAuth()

  if (cargando) return <Cargando />
  if (!session) return <Navigate to="/login" replace />
  if (!perfil) return <SinPerfil />
  // Atleta con el acceso desactivado por el entrenador (la barrera real es el bloqueo en Auth).
  if (perfil.rol === 'client' && perfil.activo === false) return <CuentaDesactivada />
  // Rol equivocado: lo mandamos a "/", que lo redirige a SU zona.
  if (rol && perfil.rol !== rol) return <Navigate to="/" replace />

  return children
}
