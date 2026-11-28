// =====================================================================
// src/lib/usePlanVigente.js — hook: lee el plan nutricional VIGENTE de un atleta.
//
// Es la referencia única de "Comidas del día": calorías, macros y (si existen) los datos del
// configurador. Pide UNA sola fila con las columnas mínimas. Vuelve a leer cuando `version` sube
// (la ficha la sube cada vez que se guarda un plan). Mientras relee, conserva el plan anterior
// para que la pantalla no parpadee.
//
// Devuelve { plan (fila o null si no hay), cargando (solo la primera vez), error }.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const COLUMNAS_PLAN_VIGENTE =
  'id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g, objetivo_calorico, objetivo_fisico, intensidad, tipo_dieta, vigente_desde'

export function usePlanVigente(atletaId, version = 0) {
  const [estado, setEstado] = useState({ plan: null, cargando: true, error: '' })

  useEffect(() => {
    let cancelado = false
    supabase
      .from('nutrition_plans')
      .select(COLUMNAS_PLAN_VIGENTE)
      .eq('user_id', atletaId)
      .is('vigente_hasta', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) setEstado((e) => ({ ...e, cargando: false, error: 'No se pudo leer el plan nutricional.' }))
        else setEstado({ plan: data, cargando: false, error: '' })
      })
    return () => { cancelado = true }
  }, [atletaId, version])

  return estado
}
