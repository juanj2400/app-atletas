// =====================================================================
// main.jsx — el PUNTO DE ENTRADA. index.html lo carga y aquí arranca todo.
// Las "capas" se anidan de afuera hacia adentro:
//   BrowserRouter  -> habilita las rutas (URLs)
//   AuthProvider   -> disponibiliza la sesión y el rol a toda la app
//   App            -> el mapa de pantallas
// =====================================================================
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
