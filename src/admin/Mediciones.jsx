// =====================================================================
// Mediciones — peso, cintura y calorías de UN atleta. Solo las registra el ADMIN.
//
// Este componente es AUTÓNOMO: recibe solo el id del atleta (prop `atletaId`)
// y se encarga él mismo de cargar, mostrar, guardar y borrar sus datos.
// Dividir una pantalla grande en componentes con una sola responsabilidad
// hace el código más fácil de leer, probar y reutilizar.
//
// ⚠️ Seguridad: que el formulario solo aparezca en la zona del admin es
// experiencia de usuario. Lo que de verdad impide que un atleta escriba aquí
// son las políticas RLS de la tabla `metrics` (migración 03).
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fechaLocalISO, formatearFecha } from '../lib/fechas'
import { aNumero } from '../lib/numeros'
import { ESTADOS_CALORICOS } from '../lib/opciones'
import { resumirMediciones, textoMedicion } from '../lib/mediciones'
import ResumenMediciones from '../components/ResumenMediciones'
import GraficoEvolucion from '../components/GraficoEvolucionLazy'
import GraficoOscilacionPeso from '../components/GraficoOscilacionPesoLazy'

const CAMPO = 'min-h-11 w-full rounded-xl border border-borde-campo bg-fondo px-3'

// Es una FUNCIÓN (no un objeto fijo) para que la fecha se calcule al momento
// de usarla: si la app queda abierta pasada la medianoche, "hoy" sigue siendo correcto.
function formVacio() {
  return { fecha: fechaLocalISO(), peso: '', cintura: '', calorias: '', estado: '', notas: '' }
}

export default function Mediciones({ atletaId, versionPlan = 0 }) {
  const [mediciones, setMediciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  // "Contador de recarga": cada vez que sube, el efecto de abajo vuelve a
  // pedir los datos. Es el patrón simple para refrescar tras guardar o borrar.
  const [version, setVersion] = useState(0)

  // useState(formVacio) -sin paréntesis- le pasa la FUNCIÓN: React la ejecuta
  // solo la primera vez ("inicialización perezosa").
  const [form, setForm] = useState(formVacio)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok' | 'error' | 'info', texto }

  // useRef guarda una referencia a un elemento HTML real (aquí, el formulario)
  // para poder desplazar la pantalla hasta él. Cambiarla NO redibuja el componente.
  const formRef = useRef(null)

  // ---- Cargar las últimas 30 mediciones ----
  useEffect(() => {
    let cancelado = false
    supabase
      .from('metrics')
      .select('id, fecha, peso_corporal_kg, perimetro_cintura_cm, calorias_consumidas, estado_calorico, notas')
      .eq('user_id', atletaId)
      .order('fecha', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setErrorCarga('No se pudieron cargar las mediciones.')
        else { setMediciones(data); setErrorCarga('') }
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId, version])

  // ---- Datos DERIVADOS (se calculan, no se guardan en el estado) ----
  // Planes nutricionales: para la línea de objetivo del gráfico. `versionPlan` sube cuando
  // el entrenador cambia el plan en la misma ficha, y así la línea se actualiza sola.
  const [planes, setPlanes] = useState([])
  useEffect(() => {
    let cancelado = false
    supabase
      .from('nutrition_plans')
      .select('calorias_objetivo, vigente_desde, vigente_hasta')
      .eq('user_id', atletaId)
      .order('vigente_desde')
      .then(({ data }) => { if (!cancelado && data) setPlanes(data) })
    return () => { cancelado = true }
  }, [atletaId, versionPlan])

  // Resumen compartido con la pantalla del atleta (ver lib/mediciones.js).
  const datos = resumirMediciones(mediciones)
  // ¿Ya hay una medición en la fecha elegida? Cambia el título y el botón.
  const existente = mediciones.find((m) => m.fecha === form.fecha)

  function actualizar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
    setMensaje(null)
  }

  // Carga una medición existente en el formulario para corregirla.
  function editar(m) {
    setForm({
      fecha: m.fecha,
      peso: String(m.peso_corporal_kg ?? ''),
      cintura: String(m.perimetro_cintura_cm ?? ''),
      calorias: String(m.calorias_consumidas ?? ''),
      estado: m.estado_calorico ?? '',
      notas: m.notas ?? '',
    })
    setMensaje({ tipo: 'info', texto: `Editando la medición del ${formatearFecha(m.fecha)}. Al guardar, se reemplaza.` })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ---- Guardar (crear o reemplazar la medición de esa fecha) ----
  async function guardar(evento) {
    evento.preventDefault()
    setMensaje(null)

    const peso = aNumero(form.peso)
    const cintura = aNumero(form.cintura)
    const calorias = aNumero(form.calorias)
    const error = (texto) => setMensaje({ tipo: 'error', texto })

    // Validaciones en el navegador (la base de datos tiene además sus propios CHECK).
    if (!form.fecha) return error('Elige una fecha.')
    if (form.fecha > fechaLocalISO()) return error('La fecha no puede ser futura.')
    if ([peso, cintura, calorias].some(Number.isNaN)) {
      return error('Revisa los números: usa solo dígitos y un punto o coma decimal.')
    }
    if (peso === null && cintura === null && calorias === null) {
      return error('Ingresa al menos un dato: peso, cintura o calorías.')
    }
    if (peso !== null && (peso < 20 || peso > 400)) return error('El peso debe estar entre 20 y 400 kg.')
    if (cintura !== null && (cintura < 30 || cintura > 250)) return error('La cintura debe estar entre 30 y 250 cm.')
    if (calorias !== null && (calorias < 0 || calorias > 10000)) return error('Las calorías deben estar entre 0 y 10.000.')

    setGuardando(true)
    const { error: errorBD } = await supabase.from('metrics').upsert(
      {
        user_id: atletaId,
        fecha: form.fecha,
        peso_corporal_kg: peso,                 // null si el campo estaba vacío
        perimetro_cintura_cm: cintura,
        calorias_consumidas: calorias === null ? null : Math.round(calorias),
        // El <select> vacío da '' y la base de datos solo acepta los 3 valores
        // o NULL. `'' || null` -> null (un texto vacío cuenta como "falso").
        estado_calorico: form.estado || null,
        notas: form.notas.trim() || null,
      },
      // Requiere el índice único (user_id, fecha) de la migración 03.
      { onConflict: 'user_id,fecha' }
    )
    setGuardando(false)

    if (errorBD) {
      error('No se pudo guardar la medición. Inténtalo de nuevo.')
    } else {
      setForm(formVacio())
      setMensaje({ tipo: 'ok', texto: 'Medición guardada.' })
      setVersion((v) => v + 1) // dispara la recarga de la lista
    }
  }

  // ---- Eliminar ----
  async function eliminar(m) {
    if (!window.confirm(`¿Eliminar la medición del ${formatearFecha(m.fecha)}? No se puede deshacer.`)) return
    // .select('id') al final hace que Postgres DEVUELVA las filas borradas.
    // ¿Por qué? Cuando una política RLS impide borrar, NO da error: simplemente
    // borra 0 filas en silencio. Comprobando cuántas volvieron, detectamos el caso.
    const { data, error } = await supabase.from('metrics').delete().eq('id', m.id).select('id')
    if (error || !data || data.length === 0) {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar la medición.' })
    } else {
      setMensaje({ tipo: 'ok', texto: 'Medición eliminada.' })
      setVersion((v) => v + 1)
    }
  }

  const colorMensaje = { error: 'text-alerta', ok: 'text-enlace', info: 'text-suave' }

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-bold">Mediciones</h3>

      <ResumenMediciones resumen={datos} objetivoKcal={planes.find((p) => p.vigente_hasta === null)?.calorias_objetivo ?? null} />

      <GraficoEvolucion mediciones={mediciones} planes={planes} />
      <GraficoOscilacionPeso mediciones={mediciones} />

      <form
        ref={formRef}
        onSubmit={guardar}
        className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4"
      >
        <h4 className="font-semibold">{existente ? 'Actualizar medición' : 'Registrar medición'}</h4>

        <label htmlFor="med-fecha" className="text-sm text-suave">Fecha</label>
        <input
          id="med-fecha" type="date" max={fechaLocalISO()} value={form.fecha}
          onChange={(e) => actualizar('fecha', e.target.value)} className={CAMPO}
        />
        {existente && (
          <p className="text-sm text-alerta">
            Ya hay una medición en esta fecha: al guardar se reemplaza.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="med-peso" className="text-sm text-suave">Peso (kg)</label>
            <input
              id="med-peso" type="text" inputMode="decimal" placeholder="Ej: 82.4"
              value={form.peso} onChange={(e) => actualizar('peso', e.target.value)}
              className={`${CAMPO} mt-1`}
            />
          </div>
          <div>
            <label htmlFor="med-cintura" className="text-sm text-suave">Cintura (cm)</label>
            <input
              id="med-cintura" type="text" inputMode="decimal" placeholder="Ej: 88"
              value={form.cintura} onChange={(e) => actualizar('cintura', e.target.value)}
              className={`${CAMPO} mt-1`}
            />
          </div>
        </div>

        <label htmlFor="med-kcal" className="text-sm text-suave">Calorías consumidas</label>
        <input
          id="med-kcal" type="text" inputMode="numeric" placeholder="Ej: 2600"
          value={form.calorias} onChange={(e) => actualizar('calorias', e.target.value)}
          className={CAMPO}
        />

        <label htmlFor="med-estado" className="text-sm text-suave">Estado calórico</label>
        <select
          id="med-estado" value={form.estado}
          onChange={(e) => actualizar('estado', e.target.value)} className={CAMPO}
        >
          <option value="">Sin definir</option>
          {ESTADOS_CALORICOS.map((e) => (
            <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
          ))}
        </select>

        <label htmlFor="med-notas" className="text-sm text-suave">Notas (opcional)</label>
        <textarea
          id="med-notas" rows={2} maxLength={300} value={form.notas}
          onChange={(e) => actualizar('notas', e.target.value)}
          className="w-full rounded-xl border border-borde-campo bg-fondo p-3"
        />

        {mensaje && (
          <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={colorMensaje[mensaje.tipo]}>
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit" disabled={guardando}
          className="min-h-11 rounded-xl bg-primario px-4 font-semibold text-white disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : existente ? 'Reemplazar medición' : 'Guardar medición'}
        </button>
      </form>

      <div>
        <h4 className="mb-2 font-semibold">Historial</h4>
        {cargando && <p className="text-suave">Cargando mediciones...</p>}
        {errorCarga && <p role="alert" className="text-alerta">{errorCarga}</p>}
        {!cargando && !errorCarga && mediciones.length === 0 && (
          <p className="text-suave">Aún no hay mediciones para este atleta.</p>
        )}
        <ul className="flex flex-col gap-3">
          {mediciones.map((m) => (
            <li key={m.id} className="rounded-2xl border border-borde bg-superficie p-4">
              <p className="font-semibold capitalize">{formatearFecha(m.fecha)}</p>
              <p className="mt-1 text-sm text-suave">{textoMedicion(m)}</p>
              {m.notas && <p className="mt-1 text-sm">{m.notas}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button" onClick={() => editar(m)}
                  className="min-h-11 rounded-xl border border-borde px-4 text-sm font-semibold"
                >
                  Editar
                </button>
                <button
                  type="button" onClick={() => eliminar(m)}
                  className="min-h-11 rounded-xl border border-borde px-4 text-sm font-semibold text-alerta"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
