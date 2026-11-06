// =====================================================================
// src/lib/supabase.js — LA conexión con tu base de datos.
//
// Se crea UNA sola vez y todo el proyecto la importa:
//     import { supabase } from '../lib/supabase'
//
// ¿Qué es supabase-js? Una librería que traduce tus órdenes de JavaScript a
// peticiones HTTP hacia Supabase. Cuando escribes:
//     supabase.from('profiles').select('*')
// por debajo hace un GET a https://TU-PROYECTO.supabase.co/rest/v1/profiles
// (esa API la genera Supabase automáticamente con PostgREST a partir de tus
// tablas). Tú no escribes servidor ni endpoints: ¡esa es la ventaja de este stack!
//
// ¿Por qué es seguro poner la clave en el frontend?
//  - Todo lo que va en React lo puede ver cualquiera (clic derecho > inspeccionar).
//  - Por eso aquí SOLO va la clave pública. Por sí sola no permite nada: lo que
//    puede leer/escribir cada persona lo deciden las políticas RLS que creamos
//    en la base de datos. La clave secreta (service_role) y la de Gemini viven
//    únicamente en el servidor (Edge Function) y JAMÁS en este proyecto.
//
// Las variables VITE_* se leen de tu archivo .env. Vite SOLO expone al navegador
// las que empiezan con VITE_ (así no se filtra por accidente otro secreto).
// =====================================================================
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clavePublica = import.meta.env.VITE_SUPABASE_KEY

if (!url || !clavePublica) {
  // Fallar fuerte y con un mensaje claro es mejor que un error misterioso después.
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY. Copia .env.example a .env y rellénalo.'
  )
}

export const supabase = createClient(url, clavePublica)
