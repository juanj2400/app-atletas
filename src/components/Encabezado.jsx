// Encabezado reutilizable. Novedad: si le pasas `volverA`, muestra un enlace
// para regresar a la pantalla anterior (prop opcional).
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AvisoSoloConConexion } from './IndicadorConexion'

export default function Encabezado({ titulo, volverA, textoVolver = 'Volver' }) {
  const { perfil, cerrarSesion } = useAuth()
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3 md:px-6 md:py-4 lg:px-8">
        <div>
          {/* <Link> navega sin recargar la página (a diferencia de <a href>). */}
          {volverA && (
            <Link to={volverA} className="text-sm text-enlace">
              ‹ {textoVolver}
            </Link>
          )}
          <h1 className="text-lg font-bold md:text-xl">{titulo}</h1>
          {/* En escritorio el usuario aparece en la barra lateral (MarcoApp). */}
          <p className="text-sm text-suave md:hidden">{perfil?.nombre_completo || perfil?.email}</p>
        </div>
        <button
          onClick={cerrarSesion}
          className="min-h-11 rounded-xl border border-borde bg-superficie px-4 text-sm font-semibold md:hidden"
        >
          Salir
        </button>
      </header>
      {/* El atleta tiene su propio indicador (IndicadorConexion); esto es solo para el entrenador */}
      {perfil?.rol === 'admin' && <AvisoSoloConConexion />}
    </>
  )
}
