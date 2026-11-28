// =====================================================================
// EditorRutina — aquí el entrenador ARMA la rutina de un atleta.
//   Rutina  ->  Días  ->  Ejercicios (series, reps, RPE, descanso)
//
// Patrón de la pantalla: cada acción (agregar, guardar, quitar...) hace UN cambio
// en Supabase y después RECARGA la rutina completa. Es simple y siempre muestra
// lo que de verdad quedó guardado en la base de datos.
// =====================================================================
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import { MarcoAdmin } from '../components/MarcoApp'
import SelectorEjercicio from './SelectorEjercicio'
import VolumenMuscular from './VolumenMuscular'
import { aNumero } from '../lib/numeros'
import { BLOQUES, bloqueDe, textoBloques } from '../lib/bloques'
import { textoEstadoRutina } from '../lib/opciones'
import {
  SISTEMAS_PROGRESION, SALTOS_PESO, SERIES_ESQUEMA, REPS_ESQUEMA,
  alternarEsquema, tieneEsquema, normalizarEscalera, formatearKg,
} from '../lib/progresion'
import { CAMPO, BOTON, BOTON_SEC, TARJETA, CONTENIDO_ADMIN } from '../lib/estilos'
import { DESCANSOS_RAPIDOS, textoDescanso } from '../lib/rutinas'

const porOrden = (a, b) => a.orden - b.orden

// Botón de selección (esquema o salto de peso). aria-pressed avisa a los lectores de pantalla si está marcado.
const claseToggle = (activo) =>
  `min-h-11 rounded-xl border text-sm font-semibold ${activo ? 'border-primario bg-primario text-white' : 'border-borde'}`

// Si una política RLS impide un cambio, Supabase NO da error: afecta 0 filas.
// Por eso pedimos .select('id') en cada operación y comprobamos que volvió algo.
const fallo = (res) => res.error || !res.data || res.data.length === 0

// ---------------------------------------------------------------------
// Una fila de ejercicio dentro de un día
// ---------------------------------------------------------------------
function FilaEjercicio({ fila, listaNegra, aplicar, hibrido }) {
  const [f, setF] = useState({
    series: String(fila.series),
    repsMin: String(fila.reps_min ?? ''),
    repsMax: String(fila.reps_max ?? ''),
    rpe: String(fila.rpe_objetivo ?? ''),
    bloque: bloqueDe(fila), // 'halterofilia' o 'musculacion' (solo cuenta en rutinas híbridas)
    pideRpe: fila.pide_rpe !== false, // ¿el atleta debe anotar el RPE en este ejercicio?
    descanso: String(fila.descanso_seg ?? ''),
    notas: fila.notas ?? '',
    // Progresión automática (migración 11). escalera = lista de parejas [[series, reps], ...].
    progresion: fila.progresion_tipo ?? 'ninguna',
    escalera: Array.isArray(fila.escalera) ? fila.escalera : [],
    salto: Number(fila.incremento_kg) || 2.5,
    pesoInicial: String(fila.peso_inicial_kg ?? ''),
  })
  const [error, setError] = useState('')
  const cambiar = (campo, valor) => { setF((a) => ({ ...a, [campo]: valor })); setError('') }

  const aviso = fila.exercises.restringido
    ? 'Ejercicio restringido'
    : listaNegra.has(fila.exercise_id) ? 'En la lista negra de este atleta' : null

  async function guardar() {
    const series = aNumero(f.series)
    const repsMin = aNumero(f.repsMin)
    const repsMax = aNumero(f.repsMax)
    // Si no se pide RPE, el RPE objetivo no aplica (se guarda vacío).
    const rpe = f.pideRpe ? aNumero(f.rpe) : null
    const descanso = aNumero(f.descanso)
    const pesoInicial = aNumero(f.pesoInicial)

    if ([series, repsMin, repsMax, rpe, descanso, pesoInicial].some(Number.isNaN)) return setError('Revisa los números.')
    if (series === null || !Number.isInteger(series) || series < 1 || series > 20) {
      return setError('Las series deben ser un número entero entre 1 y 20.')
    }
    for (const reps of [repsMin, repsMax]) {
      if (reps !== null && (!Number.isInteger(reps) || reps < 1 || reps > 100)) {
        return setError('Las repeticiones deben ser enteros entre 1 y 100.')
      }
    }
    if (repsMin !== null && repsMax !== null && repsMax < repsMin) {
      return setError('Las reps máximas no pueden ser menores que las mínimas.')
    }
    if (rpe !== null && (rpe < 1 || rpe > 10)) return setError('El RPE debe estar entre 1 y 10.')
    if (descanso !== null && (!Number.isInteger(descanso) || descanso < 0 || descanso > 900)) {
      return setError('El descanso debe ser un entero entre 0 y 900 segundos.')
    }
    if (f.progresion === 'doble' && (repsMin === null || repsMax === null || repsMax <= repsMin)) {
      return setError('Para progresar por rango escribe reps mínimas y máximas, con el máximo mayor que el mínimo.')
    }
    if (f.progresion === 'escalera' && normalizarEscalera(f.escalera).length < 2) {
      return setError('Marca al menos 2 pasos para la fuerza simple.')
    }
    if (pesoInicial !== null && (pesoInicial < 0 || pesoInicial > 1000)) {
      return setError('El peso inicial debe estar entre 0 y 1.000 kg.')
    }

    // 1) Datos básicos del ejercicio. Va primero porque set_progresion revisa las reps ya guardadas.
    const base = await supabase.from('routine_exercises')
      .update({
        series, reps_min: repsMin, reps_max: repsMax, rpe_objetivo: rpe, pide_rpe: f.pideRpe,
        bloque: hibrido ? f.bloque : 'musculacion',
        descanso_seg: descanso, notas: f.notas.trim() || null,
      })
      .eq('id', fila.id).select('id')
    if (fallo(base)) return setError('No se pudo guardar el ejercicio. Inténtalo de nuevo.')

    // 2) Progresión: la función de la base de datos la valida y la guarda (solo admin).
    const { error: errorProg } = await supabase.rpc('set_progresion', {
      p_routine_exercise_id: fila.id,
      p_tipo: f.progresion,
      p_escalera: f.progresion === 'escalera' ? f.escalera : null,
      p_incremento_kg: f.salto,
      p_peso_inicial_kg: f.progresion === 'ninguna' ? null : pesoInicial,
    })
    if (errorProg) {
      // Los mensajes de la función ya vienen redactados en español (código P0001 o 42501).
      const redactado = errorProg.code === 'P0001' || errorProg.code === '42501'
      return setError(redactado ? errorProg.message : 'No se pudo guardar la progresión. Inténtalo de nuevo.')
    }

    // Todo salió bien: se reutiliza "aplicar" solo para mostrar el aviso y recargar la rutina.
    aplicar(Promise.resolve({ data: [{ id: fila.id }], error: null }), 'Ejercicio guardado.')
  }

  function quitar() {
    if (!window.confirm(`¿Quitar ${fila.exercises.nombre} de este día?`)) return
    aplicar(supabase.from('routine_exercises').delete().eq('id', fila.id).select('id'), 'Ejercicio quitado.')
  }

  const mini = 'text-xs text-suave'
  return (
    <li className="rounded-xl border border-borde bg-hundido p-3">
      <p className="font-semibold">{fila.exercises.nombre}</p>
      <p className="text-sm text-suave">{fila.exercises.grupo_muscular || 'Sin grupo'}</p>
      {aviso && <p className="text-sm text-alerta">Atención: {aviso}</p>}

      {/* Rutina híbrida: en qué bloque de la sesión va este ejercicio */}
      {hibrido && (
        <div className="mt-2">
          <p className="text-xs text-suave">Bloque de la sesión</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {BLOQUES.map((b) => (
              <button key={b.valor} type="button" aria-pressed={f.bloque === b.valor} onClick={() => cambiar('bloque', b.valor)} className={claseToggle(f.bloque === b.valor)}>
                {b.titulo}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-suave">Pulsa Guardar para aplicar el cambio de bloque.</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <label className={mini} htmlFor={`s-${fila.id}`}>Series</label>
          <input id={`s-${fila.id}`} inputMode="numeric" value={f.series} onChange={(e) => cambiar('series', e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label className={mini} htmlFor={`rmin-${fila.id}`}>Reps mín.</label>
          <input id={`rmin-${fila.id}`} inputMode="numeric" value={f.repsMin} onChange={(e) => cambiar('repsMin', e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label className={mini} htmlFor={`rmax-${fila.id}`}>Reps máx.</label>
          <input id={`rmax-${fila.id}`} inputMode="numeric" value={f.repsMax} onChange={(e) => cambiar('repsMax', e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label className={mini} htmlFor={`rpe-${fila.id}`}>RPE objetivo</label>
          <input id={`rpe-${fila.id}`} inputMode="decimal" value={f.rpe} disabled={!f.pideRpe} onChange={(e) => cambiar('rpe', e.target.value)} className={`${CAMPO} disabled:opacity-50`} />
        </div>
        <div className="col-span-2">
          <label className={mini} htmlFor={`d-${fila.id}`}>Descanso (segundos)</label>
          {/* Opciones rápidas: rellenan el campo de abajo, que sigue editable para otros valores (0–900 s). */}
          <div role="group" aria-label="Descansos rápidos" className="mb-2 grid grid-cols-4 gap-2">
            {DESCANSOS_RAPIDOS.map((seg) => {
              const elegido = aNumero(f.descanso) === seg
              return (
                <button
                  key={seg}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => cambiar('descanso', String(seg))}
                  className={`min-h-11 rounded-xl border px-1 text-sm font-semibold ${
                    elegido ? 'border-primario bg-primario text-white' : 'border-borde text-suave'
                  }`}
                >
                  {textoDescanso(seg)}
                </button>
              )
            })}
          </div>
          <input id={`d-${fila.id}`} inputMode="numeric" value={f.descanso} onChange={(e) => cambiar('descanso', e.target.value)} className={CAMPO} />
        </div>
      </div>
      <p className="mt-1 text-xs text-suave">Si las repeticiones son fijas, repite el mismo número en mín. y máx.</p>

      {/* El atleta solo ve y llena el campo RPE si aquí está en "Sí". */}
      <div className="mt-3">
        <p className={mini}>¿Pedir RPE al atleta en este ejercicio?</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={f.pideRpe} onClick={() => cambiar('pideRpe', true)} className={claseToggle(f.pideRpe)}>
            Sí
          </button>
          <button type="button" aria-pressed={!f.pideRpe} onClick={() => cambiar('pideRpe', false)} className={claseToggle(!f.pideRpe)}>
            No
          </button>
        </div>
      </div>

      {/* Progresión automática: la meta de cada sesión se calcula con lo que el atleta anota. */}
      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-borde p-3">
        <label className={mini} htmlFor={`pg-${fila.id}`}>Progresión de este ejercicio</label>
        <select id={`pg-${fila.id}`} value={f.progresion} onChange={(e) => cambiar('progresion', e.target.value)} className={CAMPO}>
          {SISTEMAS_PROGRESION.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
        </select>

        {f.progresion === 'doble' && (
          <p className="text-xs text-suave">
            Usa el rango de reps mín.–máx. de arriba (el máximo debe ser mayor que el mínimo). Cada sesión el atleta intenta una repetición más que su mejor
            serie anterior; si no mejora, la meta se mantiene. Al llegar al máximo se sugiere subir el peso y se
            vuelve a empezar en el mínimo.
          </p>
        )}

        {f.progresion === 'escalera' && (
          <>
            <p className="text-xs text-suave">
              Marca los pasos (series × repeticiones) que se usarán, mínimo 2. Se recorren de menor a mayor: primero suben las
              series y luego las repeticiones; al terminar el último se sugiere subir el peso. Aquí la meta la
              marca la escalera (el campo Series de arriba solo cuenta para el volumen semanal).
            </p>
            <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] items-center gap-1">
              <span className="text-xs text-suave">Reps ↓ / Series →</span>
              {SERIES_ESQUEMA.map((s) => <span key={s} className="text-center text-xs text-suave">{s}</span>)}
              {REPS_ESQUEMA.map((r) => (
                <div key={r} className="contents">
                  <span className="pr-1 text-xs text-suave">{r} {r === 1 ? 'rep' : 'reps'}</span>
                  {SERIES_ESQUEMA.map((s) => {
                    const activo = tieneEsquema(f.escalera, s, r)
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={activo}
                        aria-label={`${s} series de ${r} ${r === 1 ? 'repetición' : 'repeticiones'}`}
                        onClick={() => cambiar('escalera', alternarEsquema(f.escalera, s, r))}
                        className={claseToggle(activo)}
                      >
                        {s}×{r}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {f.progresion !== 'ninguna' && (
          <div>
            <label className={mini} htmlFor={`pi-${fila.id}`}>Peso inicial de este atleta (kg, opcional)</label>
            <input id={`pi-${fila.id}`} inputMode="decimal" value={f.pesoInicial} onChange={(e) => cambiar('pesoInicial', e.target.value)} className={CAMPO} />
            <p className="mt-1 text-xs text-suave">Se usa solo la primera vez. No se copia al copiar la rutina a otro atleta.</p>
          </div>
        )}

        {f.progresion !== 'ninguna' && (
          <div>
            <p className={mini}>Al terminar la secuencia, subir:</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {SALTOS_PESO.map((kg) => (
                <button key={kg} type="button" aria-pressed={f.salto === kg} onClick={() => cambiar('salto', kg)} className={claseToggle(f.salto === kg)}>
                  {formatearKg(kg)} kg
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <label className={`${mini} mt-2 block`} htmlFor={`n-${fila.id}`}>Notas</label>
      <input id={`n-${fila.id}`} value={f.notas} onChange={(e) => cambiar('notas', e.target.value)} className={CAMPO} />

      {error && <p role="alert" className="mt-2 text-sm text-alerta">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={guardar} className={BOTON}>Guardar</button>
        <button type="button" onClick={quitar} className={`${BOTON_SEC} text-alerta`}>Quitar</button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------
// Un día de la rutina con sus ejercicios
// ---------------------------------------------------------------------
function DiaRutina({ dia, listaNegra, aplicar, hibrido }) {
  const [nombre, setNombre] = useState(dia.nombre)
  const [notas, setNotas] = useState(dia.notas ?? '')
  // Bloque en el que se está eligiendo un ejercicio nuevo ('musculacion' o 'halterofilia'); null = cerrado
  const [eligiendo, setEligiendo] = useState(null)

  const siguienteOrden = dia.routine_exercises.reduce((max, e) => Math.max(max, e.orden), 0) + 1

  function guardarDia() {
    if (!nombre.trim()) return
    aplicar(
      supabase.from('routine_days').update({ nombre: nombre.trim(), notas: notas.trim() || null }).eq('id', dia.id).select('id'),
      'Día guardado.'
    )
  }

  function quitarDia() {
    if (!window.confirm(`¿Eliminar "${dia.nombre}" y todos sus ejercicios?`)) return
    aplicar(supabase.from('routine_days').delete().eq('id', dia.id).select('id'), 'Día eliminado.')
  }

  async function agregarEjercicio(ejercicio, bloque) {
    const ok = await aplicar(
      supabase.from('routine_exercises')
        .insert({ day_id: dia.id, exercise_id: ejercicio.id, orden: siguienteOrden, series: 3, bloque })
        .select('id'),
      `${ejercicio.nombre} agregado. Ajusta series y repeticiones.`
    )
    if (ok) setEligiendo(null)
  }

  return (
    <div className={`${TARJETA} flex flex-col gap-3`}>
      <label htmlFor={`dia-${dia.id}`} className="text-sm text-suave">Nombre del día</label>
      <input id={`dia-${dia.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
      <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas del día (opcional)" aria-label="Notas del día" className={CAMPO} />
      <div className="flex gap-2">
        <button type="button" onClick={guardarDia} className={BOTON_SEC}>Guardar día</button>
        <button type="button" onClick={quitarDia} className={`${BOTON_SEC} text-alerta`}>Eliminar día</button>
      </div>

      {hibrido && dia.routine_exercises.length > 0 && (
        <p className="text-sm text-suave">En la sesión: {textoBloques(dia.routine_exercises)}.</p>
      )}

      {/* Rutina normal: una sola lista. Híbrida: un bloque de halterofilia y otro de musculación. */}
      {(hibrido ? BLOQUES : [{ valor: 'musculacion', titulo: null }]).map((b) => {
        const filas = hibrido ? dia.routine_exercises.filter((f) => bloqueDe(f) === b.valor) : dia.routine_exercises
        return (
          <div key={b.valor} className="flex flex-col gap-3">
            {hibrido && (
              <h4 className={`border-l-4 pl-3 font-bold ${b.valor === 'halterofilia' ? 'border-primario' : 'border-enlace'}`}>
                Bloque de {b.titulo.toLowerCase()} ({filas.length})
              </h4>
            )}
            {filas.length === 0 && (
              <p className="text-sm text-suave">
                {hibrido ? `Sin ejercicios de ${b.titulo.toLowerCase()} en este día.` : 'Este día aún no tiene ejercicios.'}
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {filas.map((fila) => (
                <FilaEjercicio key={fila.id} fila={fila} listaNegra={listaNegra} aplicar={aplicar} hibrido={hibrido} />
              ))}
            </ul>
            {eligiendo === b.valor ? (
              <SelectorEjercicio listaNegra={listaNegra} onElegir={(e) => agregarEjercicio(e, b.valor)} onCerrar={() => setEligiendo(null)} />
            ) : (
              <button type="button" onClick={() => setEligiendo(b.valor)} className={BOTON}>
                {hibrido ? `Agregar ejercicio de ${b.titulo.toLowerCase()}` : 'Agregar ejercicio'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------
// Modo híbrido: activa los bloques de halterofilia y musculación en cada día
// ---------------------------------------------------------------------
function ModoHibrido({ rutina, aplicar }) {
  const hibrido = Boolean(rutina.modo_hibrido)
  const enHalterofilia = rutina.routine_days
    .flatMap((d) => d.routine_exercises)
    .filter((e) => bloqueDe(e) === 'halterofilia').length

  function cambiar(valor) {
    if (valor === hibrido) return
    if (!valor && enHalterofilia > 0 &&
        !window.confirm(`Los ${enHalterofilia} ejercicios de halterofilia pasarán al bloque de musculación. ¿Continuar?`)) return
    aplicar(
      supabase.from('routines').update({ modo_hibrido: valor }).eq('id', rutina.id).select('id'),
      valor ? 'Modo híbrido activado: ahora puedes armar el bloque de halterofilia en cada día.' : 'Modo híbrido desactivado.'
    )
  }

  return (
    <div className={`${TARJETA} flex flex-col gap-2`}>
      <p className="font-semibold">Rutina híbrida (halterofilia + musculación)</p>
      <p className="text-sm text-suave">
        Si la activas, cada día tiene un bloque de halterofilia y otro de musculación (por ejemplo, 2 ejercicios de
        halterofilia + 5 de musculación). El atleta los ve juntos en su sesión, con cada ejercicio identificado.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={hibrido} onClick={() => cambiar(true)} className={claseToggle(hibrido)}>Activada</button>
        <button type="button" aria-pressed={!hibrido} onClick={() => cambiar(false)} className={claseToggle(!hibrido)}>Desactivada</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Datos generales de la rutina (nombre, objetivo, notas)
// ---------------------------------------------------------------------
function FormDatos({ rutina, aplicar }) {
  const [nombre, setNombre] = useState(rutina.nombre)
  const [objetivo, setObjetivo] = useState(rutina.objetivo ?? '')
  const [notas, setNotas] = useState(rutina.notas ?? '')
  const [error, setError] = useState('')

  function guardar(evento) {
    evento.preventDefault()
    if (!nombre.trim()) return setError('La rutina necesita un nombre.')
    setError('')
    aplicar(
      supabase.from('routines')
        .update({ nombre: nombre.trim(), objetivo: objetivo.trim() || null, notas: notas.trim() || null })
        .eq('id', rutina.id).select('id'),
      'Datos de la rutina guardados.'
    )
  }

  return (
    <form onSubmit={guardar} className={`${TARJETA} flex flex-col gap-3`}>
      <label htmlFor="r-nombre" className="text-sm text-suave">Nombre</label>
      <input id="r-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
      <label htmlFor="r-objetivo" className="text-sm text-suave">Objetivo (opcional)</label>
      <input id="r-objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej: fuerza máxima" className={CAMPO} />
      <label htmlFor="r-notas" className="text-sm text-suave">Notas (opcional)</label>
      <textarea id="r-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full rounded-xl border border-borde-campo bg-fondo p-3" />
      {error && <p role="alert" className="text-alerta">{error}</p>}
      <button type="submit" className={BOTON_SEC}>Guardar datos</button>
    </form>
  )
}

// ---------------------------------------------------------------------
// Pantalla principal del editor
// ---------------------------------------------------------------------
export default function EditorRutina() {
  const { rutinaId } = useParams()
  const navigate = useNavigate()

  const [rutina, setRutina] = useState(null)
  const [listaNegra, setListaNegra] = useState(new Set())
  const [atletas, setAtletas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [version, setVersion] = useState(0)
  const [nuevoDia, setNuevoDia] = useState('')
  const [destino, setDestino] = useState('')

  const recargar = () => setVersion((v) => v + 1)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      // Una sola consulta trae la rutina con sus días, ejercicios y el nombre de cada ejercicio.
      const { data, error } = await supabase
        .from('routines')
        .select(`
          id, user_id, nombre, objetivo, notas, estado, origen, modo_hibrido,
          routine_days (
            id, orden, nombre, notas,
            routine_exercises (
              id, orden, bloque, exercise_id, series, reps_min, reps_max, rpe_objetivo, pide_rpe, descanso_seg, notas,
              progresion_tipo, escalera, incremento_kg, peso_inicial_kg,
              exercises ( nombre, grupo_muscular, restringido )
            )
          )
        `)
        .eq('id', rutinaId)
        .maybeSingle()
      if (cancelado) return
      if (error) { setError('No se pudo cargar la rutina.'); setCargando(false); return }
      if (!data) { setRutina(null); setError(''); setCargando(false); return }

      // La base de datos no garantiza el orden de las listas anidadas: lo ordenamos aquí.
      data.routine_days.sort(porOrden)
      data.routine_days.forEach((d) => d.routine_exercises.sort(porOrden))

      const [lista, todos] = await Promise.all([
        supabase.from('athlete_exercise_blacklist').select('exercise_id').eq('user_id', data.user_id),
        supabase.from('profiles').select('id, nombre_completo, email').eq('rol', 'client').order('nombre_completo'),
      ])
      if (cancelado) return
      setRutina(data)
      setListaNegra(new Set((lista.data ?? []).map((x) => x.exercise_id)))
      setAtletas(todos.data ?? [])
      setError('')
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [rutinaId, version])

  // Ejecuta una operación de escritura, avisa del resultado y recarga si salió bien.
  async function aplicar(operacion, textoOk) {
    setMensaje(null)
    const res = await operacion
    if (fallo(res)) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el cambio. Inténtalo de nuevo.' })
      return false
    }
    if (textoOk) setMensaje({ tipo: 'ok', texto: textoOk })
    recargar()
    return true
  }

  async function activar() {
    setMensaje(null)
    // La función de la base de datos archiva la rutina activa anterior y activa esta.
    const { error } = await supabase.rpc('activate_routine', { p_routine_id: rutina.id })
    if (error) setMensaje({ tipo: 'error', texto: error.message })
    else { setMensaje({ tipo: 'ok', texto: 'Rutina activada: el atleta ya puede verla.' }); recargar() }
  }

  function cambiarEstado(estado, texto) {
    aplicar(supabase.from('routines').update({ estado }).eq('id', rutina.id).select('id'), texto)
  }

  function agregarDia(evento) {
    evento.preventDefault()
    if (!nuevoDia.trim()) return
    const orden = rutina.routine_days.reduce((max, d) => Math.max(max, d.orden), 0) + 1
    aplicar(
      supabase.from('routine_days').insert({ routine_id: rutina.id, orden, nombre: nuevoDia.trim() }).select('id'),
      'Día agregado.'
    ).then((ok) => { if (ok) setNuevoDia('') })
  }

  async function copiar() {
    if (!destino) return setMensaje({ tipo: 'error', texto: 'Elige a qué atleta copiarla.' })
    setMensaje(null)
    const { data, error } = await supabase.rpc('duplicate_routine', { p_routine_id: rutina.id, p_target_user: destino })
    if (error) return setMensaje({ tipo: 'error', texto: error.message })
    navigate(`/admin/rutinas/${data}`) // abre la copia (nace como borrador)
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar esta rutina completa? No se puede deshacer.')) return
    const res = await supabase.from('routines').delete().eq('id', rutina.id).select('id')
    if (fallo(res)) return setMensaje({ tipo: 'error', texto: 'No se pudo eliminar la rutina.' })
    navigate(`/admin/atletas/${rutina.user_id}`)
  }

  if (cargando) {
    return <MarcoAdmin><Encabezado titulo="Rutina" /><main className={`${CONTENIDO_ADMIN} text-suave`}>Cargando rutina...</main></MarcoAdmin>
  }
  if (error || !rutina) {
    return (
      <MarcoAdmin>
        <Encabezado titulo="Rutina" volverA="/admin" textoVolver="Atletas" />
        <main className={`${CONTENIDO_ADMIN} text-alerta`}>{error || 'No encontramos esta rutina.'}</main>
      </MarcoAdmin>
    )
  }

  const colorMensaje = mensaje?.tipo === 'error' ? 'text-alerta' : 'text-enlace'

  return (
    <MarcoAdmin>
      <Encabezado titulo={rutina.nombre} volverA={`/admin/atletas/${rutina.user_id}`} textoVolver="Atleta" />
      <main className={`${CONTENIDO_ADMIN} flex flex-col gap-4`}>
        {/* Aviso fijo arriba: así se ve aunque estés editando más abajo en la página. */}
        {mensaje && (
          <p role={mensaje.tipo === 'error' ? 'alert' : 'status'}
             className={`sticky top-2 z-10 rounded-xl border border-borde bg-superficie p-3 ${colorMensaje}`}>
            {mensaje.texto}
          </p>
        )}

        <div className={`${TARJETA} flex flex-col gap-3`}>
          <p>
            Estado: <span className="font-semibold">{textoEstadoRutina(rutina.estado)}</span>
            {rutina.origen === 'ia' && <span className="text-suave"> · propuesta por la IA</span>}
          </p>
          <p className="text-sm text-suave">
            {rutina.estado === 'activa'
              ? 'El atleta ve esta rutina.'
              : 'El atleta NO ve esta rutina hasta que la actives.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {rutina.estado !== 'activa' && <button type="button" onClick={activar} className={BOTON}>Activar rutina</button>}
            {rutina.estado === 'activa' && (
              <>
                <button type="button" onClick={() => cambiarEstado('archivada', 'Rutina archivada.')} className={BOTON_SEC}>Archivar</button>
                <button type="button" onClick={() => cambiarEstado('borrador', 'La rutina volvió a borrador.')} className={BOTON_SEC}>Volver a borrador</button>
              </>
            )}
            {rutina.estado === 'archivada' && (
              <button type="button" onClick={() => cambiarEstado('borrador', 'La rutina volvió a borrador.')} className={BOTON_SEC}>Volver a borrador</button>
            )}
          </div>
        </div>

        <FormDatos rutina={rutina} aplicar={aplicar} />

        <ModoHibrido rutina={rutina} aplicar={aplicar} />

        <h3 className="text-lg font-bold">Días y ejercicios</h3>
        {rutina.routine_days.length === 0 && <p className="text-suave">Empieza agregando el primer día.</p>}
        {rutina.routine_days.map((dia) => (
          <DiaRutina key={dia.id} dia={dia} listaNegra={listaNegra} aplicar={aplicar} hibrido={Boolean(rutina.modo_hibrido)} />
        ))}

        <form onSubmit={agregarDia} className={`${TARJETA} flex flex-col gap-3`}>
          <label htmlFor="nuevo-dia" className="text-sm text-suave">Agregar día</label>
          <input id="nuevo-dia" value={nuevoDia} onChange={(e) => setNuevoDia(e.target.value)} placeholder="Ej: Día 1 · Pierna" className={CAMPO} />
          <button type="submit" className={BOTON}>Agregar día</button>
        </form>

        {/* Se recalcula solo cada vez que cambias algo en la rutina (version) */}
        <VolumenMuscular rutinaId={rutina.id} version={version} titulo="Volumen semanal de esta rutina" />

        <div className={`${TARJETA} flex flex-col gap-3`}>
          <p className="font-semibold">Copiar a un atleta</p>
          <p className="text-sm text-suave">Crea una copia como borrador (sin los pesos sugeridos).</p>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Atleta destino" className={CAMPO}>
            <option value="">Elige un atleta...</option>
            {atletas.map((a) => <option key={a.id} value={a.id}>{a.nombre_completo || a.email}</option>)}
          </select>
          <button type="button" onClick={copiar} className={BOTON_SEC}>Copiar rutina</button>
          <button type="button" onClick={eliminar} className={`${BOTON_SEC} text-alerta`}>Eliminar esta rutina</button>
        </div>
      </main>
    </MarcoAdmin>
  )
}
