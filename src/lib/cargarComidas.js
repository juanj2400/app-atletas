// =====================================================================
// src/lib/cargarComidas.js — pide a Supabase las comidas del día de UN atleta.
//
// Lo usan las dos zonas (el atleta lee las suyas; el entrenador carga las del atleta que está
// editando): las políticas RLS deciden qué filas llegan, así que la misma consulta sirve a ambos.
// Son dos consultas planas (comidas y alimentos) que se unen en el cliente con `armarComidas`.
// Con los topes de la base (10 comidas × 30 alimentos) nunca se acerca al límite de 1.000 filas.
//
// Devuelve { comidas } o { error } (texto ya en español, sin detalles técnicos).
// =====================================================================
import { supabase } from './supabase'
import { armarComidas } from './comidas'

export async function cargarComidas(userId) {
  const [c, a] = await Promise.all([
    supabase.from('meals')
      .select('id, nombre, notas, orden, created_at')
      .eq('user_id', userId)
      .order('orden', { ascending: true }),
    supabase.from('meal_foods')
      // Incluye el snapshot de la migración 25 (estado y macros base/asignados).
      .select('id, meal_id, alimento, cantidad, unidad, nota, orden, food_id, estado, base_calorias, base_proteina_g, base_carbohidratos_g, base_grasas_g, calorias, proteina_g, carbohidratos_g, grasas_g')
      .eq('user_id', userId)
      .order('orden', { ascending: true }),
  ])
  // errorBD: el error crudo, para que cargarConCache distinga "sin red" de "la base rechazó algo"
  if (c.error || a.error) return { error: 'No se pudieron cargar las comidas.', errorBD: c.error ?? a.error }
  return { comidas: armarComidas(c.data, a.data) }
}
