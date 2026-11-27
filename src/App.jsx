// =====================================================================
// App.jsx — el MAPA de la aplicación: qué pantalla se ve en cada URL.
// =====================================================================
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import RutaProtegida from './auth/RutaProtegida'
import Login from './pages/Login'
import RecuperarContrasena from './pages/RecuperarContrasena'
import RestablecerContrasena from './pages/RestablecerContrasena'
import Inicio from './pages/Inicio'
import PantallaAtleta from './atleta/PantallaAtleta'
import CheckIn from './atleta/CheckIn'
import MisDatos from './atleta/MisDatos'
import MisMediciones from './atleta/MisMediciones'
import Records from './atleta/Records'
import Nutricion from './atleta/Nutricion'
import Entrenar from './atleta/Entrenar'
import EntrenarDia from './atleta/EntrenarDia'
import ListaAtletas from './admin/ListaAtletas'
import DetalleAtleta from './admin/DetalleAtleta'
import EditorRutina from './admin/EditorRutina'
import Ejercicios from './admin/Ejercicios'
import GestionUsuarios from './admin/GestionUsuarios'

export default function App() {
  const { recuperando } = useAuth()
  const { pathname } = useLocation()

  // Venimos del enlace de "recuperar contraseña": hasta elegir la contraseña nueva, esta es
  // la única pantalla (si no, la sesión temporal dejaría entrar a la app sin cambiarla).
  if (recuperando && pathname !== '/restablecer') return <Navigate to="/restablecer" replace />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar" element={<RecuperarContrasena />} />
      {/* Necesita sesión (la del enlace del correo), pero sirve para cualquier rol: sin portero. */}
      <Route path="/restablecer" element={<RestablecerContrasena />} />
      <Route path="/" element={<Inicio />} />

      {/* Rutas ANIDADAS: el portero y el marco se declaran una sola vez en el
          padre; las pantallas concretas son hijas y aparecen en el <Outlet />. */}
      <Route
        path="/atleta"
        element={<RutaProtegida rol="client"><PantallaAtleta /></RutaProtegida>}
      >
        {/* index = lo que se ve en "/atleta" exacto */}
        <Route index element={<CheckIn />} />
        <Route path="entrenar" element={<Entrenar />} />
        <Route path="entrenar/:diaId" element={<EntrenarDia />} />
        {/* Nutrición es una sección principal (pestaña de la barra inferior). Al ser hija de
            PantallaAtleta, también pasa por el portero del check-in. */}
        <Route path="nutricion" element={<Nutricion />} />
        {/* "datos" tiene sus propias hijas: Medidas (índice) y Récords */}
        <Route path="datos" element={<MisDatos />}>
          <Route index element={<MisMediciones />} />
          <Route path="records" element={<Records />} />
          {/* Dirección antigua (cuando Nutrición era una sección de Mis datos): enlaces guardados */}
          <Route path="nutricion" element={<Navigate to="/atleta/nutricion" replace />} />
        </Route>
      </Route>

      <Route
        path="/admin"
        element={<RutaProtegida rol="admin"><ListaAtletas /></RutaProtegida>}
      />
      {/* ":id" es un PARÁMETRO: /admin/atletas/abc123 -> useParams() entrega id = 'abc123' */}
      <Route
        path="/admin/atletas/:id"
        element={<RutaProtegida rol="admin"><DetalleAtleta /></RutaProtegida>}
      />
      <Route
        path="/admin/rutinas/:rutinaId"
        element={<RutaProtegida rol="admin"><EditorRutina /></RutaProtegida>}
      />
      <Route
        path="/admin/ejercicios"
        element={<RutaProtegida rol="admin"><Ejercicios /></RutaProtegida>}
      />
      <Route
        path="/admin/usuarios"
        element={<RutaProtegida rol="admin"><GestionUsuarios /></RutaProtegida>}
      />
      {/* Cualquier otra URL: de vuelta al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
