// =====================================================================
// ListaComidas — las comidas del día de un atleta, para CONSULTAR (solo lectura).
//
// Es de PRESENTACIÓN: no consulta nada, dibuja la lista que recibe (la forma que entrega
// `armarComidas` de lib/comidas.js). Cada comida es una tarjeta desplegable (<details>:
// funciona sin JavaScript y es accesible) que arranca ABIERTA, para que el atleta vea de
// un vistazo qué comer, en qué estado (crudo o cocido) y en qué cantidad exacta; puede cerrar
// las que ya pasaron.
//
// Si los alimentos vienen del catálogo (snapshot de la migración 25) también muestra los
// macros de cada alimento y el total de la comida; los menús antiguos o manuales se ven como siempre.
// =====================================================================
import { textoCantidad, totalesAsignados } from '../lib/comidas'
import { textoEstado } from '../lib/alimentos'
import { TARJETA } from '../lib/estilos'

const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

export default function ListaComidas({ comidas }) {
  return (
    <ul className="flex flex-col gap-3">
      {comidas.map((comida) => {
        const totales = totalesAsignados(comida.alimentos)
        const hayMacros = comida.alimentos.some((a) => a.asignado)
        return (
          <li key={comida.id}>
            <details open className={`${TARJETA} group`}>
              {/* min-h-11: el encabezado es el botón de abrir/cerrar y debe ser fácil de tocar */}
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-tight">{comida.nombre}</span>
                  <span className="block text-xs text-suave">
                    {comida.alimentos.length} {comida.alimentos.length === 1 ? 'alimento' : 'alimentos'}
                    {hayMacros && ` · ${numero(totales.calorias)} kcal`}
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
                        <span className="block">
                          {a.alimento}
                          {/* Estado de preparación: crudo o cocido (en "n/a" o en menús antiguos no se muestra) */}
                          {(a.estado === 'crudo' || a.estado === 'cocido') && (
                            <span className="ml-2 rounded-full bg-hundido px-2 py-0.5 align-middle text-xs font-semibold text-enlace">
                              {textoEstado(a.estado)}
                            </span>
                          )}
                        </span>
                        {a.nota && <span className="block text-xs text-suave">{a.nota}</span>}
                        {a.asignado && (
                          <span className="block text-xs text-suave">
                            {numero(a.asignado.calorias)} kcal · P {numero(a.asignado.proteina)} · C {numero(a.asignado.carbohidratos)} · G {numero(a.asignado.grasas)} g
                          </span>
                        )}
                      </span>
                      {/* La cantidad es lo importante: va a la derecha, en negrita y sin partirse */}
                      <span className="shrink-0 whitespace-nowrap font-bold">{textoCantidad(a.cantidad, a.unidad)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {hayMacros && (
                <p className="mt-2 rounded-xl bg-hundido p-3 text-sm">
                  <span className="font-semibold">Total: </span>
                  <span className="font-bold">{numero(totales.calorias)} kcal</span>
                  <span className="text-suave"> · P {numero(totales.proteina)} · C {numero(totales.carbohidratos)} · G {numero(totales.grasas)} g</span>
                </p>
              )}
            </details>
          </li>
        )
      })}
    </ul>
  )
}
