// =====================================================================
// CiclosAtleta — el entrenador define los ciclos de UN atleta:
//   macrociclo (bloque grande)  ->  mesociclos (fases dentro del bloque).
// El atleta ve en "Entrenar" en qué fase y semana va.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHoy } from '../lib/useHoy'
import { FASES_SUGERIDAS, estaVigente, validarCiclo } from '../lib/ciclos'
import { formatearFechaCorta } from '../lib/fechas'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import CicloVigenteCard from '../components/CicloVigenteCard'

const COLUMNAS = 'id, parent_id, nivel, nombre, fase, objetivo, fecha_inicio, fecha_fin, notas'

// ---------------------------------------------------------------------
// Formulario (sirve para crear y para editar, macro o meso)
// ---------------------------------------------------------------------
function FormCiclo({ nivel, ciclo, ciclos, userId, hoy, onGuardado, onCancelar }) {
  const macros = ciclos.filter((c) => c.nivel === 'macrociclo')
  const [f, setF] = useState({
    nombre: ciclo?.nombre ?? '',
    fase: ciclo?.fase ?? '',
    objetivo: ciclo?.objetivo ?? '',
    inicio: ciclo?.fecha_inicio ?? hoy,
    fin: ciclo?.fecha_fin ?? '',
    notas: ciclo?.notas ?? '',
    parentId: ciclo?.parent_id ?? macros[0]?.id ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const cambiar = (campo, valor) => { setF((a) => ({ ...a, [campo]: valor })); setError('') }
  const esMeso = nivel === 'mesociclo'

  async function guardar(evento) {
    evento.preventDefault()
    const mensaje = validarCiclo(
      { nivel, nombre: f.nombre, fecha_inicio: f.inicio, fecha_fin: f.fin, parent_id: esMeso ? f.parentId : null },
      ciclos, ciclo?.id ?? null
    )
    if (mensaje) return setError(mensaje)

    const campos = {
      nombre: f.nombre.trim(),
      fase: esMeso ? f.fase.trim() || null : null,
      objetivo: f.objetivo.trim() || null,
      fecha_inicio: f.inicio,
      fecha_fin: f.fin,
      notas: f.notas.trim() || null,
      parent_id: esMeso ? f.parentId : null,
    }
    setGuardando(true)
    const consulta = ciclo
      ? supabase.from('training_cycles').update(campos).eq('id', ciclo.id).select('id')
      : supabase.from('training_cycles').insert({ ...campos, user_id: userId, nivel }).select('id')
    const { data, error: errorBD } = await consulta
    setGuardando(false)
    if (errorBD || !data || data.length === 0) return setError('No se pudo guardar el ciclo. Inténtalo de nuevo.')
    onGuardado()
  }

  return (
    <form onSubmit={guardar} className={`${TARJETA} flex flex-col gap-3`}>
      <h4 className="font-semibold">{ciclo ? 'Editar' : 'Nuevo'} {esMeso ? 'mesociclo' : 'macrociclo'}</h4>

      {esMeso && (
        <>
          <label htmlFor="ciclo-macro" className="text-sm text-suave">Macrociclo al que pertenece</label>
          <select id="ciclo-macro" value={f.parentId} onChange={(e) => cambiar('parentId', e.target.value)} className={CAMPO}>
            {macros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </>
      )}

      <label htmlFor="ciclo-nombre" className="text-sm text-suave">Nombre</label>
      <input id="ciclo-nombre" value={f.nombre} onChange={(e) => cambiar('nombre', e.target.value)}
        placeholder={esMeso ? 'Ej: Bloque 1' : 'Ej: Fuerza 2026'} className={CAMPO} />

      {esMeso && (
        <>
          <label htmlFor="ciclo-fase" className="text-sm text-suave">Fase (opcional)</label>
          {/* datalist: sugiere las fases habituales pero permite escribir otra */}
          <input id="ciclo-fase" list="fases-sugeridas" value={f.fase} onChange={(e) => cambiar('fase', e.target.value)}
            placeholder="Ej: Acumulación" className={CAMPO} />
          <datalist id="fases-sugeridas">
            {FASES_SUGERIDAS.map((fase) => <option key={fase} value={fase} />)}
          </datalist>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ciclo-inicio" className="text-sm text-suave">Inicio</label>
          <input id="ciclo-inicio" type="date" value={f.inicio} onChange={(e) => cambiar('inicio', e.target.value)} className={`${CAMPO} mt-1`} />
        </div>
        <div>
          <label htmlFor="ciclo-fin" className="text-sm text-suave">Fin</label>
          <input id="ciclo-fin" type="date" value={f.fin} onChange={(e) => cambiar('fin', e.target.value)} className={`${CAMPO} mt-1`} />
        </div>
      </div>

      <label htmlFor="ciclo-objetivo" className="text-sm text-suave">Objetivo (opcional)</label>
      <input id="ciclo-objetivo" value={f.objetivo} onChange={(e) => cambiar('objetivo', e.target.value)}
        placeholder="Ej: construir volumen de trabajo" className={CAMPO} />

      <label htmlFor="ciclo-notas" className="text-sm text-suave">Notas (opcional)</label>
      <textarea id="ciclo-notas" rows={2} maxLength={300} value={f.notas} onChange={(e) => cambiar('notas', e.target.value)}
        className="w-full rounded-xl border border-[#5B6372] bg-fondo p-3" />

      {error && <p role="alert" className="text-alerta">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className={BOTON}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        <button type="button" onClick={onCancelar} className={BOTON_SEC}>Cancelar</button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Sección
// ---------------------------------------------------------------------
export default function CiclosAtleta({ atletaId }) {
  const hoy = useHoy()
  const [ciclos, setCiclos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState(null) // null | { nivel, ciclo }
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('training_cycles')
      .select(COLUMNAS)
      .eq('user_id', atletaId)
      .in('nivel', ['macrociclo', 'mesociclo'])
      .order('fecha_inicio')
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setErrorCarga('No se pudieron cargar los ciclos.')
        else { setCiclos(data); setErrorCarga('') }
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId, version])

  const macros = ciclos.filter((c) => c.nivel === 'macrociclo').sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  const mesosDe = (macroId) => ciclos.filter((c) => c.nivel === 'mesociclo' && c.parent_id === macroId)

  function terminarForm() {
    setForm(null)
    setMensaje({ tipo: 'ok', texto: 'Ciclo guardado.' })
    setVersion((v) => v + 1)
  }

  async function eliminar(c) {
    const aviso = c.nivel === 'macrociclo'
      ? `¿Eliminar el macrociclo "${c.nombre}" y todos sus mesociclos?`
      : `¿Eliminar el mesociclo "${c.nombre}"?`
    if (!window.confirm(aviso)) return
    const { data, error } = await supabase.from('training_cycles').delete().eq('id', c.id).select('id')
    if (error || !data || data.length === 0) return setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el ciclo.' })
    setMensaje({ tipo: 'ok', texto: 'Ciclo eliminado.' })
    setVersion((v) => v + 1)
  }

  const rango = (c) => `${formatearFechaCorta(c.fecha_inicio)} – ${formatearFechaCorta(c.fecha_fin)}`
  const insignia = (c) => estaVigente(c, hoy) && <span className="ml-2 text-xs text-enlace">En curso</span>

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Ciclos de entrenamiento</h3>

      {cargando && <p className="text-suave">Cargando ciclos...</p>}
      {errorCarga && <p role="alert" className="text-alerta">{errorCarga}</p>}

      {!cargando && !errorCarga && (
        <>
          <CicloVigenteCard ciclos={ciclos} hoy={hoy} mostrarVacio />

          {mensaje && (
            <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={mensaje.tipo === 'error' ? 'text-alerta' : 'text-enlace'}>
              {mensaje.texto}
            </p>
          )}

          {form ? (
            <FormCiclo
              key={form.ciclo?.id ?? `nuevo-${form.nivel}`}
              nivel={form.nivel} ciclo={form.ciclo} ciclos={ciclos} userId={atletaId} hoy={hoy}
              onGuardado={terminarForm} onCancelar={() => setForm(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMensaje(null); setForm({ nivel: 'macrociclo', ciclo: null }) }} className={BOTON_SEC}>
                Nuevo macrociclo
              </button>
              <button type="button" disabled={macros.length === 0}
                onClick={() => { setMensaje(null); setForm({ nivel: 'mesociclo', ciclo: null }) }} className={BOTON_SEC}>
                Nuevo mesociclo
              </button>
            </div>
          )}
          {!form && macros.length === 0 && <p className="text-sm text-suave">Empieza creando un macrociclo; después le agregas mesociclos.</p>}

          <ul className="flex flex-col gap-3">
            {macros.map((m) => (
              <li key={m.id} className={TARJETA}>
                <p className="font-semibold">{m.nombre}{insignia(m)}</p>
                <p className="text-sm text-suave">Macrociclo · {rango(m)}</p>
                {m.objetivo && <p className="text-sm">{m.objetivo}</p>}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => { setMensaje(null); setForm({ nivel: 'macrociclo', ciclo: m }) }} className={BOTON_SEC}>Editar</button>
                  <button type="button" onClick={() => eliminar(m)} className={`${BOTON_SEC} text-alerta`}>Eliminar</button>
                </div>

                <ul className="mt-3 flex flex-col gap-2">
                  {mesosDe(m.id).map((s) => (
                    <li key={s.id} className="rounded-xl border border-borde bg-hundido p-3">
                      <p className="font-semibold">{s.nombre}{insignia(s)}</p>
                      <p className="text-sm text-suave">{s.fase ? `${s.fase} · ` : ''}{rango(s)}</p>
                      {s.objetivo && <p className="text-sm">{s.objetivo}</p>}
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => { setMensaje(null); setForm({ nivel: 'mesociclo', ciclo: s }) }} className={BOTON_SEC}>Editar</button>
                        <button type="button" onClick={() => eliminar(s)} className={`${BOTON_SEC} text-alerta`}>Eliminar</button>
                      </div>
                    </li>
                  ))}
                  {mesosDe(m.id).length === 0 && <li className="text-sm text-suave">Sin mesociclos todavía.</li>}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
