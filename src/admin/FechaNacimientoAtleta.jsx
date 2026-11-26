// =====================================================================
// FechaNacimientoAtleta — fecha de nacimiento en la ficha del atleta (solo el entrenador).
// Se guarda con la RPC set_fecha_nacimiento (migración 19): la base de datos comprueba que
// quien llama sea admin y rechaza fechas futuras o anteriores a 1900. La validación de aquí
// es solo comodidad; la barrera real es la de la base de datos.
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHoy } from '../lib/useHoy'
import { formatearFechaConAnio } from '../lib/fechas'
import { edadEnFecha, validarFechaNacimiento } from '../lib/cumpleanos'
import { CAMPO, BOTON, BOTON_SEC } from '../lib/estilos'

export default function FechaNacimientoAtleta({ atletaId, valor, onGuardado }) {
  const hoy = useHoy()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function abrir() {
    setTexto(valor ?? '')
    setError('')
    setEditando(true)
  }

  // fecha: "YYYY-MM-DD" o null (quitar la fecha)
  async function guardar(fecha) {
    const mensaje = validarFechaNacimiento(fecha ?? '', hoy)
    if (mensaje) return setError(mensaje)
    setGuardando(true)
    setError('')
    const { error: err } = await supabase.rpc('set_fecha_nacimiento', { p_atleta: atletaId, p_fecha: fecha })
    setGuardando(false)
    if (err) {
      // P0001 = mensaje ya redactado en español por la función; lo demás, texto genérico.
      return setError(err.code === 'P0001' ? err.message : 'No se pudo guardar la fecha. Intenta de nuevo.')
    }
    setEditando(false)
    onGuardado(fecha)
  }

  if (!editando) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <p className="text-suave">
          Nacimiento:{' '}
          {valor ? (
            <span className="text-texto">
              {formatearFechaConAnio(valor)} · {edadEnFecha(valor, hoy)} años
            </span>
          ) : (
            'sin anotar'
          )}
        </p>
        <button type="button" onClick={abrir} className="min-h-11 font-semibold text-enlace">
          {valor ? 'Editar' : 'Agregar'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4">
      <label htmlFor="fecha-nacimiento" className="text-sm text-suave">
        Fecha de nacimiento
      </label>
      <input
        id="fecha-nacimiento"
        type="date"
        min="1900-01-01"
        max={hoy}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className={CAMPO}
      />
      {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={guardando || texto === ''} onClick={() => guardar(texto)} className={BOTON}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" disabled={guardando} onClick={() => setEditando(false)} className={BOTON_SEC}>
          Cancelar
        </button>
        {valor && (
          <button type="button" disabled={guardando} onClick={() => guardar(null)} className={`${BOTON_SEC} text-alerta`}>
            Quitar fecha
          </button>
        )}
      </div>
    </div>
  )
}
