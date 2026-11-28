// =====================================================================
// src/lib/cargarDescarga.js — pide a Supabase la semana de descarga EN CURSO de un atleta.
//
// La usan las dos zonas (RLS decide qué llega: el atleta solo ve las suyas). "Hoy" es la
// fecha LOCAL (fechaLocalISO / useHoy), nunca UTC. Devuelve { descarga } (null si no hay
// ninguna en curso) o { error } con texto en español.
// =====================================================================
import { supabase } from './supabase'

export async function cargarDescargaVigente(userId, hoy) {
  const { data, error } = await supabase
    .from('deload_weeks')
    .select('id, fecha_inicio, fecha_fin, cancelada_en')
    .eq('user_id', userId)
    .is('cancelada_en', null)
    .lte('fecha_inicio', hoy)
    .gte('fecha_fin', hoy)
    .order('fecha_inicio', { ascending: false })
    .limit(1)
  // errorBD: el error crudo, para que cargarConCache distinga "sin red" de "la base rechazó algo"
  if (error) return { error: 'No se pudo cargar la semana de descarga.', errorBD: error }
  return { descarga: data[0] ?? null }
}
