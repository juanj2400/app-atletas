// =====================================================================
// CumpleanosAtletas — bloque compacto de la lista de atletas (admin).
// Muestra los cumpleaños de HOY a los próximos 30 días (incluye lo que resta del mes
// actual). Para no sobrecargar la pantalla enseña solo los 3 más cercanos y un botón
// "Ver todos". Los cálculos viven en src/lib/cumpleanos.js (funciones puras).
// =====================================================================
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatearFechaCorta } from '../lib/fechas'
import { resumirCumpleanos, textoFaltan, DIAS_ADELANTE } from '../lib/cumpleanos'
import { TARJETA } from '../lib/estilos'

const VISIBLES = 3

export default function CumpleanosAtletas({ atletas, hoy }) {
  const [verTodos, setVerTodos] = useState(false)
  const { proximos, yaEsteMes, sinFecha } = resumirCumpleanos(atletas, hoy)

  // Si nadie tiene fecha, solo se recuerda dónde anotarla.
  if (sinFecha === atletas.length) {
    return (
      <section className={`${TARJETA} mb-4`} aria-label="Cumpleaños">
        <h2 className="font-bold">Cumpleaños</h2>
        <p className="mt-1 text-sm text-suave">
          Aún no hay fechas de nacimiento. Anótalas en la ficha de cada atleta.
        </p>
      </section>
    )
  }

  const visibles = verTodos ? proximos : proximos.slice(0, VISIBLES)

  return (
    <section className={`${TARJETA} mb-4`} aria-label="Cumpleaños">
      <h2 className="font-bold">Cumpleaños</h2>

      {proximos.length === 0 ? (
        <p className="mt-1 text-sm text-suave">Nadie cumple años en los próximos {DIAS_ADELANTE} días.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {visibles.map((c) => (
            <li key={c.atleta.id}>
              <Link
                to={`/admin/atletas/${c.atleta.id}`}
                className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-hundido px-3 py-2 ${
                  c.esHoy ? 'border-primario' : 'border-borde'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.atleta.nombre_completo || 'Sin nombre'}</span>
                  <span className="block text-sm text-suave">
                    {formatearFechaCorta(c.fechaISO)} · cumple {c.edad}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    c.esHoy ? 'bg-primario text-white' : 'border border-borde text-suave'
                  }`}
                >
                  {textoFaltan(c.dias)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {proximos.length > VISIBLES && (
        <button
          type="button"
          aria-expanded={verTodos}
          onClick={() => setVerTodos((v) => !v)}
          className="mt-2 min-h-11 w-full rounded-xl border border-borde px-4 text-sm font-semibold"
        >
          {verTodos ? 'Ver menos' : `Ver todos (${proximos.length})`}
        </button>
      )}

      {yaEsteMes.length > 0 && (
        <p className="mt-2 text-xs text-suave">
          Ya cumplieron este mes:{' '}
          {yaEsteMes.map((c) => `${c.atleta.nombre_completo || 'Sin nombre'} (${formatearFechaCorta(c.fechaISO)})`).join(', ')}
        </p>
      )}
      {sinFecha > 0 && (
        <p className="mt-1 text-xs text-suave">
          {sinFecha === 1 ? '1 atleta sin fecha de nacimiento.' : `${sinFecha} atletas sin fecha de nacimiento.`}
        </p>
      )}
    </section>
  )
}
