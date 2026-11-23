// =====================================================================
// ListaNegraAtleta — ejercicios que NO deben asignarse ni sugerirse a UN atleta
// (lesión, molestia, ineficiente para él...). Solo la ve el entrenador.
//
// Qué provoca estar en esta lista:
//   - El editor de rutinas ADVIERTE si intentas agregar uno de estos ejercicios.
//   - La IA no podrá sugerir cargas de estos ejercicios (lo impide un trigger de la base de datos).
// No elimina automáticamente el ejercicio de rutinas ya armadas: eso lo decides tú.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import { fechaCortaDeTimestamp } from '../lib/records'
import SelectorEjercicio from './SelectorEjercicio'

export default function ListaNegraAtleta({ atletaId }) {
  const { perfil } = useAuth()
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [eligiendo, setEligiendo] = useState(false)   // ¿está abierto el buscador?
  const [elegido, setElegido] = useState(null)        // ejercicio elegido, pendiente de confirmar
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('athlete_exercise_blacklist')
      .select('id, exercise_id, motivo, created_at, exercises ( nombre, grupo_muscular )')
      .eq('user_id', atletaId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setErrorCarga('No se pudo cargar la lista negra.')
        else { setItems(data); setErrorCarga('') }
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId, version])

  const idsEnLista = new Set(items.map((i) => i.exercise_id))

  function elegir(ejercicio) {
    if (idsEnLista.has(ejercicio.id)) {
      setMensaje({ tipo: 'error', texto: `${ejercicio.nombre} ya está en la lista negra.` })
      return
    }
    setElegido(ejercicio)
    setEligiendo(false)
    setMotivo('')
    setMensaje(null)
  }

  async function confirmar() {
    setGuardando(true)
    const { error } = await supabase.from('athlete_exercise_blacklist').insert({
      user_id: atletaId,
      exercise_id: elegido.id,
      motivo: motivo.trim() || null,
      creado_por: perfil.id,
    })
    setGuardando(false)
    if (error) {
      return setMensaje({
        tipo: 'error',
        texto: error.code === '23505' ? 'Ese ejercicio ya estaba en la lista negra.' : 'No se pudo agregar el ejercicio.',
      })
    }
    setMensaje({ tipo: 'ok', texto: `${elegido.nombre} agregado a la lista negra.` })
    setElegido(null)
    setVersion((v) => v + 1)
  }

  async function quitar(item) {
    if (!window.confirm(`¿Quitar "${item.exercises.nombre}" de la lista negra?`)) return
    const { data, error } = await supabase.from('athlete_exercise_blacklist').delete().eq('id', item.id).select('id')
    if (error || !data || data.length === 0) return setMensaje({ tipo: 'error', texto: 'No se pudo quitar el ejercicio.' })
    setMensaje({ tipo: 'ok', texto: 'Ejercicio quitado de la lista negra.' })
    setVersion((v) => v + 1)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Lista negra de ejercicios</h3>
      <p className="text-sm text-suave">
        Ejercicios que no deben asignarse ni sugerirse a este atleta. El editor de rutinas te avisará si intentas usarlos.
      </p>

      {cargando && <p className="text-suave">Cargando...</p>}
      {errorCarga && <p role="alert" className="text-alerta">{errorCarga}</p>}

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={mensaje.tipo === 'error' ? 'text-alerta' : 'text-enlace'}>
          {mensaje.texto}
        </p>
      )}

      {!cargando && !errorCarga && (
        <>
          {items.length === 0 && <p className="text-suave">Este atleta no tiene ejercicios en la lista negra.</p>}
          <ul className="flex flex-col gap-2">
            {items.map((i) => (
              <li key={i.id} className={`${TARJETA} flex items-start justify-between gap-3`}>
                <div>
                  <p className="font-semibold">{i.exercises.nombre}</p>
                  <p className="text-sm text-suave">{i.exercises.grupo_muscular || 'Sin grupo'} · desde el {fechaCortaDeTimestamp(i.created_at)}</p>
                  {i.motivo && <p className="mt-1 text-sm">Motivo: {i.motivo}</p>}
                </div>
                <button type="button" onClick={() => quitar(i)} className={`${BOTON_SEC} text-alerta`}>Quitar</button>
              </li>
            ))}
          </ul>

          {eligiendo && (
            <SelectorEjercicio
              listaNegra={idsEnLista} onElegir={elegir} onCerrar={() => setEligiendo(false)}
              avisarRestringidos={false} textoBoton="Elegir" titulo="Elegir ejercicio para la lista negra"
            />
          )}

          {elegido && (
            <div className={`${TARJETA} flex flex-col gap-3`}>
              <p className="font-semibold">Agregar: {elegido.nombre}</p>
              <label htmlFor="ln-motivo" className="text-sm text-suave">Motivo (opcional)</label>
              <input id="ln-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
                placeholder="Ej: molestia en el hombro" className={CAMPO} />
              <div className="flex gap-2">
                <button type="button" onClick={confirmar} disabled={guardando} className={BOTON}>
                  {guardando ? 'Guardando...' : 'Agregar a la lista negra'}
                </button>
                <button type="button" onClick={() => setElegido(null)} className={BOTON_SEC}>Cancelar</button>
              </div>
            </div>
          )}

          {!eligiendo && !elegido && (
            <button type="button" onClick={() => { setMensaje(null); setEligiendo(true) }} className={BOTON_SEC}>
              Agregar ejercicio a la lista negra
            </button>
          )}
        </>
      )}
    </section>
  )
}
