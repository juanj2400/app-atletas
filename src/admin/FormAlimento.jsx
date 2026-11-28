// =====================================================================
// FormAlimento — crear o editar UN alimento del catálogo (tabla `foods`, migración 25).
//
// Los macros se escriben POR 100 g de alimento en ese estado (crudo, cocido o no aplica).
// Si dejas las calorías vacías se calculan con los macros (4 kcal por g de proteína y
// carbohidratos, 9 por g de grasa). La macro dominante la calcula la base de datos sola.
// Se valida aquí (lib/alimentos.js) y otra vez en la base de datos (CHECK).
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { aNumero } from '../lib/numeros'
import {
  CATEGORIAS, ESTADOS, FORM_ALIMENTO_VACIO, TEXTO_MACRO,
  avisoCalorias, formDeAlimento, macroDominante, validarAlimento,
} from '../lib/alimentos'
import { kcalDeMacros } from '../lib/nutricion'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

export default function FormAlimento({ alimento, onCancelar, onGuardado }) {
  const [form, setForm] = useState(() => (alimento ? formDeAlimento(alimento) : FORM_ALIMENTO_VACIO))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const pre = alimento ? `alimento-${alimento.id}` : 'alimento-nuevo'

  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setError('') }

  // Vista previa en vivo: calorías según los macros y macro dominante
  const p = aNumero(form.proteina)
  const c = aNumero(form.carbohidratos)
  const g = aNumero(form.grasas)
  const macrosValidos = [p, c, g].every((n) => n !== null && Number.isFinite(n))
  const kcalCalculadas = macrosValidos ? Math.round(kcalDeMacros(p, c, g)) : null
  const dominante = macrosValidos ? macroDominante({ proteina_g: p, carbohidratos_g: c, grasas_g: g }) : null
  const aviso = avisoCalorias(form)

  async function guardar(evento) {
    evento.preventDefault()
    const { error: problema, datos } = validarAlimento(form)
    if (problema) return setError(problema)

    setGuardando(true)
    // .select('id'): si la política RLS bloquea la operación, no llega ninguna fila (no falla en silencio).
    const consulta = alimento
      ? supabase.from('foods').update(datos).eq('id', alimento.id).select('id')
      : supabase.from('foods').insert(datos).select('id')
    const { data, error: errorBD } = await consulta
    setGuardando(false)

    if (errorBD) {
      return setError(
        errorBD.code === '23505'
          ? 'Ya existe un alimento con ese nombre y ese estado (crudo/cocido).'
          : 'No se pudo guardar el alimento. Inténtalo de nuevo.'
      )
    }
    if (!data || data.length === 0) return setError('No se pudo guardar: no tienes permiso para esta acción.')
    onGuardado()
  }

  return (
    <form onSubmit={guardar} className={`${TARJETA} flex flex-col gap-2.5 bg-hundido`} noValidate>
      <h3 className="font-bold">{alimento ? 'Editar alimento' : 'Nuevo alimento'}</h3>

      <div>
        <label htmlFor={`${pre}-nombre`} className="text-xs text-suave">Nombre</label>
        <input id={`${pre}-nombre`} value={form.nombre} maxLength={80}
          onChange={(e) => cambiar('nombre', e.target.value)}
          placeholder="Ej: Arroz blanco" className={CAMPO} />
        <p className="mt-1 text-xs text-suave">
          Sin el estado: «Arroz blanco»; crudo o cocido se elige aparte.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${pre}-categoria`} className="text-xs text-suave">Categoría</label>
          <select id={`${pre}-categoria`} value={form.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)} className={CAMPO}>
            {CATEGORIAS.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${pre}-estado`} className="text-xs text-suave">Estado</label>
          <select id={`${pre}-estado`} value={form.estado}
            onChange={(e) => cambiar('estado', e.target.value)} className={CAMPO}>
            {ESTADOS.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>
      </div>

      <p className="text-sm font-semibold">Macros por 100 g</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['proteina', 'Proteína (g)'],
          ['carbohidratos', 'Carbohidratos (g)'],
          ['grasas', 'Grasas (g)'],
          ['calorias', 'Calorías (kcal)'],
        ].map(([campo, etiqueta]) => (
          <div key={campo}>
            <label htmlFor={`${pre}-${campo}`} className="text-xs text-suave">{etiqueta}</label>
            <input id={`${pre}-${campo}`} inputMode="decimal" value={form[campo]}
              onChange={(e) => cambiar(campo, e.target.value)}
              placeholder={campo === 'calorias' && kcalCalculadas !== null ? `${kcalCalculadas} (calculadas)` : '0'}
              className={CAMPO} />
          </div>
        ))}
      </div>

      {dominante && (
        <p className="text-sm text-suave">
          Macro dominante: <span className="font-semibold text-texto">{TEXTO_MACRO[dominante]}</span>
          {kcalCalculadas !== null && <> · con estos macros suman unas {kcalCalculadas} kcal</>}
        </p>
      )}
      {aviso && <p role="status" className="text-sm text-alerta">{aviso}</p>}
      {error && <p role="alert" className="text-sm text-alerta">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={`${BOTON} flex-1`}>
          {guardando ? 'Guardando...' : 'Guardar alimento'}
        </button>
        <button type="button" onClick={onCancelar} className={BOTON_SEC}>Cancelar</button>
      </div>
    </form>
  )
}
