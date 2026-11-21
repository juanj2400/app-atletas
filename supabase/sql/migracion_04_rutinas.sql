-- =====================================================================
-- MIGRACIÓN 04: rutinas asignadas por el entrenador
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- Requiere las migraciones anteriores (schema, 02 y 03).
--
-- Estructura (de lo grande a lo pequeño):
--   routines          la rutina completa de un atleta   ("Fuerza 4 semanas")
--     routine_days    sus días / sesiones               ("Día 1 · Pierna")
--       routine_exercises  los ejercicios de ese día    ("Sentadilla 4x5 RPE 8")
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RUTINA
--    estado: 'borrador' (solo la ve el entrenador), 'activa' (la ve el atleta),
--            'archivada' (histórico).
--    origen: 'manual' o 'ia'. Preparado para cuando la IA proponga rutinas:
--            siempre nacerán como 'borrador' hasta que tú las revises y actives.
-- ---------------------------------------------------------------------
create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  nombre      text not null,
  objetivo    text,
  notas       text,
  estado      text not null default 'borrador'
                check (estado in ('borrador', 'activa', 'archivada')),
  origen      text not null default 'manual'
                check (origen in ('manual', 'ia')),
  cycle_id    uuid references public.training_cycles (id) on delete set null,
  creado_por  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index routines_user_estado_idx on public.routines (user_id, estado);

-- Un atleta tiene como máximo UNA rutina activa a la vez.
-- (Si algún día quieres permitir varias, elimina este índice.)
create unique index routines_one_active_idx
  on public.routines (user_id) where estado = 'activa';


-- ---------------------------------------------------------------------
-- 2. DÍAS DE LA RUTINA
-- ---------------------------------------------------------------------
create table public.routine_days (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines (id) on delete cascade,
  orden       smallint not null default 1,
  nombre      text not null,
  notas       text,
  created_at  timestamptz not null default now()
);

create index routine_days_routine_idx on public.routine_days (routine_id, orden);


-- ---------------------------------------------------------------------
-- 3. EJERCICIOS DE CADA DÍA (lo que el entrenador prescribe)
--    Reps: reps_min y reps_max definen el rango (ej. 6 a 8). Si son fijas,
--    se repite el mismo número. RPE objetivo admite decimales (8.5).
-- ---------------------------------------------------------------------
create table public.routine_exercises (
  id                uuid primary key default gen_random_uuid(),
  day_id            uuid not null references public.routine_days (id) on delete cascade,
  exercise_id       uuid not null references public.exercises (id) on delete restrict,
  orden             smallint not null default 1,
  series            smallint not null default 3 check (series between 1 and 20),
  reps_min          smallint check (reps_min > 0),
  reps_max          smallint check (reps_max > 0),
  rpe_objetivo      numeric(3,1) check (rpe_objetivo between 1 and 10),
  descanso_seg      integer check (descanso_seg >= 0),
  peso_sugerido_kg  numeric(6,2) check (peso_sugerido_kg >= 0),
  notas             text,
  created_at        timestamptz not null default now(),
  check (reps_min is null or reps_max is null or reps_max >= reps_min)
);

create index routine_exercises_day_idx      on public.routine_exercises (day_id, orden);
create index routine_exercises_exercise_idx on public.routine_exercises (exercise_id);


-- ---------------------------------------------------------------------
-- 4. Enlazar el registro de series con lo prescrito
--    Cuando el atleta anote una serie, podremos saber a qué ejercicio de la
--    rutina corresponde (siguiente paso de la app). Es opcional (NULL).
-- ---------------------------------------------------------------------
alter table public.routine_logs
  add column if not exists routine_exercise_id uuid
    references public.routine_exercises (id) on delete set null;

create index if not exists routine_logs_routine_exercise_idx
  on public.routine_logs (routine_exercise_id);


-- =====================================================================
-- 5. SEGURIDAD (RLS)
--    - El entrenador (admin) lo gestiona todo.
--    - El atleta SOLO LEE su rutina ACTIVA (no los borradores).
--    - Días y ejercicios: "si puedes ver la rutina, puedes ver sus días", y así
--      en cadena. Las subconsultas de una política también pasan por RLS, por
--      eso basta con preguntar si existe la fila padre visible.
-- =====================================================================
alter table public.routines          enable row level security;
alter table public.routine_days      enable row level security;
alter table public.routine_exercises enable row level security;

create policy "routines_select" on public.routines
  for select to authenticated
  using (
    public.is_admin()
    or (user_id = (select auth.uid()) and estado = 'activa')
  );
create policy "routines_admin_write" on public.routines
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "routine_days_select" on public.routine_days
  for select to authenticated
  using (exists (
    select 1 from public.routines r where r.id = routine_days.routine_id
  ));
create policy "routine_days_admin_write" on public.routine_days
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "routine_exercises_select" on public.routine_exercises
  for select to authenticated
  using (exists (
    select 1 from public.routine_days d where d.id = routine_exercises.day_id
  ));
create policy "routine_exercises_admin_write" on public.routine_exercises
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- =====================================================================
-- 6. FUNCIÓN: activar una rutina
--    Archiva la rutina activa anterior (si la hay) y activa esta, todo junto.
--    Se hace en la base de datos para que sea "todo o nada": nunca queda un
--    atleta sin rutina por un fallo a medias.
-- =====================================================================
create or replace function public.activate_routine(p_routine_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede activar rutinas.' using errcode = '42501';
  end if;

  select user_id into v_user from public.routines where id = p_routine_id for update;
  if not found then
    raise exception 'Rutina no encontrada.';
  end if;

  if not exists (
    select 1
    from public.routine_exercises e
    join public.routine_days d on d.id = e.day_id
    where d.routine_id = p_routine_id
  ) then
    raise exception 'La rutina no tiene ejercicios: agrega al menos uno antes de activarla.';
  end if;

  update public.routines set estado = 'archivada'
   where user_id = v_user and estado = 'activa' and id <> p_routine_id;

  update public.routines set estado = 'activa' where id = p_routine_id;
end;
$$;

revoke all on function public.activate_routine(uuid) from public, anon;
grant execute on function public.activate_routine(uuid) to authenticated;


-- =====================================================================
-- 7. FUNCIÓN: copiar una rutina a otro atleta (o duplicarla)
--    La copia nace como 'borrador'. No copia pesos sugeridos (son por atleta).
-- =====================================================================
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
      (day_id, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, descanso_seg, notas)
    select v_new_day, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, descanso_seg, notas
    from public.routine_exercises where day_id = v_day.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.duplicate_routine(uuid, uuid) from public, anon;
grant execute on function public.duplicate_routine(uuid, uuid) to authenticated;
