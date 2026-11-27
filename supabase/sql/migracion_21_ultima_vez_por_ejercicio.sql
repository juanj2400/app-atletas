-- =====================================================================
-- Migración 21 — "Última vez" de cada ejercicio sin cortes en rutinas de larga duración
--
-- Problema que resuelve: la progresión automática calcula la meta del día con las series
-- de la ÚLTIMA sesión de cada ejercicio. La app las pedía con un tope global de filas
-- (150 en la pantalla del atleta, 800 en la ficha del entrenador) ordenadas por fecha. Con una
-- rutina que dura meses, un ejercicio que el atleta dejó de entrenar unas semanas podía
-- quedar fuera de esas filas, y la app creía que nunca lo había hecho: la meta volvía al
-- inicio (reps mínimas y peso inicial) y se "cortaba" la progresión.
--
-- Qué hace: crea la función `ultimas_series_por_ejercicio`, que devuelve las N series más
-- recientes DE CADA ejercicio por separado (N = 40 por defecto, suficiente para una sesión
-- completa: el tope por ejercicio es de 20 series). Así el historial de un ejercicio nunca
-- depende de cuánto entrenó el atleta los demás.
--
-- Seguridad: es `security invoker`, es decir, se ejecuta con los permisos de quien la llama.
-- Las políticas RLS de `routine_logs` siguen mandando: el atleta solo recibe lo suyo y el
-- entrenador lo de cualquiera. No da acceso nuevo a nada.
--
-- Esta migración NO elimina nada (solo crea una función). No cambia tablas ni datos.
-- =====================================================================
create or replace function public.ultimas_series_por_ejercicio(
  p_user_id      uuid,
  p_exercise_ids uuid[],
  p_antes        timestamptz default null,  -- si se indica, solo series anteriores a este instante
  p_max          integer     default 40     -- series por ejercicio (se limita entre 1 y 100)
)
returns setof public.routine_logs
language sql
stable
security invoker
set search_path = ''
as $$
  select l.*
  from unnest(p_exercise_ids) as e(exercise_id)
  cross join lateral (
    select r.*
    from public.routine_logs r
    where r.user_id = p_user_id
      and r.exercise_id = e.exercise_id
      and (p_antes is null or r.realizado_en < p_antes)
    order by r.realizado_en desc, r.numero_serie desc
    limit least(greatest(coalesce(p_max, 40), 1), 100)
  ) as l
  order by l.exercise_id, l.realizado_en desc, l.numero_serie desc;
$$;

revoke all on function public.ultimas_series_por_ejercicio(uuid, uuid[], timestamptz, integer) from public, anon;
grant execute on function public.ultimas_series_por_ejercicio(uuid, uuid[], timestamptz, integer) to authenticated;
