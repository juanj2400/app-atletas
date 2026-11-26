-- =====================================================================
-- MIGRACIÓN 12: tope de series por ejercicio y RPE opcional por ejercicio
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- Requiere las migraciones 04 (rutinas) y 11 (progresión).
-- ORDEN: primero este SQL y DESPUÉS subir el código (el código nuevo pide la columna
-- pide_rpe; sin ella, el editor de rutinas y la pantalla de entrenar darían error).
--
-- Qué hace:
--   1) routine_exercises.pide_rpe: el entrenador decide, ejercicio por ejercicio, si el
--      atleta debe anotar el RPE. Por defecto es true, así que todo lo que ya existe
--      sigue pidiendo RPE como hasta ahora.
--   2) Un trigger que impide guardar más series de las prescritas para un ejercicio en un
--      mismo entrenamiento (sesion_id). La pantalla del atleta ya lo evita; esto es la
--      barrera real (por ejemplo, ante un doble toque en "Guardar serie" o dos teléfonos).
--      - Progresión 'ninguna' y 'doble': el tope es el campo "series" del ejercicio.
--      - Progresión 'escalera': el tope exacto de cada día lo calcula la app (depende de lo
--        que hizo el atleta la vez anterior); aquí se usa como tope el mayor número de series
--        de la escalera (o "series", si es mayor).
--      Límite conocido: el control es por sesion_id, y quien manipule la app a mano puede
--      mandar otro sesion_id. Sirve para evitar errores, no para frenar a un atacante; los
--      datos de un atleta solo le afectan a él mismo.
--   3) duplicate_routine ahora también copia pide_rpe (misma función de la migración 11).
--
-- Esta migración NO elimina nada: no contiene drop ni delete, así que el SQL Editor no
-- debería mostrar el aviso "Potential issue detected".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ¿Este ejercicio pide RPE al atleta?
-- ---------------------------------------------------------------------
alter table public.routine_exercises
  add column if not exists pide_rpe boolean not null default true;


-- ---------------------------------------------------------------------
-- 2. Tope de series por ejercicio y entrenamiento
--    security definer: debe contar TODAS las series del entrenamiento y leer el ejercicio
--    de la rutina aunque las políticas RLS del atleta limiten lo que ve.
-- ---------------------------------------------------------------------
create or replace function public.limitar_series_por_ejercicio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila   public.routine_exercises%rowtype;
  v_tope   numeric;
  v_hechas integer;
begin
  -- Series sueltas (sin ejercicio de la rutina) no tienen tope.
  if new.routine_exercise_id is null then
    return new;
  end if;

  select * into v_fila from public.routine_exercises where id = new.routine_exercise_id;
  if not found then
    return new;
  end if;

  v_tope := v_fila.series;
  if v_fila.progresion_tipo = 'escalera' and jsonb_typeof(v_fila.escalera) = 'array' then
    select greatest(
             v_tope,
             coalesce(max(case when jsonb_typeof(e -> 0) = 'number' then (e ->> 0)::numeric end), 0)
           )
      into v_tope
      from jsonb_array_elements(v_fila.escalera) as e;
  end if;

  -- Si dos series llegan a la vez, se atienden una tras otra (si no, ambas verían
  -- "faltan series" y las dos se guardarían).
  perform pg_advisory_xact_lock(
    hashtextextended(new.routine_exercise_id::text || coalesce(new.sesion_id::text, ''), 0)
  );

  select count(*) into v_hechas
    from public.routine_logs
   where user_id = new.user_id
     and routine_exercise_id = new.routine_exercise_id
     and sesion_id is not distinct from new.sesion_id;

  if v_hechas >= v_tope then
    raise exception 'Ya registraste todas las series que te tocan en este ejercicio.';
  end if;

  return new;
end;
$$;

revoke all on function public.limitar_series_por_ejercicio() from public, anon, authenticated;

create or replace trigger routine_logs_limitar_series
  before insert on public.routine_logs
  for each row execute function public.limitar_series_por_ejercicio();


-- ---------------------------------------------------------------------
-- 3. Copiar una rutina: igual que en la migración 11, más pide_rpe.
--    (create or replace: no elimina nada). Sigue sin copiar el peso inicial, que es de cada atleta.
-- ---------------------------------------------------------------------
create or replace function public.duplicate_routine(p_routine_id uuid, p_target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new     uuid;
  v_day     record;
  v_new_day uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede copiar rutinas.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user and rol = 'client') then
    raise exception 'El destinatario no es un atleta.';
  end if;

  insert into public.routines (user_id, nombre, objetivo, notas, estado, origen, creado_por)
  select p_target_user, nombre, objetivo, notas, 'borrador', 'manual', (select auth.uid())
  from public.routines where id = p_routine_id
  returning id into v_new;

  if v_new is null then
    raise exception 'Rutina no encontrada.';
  end if;

  for v_day in
    select * from public.routine_days where routine_id = p_routine_id order by orden
  loop
    insert into public.routine_days (routine_id, orden, nombre, notas)
    values (v_new, v_day.orden, v_day.nombre, v_day.notas)
    returning id into v_new_day;

    insert into public.routine_exercises
      (day_id, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, descanso_seg, notas,
       progresion_tipo, escalera, incremento_kg, pide_rpe)
    select v_new_day, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, descanso_seg, notas,
           progresion_tipo, escalera, incremento_kg, pide_rpe
    from public.routine_exercises where day_id = v_day.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.duplicate_routine(uuid, uuid) from public, anon;
grant execute on function public.duplicate_routine(uuid, uuid) to authenticated;
