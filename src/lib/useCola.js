// =====================================================================
// src/lib/useCola.js — hooks de la cola offline.
//
//   useCola(userId)          -> { pendientes, errores, primerError, sincronizando, subidos }
//                               `subidos` sube de número cada vez que se sube algo: úsalo como
//                               dependencia de un useEffect para recargar la pantalla.
//   useSincronizacion(userId)-> arranca la subida automática (al abrir la app, al volver el
//                               internet, al volver a la app y cada 30 s mientras haya pendientes).
// =====================================================================
import { useCallback, useEffect, useState } from 'react'
import { enLinea } from './conexion'
import { estaSincronizando, resumenCola, sincronizarCola, suscribirCola } from './colaOffline'

const VACIO = { pendientes: 0, errores: 0, primerError: null }

export function useCola(userId) {
  const [resumen, setResumen] = useState(VACIO)
  const [sincronizando, setSincronizando] = useState(estaSincronizando())
  const [subidos, setSubidos] = useState(0)

  const refrescar = useCallback(() => {
    resumenCola(userId).then(setResumen)
  }, [userId])

  useEffect(() => {
    refrescar()
    return suscribirCola((evento) => {
      if (evento.tipo === 'inicio') setSincronizando(true)
      if (evento.tipo === 'fin') {
        setSincronizando(false)
        if (evento.subidos > 0) setSubidos((n) => n + 1)
      }
      refrescar()
    })
  }, [refrescar])

  return { ...resumen, sincronizando, subidos }
}

const CADA_CUANTO_MS = 30 * 1000

export function useSincronizacion(userId) {
  useEffect(() => {
    const intentar = () => { if (enLinea()) sincronizarCola(userId) }
    intentar() // al abrir la app: lo que quedó pendiente de la vez anterior
    window.addEventListener('online', intentar)
    const alVolver = () => { if (document.visibilityState === 'visible') intentar() }
    document.addEventListener('visibilitychange', alVolver)
    const intervalo = setInterval(intentar, CADA_CUANTO_MS) // reintento si la señal volvió sin avisar
    return () => {
      window.removeEventListener('online', intentar)
      document.removeEventListener('visibilitychange', alVolver)
      clearInterval(intervalo)
    }
  }, [userId])
}
