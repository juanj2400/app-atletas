// =====================================================================
// App.jsx — el MAPA de la aplicación: qué pantalla se ve en cada URL.
// =====================================================================
import { Routes, Route, Navigate } from 'react-router-dom'
import RutaProtegida from './auth/RutaProtegida'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import PantallaAtleta from './atleta/PantallaAtleta'
import CheckIn from './atleta/CheckIn'
import MisDatos from './atleta/MisDatos'
import ListaAtletas from './admin/ListaAtletas'
import DetalleAtleta from './admin/DetalleAtleta'
import EditorRutina from './admin/EditorRutina'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Inicio />} />

      {/* Rutas ANIDADAS: el portero y el marco se declaran una sola vez en el
          padre; las pantallas concretas son hijas y aparecen en el <Outlet />. */}
      <Route
        path="/atleta"
        element={<RutaProtegida rol="client"><PantallaAtleta /></RutaProtegida>}
      >
        {/* index = lo que se ve en "/atleta" exacto */}
        <Route index element={<CheckIn />} />
        {/* "datos" = "/atleta/datos" */}
        <Route path="datos" element={<MisDatos />} />
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
      {/* Cualquier otra URL: de vuelta al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
