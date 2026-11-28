// =====================================================================
// Ejercicios — biblioteca de ejercicios y sus MÚSCULOS (solo entrenador).
// Aquí defines qué músculos trabaja cada ejercicio y con qué factor
// (principal = cuenta 1 serie; secundario = cuenta media serie).
// De esto sale el cálculo de volumen por músculo de las rutinas.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import { MarcoAdmin } from '../components/MarcoApp'
import { textoTipo } from '../lib/tiposEjercicio'
import FormEjercicio from './FormEjercicio'
import { CAMPO, BOTON, BOTON_SEC, TARJETA, CONTENIDO_ADMIN } from '../lib/estilos'

const normalizar = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Opciones del selector de cada músculo
const OPCIONES = [
  { valor: '', etiqueta: '—' },
  { valor: '1', etiqueta: 'Principal (1)' },
  { valor: '0.5', etiqueta: 'Secundario (0,5)' },
]

function textoFactor(factor) {
  return Number(factor) >= 1 ? 'principal' : `×${String(Number(factor)).replace('.', ',')}`
}

// Editor de los músculos de UN ejercicio
function EditorMusculos({ ejercicio, asignados, grupos, onGuardado, onCancelar }) {
  // valores: { pecho: '1', triceps: '0.5', ... } (lo que no está = sin asignar)
  const [valores, setValores] = useState(() => {
    const inicial = {}
    for (const a of asignados) inicial[a.muscle] = Number(a.factor) >= 1 ? '1' : '0.5'
    return inicial
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    const lista = Object.entries(valores)
      .filter(([, factor]) => factor !== '')
      .map(([muscle, factor]) => ({ muscle, factor: Number(factor) }))
    if (lista.length === 0) return setError('Asigna al menos un músculo.')

    setGuardando(true)
    // La función de la base de datos reemplaza todos los músculos de una vez (todo o nada).
    const { error: errorBD } = await supabase.rpc('set_exercise_muscles', {
      p_exercise_id: ejercicio.id,
      p_muscles: lista,
    })
    setGuardando(false)
    if (errorBD) setError('No se pudieron guardar los músculos.')
    else onGuardado()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borde bg-hundido p-3">
      <p className="text-sm text-suave">Elige qué músculos trabaja y con qué peso cuenta cada serie.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {grupos.map((g) => (
          <div key={g.codigo}>
            <label htmlFor={`m-${ejercicio.id}-${g.codigo}`} className="text-xs text-suave">{g.nombre}</label>
            <select
              id={`m-${ejercicio.id}-${g.codigo}`}
              value={valores[g.codigo] ?? ''}
              onChange={(e) => { setValores((a) => ({ ...a, [g.codigo]: e.target.value })); setError('') }}
              className={CAMPO}
            >
              {OPCIONES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </select>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={guardar} disabled={guardando} className={BOTON}>
          {guardando ? 'Guardando...' : 'Guardar músculos'}
        </button>
        <button type="button" onClick={onCancelar} className={BOTON_SEC}>Cancelar</button>
      </div>
    </div>
  )
}

export default function Ejercicios() {
  const [ejercicios, setEjercicios] = useState([])
  const [musculos, setMusculos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [soloSin, setSoloSin] = useState(false)
  const [editando, setEditando] = useState(null) // id del ejercicio cuyos MÚSCULOS se editan
  const [claveNuevo, setClaveNuevo] = useState(0) // al cambiar, el formulario de «Nuevo» se vacía
  const [formEj, setFormEj] = useState(null)     // null | 'nuevo' | id del ejercicio cuyos DATOS se editan

  useEffect(() => {
    let cancelado = false
    Promise.all([
      supabase.from('exercises').select('id, nombre, grupo_muscular, tipo_ejercicio, descripcion, video_url, restringido').order('nombre'),
      supabase.from('exercise_muscles').select('exercise_id, muscle, factor'),
      supabase.from('muscle_groups').select('codigo, nombre, orden').order('orden'),
    ]).then(([ej, mus, gru]) => {
      if (cancelado) return
      if (ej.error || mus.error || gru.error) setError('No se pudo cargar la biblioteca.')
      else {
        setEjercicios(ej.data)
        setMusculos(mus.data)
        setGrupos(gru.data)
        setError('')
      }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [version])

  const nombreMusculo = Object.fromEntries(grupos.map((g) => [g.codigo, g.nombre]))
  const asignadosDe = (id) => musculos.filter((m) => m.exercise_id === id)
  const sinAsignar = ejercicios.filter((e) => asignadosDe(e.id).length === 0).length
  // Grupos escritos hasta ahora (para sugerirlos al crear un ejercicio)
  const gruposExistentes = [...new Set(ejercicios.map((e) => e.grupo_muscular).filter(Boolean))].sort()

  const visibles = ejercicios.filter((e) =>
    normalizar(e.nombre).includes(normalizar(busqueda)) && (!soloSin || asignadosDe(e.id).length === 0)
  )

  return (
    <MarcoAdmin>
      <Encabezado titulo="Biblioteca de ejercicios" volverA="/admin" textoVolver="Atletas" />
      <main className={`${CONTENIDO_ADMIN} flex flex-col gap-3`}>
        <p className="text-sm text-suave">
          Crea ejercicios y define los músculos de cada uno para calcular el volumen semanal de las rutinas.
          {sinAsignar > 0 && <span className="text-alerta"> {sinAsignar} sin músculos asignados.</span>}
        </p>

        {/* Escritorio: «Nuevo ejercicio» siempre a la izquierda (fijo al hacer scroll) y la lista a la derecha. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside aria-label="Nuevo ejercicio" className="lg:sticky lg:top-4">
            {formEj !== 'nuevo' && (
              <button type="button" onClick={() => setFormEj('nuevo')} className={`${BOTON} w-full lg:hidden`}>Nuevo ejercicio</button>
            )}
            <div className={formEj === 'nuevo' ? '' : 'hidden lg:block'}>
              <FormEjercicio
                key={claveNuevo}
                ejercicio={null} gruposExistentes={gruposExistentes}
                onCancelar={() => { setFormEj(null); setClaveNuevo((k) => k + 1) }}
                onGuardado={(id) => { setFormEj(null); setClaveNuevo((k) => k + 1); setEditando(id); setBusqueda(''); setSoloSin(false); setVersion((v) => v + 1) }}
              />
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-3" aria-label="Lista de ejercicios">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <input
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar ejercicio..." aria-label="Buscar ejercicio" className={`${CAMPO} md:min-w-48 md:flex-1`}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm text-suave">
                <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} />
                Solo sin músculos asignados
              </label>
            </div>

            {cargando && <p className="text-suave">Cargando...</p>}
            {error && <p role="alert" className="text-alerta">{error}</p>}
            {!cargando && !error && visibles.length === 0 && <p className="text-suave">No hay ejercicios que mostrar.</p>}

            <ul className="divide-y divide-borde-suave overflow-hidden rounded-2xl border border-borde bg-superficie">
              {visibles.map((e) => {
                const asignados = asignadosDe(e.id)
                return (
                  <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-semibold">{e.nombre}</p>
                      <p className="text-xs text-suave">{e.grupo_muscular || 'Sin grupo'} · {textoTipo(e.tipo_ejercicio)}</p>
                      {e.restringido && <p className="text-xs text-alerta">Restringido (lista negra global)</p>}
                      {asignados.length === 0 ? (
                        <p className="mt-1 text-xs text-alerta">Sin músculos asignados</p>
                      ) : (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {asignados.map((a) => (
                            <li key={a.muscle} className="rounded-full bg-hundido px-2.5 py-0.5 text-xs">
                              {nombreMusculo[a.muscle] ?? a.muscle} · {textoFactor(a.factor)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {editando !== e.id && (
                        <button type="button" onClick={() => setEditando(e.id)} className={`${BOTON_SEC} md:min-h-9`}>Músculos</button>
                      )}
                      {formEj !== e.id && (
                        <button type="button" onClick={() => setFormEj(e.id)} className={`${BOTON_SEC} md:min-h-9`}>Datos</button>
                      )}
                    </div>
                    {editando === e.id && (
                      <div className="basis-full">
                        <EditorMusculos
                          ejercicio={e} asignados={asignados} grupos={grupos}
                          onCancelar={() => setEditando(null)}
                          onGuardado={() => { setEditando(null); setVersion((v) => v + 1) }}
                        />
                      </div>
                    )}
                    {formEj === e.id && (
                      <div className="basis-full">
                        <FormEjercicio
                          ejercicio={e} gruposExistentes={gruposExistentes}
                          onCancelar={() => setFormEj(null)}
                          onGuardado={() => { setFormEj(null); setVersion((v) => v + 1) }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </main>
    </MarcoAdmin>
  )
}
