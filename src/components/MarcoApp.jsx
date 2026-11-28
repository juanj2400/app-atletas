// =====================================================================
// MarcoApp — el MARCO de escritorio (solo presentación).
// En celular (< md) no dibuja nada extra: se ve igual que antes (la barra
// inferior del atleta sigue en PantallaAtleta). Desde md: barra lateral
// izquierda con logo, usuario/rol, navegación y "Cerrar sesión" al fondo;
// a la derecha, el contenido.
// `items`: [{ a: ruta, texto, icono, prefijos?: [rutas que también lo activan], fin? }]
// =====================================================================
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Logo from './Logo'

// Iconos de línea simples (sin dependencias). Todos decorativos (aria-hidden).
const TRAZOS = {
  entrenar: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  nutricion: 'M12 4c-3 0-6 3-6 7s3 9 6 9 6-5 6-9-3-7-6-7zM12 4c0-1.5 1-2.5 2.5-2.5',
  datos: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  atletas: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 100-6M18 15c2 .5 3 2.2 3 5',
  usuarios: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.5-6 8-6s8 2 8 6',
  ejercicios: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  alimentos: 'M5 11h14a7 7 0 01-14 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4',
}

function Icono({ nombre }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

export default function MarcoApp({ items = [], children }) {
  const { perfil, cerrarSesion } = useAuth()
  const { pathname } = useLocation()
  const ruta = pathname.replace(/\/+$/, '') || '/'
  const etiquetaRol = perfil?.rol === 'admin' ? 'Entrenador' : 'Atleta'

  function activo(i) {
    if (i.fin) return ruta === i.a
    return [i.a, ...(i.prefijos || [])].some((p) => ruta === p || ruta.startsWith(`${p}/`))
  }

  return (
    <div className="md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-borde bg-superficie p-4 md:flex lg:w-64">
        <div className="px-2 py-2"><Logo /></div>

        <div className="mt-6 rounded-xl border border-borde-suave bg-hundido p-3">
          <p className="truncate text-sm font-semibold">{perfil?.nombre_completo || perfil?.email}</p>
          <p className="text-xs text-suave">{etiquetaRol}</p>
        </div>

        <nav aria-label="Navegación principal" className="mt-6 flex flex-1 flex-col gap-1">
          {items.map((i) => {
            const on = activo(i)
            return (
              <Link
                key={i.a}
                to={i.a}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  on ? 'bg-elevada text-enlace' : 'text-suave hover:bg-elevada hover:text-texto'
                }`}
              >
                <Icono nombre={i.icono} />
                {i.texto}
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-4 min-h-11 rounded-xl border border-borde px-3 text-left text-sm font-semibold text-suave transition-colors hover:bg-elevada hover:text-texto"
        >
          Cerrar sesión
        </button>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// Menú del entrenador (en celular se sigue entrando por los botones de la lista de atletas).
export const ITEMS_ADMIN = [
  { a: '/admin', texto: 'Atletas', icono: 'atletas', fin: true, prefijos: ['/admin/atletas', '/admin/rutinas'] },
  { a: '/admin/usuarios', texto: 'Usuarios', icono: 'usuarios' },
  { a: '/admin/ejercicios', texto: 'Ejercicios', icono: 'ejercicios' },
  { a: '/admin/alimentos', texto: 'Alimentos', icono: 'alimentos' },
]

// Envuelve una pantalla del entrenador con el marco.
export function MarcoAdmin({ children }) {
  return <MarcoApp items={ITEMS_ADMIN}>{children}</MarcoApp>
}
