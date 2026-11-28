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
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

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
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-borde bg-hundido p-3">
      <p className="text-sm text-suave">Elige qué músculos trabaja y con qué peso cuenta cada serie.</p>
      <div className="grid grid-cols-2 gap-3">
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
      <main className={`${CONTENIDO_ADMIN} flex flex-col gap-4`}>
        <p className="text-sm text-suave">
          Crea ejercicios y define los músculos de cada uno para calcular el volumen semanal de las rutinas.
          {sinAsignar > 0 && <span className="text-alerta"> {sinAsignar} sin músculos asignados.</span>}
        </p>

        {formEj === 'nuevo' ? (
          <FormEjercicio
            ejercicio={null} gruposExistentes={gruposExistentes}
            onCancelar={() => setFormEj(null)}
            // Al crearlo, se abre de una vez el editor de músculos de ese ejercicio nuevo.
            onGuardado={(id) => { setFormEj(null); setEditando(id); setBusqueda(''); setSoloSin(false); setVersion((v) => v + 1) }}
          />
        ) : (
          <button type="button" onClick={() => setFormEj('nuevo')} className={BOTON}>Nuevo ejercicio</button>
        )}

        <input
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ejercicio..." aria-label="Buscar ejercicio" className={CAMPO}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} />
          Mostrar solo los que no tienen músculos asignados
        </label>

        {cargando && <p className="text-suave">Cargando...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        {!cargando && !error && visibles.length === 0 && <p className="text-suave">No hay ejercicios que mostrar.</p>}

        <ul className="flex flex-col gap-3">
          {visibles.map((e) => {
            const asignados = asignadosDe(e.id)
            return (
              <li key={e.id} className={TARJETA}>
                <p className="font-semibold">{e.nombre}</p>
                <p className="text-sm text-suave">{e.grupo_muscular || 'Sin grupo'} · {textoTipo(e.tipo_ejercicio)}</p>
                {e.restringido && <p className="text-sm text-alerta">Restringido (lista negra global)</p>}
                {asignados.length === 0 ? (
                  <p className="mt-1 text-sm text-alerta">Sin músculos asignados</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {asignados.map((a) => (
                      <li key={a.muscle} className="rounded-full bg-hundido px-3 py-1 text-sm">
                        {nombreMusculo[a.muscle] ?? a.muscle} · {textoFactor(a.factor)}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {editando !== e.id && (
                    <button type="button" onClick={() => setEditando(e.id)} className={BOTON_SEC}>Editar músculos</button>
                  )}
                  {formEj !== e.id && (
                    <button type="button" onClick={() => setFormEj(e.id)} className={BOTON_SEC}>Editar datos</button>
                  )}
                </div>
                {editando === e.id && (
                  <EditorMusculos
                    ejercicio={e} asignados={asignados} grupos={grupos}
                    onCancelar={() => setEditando(null)}
                    onGuardado={() => { setEditando(null); setVersion((v) => v + 1) }}
                  />
                )}
                {formEj === e.id && (
                  <div className="mt-3">
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
      </main>
    </MarcoAdmin>
  )
}
