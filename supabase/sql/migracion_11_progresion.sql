-- =====================================================================
-- MIGRACIÓN 11: progresión automática de repeticiones, series y peso
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- Requiere las migraciones 04 (rutinas). No elimina datos.
--
-- Cómo funciona la progresión (la calcula la app a partir de lo que el atleta escribe;
-- NO usa IA ni guarda un "estado": siempre se deduce de las series registradas):
--   - 'doble'    : el entrenador da un rango de repeticiones (ej. 6 a 10) y un nº de series.
--                  Cada semana se intenta 1 repetición más. Si no mejora, se mantiene.
--                  Al llegar al máximo, se sugiere subir peso (2,5 o 5 kg) y se reinicia el rango.
--   - 'escalera' : el entrenador elige los pasos series x repeticiones (2x1, 3x1, 4x1, 2x2...).
--                  Se avanza paso a paso; tras el último, se sugiere subir peso y se reinicia.
--   - 'ninguna'  : sin progresión.
-- El peso que se usa después de subir es el que el atleta REALMENTE escribe, no el sugerido.
-- =====================================================================

-- 1) Configuración de la progresión en cada ejercicio de la rutina (propia de cada atleta,
--    porque las rutinas son por atleta)
alter table public.routine_exercises
  add column if not exists progresion_tipo text not null default 'ninguna'
    check (progresion_tipo in ('ninguna', 'doble', 'escalera')),
  add column if not exists escalera jsonb,                 -- [[series, reps], ...] ordenado por reps y luego series
  add column if not exists incremento_kg numeric(4,2) not null default 2.5
    check (incremento_kg > 0 and incremento_kg <= 20),
  add column if not exists peso_inicial_kg numeric(6,2)
    check (peso_inicial_kg >= 0);

alter table public.routine_exercises
  add constraint routine_exercises_escalera_basica
  check (progresion_tipo <> 'escalera' or (escalera is not null and jsonb_typeof(escalera) = 'array'));


-- 2) Función: guardar la progresión de un ejercicio (valida todo; solo administrador)
--    Devuelve el id del ejercicio de la rutina.
create or replace function public.set_progresion(
  p_routine_exercise_id  uuid,
  p_tipo                 text,                 -- 'ninguna' | 'doble' | 'escalera'
  p_escalera             jsonb   default null, -- solo para 'escalera': [[2,1],[3,1],[4,1],[2,2],...]
  p_incremento_kg        numeric default 2.5,
  p_peso_inicial_kg      numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila    public.routine_exercises%rowtype;
  e         jsonb;
  v_sn      numeric;
  v_rn      numeric;
  v_s       integer;
  v_r       integer;
  v_prev_s  integer := 0;
  v_prev_r  integer := 0;
  v_n       integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede configurar la progresión.' using errcode = '42501';
  end if;

  if p_tipo not in ('ninguna', 'doble', 'escalera') then
    raise exception 'Tipo de progresión inválido.';
  end if;

  select * into v_fila from public.routine_exercises where id = p_routine_exercise_id for update;
  if not found then
    raise exception 'Ejercicio de la rutina no encontrado.';
  end if;

  if p_incremento_kg is null or p_incremento_kg <= 0 or p_incremento_kg > 20 then
    raise exception 'El incremento de peso debe ser mayor que 0 y no pasar de 20 kg.';
  end if;
  if p_peso_inicial_kg is not null and (p_peso_inicial_kg < 0 or p_peso_inicial_kg > 1000) then
    raise exception 'El peso inicial debe estar entre 0 y 1.000 kg.';
  end if;

  if p_tipo = 'doble' then
    if v_fila.reps_min is null or v_fila.reps_max is null or v_fila.reps_max <= v_fila.reps_min then
      raise exception 'Para la progresión por rango, define repeticiones mínimas y máximas distintas en el ejercicio.';
    end if;
    p_escalera := null;

  elsif p_tipo = 'escalera' then
    if p_escalera is null or jsonb_typeof(p_escalera) <> 'array' then
      raise exception 'La escalera debe ser una lista de pasos.';
    end if;
    if jsonb_array_length(p_escalera) < 2 or jsonb_array_length(p_escalera) > 40 then
      raise exception 'La escalera debe tener entre 2 y 40 pasos.';
    end if;

    for e in select value from jsonb_array_elements(p_escalera) loop
      if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2
         or jsonb_typeof(e -> 0) <> 'number' or jsonb_typeof(e -> 1) <> 'number' then
        raise exception 'Cada paso debe ser una pareja [series, repeticiones].';
      end if;
      v_sn := (e ->> 0)::numeric;
      v_rn := (e ->> 1)::numeric;
      if v_sn <> trunc(v_sn) or v_rn <> trunc(v_rn)
         or v_sn not between 1 and 20 or v_rn not between 1 and 100 then
        raise exception 'Series: enteros de 1 a 20. Repeticiones: enteros de 1 a 100.';
      end if;
      v_s := v_sn::integer;
      v_r := v_rn::integer;
      -- Orden estricto: primero por repeticiones y, a igual repetición, por series; sin repetir pasos.
      if v_n > 0 and (v_r < v_prev_r or (v_r = v_prev_r and v_s <= v_prev_s)) then
        raise exception 'Los pasos deben ir ordenados por repeticiones y luego por series, sin repetirse.';
      end if;
      v_n := v_n + 1;
      v_prev_s := v_s;
      v_prev_r := v_r;
    end loop;

  else
    p_escalera := null;
  end if;

  update public.routine_exercises
     set progresion_tipo = p_tipo,
         escalera        = p_escalera,
         incremento_kg   = p_incremento_kg,
         peso_inicial_kg = p_peso_inicial_kg
   where id = p_routine_exercise_id;

  return p_routine_exercise_id;
end;
$$;

revoke all on function public.set_progresion(uuid, text, jsonb, numeric, numeric) from public, anon;
grant execute on function public.set_progresion(uuid, text, jsonb, numeric, numeric) to authenticated;


-- 3) Copiar una rutina a otro atleta ahora también copia la configuración de progresión
--    (se redefine la función creada en la migración 04)
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

    -- Se copia la CONFIGURACIÓN de la progresión (tipo, escalera, incremento), pero NO el
    -- peso inicial: ese dato es propio de cada atleta.
    insert into public.routine_exercises
      (day_id, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, descanso_seg, notas,
       progresion_tipo, escalera, incremento_kg)
    select v_new_day, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, descanso_seg, notas,
           progresion_tipo, escalera, incremento_kg
    from public.routine_exercises where day_id = v_day.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.duplicate_routine(uuid, uuid) from public, anon;
grant execute on function public.duplicate_routine(uuid, uuid) to authenticated;