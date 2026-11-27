// =====================================================================
// ListaComidas — las comidas del día de un atleta, para CONSULTAR (solo lectura).
//
// Es de PRESENTACIÓN: no consulta nada, dibuja la lista que recibe (la forma que entrega
// `armarComidas` de lib/comidas.js). Cada comida es una tarjeta desplegable (<details>:
// funciona sin JavaScript y es accesible) que arranca ABIERTA, para que el atleta vea de
// un vistazo qué comer y en qué cantidad; puede cerrar las que ya pasaron.
// =====================================================================
import { textoCantidad } from '../lib/comidas'
import { TARJETA } from '../lib/estilos'

export default function ListaComidas({ comidas }) {
  return (
    <ul className="flex flex-col gap-3">
      {comidas.map((comida) => (
        <li key={comida.id}>
          <details open className={`${TARJETA} group`}>
            {/* min-h-11: el encabezado es el botón de abrir/cerrar y debe ser fácil de tocar */}
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-tight">{comida.nombre}</span>
                <span className="block text-xs text-suave">
                  {comida.alimentos.length} {comida.alimentos.length === 1 ? 'alimento' : 'alimentos'}
                </span>
              </span>
              <span aria-hidden="true" className="text-xl text-enlace transition-transform group-open:rotate-90">›</span>
            </summary>

            {comida.notas && (
              <p className="mt-2 rounded-xl bg-hundido p-3 text-sm text-suave">{comida.notas}</p>
            )}

            {comida.alimentos.length === 0 ? (
              <p className="mt-2 text-sm text-suave">Tu entrenador aún no agregó alimentos a esta comida.</p>
            ) : (
              <ul className="mt-2 divide-y divide-borde">
                {comida.alimentos.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block">{a.alimento}</span>
                      {a.nota && <span className="block text-xs text-suave">{a.nota}</span>}
                    </span>
                    {/* La cantidad es lo importante: va a la derecha, en negrita y sin partirse */}
                    <span className="shrink-0 whitespace-nowrap font-bold">{textoCantidad(a.cantidad, a.unidad)}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </li>
      ))}
    </ul>
  )
}
