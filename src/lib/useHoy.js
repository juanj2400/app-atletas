// =====================================================================
// useHoy — un "hook" propio que devuelve la fecha de HOY (hora del celular)
// y se actualiza SOLO cuando cambia el día, aunque la app esté abierta.
//
// ¿Por qué hace falta? Sin esto, si el atleta deja la app abierta de noche, a
// las 12:00 a. m. la pantalla seguiría creyendo que es "ayer" y no volvería a
// ofrecer el check-in del día nuevo.
//
// Cómo funciona:
//  - Cada minuto recalcula la fecha (setInterval).
//  - También la recalcula cuando el atleta vuelve a la app (visibilitychange),
//    porque los celulares congelan los temporizadores de las apps en segundo plano.
//  - Si la fecha no cambió, setHoy recibe el mismo texto y React NO redibuja nada.
// =====================================================================
import { useEffect, useState } from 'react'
import { fechaLocalISO } from './fechas'

export function useHoy() {
  const [hoy, setHoy] = useState(() => fechaLocalISO())

  useEffect(() => {
    const actualizar = () => setHoy(fechaLocalISO())
    const intervalo = setInterval(actualizar, 60_000) // 60_000 ms = 1 minuto
    document.addEventListener('visibilitychange', actualizar)
    // Limpieza: al salir de la pantalla se cancelan el temporizador y el listener.
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', actualizar)
    }
  }, [])

  return hoy
}
