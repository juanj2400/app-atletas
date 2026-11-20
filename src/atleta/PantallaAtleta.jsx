// =====================================================================
// PantallaAtleta — el MARCO de la zona del atleta (encabezado + barra inferior).
//
// RUTAS ANIDADAS: en App.jsx, /atleta/datos es "hija" de /atleta. React Router
// dibuja ESTE componente (el marco) y, en el lugar de <Outlet />, inserta la
// pantalla hija que corresponda a la URL (check-in o datos). El marco no se
// vuelve a dibujar al cambiar de pestaña: solo cambia lo que hay en el Outlet.
// =====================================================================
import { NavLink, Outlet } from 'react-router-dom'
import Encabezado from '../components/Encabezado'

const PESTANAS = [
  // `fin: true` = solo activa en la URL EXACTA. Sin eso, "/atleta" también
  // se marcaría activa estando en "/atleta/datos" (porque la URL empieza igual).
  { a: '/atleta', texto: 'Check-in', fin: true },
  { a: '/atleta/datos', texto: 'Mis datos', fin: false },
]

export default function PantallaAtleta() {
  return (
    <>
      <Encabezado titulo="Mi entrenamiento" />
      {/* pb-28: espacio extra abajo para que la barra fija no tape el contenido */}
      <main className="mx-auto max-w-md p-4 pb-28">
        <Outlet />
      </main>

      {/* Barra inferior: patrón típico de apps móviles (se alcanza con el pulgar).
          `fixed` la ancla a la pantalla. El pb con env(safe-area-inset-bottom)
          la separa de la barra de gestos del iPhone cuando la PWA está instalada. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 flex border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)]"
      >
        {PESTANAS.map((p) => (
          <NavLink
            key={p.a}
            to={p.a}
            end={p.fin}
            // NavLink nos dice si el enlace está activo y así cambiamos el color.
            className={({ isActive }) =>
              `flex min-h-14 flex-1 items-center justify-center text-sm font-semibold ${
                isActive ? 'text-enlace' : 'text-suave'
              }`
            }
          >
            {p.texto}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
