// =====================================================================
// CheckIn — la encuesta diaria previa al entrenamiento.
// Es la PRIMERA pantalla que ESCRIBE datos en Supabase.
//
// Secuencia completa:
//   1) Al aparecer: buscamos si el atleta ya hizo su check-in HOY.
//        - Si existe: rellenamos el formulario con esas respuestas.
//        - Si no: formulario vacío.
//   2) El atleta responde; cada toque actualiza el estado `form`.
//   3) Al pulsar "Guardar": validamos en el navegador (respuesta rápida).
//   4) Enviamos con upsert: crea la fila o, si ya existe la de hoy, la corrige.
//   5) Supabase/Postgres revisa la política RLS: solo permite si user_id es el tuyo.
//   6) Mostramos éxito o error.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { fechaLocalISO } from '../lib/fechas'
import { ANIMOS } from '../lib/opciones'
import Selector from '../components/Selector'

// Opciones fuera del componente: son constantes y no deben recrearse en cada dibujado.
const SI_NO = [
  { valor: true, etiqueta: 'Sí' },
  { valor: false, etiqueta: 'No' },
]
const OPCIONES_ANIMO = ANIMOS.map((a) => ({ valor: a.valor, etiqueta: `${a.emoji} ${a.etiqueta}` }))

// `null` significa "aún no respondió". Es distinto de `false` ("respondió que no").
// Esa diferencia importa: por eso no usamos false como valor inicial.
const FORM_VACIO = { caloriasAyer: null, horas: '', animo: null, recuperado: null }

export default function CheckIn() {
  const { perfil } = useAuth()
  const hoy = fechaLocalISO()

  const [form, setForm] = useState(FORM_VACIO)
  const [yaExiste, setYaExiste] = useState(false)   // ¿ya envió el de hoy?
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)      // { tipo: 'ok' | 'error', texto }

  // Paso 1: cargar el check-in de hoy (si existe).
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const { data, error } = await supabase
        .from('daily_check_ins')
        .select('calorias_ayer_cumplidas, horas_sueno, estado_animo, se_siente_recuperado')
        .eq('user_id', perfil.id)
        .eq('fecha', hoy)
        // maybeSingle(): devuelve la fila, o null si no hay ninguna (sin error).
        // single() en cambio daría error cuando no hay fila, y "no hay check-in
        // todavía" es una situación NORMAL, no un error.
        .maybeSingle()
      if (cancelado) return
      if (error) {
        setMensaje({ tipo: 'error', texto: 'No se pudo cargar tu check-in de hoy.' })
      } else if (data) {
        setForm({
          caloriasAyer: data.calorias_ayer_cumplidas,
          horas: data.horas_sueno === null ? '' : String(data.horas_sueno),
          animo: data.estado_animo,
          recuperado: data.se_siente_recuperado,
        })
        setYaExiste(true)
      }
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [perfil.id, hoy])

  // Actualiza UN campo sin perder los demás.
  // - setForm((anterior) => ...) recibe el estado más reciente (forma segura).
  // - { ...anterior } copia todos los campos; [campo]: valor sobrescribe solo uno.
  //   En React NUNCA se modifica el estado directamente: siempre se crea una copia nueva.
  function actualizar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
    setMensaje(null)
  }

  // Pasos 3 a 6
  async function guardar(evento) {
    evento.preventDefault()
    setMensaje(null)

    // Teclados en español escriben "7,5" con coma: la convertimos a punto.
    const horas = Math.round(parseFloat(String(form.horas).replace(',', '.')) * 10) / 10

    // Validación en el navegador: da respuesta inmediata y evita viajes inútiles.
    // (La base de datos TAMBIÉN valida con sus CHECK: es la barrera definitiva.)
    if (
      form.caloriasAyer === null || form.animo === null ||
      form.recuperado === null || Number.isNaN(horas)
    ) {
      setMensaje({ tipo: 'error', texto: 'Responde todas las preguntas antes de guardar.' })
      return
    }
    if (horas < 0 || horas > 24) {
      setMensaje({ tipo: 'error', texto: 'Las horas de sueño deben estar entre 0 y 24.' })
      return
    }

    setGuardando(true)
    const { error } = await supabase.from('daily_check_ins').upsert(
      {
        user_id: perfil.id, // la política RLS exige que sea TU id
        fecha: hoy,         // fecha local del celular (ver lib/fechas.js)
        calorias_ayer_cumplidas: form.caloriasAyer,
        horas_sueno: horas,
        estado_animo: form.animo,
        se_siente_recuperado: form.recuperado,
      },
      // upsert = "insert o update". onConflict le dice a Postgres qué columnas
      // identifican "el mismo registro": la restricción unique (user_id, fecha)
      // que creamos en la tabla. Mismo atleta + mismo día = corregir, no duplicar.
      { onConflict: 'user_id,fecha' }
    )
    setGuardando(false)

    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' })
    } else {
      setYaExiste(true)
      setMensaje({ tipo: 'ok', texto: 'Check-in guardado. ¡Buen entrenamiento!' })
    }
  }

  if (cargando) return <p className="text-suave">Cargando tu check-in...</p>

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Check-in de hoy</h2>
        <p className="mt-1 text-sm text-suave">
          {yaExiste
            ? 'Ya enviaste tu check-in de hoy. Puedes corregirlo y volver a guardar.'
            : 'Respóndelo antes de entrenar. Toma menos de un minuto.'}
        </p>
      </div>

      <fieldset className="rounded-2xl border border-borde bg-superficie p-4">
        <legend className="sr-only">Calorías de ayer</legend>
        <p className="font-semibold">¿Cumpliste las calorías de ayer?</p>
        <Selector opciones={SI_NO} valor={form.caloriasAyer} onChange={(v) => actualizar('caloriasAyer', v)} />
      </fieldset>

      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <label htmlFor="horas" className="font-semibold">Horas dormidas</label>
        <input
          id="horas"
          type="text"
          // inputMode="decimal" abre el teclado numérico del celular con punto/coma.
          // Usamos type="text" porque type="number" se comporta distinto según el
          // navegador y el idioma cuando el usuario escribe decimales con coma.
          inputMode="decimal"
          placeholder="Ej: 7.5"
          value={form.horas}
          onChange={(e) => actualizar('horas', e.target.value)}
          className="mt-3 min-h-11 w-full rounded-xl border border-[#5B6372] bg-fondo px-3"
        />
      </div>

      <fieldset className="rounded-2xl border border-borde bg-superficie p-4">
        <legend className="sr-only">Estado de ánimo</legend>
        <p className="font-semibold">¿Cómo te sientes hoy?</p>
        <Selector opciones={OPCIONES_ANIMO} valor={form.animo} onChange={(v) => actualizar('animo', v)} />
      </fieldset>

      <fieldset className="rounded-2xl border border-borde bg-superficie p-4">
        <legend className="sr-only">Recuperación</legend>
        <p className="font-semibold">¿Te sientes recuperado?</p>
        <Selector opciones={SI_NO} valor={form.recuperado} onChange={(v) => actualizar('recuperado', v)} />
      </fieldset>

      {mensaje && (
        <p
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={mensaje.tipo === 'error' ? 'text-alerta' : 'text-enlace'}
        >
          {mensaje.texto}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="min-h-11 rounded-xl bg-primario px-4 font-semibold text-white disabled:opacity-60"
      >
        {guardando ? 'Guardando...' : yaExiste ? 'Actualizar check-in' : 'Guardar check-in'}
      </button>
    </form>
  )
}
