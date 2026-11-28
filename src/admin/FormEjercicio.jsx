// =====================================================================
// FormEjercicio — crear o editar un ejercicio de la biblioteca (solo entrenador).
// ejercicio = null  -> crear uno nuevo.   ejercicio = {...} -> editar.
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import { TIPOS_EJERCICIO } from '../lib/tiposEjercicio'

// Solo se aceptan enlaces http o https (un "javascript:..." podría ejecutar código al tocarlo).
// La base de datos aplica la misma regla (migración 09): aquí solo damos el aviso rápido.
const URL_VALIDA = /^https?:\/\/\S+$/i

export default function FormEjercicio({ ejercicio, gruposExistentes, onGuardado, onCancelar }) {
  const [f, setF] = useState({
    nombre: ejercicio?.nombre ?? '',
    grupo: ejercicio?.grupo_muscular ?? '',
    // En un ejercicio nuevo no hay tipo por defecto: el entrenador debe elegirlo a conciencia.
    tipo: ejercicio?.tipo_ejercicio ?? '',
    descripcion: ejercicio?.descripcion ?? '',
    video: ejercicio?.video_url ?? '',
    restringido: ejercicio?.restringido ?? false,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const cambiar = (campo, valor) => { setF((a) => ({ ...a, [campo]: valor })); setError('') }

  async function guardar(evento) {
    evento.preventDefault()
    const nombre = f.nombre.trim()
    const video = f.video.trim()
    if (nombre.length < 2 || nombre.length > 80) return setError('El nombre debe tener entre 2 y 80 caracteres.')
    if (!TIPOS_EJERCICIO.some((t) => t.valor === f.tipo)) return setError('Elige el tipo de ejercicio (define si se estima su 1RM).')
    if (f.grupo.trim().length > 40) return setError('El grupo muscular es demasiado largo (máximo 40 caracteres).')
    if (f.descripcion.length > 1000) return setError('La descripción es demasiado larga (máximo 1.000 caracteres).')
    if (video && !URL_VALIDA.test(video)) return setError('El enlace del video debe empezar por http:// o https://')

    const campos = {
      nombre,
      grupo_muscular: f.grupo.trim() || null,
      tipo_ejercicio: f.tipo,
      descripcion: f.descripcion.trim() || null,
      video_url: video || null,
      restringido: f.restringido,
    }
    setGuardando(true)
    const { data, error: errorBD } = ejercicio
      ? await supabase.from('exercises').update(campos).eq('id', ejercicio.id).select('id')
      : await supabase.from('exercises').insert(campos).select('id')
    setGuardando(false)

    if (errorBD) {
      // 23505 = ya existe (el nombre es único)
      return setError(errorBD.code === '23505' ? 'Ya existe un ejercicio con ese nombre.' : 'No se pudo guardar el ejercicio.')
    }
    if (!data || data.length === 0) return setError('No se pudo guardar el ejercicio.')
    onGuardado(data[0].id, !ejercicio)
  }

  return (
    <form onSubmit={guardar} className={`${TARJETA} flex flex-col gap-3`}>
      <h4 className="font-semibold">{ejercicio ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h4>

      <label htmlFor="ej-nombre" className="text-sm text-suave">Nombre</label>
      <input id="ej-nombre" value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)}
        placeholder="Ej: Remo con mancuerna" className={CAMPO} />

      <label htmlFor="ej-grupo" className="text-sm text-suave">Grupo muscular (opcional)</label>
      <input id="ej-grupo" list="grupos-existentes" value={f.grupo} onChange={(e) => cambiar('grupo', e.target.value)}
        placeholder="Ej: Espalda" className={CAMPO} />
      <datalist id="grupos-existentes">
        {gruposExistentes.map((g) => <option key={g} value={g} />)}
      </datalist>

      <label htmlFor="ej-tipo" className="text-sm text-suave">Tipo de ejercicio</label>
      <select id="ej-tipo" value={f.tipo} onChange={(e) => cambiar('tipo', e.target.value)} className={CAMPO}>
        <option value="">Elige un tipo...</option>
        {TIPOS_EJERCICIO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
      </select>
      <p className="-mt-2 text-xs text-suave">
        Compuesto, fuerza y halterofilia muestran 1RM estimado en los récords. Aislado solo guarda las mejores repeticiones con cada peso.
      </p>

      <label htmlFor="ej-desc" className="text-sm text-suave">Cómo se hace (opcional; lo ve el atleta)</label>
      <textarea id="ej-desc" rows={3} maxLength={1000} value={f.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)}
        className="w-full rounded-xl border border-borde-campo bg-fondo p-3" />

      <label htmlFor="ej-video" className="text-sm text-suave">Enlace de video (opcional)</label>
      <input id="ej-video" inputMode="url" value={f.video} onChange={(e) => cambiar('video', e.target.value)}
        placeholder="https://..." className={CAMPO} />

      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" checked={f.restringido} onChange={(e) => cambiar('restringido', e.target.checked)} className="mt-1" />
        <span>
          Restringido (lista negra global): el editor de rutinas avisará al usarlo y la IA no podrá sugerir cargas de este ejercicio para nadie.
        </span>
      </label>

      {error && <p role="alert" className="text-alerta">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={BOTON}>{guardando ? 'Guardando...' : 'Guardar ejercicio'}</button>
        <button type="button" onClick={onCancelar} className={BOTON_SEC}>Cancelar</button>
      </div>
    </form>
  )
}
