-- =====================================================================
-- Migración 16 — Rutina híbrida: halterofilia + musculación en la misma sesión (paso 16)
--
-- Qué hace:
--   1) routines.modo_hibrido (por defecto false): el entrenador lo activa para que la
--      rutina tenga dos bloques por día, "halterofilia" y "musculación".
--   2) routine_exercises.bloque ('musculacion' por defecto o 'halterofilia'): a qué
--      bloque pertenece cada ejercicio. Las rutinas y ejercicios que ya existen quedan
--      como musculación y sin modo híbrido, o sea, exactamente igual que antes.
--   3) Trigger bloquear_bloque_sin_hibrido: no se puede poner un ejercicio en el
--      bloque de halterofilia si la rutina no está en modo híbrido.
--   4) Trigger reiniciar_bloques_sin_hibrido: al DESACTIVAR el modo híbrido, todos los
--      ejercicios de la rutina vuelven a "musculación" (así no quedan bloques huérfanos).
--   5) duplicate_routine actualizada: copia también modo_hibrido y bloque.
--      OJO: la migración 12 ya había actualizado esta función para copiar pide_rpe y su
--      archivo no está en el repositorio; esta versión parte de la 11 más pide_rpe.
--
-- Requiere: migraciones 04, 11 y 12 (usa routine_exercises.pide_rpe y duplicate_routine).
-- Contiene un UPDATE con WHERE dentro de un trigger (reinicia bloques); no borra nada.
-- Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================

alter table public.routines
  add column if not exists modo_hibrido boolean not null default false;

alter table public.routine_exercises
  add column if not exists bloque text not null default 'musculacion'
    check (bloque in ('musculacion', 'halterofilia'));

comment on column public.routines.modo_hibrido is
  'true = cada día tiene bloque de halterofilia y bloque de musculación.';
comment on column public.routine_exercises.bloque is
  'musculacion o halterofilia. Solo puede ser halterofilia si la rutina es híbrida.';

-- ---------------------------------------------------------------------
-- 3) Solo hay bloque de halterofilia en rutinas híbridas
-- ---------------------------------------------------------------------
create or replace function public.bloquear_bloque_sin_hibrido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bloque = 'halterofilia' and not exists (
    select 1
    from public.routine_days d
    join public.routines r on r.id = d.routine_id
    where d.id = new.day_id and r.modo_hibrido
  ) then
    raise exception 'Activa el modo híbrido de la rutina para usar el bloque de halterofilia.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger routine_exercises_bloquear_bloque
  before insert or update of bloque, day_id on public.routine_exercises
  for each row execute function public.bloquear_bloque_sin_hibrido();

-- ---------------------------------------------------------------------
-- 4) Al desactivar el modo híbrido, todo vuelve a musculación
-- ---------------------------------------------------------------------
create or replace function public.reiniciar_bloques_sin_hibrido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.routine_exercises re
  set bloque = 'musculacion'
  where re.bloque <> 'musculacion'
    and re.day_id in (select d.id from public.routine_days d where d.routine_id = new.id);
  return new;
end;
$$;

create trigger routines_reiniciar_bloques
  after update of modo_hibrido on public.routines
  for each row
  when (old.modo_hibrido and not new.modo_hibrido)
  execute function public.reiniciar_bloques_sin_hibrido();

-- ---------------------------------------------------------------------
-- 5) duplicate_routine: copia también modo_hibrido y bloque (y pide_rpe, de la migración 12)
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

  insert into public.routines (user_id, nombre, objetivo, notas, estado, origen, creado_por, modo_hibrido)
  select p_target_user, nombre, objetivo, notas, 'borrador', 'manual', (select auth.uid()), modo_hibrido
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
      (day_id, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, pide_rpe, descanso_seg, notas,
       progresion_tipo, escalera, incremento_kg, bloque)
    select v_new_day, exercise_id, orden, series, reps_min, reps_max, rpe_objetivo, pide_rpe, descanso_seg, notas,
           progresion_tipo, escalera, incremento_kg, bloque
    from public.routine_exercises where day_id = v_day.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.duplicate_routine(uuid, uuid) from public, anon;
grant execute on function public.duplicate_routine(uuid, uuid) to authenticated;
