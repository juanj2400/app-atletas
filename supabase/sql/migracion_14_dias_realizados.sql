-- =====================================================================
-- Migración 14 — Días de entrenamiento realizados por semana (paso 14)
--
-- Qué hace:
--   1) Crea routine_day_completions: cuando el atleta termina un día de su rutina
--      activa se guarda una fila (una por día de rutina y semana).
--   2) Crea el trigger bloquear_dia_realizado: una vez realizado el día, la base de
--      datos rechaza nuevas series de ese día durante la misma semana.
--
-- "Semana" = de lunes a domingo, en la fecha LOCAL del atleta. La app manda
-- semana_inicio (el lunes) y un CHECK comprueba que sea coherente con la fecha.
-- El trigger calcula la semana de cada serie con la hora de Colombia
-- (America/Bogota): es una barrera contra errores y dobles toques, no contra manipulación.
--
-- Requiere: esquema inicial y migración 04 (routines, routine_days, routine_exercises).
-- No contiene sentencias destructivas (sin drop ni delete).
-- Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================

create table public.routine_day_completions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  routine_day_id        uuid not null references public.routine_days (id) on delete cascade,
  fecha                 date not null,          -- día local en que lo terminó
  semana_inicio         date not null,          -- lunes de esa semana (fecha local)
  ejercicios_completos  smallint not null check (ejercicios_completos >= 0),
  ejercicios_finalizados smallint not null check (ejercicios_finalizados >= 0),
  completada_en         timestamptz not null default now(),
  -- semana_inicio debe ser el lunes de la semana de "fecha" (isodow: lunes = 1)
  check (semana_inicio = fecha - (extract(isodow from fecha)::int - 1)),
  check (ejercicios_completos + ejercicios_finalizados >= 1),
  unique (user_id, routine_day_id, semana_inicio)
);

create index routine_day_completions_user_semana_idx
  on public.routine_day_completions (user_id, semana_inicio desc);

alter table public.routine_day_completions enable row level security;

-- Lectura: el atleta ve las suyas; el admin, todas.
create policy "day_completions_select" on public.routine_day_completions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Crear: el atleta solo a su nombre y sobre un día de su rutina activa
-- (la subconsulta respeta RLS: el atleta solo ve su rutina activa).
-- No puede modificar ni borrar: así no puede "reabrir" el día por su cuenta.
create policy "day_completions_insert_atleta" on public.routine_day_completions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.routine_days d
      join public.routines r on r.id = d.routine_id
      where d.id = routine_day_completions.routine_day_id
        and r.user_id = (select auth.uid())
        and r.estado = 'activa'
    )
  );

-- El admin gestiona todo (por ejemplo, borrar un registro para reabrir un día).
create policy "day_completions_admin_all" on public.routine_day_completions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Trigger: no se pueden registrar series de un día ya realizado esta semana
-- ---------------------------------------------------------------------
create or replace function public.bloquear_dia_realizado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo aplica a series ligadas a un ejercicio de rutina; el admin queda libre.
  if new.routine_exercise_id is null or public.is_admin() then
    return new;
  end if;

  if exists (
    select 1
    from public.routine_exercises re
    join public.routine_day_completions c on c.routine_day_id = re.day_id
    where re.id = new.routine_exercise_id
      and c.user_id = new.user_id
      and c.semana_inicio = date_trunc('week', new.realizado_en at time zone 'America/Bogota')::date
  ) then
    raise exception 'Ya realizaste este día de entrenamiento esta semana. Podrás volver a entrenarlo la próxima semana.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger routine_logs_bloquear_dia_realizado
  before insert on public.routine_logs
  for each row execute function public.bloquear_dia_realizado();
