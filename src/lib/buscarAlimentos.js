// =====================================================================
// src/lib/buscarAlimentos.js — consultas LIGERAS al catálogo de alimentos (tabla `foods`).
//
// Regla de oro: nunca se descarga el catálogo completo. Cada consulta pide solo las columnas
// necesarias, filtra y limita en el servidor (`ilike` sobre `nombre_busqueda`, que ya viene sin
// tildes ni mayúsculas) y devuelve pocas filas. Así se cuida el plan gratuito de Supabase.
//
// Todas devuelven { alimentos } / { alimento } o { error } (texto en español).
// =====================================================================
import { supabase } from './supabase'
import { terminosBusqueda } from './alimentos'

// Columnas mínimas para mostrar, elegir y calcular un alimento.
export const COLUMNAS_ALIMENTO =
  'id, nombre, categoria, estado, calorias, proteina_g, carbohidratos_g, grasas_g, macro_dominante, activo'

// Busca alimentos.
//   texto        palabras a buscar en el nombre (todas deben aparecer); '' = sin filtro de nombre
//   categoria    '' o un valor de CATEGORIAS
//   estado       '' o 'crudo' | 'cocido' | 'n/a'
//   limite       máximo de filas (por defecto 20)
//   soloActivos  true: oculta los alimentos desactivados
export async function buscarAlimentos({ texto = '', categoria = '', estado = '', limite = 20, soloActivos = true } = {}) {
  let consulta = supabase
    .from('foods')
    .select(COLUMNAS_ALIMENTO)
    .order('nombre', { ascending: true })
    .order('estado', { ascending: true })
    .limit(limite)

  for (const palabra of terminosBusqueda(texto)) consulta = consulta.ilike('nombre_busqueda', `%${palabra}%`)
  if (categoria) consulta = consulta.eq('categoria', categoria)
  if (estado) consulta = consulta.eq('estado', estado)
  if (soloActivos) consulta = consulta.eq('activo', true)

  const { data, error } = await consulta
  if (error) return { error: 'No se pudo buscar en el catálogo de alimentos.' }
  return { alimentos: data }
}

// Busca LA variante de un alimento en otro estado (p. ej. "Arroz blanco" crudo -> cocido), para
// el botón "Cambiar a cocido/crudo". Es una consulta de UNA sola fila.
// Devuelve { alimento } (null si no existe esa variante) o { error }.
export async function buscarVariante(nombre, estado) {
  const { data, error } = await supabase
    .from('foods')
    .select(COLUMNAS_ALIMENTO)
    .eq('nombre', nombre)
    .eq('estado', estado)
    .eq('activo', true)
    .limit(1)
  if (error) return { error: 'No se pudo buscar esa variante del alimento.' }
  return { alimento: data[0] ?? null }
}
