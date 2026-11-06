// =====================================================================
// App.jsx — el MAPA de la aplicación: qué pantalla se ve en cada URL.
// React Router cambia de pantalla SIN recargar la página (por eso es una SPA
// y se siente como una app nativa).
// =====================================================================
import { Routes, Route, Navigate } from 'react-router-dom'
import RutaProtegida from './auth/RutaProtegida'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import PantallaAtleta from './atleta/PantallaAtleta'
import ListaAtletas from './admin/ListaAtletas'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Inicio />} />
      <Route
        path="/atleta"
        element={<RutaProtegida rol="client"><PantallaAtleta /></RutaProtegida>}
      />
      <Route
        path="/admin"
        element={<RutaProtegida rol="admin"><ListaAtletas /></RutaProtegida>}
      />
      {/* Cualquier otra URL: de vuelta al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
