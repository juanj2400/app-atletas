// =====================================================================
// src/lib/cargarPesoReciente.js — el peso más reciente conocido de un atleta.
//
// Para precargar el configurador del plan nutricional. Pide solo UNA fila de cada fuente
// (mediciones oficiales y check-in diario) y se queda con la más nueva; si el mismo día hay
// medición oficial, manda esa (misma regla que lib/pesoCombinado.js). No copia nada a `metrics`.
// Devuelve { peso (número o null), fecha, origen: 'oficial' | 'checkin' | null } o { error }.
// =====================================================================
import { supabase } from './supabase'
import { combinarPesos } from './pesoCombinado'

export async function cargarPesoReciente(atletaId) {
  const ultimo = (tabla) => supabase
    .from(tabla)
    .select('fecha, peso_corporal_kg')
    .eq('user_id', atletaId)
    .not('peso_corporal_kg', 'is', null)
    .order('fecha', { ascending: false })
    .limit(1)
  const [oficial, checkin] = await Promise.all([ultimo('metrics'), ultimo('daily_check_ins')])
  if (oficial.error || checkin.error) return { error: 'No se pudo leer el peso del atleta.' }
  const [masReciente] = combinarPesos(oficial.data, checkin.data)
  return masReciente
    ? { peso: Number(masReciente.peso_corporal_kg), fecha: masReciente.fecha, origen: masReciente.origen }
    : { peso: null, fecha: null, origen: null }
}
