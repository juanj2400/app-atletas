// useConexion — hook que devuelve true/false según haya conexión y redibuja al cambiar.
import { useSyncExternalStore } from 'react'
import { enLinea, suscribirConexion } from './conexion'

export function useConexion() {
  return useSyncExternalStore(suscribirConexion, enLinea, () => true)
}
