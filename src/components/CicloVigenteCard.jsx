// Tarjeta del ciclo de entrenamiento EN CURSO (macrociclo, mesociclo, semana y progreso).
// Es de PRESENTACIÓN: recibe los ciclos y la fecha de hoy y dibuja. La usan el atleta y el entrenador.
import { cicloVigente, semanaActual, semanasTotales } from '../lib/ciclos'
import { formatearFechaCorta } from '../lib/fechas'
import { TARJETA } from '../lib/estilos'

export default function CicloVigenteCard({ ciclos, hoy, mostrarVacio = false }) {
  const { macro, meso } = cicloVigente(ciclos, hoy)

  if (!macro && !meso) {
    return mostrarVacio ? (
      <div className={TARJETA}>
        <p className="font-semibold">Ciclo en curso</p>
        <p className="mt-1 text-sm text-suave">No hay un ciclo de entrenamiento en curso.</p>
      </div>
    ) : null
  }

  const semana = meso ? semanaActual(meso, hoy) : null
  const total = meso ? semanasTotales(meso) : null
  const progreso = meso ? Math.min(100, Math.max(0, (semana / total) * 100)) : 0

  return (
    <div className={`${TARJETA} flex flex-col gap-1`}>
      <p className="text-sm text-suave">{macro ? `Macrociclo: ${macro.nombre}` : 'Ciclo en curso'}</p>
      {meso ? (
        <>
          <p className="text-xl font-bold">{meso.nombre}</p>
          <p className="text-sm text-suave">
            {meso.fase && `${meso.fase} · `}Semana {semana} de {total} · termina el {formatearFechaCorta(meso.fecha_fin)}
          </p>
          <div className="mt-2 h-2 rounded-full bg-borde" role="img" aria-label={`Semana ${semana} de ${total}`}>
            <div className="h-2 rounded-full bg-primario" style={{ width: `${progreso}%` }} />
          </div>
          {meso.objetivo && <p className="mt-2 text-sm">Objetivo: {meso.objetivo}</p>}
        </>
      ) : (
        <p className="text-sm text-suave">Sin mesociclo en curso dentro de este macrociclo.</p>
      )}
    </div>
  )
}
