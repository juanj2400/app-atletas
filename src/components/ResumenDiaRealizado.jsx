// =====================================================================
// ResumenDiaRealizado — resumen CORTO y de solo lectura de lo que el atleta hizo en un
// día ya realizado esta semana. Es de presentación: recibe el resultado de
// resumenDiaRealizado() (src/lib/cierres.js). No tiene botones de editar ni de borrar.
// =====================================================================
import { TARJETA } from '../lib/estilos'

const TITULO_BLOQUE = { halterofilia: 'Halterofilia', musculacion: 'Musculación' }

function Fila({ ej }) {
  const cerrado = ej.estado === 'cerrado'
  return (
    <li className="flex flex-col gap-0.5 rounded-xl border border-borde bg-hundido px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{ej.nombre}</p>
        <span className={`whitespace-nowrap text-sm font-semibold ${cerrado ? 'text-alerta' : 'text-enlace'}`}>
          {cerrado ? `Finalizado ${ej.hechas} de ${ej.objetivo}` : ej.estado === 'completo' ? '✓' : ''}
        </span>
      </div>
      <p className="text-sm text-suave">{ej.texto || 'Sin series registradas'}</p>
      {ej.nota && <p className="text-sm"><span className="text-suave">Tu nota:</span> {ej.nota}</p>}
    </li>
  )
}

export default function ResumenDiaRealizado({ resumen }) {
  // Rutina híbrida: se mantiene el orden por bloques (halterofilia primero) con un subtítulo.
  const bloques = ['halterofilia', 'musculacion']
    .map((b) => ({ b, filas: resumen.ejercicios.filter((e) => e.bloque === b) }))
    .filter((g) => g.filas.length > 0)
  const hibrido = bloques.length > 0

  return (
    <section className={`${TARJETA} flex flex-col gap-3`} aria-label="Resumen de lo que hiciste">
      <div>
        <h3 className="text-lg font-bold">Lo que hiciste</h3>
        <p className="text-sm text-suave">
          {resumen.completos} {resumen.completos === 1 ? 'ejercicio completo' : 'ejercicios completos'}
          {resumen.cerrados > 0 && ` · ${resumen.cerrados} ${resumen.cerrados === 1 ? 'finalizado' : 'finalizados'} con nota`}
        </p>
      </div>
      {hibrido ? (
        bloques.map((g) => (
          <div key={g.b} className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-suave">{TITULO_BLOQUE[g.b]}</p>
            <ul className="flex flex-col gap-2">{g.filas.map((e) => <Fila key={e.id} ej={e} />)}</ul>
          </div>
        ))
      ) : (
        <ul className="flex flex-col gap-2">{resumen.ejercicios.map((e) => <Fila key={e.id} ej={e} />)}</ul>
      )}
    </section>
  )
}
