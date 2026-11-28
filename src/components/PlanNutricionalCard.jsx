// Tarjeta con el plan nutricional (calorías y macros). Es de PRESENTACIÓN: no
// consulta nada, solo dibuja el plan que recibe. La usan el atleta y el entrenador.
import { fechaCortaDeTimestamp } from '../lib/records'
import { textoEstadoCalorico } from '../lib/opciones'
import { INTENSIDADES, OBJETIVOS, TIPOS_DIETA } from '../lib/planNutricional'
import { TARJETA } from '../lib/estilos'

const etiqueta = (lista, valor) => lista.find((o) => o.valor === valor)?.etiqueta

export default function PlanNutricionalCard({ plan, titulo = 'Plan actual' }) {
  if (!plan) {
    return (
      <div className={TARJETA}>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-1 text-sm text-suave">Sin plan nutricional vigente.</p>
      </div>
    )
  }

  const macros = [
    { nombre: 'Proteína', valor: plan.proteina_g },
    { nombre: 'Carbohidratos', valor: plan.carbohidratos_g },
    { nombre: 'Grasas', valor: plan.grasas_g },
  ]

  return (
    <div className={`${TARJETA} flex flex-col gap-3`}>
      <div>
        <p className="text-sm text-suave">{titulo}</p>
        <p className="text-3xl font-bold">
          {plan.calorias_objetivo.toLocaleString('es-CO')}{' '}
          <span className="text-base font-normal text-suave">kcal al día</span>
        </p>
        <p className="text-sm text-suave">
          {plan.objetivo_calorico ? `${textoEstadoCalorico(plan.objetivo_calorico)} · ` : ''}
          desde el {fechaCortaDeTimestamp(plan.vigente_desde)}
        </p>
        {plan.objetivo_fisico && (
          <p className="text-sm text-enlace">
            {[etiqueta(OBJETIVOS, plan.objetivo_fisico), etiqueta(INTENSIDADES, plan.intensidad), etiqueta(TIPOS_DIETA, plan.tipo_dieta)].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {macros.some((m) => m.valor !== null) && (
        <div className="grid grid-cols-3 gap-2">
          {macros.map((m) => (
            <div key={m.nombre} className="rounded-xl bg-hundido p-3 text-center">
              <p className="text-xs text-suave">{m.nombre}</p>
              <p className="text-lg font-bold">{m.valor === null ? '—' : `${m.valor} g`}</p>
            </div>
          ))}
        </div>
      )}

      {plan.notas && <p className="text-sm">{plan.notas}</p>}
    </div>
  )
}
