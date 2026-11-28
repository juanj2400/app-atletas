// =====================================================================
// DescargaAtleta — el entrenador activa o cancela la semana de descarga de UN atleta.
// Va en la pestaña Entrenamiento de la ficha, junto a las rutinas.
//
// Activar: empieza HOY (fecha local) y dura 7 días. Las reglas son fijas (lib/descarga.js).
// Cancelar: el atleta vuelve de inmediato a su rutina y progresión normales.
// Toda escritura pasa por las RPC activar_descarga / cancelar_descarga (migración 24).
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHoy } from '../lib/useHoy'
import { formatearFechaCorta, fechaLocalISO } from '../lib/fechas'
import { BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import { REGLAS_DESCARGA, descargaVigente, estadoDescarga, textoVentanaDescarga } from '../lib/descarga'

const TEXTO_ESTADO = { activa: 'En curso', programada: 'Programada', finalizada: 'Finalizada', cancelada: 'Cancelada' }

export default function DescargaAtleta({ atletaId }) {
  const hoy = useHoy()
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelado = false
    supabase
      .from('deload_weeks')
      .select('id, fecha_inicio, fecha_fin, cancelada_en')
      .eq('user_id', atletaId)
      .order('fecha_inicio', { ascending: false })
      .limit(5)
      .then(({ data, error: errorBD }) => {
        if (cancelado) return
        if (errorBD) setError('No se pudo cargar la semana de descarga.')
        else { setLista(data); setError('') }
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [atletaId, version])

  const vigente = descargaVigente(lista, hoy)

  async function activar() {
    if (!window.confirm('¿Activar una semana de descarga que empieza hoy y dura 7 días? El atleta verá menos series y menos carga en su rutina actual.')) return
    setTrabajando(true)
    setError('')
    const { error: errorBD } = await supabase.rpc('activar_descarga', { p_user_id: atletaId, p_fecha_inicio: fechaLocalISO() })
    setTrabajando(false)
    // P0001 = mensaje ya redactado en español por la función de la base de datos
    if (errorBD) setError(errorBD.code === 'P0001' ? errorBD.message : 'No se pudo activar la semana de descarga.')
    else setVersion((v) => v + 1)
  }

  async function cancelar() {
    if (!window.confirm('¿Cancelar la semana de descarga? El atleta vuelve ahora mismo a su rutina normal.')) return
    setTrabajando(true)
    setError('')
    const { error: errorBD } = await supabase.rpc('cancelar_descarga', { p_user_id: atletaId })
    setTrabajando(false)
    if (errorBD) setError(errorBD.code === 'P0001' ? errorBD.message : 'No se pudo cancelar la semana de descarga.')
    else setVersion((v) => v + 1)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-bold">Semana de descarga</h3>

      <div className={`${TARJETA} flex flex-col gap-3`}>
        {cargando ? (
          <p className="text-suave">Cargando...</p>
        ) : vigente ? (
          <>
            <p role="status" className="font-semibold text-alerta">En curso · {textoVentanaDescarga(vigente, hoy)}</p>
            <button type="button" onClick={cancelar} disabled={trabajando} className={BOTON_SEC}>
              {trabajando ? 'Cancelando...' : 'Cancelar descarga'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-suave">Aplica una semana más liviana sobre la rutina actual sin cambiarla. Empieza hoy y dura 7 días.</p>
            <button type="button" onClick={activar} disabled={trabajando} className={BOTON}>
              {trabajando ? 'Activando...' : 'Activar semana de descarga'}
            </button>
          </>
        )}
        {error && <p role="alert" className="text-sm text-alerta">{error}</p>}

        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 text-enlace">Reglas que se aplican</summary>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-suave">
            {REGLAS_DESCARGA.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </details>
      </div>

      {!cargando && lista.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lista.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-borde bg-hundido px-3 py-2 text-sm">
              <span>{formatearFechaCorta(d.fecha_inicio)} – {formatearFechaCorta(d.fecha_fin)}</span>
              <span className="text-suave">{TEXTO_ESTADO[estadoDescarga(d, hoy)]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
