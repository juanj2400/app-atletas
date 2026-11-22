// =====================================================================
// MisDatos — marco de la pestaña "Mis datos" con DOS secciones:
//   - Medidas  (/atleta/datos)          peso, cintura, calorías y su gráfico.
//   - Récords  (/atleta/datos/records)  mejores marcas y gráficas por ejercicio.
// Es otra ruta anidada: este marco se queda fijo y <Outlet /> cambia la sección.
// Cada sección tiene su propia URL, así el botón "atrás" y recargar funcionan.
// =====================================================================
import { NavLink, Outlet } from 'react-router-dom'

const SECCIONES = [
  { a: '/atleta/datos', texto: 'Medidas', fin: true },   // fin: solo activa en la URL exacta
  { a: '/atleta/datos/records', texto: 'Récords', fin: false },
]

export default function MisDatos() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Mis datos</h2>

      {/* Selector de sección: dos botones tipo "pestañas" */}
      <nav aria-label="Secciones de mis datos" className="flex gap-1 rounded-2xl border border-borde bg-superficie p-1">
        {SECCIONES.map((s) => (
          <NavLink
            key={s.a}
            to={s.a}
            end={s.fin}
            className={({ isActive }) =>
              `flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold ${
                isActive ? 'bg-primario text-white' : 'text-suave'
              }`
            }
          >
            {s.texto}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
