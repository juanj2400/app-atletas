// =====================================================================
// CheckIn — la encuesta diaria previa al entrenamiento. SE LLENA UNA SOLA VEZ AL DÍA.
//
// Secuencia:
//   0) Es OBLIGATORIO: mientras esté pendiente, PantallaAtleta redirige aquí cualquier otra
//      pantalla de la zona del atleta y oculta la barra inferior.
//   1) PantallaAtleta ya sabe si hoy está hecho (viene por el contexto del Outlet).
//   2) Si ya está hecho -> esta pantalla no se muestra: redirige a "Entrenar".
//   3) Si está pendiente -> se muestra el formulario.
//   4) Al guardar se hace un INSERT (ya no upsert). La base de datos solo le permite
//      al atleta CREAR el check-in, nunca modificarlo (migración 05).
//   5) Al terminar, se marca como hecho y se redirige a "Entrenar".
//   6) A las 12 a. m. cambia el día y vuelve a aparecer solo.
// =====================================================================
import { useState } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { aNumero } from '../lib/numeros'
import { registrar } from '../lib/colaOffline'
import { guardarCache } from '../lib/almacenLocal'
import { ANIMOS, CUMPLIMIENTO_CALORIAS } from '../lib/opciones'
import Selector from '../components/Selector'

const SI_NO = [
  { valor: true, etiqueta: 'Sí' },
  { valor: false, etiqueta: 'No' },
]
const OPCIONES_ANIMO = ANIMOS.map((a) => ({ valor: a.valor, etiqueta: `${a.emoji} ${a.etiqueta}` }))
// caloriasAyer: 'cumplio' | 'menos' | 'mas' | null (sin responder)
const OPCIONES_CALORIAS = CUMPLIMIENTO_CALORIAS.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))
const FORM_VACIO = { caloriasAyer: null, horas: '', peso: '', animo: null, recuperado: null }

export default function CheckIn() {
  const { perfil } = useAuth()
  // Datos que nos entrega PantallaAtleta (el "padre" de esta ruta).
  const { hoy, hecho, marcarHecho } = useOutletContext()

  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [recienGuardado, setRecienGuardado] = useState(false)

  if (hecho === null) return <p className="text-suave">Cargando...</p>

  // Ya lo llenó: no se muestra más. `state` lleva un aviso de un solo uso a la pantalla siguiente.
  if (hecho) {
    return <Navigate to="/atleta/entrenar" replace state={{ checkInGuardado: recienGuardado }} />
  }

  function actualizar(campo, valor) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
    setError('')
  }

  async function guardar(evento) {
    evento.preventDefault()
    const horas = Math.round(parseFloat(String(form.horas).replace(',', '.')) * 10) / 10

    if (form.caloriasAyer === null || form.animo === null || form.recuperado === null || Number.isNaN(horas)) {
      return setError('Responde todas las preguntas antes de guardar.')
    }
    if (horas < 0 || horas > 24) return setError('Las horas de sueño deben estar entre 0 y 24.')

    // Peso OPCIONAL: vacío = no lo anotó (null, no es un error); texto raro = NaN (sí es error).
    // El mismo rango de las mediciones oficiales; la base de datos lo vuelve a exigir (migración 18).
    const peso = aNumero(form.peso)
    if (Number.isNaN(peso)) return setError('El peso debe ser un número, por ejemplo 82,4.')
    if (peso !== null && (peso < 20 || peso > 400)) return setError('El peso debe estar entre 20 y 400 kg.')

    setGuardando(true)
    // Con internet se guarda al instante; sin señal queda en el teléfono (cola) y se sube sola al
    // volver la conexión. En ambos casos el atleta puede seguir: el check-in ya está registrado.
    const r = await registrar({
      userId: perfil.id,
      tipo: 'checkin',
      fecha: hoy, // fecha local del celular
      payload: {
        user_id: perfil.id,
        fecha: hoy,
        // Solo se envía la columna nueva: un trigger de la base de datos mantiene al día el sí/no antiguo.
        cumplimiento_calorias: form.caloriasAyer,
        horas_sueno: horas,
        peso_corporal_kg: peso === null ? null : Math.round(peso * 10) / 10, // 1 decimal, como la columna
        estado_animo: form.animo,
        se_siente_recuperado: form.recuperado,
      },
    })
    setGuardando(false)

    // 'subido' incluye el caso "ya existía" (23505: lo llenó desde otro dispositivo): no es un fallo.
    if (r.estado === 'subido' || r.estado === 'en_cola') {
      if (r.estado === 'subido') guardarCache(perfil.id, `checkin:${hoy}`, { hecho: true })
      setRecienGuardado(true)
      marcarHecho()
    } else if (r.estado === 'sin_almacen') {
      setError('Sin conexión y este navegador no puede guardar el check-in en el teléfono. Conéctate e inténtalo de nuevo.')
    } else {
      setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Check-in de hoy</h2>
        <p className="mt-1 text-sm text-suave">
          Respóndelo antes de entrenar. Solo se llena una vez al día y no se puede cambiar después.
        </p>
      </div>

      <fieldset className="rounded-2xl border border-borde bg-superficie p-4">
        <legend className="sr-only">Calorías de ayer</legend>
        <p className="font-semibold">¿Cómo fueron tus calorías de ayer?</p>
        <Selector opciones={OPCIONES_CALORIAS} valor={form.caloriasAyer} onChange={(v) => actualizar('caloriasAyer', v)} vertical />
      </fieldset>

      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <label htmlFor="horas" className="font-semibold">Horas dormidas</label>
        <input
          id="horas"
          type="text"
          inputMode="decimal"
          placeholder="Ej: 7.5"
          value={form.horas}
          onChange={(e) => actualizar('horas', e.target.value)}
          className="mt-3 min-h-11 w-full rounded-xl border border-borde-campo bg-fondo px-3"
        />
      </div>

      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <label htmlFor="peso-checkin" className="font-semibold">
          Peso corporal (kg) <span className="font-normal text-suave">· opcional</span>
        </label>
        <input
          id="peso-checkin"
          type="text"
          inputMode="decimal"
          placeholder="Ej: 82,4"
          value={form.peso}
          onChange={(e) => actualizar('peso', e.target.value)}
          className="mt-3 min-h-11 w-full rounded-xl border border-borde-campo bg-fondo px-3"
        />
        <p className="mt-2 text-xs text-suave">
          Tu entrenador lo verá en tu check-in. No reemplaza sus mediciones oficiales y no se puede cambiar después.
        </p>
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

      {error && <p role="alert" className="text-alerta">{error}</p>}

      <button
        type="submit"
        disabled={guardando}
        className="min-h-11 rounded-xl bg-primario px-4 font-semibold text-white disabled:opacity-60"
      >
        {guardando ? 'Guardando...' : 'Guardar check-in'}
      </button>
    </form>
  )
}
