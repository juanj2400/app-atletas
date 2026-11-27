-- =====================================================================
-- Migración 22 — Historial de periodos de la rutina (versiones)
--
-- Problema que resuelve: el entrenador edita la rutina activa "en el sitio" (cambia un
-- ejercicio, las series, las repeticiones, el RPE, la progresión...). Al hacerlo se perdía
-- cómo estaba prescrita la rutina cuando el atleta la entrenó, y al quitar un ejercicio sus
-- series quedaban sin enlace con la rutina (`routine_logs.routine_exercise_id` pasa a null).
--
-- Qué hace: antes de CUALQUIER cambio a la rutina (días, ejercicios, modo híbrido o borrado),
-- un trigger comprueba si el atleta registró series desde la última foto. Si las hay, guarda
-- en `routine_versions` una FOTO de la rutina tal como estaba (antes del cambio) y el periodo
-- real en que se entrenó: de su primera a su última serie. Si no hay series nuevas, no guarda
-- nada (no hay nada que conservar). Las series del atleta NO se tocan.
--
-- Por qué en la base de datos y no en la pantalla: el editor hace varios `update` sueltos;
-- un trigger no se puede saltar y no obliga a cambiar el editor.
--
-- Seguridad: solo el entrenador lee `routine_versions`; nadie la escribe desde la app (solo el
-- trigger, que es `security definer`). El atleta no tiene acceso.
--
-- Limitación conocida: no se crean fotos de cambios hechos ANTES de esta migración. El primer
-- periodo de una rutina que ya tenía series puede abarcar ajustes anteriores.
--
-- Esta migración NO elimina nada (solo crea tabla, funciones y triggers). Los `drop` que
-- pueda mostrar el SQL Editor no existen aquí.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabla de periodos
--    routine_id pasa a null si la rutina se elimina: el historial se conserva (por eso la
--    foto guarda también el nombre de la rutina).
-- ---------------------------------------------------------------------
create table public.routine_versions (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid references public.routines (id) on delete set null,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  numero              integer not null check (numero > 0),   -- 1, 2, 3... dentro de cada rutina
  desde               timestamptz not null,                  -- primera serie del periodo
  hasta               timestamptz not null,                  -- última serie del periodo
  series_registradas  integer not null check (series_registradas > 0),
  foto                jsonb not null,                        -- la rutina tal como estaba (ver foto_rutina)
  created_at          timestamptz not null default now(),
  check (hasta >= desde),
  unique (routine_id, numero)
);

create index routine_versions_user_idx    on public.routine_versions (user_id, desde desc);
create index routine_versions_routine_idx on public.routine_versions (routine_id, numero);

comment on table public.routine_versions is
  'Periodos de una rutina: foto de la prescripción y rango real de series del atleta. Solo la escribe el trigger.';

-- ---------------------------------------------------------------------
-- 2) RLS: solo el entrenador lee; nadie escribe desde la app
-- ---------------------------------------------------------------------
alter table public.routine_versions enable row level security;

create policy "routine_versions_admin_select" on public.routine_versions
  for select to authenticated
  using (public.is_admin());

revoke all on public.routine_versions from anon, authenticated;
grant select on public.routine_versions to authenticated;

-- ---------------------------------------------------------------------
-- 3) foto_rutina: la rutina completa (días y ejercicios) como JSON
--    Se usa tanto para guardar la foto como para comparar contra la rutina de hoy.
--    `security invoker`: respeta RLS (el atleta solo vería su rutina activa).
-- ---------------------------------------------------------------------
create or replace function public.foto_rutina(p_routine_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rutina_nombre', r.nombre,
    'modo_hibrido',  r.modo_hibrido,
    'dias', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',    d.id,
          'orden', d.orden,
          'nombre', d.nombre,
          'notas', d.notas,
          'ejercicios', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id',               e.id,
                'exercise_id',      e.exercise_id,
                'nombre',           x.nombre,
                'orden',            e.orden,
                'bloque',           e.bloque,
                'series',           e.series,
                'reps_min',         e.reps_min,
                'reps_max',         e.reps_max,
                'rpe_objetivo',     e.rpe_objetivo,
                'pide_rpe',         e.pide_rpe,
                'descanso_seg',     e.descanso_seg,
                'peso_sugerido_kg', e.peso_sugerido_kg,
                'notas',            e.notas,
                'progresion_tipo',  e.progresion_tipo,
                'escalera',         e.escalera,
                'incremento_kg',    e.incremento_kg,
                'peso_inicial_kg',  e.peso_inicial_kg
              ) order by e.orden, e.created_at, e.id
            )
            from public.routine_exercises e
            join public.exercises x on x.id = e.exercise_id
            where e.day_id = d.id
          ), '[]'::jsonb)
        ) order by d.orden, d.created_at, d.id
      )
      from public.routine_days d
      where d.routine_id = r.id
    ), '[]'::jsonb)
  )
  from public.routines r
  where r.id = p_routine_id;
$$;

revoke all on function public.foto_rutina(uuid) from public, anon;
grant execute on function public.foto_rutina(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4) congelar_version_rutina: guarda el periodo si hay series nuevas
--    Idempotente: si ya se guardó una foto y no hay series posteriores, no hace nada.
--    Solo la usan los triggers (no se concede a anon ni authenticated).
-- ---------------------------------------------------------------------
create or replace function public.congelar_version_rutina(p_routine_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid;
  v_ultimo  timestamptz;
  v_numero  integer;
  v_desde   timestamptz;
  v_hasta   timestamptz;
  v_series  integer;
begin
  if p_routine_id is null then
    return;
  end if;

  select r.user_id into v_user from public.routines r where r.id = p_routine_id;
  if v_user is null then
    return;  -- la rutina ya no existe (borrado en cascada): su foto se tomó antes
  end if;

  -- Evita dos fotos repetidas si hay cambios simultáneos sobre la misma rutina.
  perform pg_advisory_xact_lock(hashtext(p_routine_id::text));

  select max(v.hasta), coalesce(max(v.numero), 0)
    into v_ultimo, v_numero
  from public.routine_versions v
  where v.routine_id = p_routine_id;

  -- Series del atleta, ligadas a esta rutina, posteriores a la última foto.
  select min(l.realizado_en), max(l.realizado_en), count(*)
    into v_desde, v_hasta, v_series
  from public.routine_logs l
  where l.user_id = v_user
    and (v_ultimo is null or l.realizado_en > v_ultimo)
    and l.routine_exercise_id in (
      select e.id
      from public.routine_exercises e
      join public.routine_days d on d.id = e.day_id
      where d.routine_id = p_routine_id
    );

  if v_series = 0 then
    return;  -- nada entrenado con esta configuración: no hay qué conservar
  end if;

  insert into public.routine_versions
    (routine_id, user_id, numero, desde, hasta, series_registradas, foto)
  values
    (p_routine_id, v_user, v_numero + 1, v_desde, v_hasta, v_series,
     public.foto_rutina(p_routine_id));
end;
$$;

revoke all on function public.congelar_version_rutina(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) Triggers: antes de cambiar ejercicios, días o la rutina
-- ---------------------------------------------------------------------
create or replace function public.versionar_antes_de_cambio_ejercicio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes   uuid;
  v_despues uuid;
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;  -- actualización sin cambios reales
  end if;

  if tg_op <> 'INSERT' then
    select d.routine_id into v_antes from public.routine_days d where d.id = old.day_id;
    perform public.congelar_version_rutina(v_antes);
  end if;
  if tg_op <> 'DELETE' then
    select d.routine_id into v_despues from public.routine_days d where d.id = new.day_id;
    if v_despues is distinct from v_antes then
      perform public.congelar_version_rutina(v_despues);
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger routine_exercises_versionar
  before insert or update or delete on public.routine_exercises
  for each row execute function public.versionar_antes_de_cambio_ejercicio();

create or replace function public.versionar_antes_de_cambio_dia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old is not distinct from new then
    return new;
  end if;

  if tg_op <> 'INSERT' then
    perform public.congelar_version_rutina(old.routine_id);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.routine_id is distinct from old.routine_id) then
    perform public.congelar_version_rutina(new.routine_id);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger routine_days_versionar
  before insert or update or delete on public.routine_days
  for each row execute function public.versionar_antes_de_cambio_dia();

create or replace function public.versionar_antes_de_cambio_rutina()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.congelar_version_rutina(old.id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Solo cuando cambia el modo híbrido o se borra la rutina (activar/archivar no cambia la prescripción).
create trigger routines_versionar_hibrido
  before update of modo_hibrido on public.routines
  for each row
  when (old.modo_hibrido is distinct from new.modo_hibrido)
  execute function public.versionar_antes_de_cambio_rutina();

create trigger routines_versionar_borrado
  before delete on public.routines
  for each row execute function public.versionar_antes_de_cambio_rutina();

-- ---------------------------------------------------------------------
-- 6) resumen_periodo_rutina: qué hizo el atleta en un periodo, por ejercicio
--    Resume en la base de datos (límite de 1.000 filas de Supabase). Cuenta los días con la
--    fecha de América/Bogotá, igual que el trigger `bloquear_dia_realizado`.
--    `security invoker`: RLS manda (solo el entrenador ve periodos).
-- ---------------------------------------------------------------------
create or replace function public.resumen_periodo_rutina(p_version_id uuid)
returns table (
  exercise_id    uuid,
  series         bigint,
  dias           bigint,
  peso_max_kg    numeric,
  reps_peso_max  smallint,
  primera        date,
  ultima         date
)
language sql
stable
set search_path = ''
as $$
  with v as (
    select * from public.routine_versions where id = p_version_id
  ),
  ids as (
    select distinct (e ->> 'exercise_id')::uuid as exercise_id
    from v,
         jsonb_array_elements(v.foto -> 'dias') d,
         jsonb_array_elements(d -> 'ejercicios') e
  )
  select
    l.exercise_id,
    count(*)::bigint,
    count(distinct (l.realizado_en at time zone 'America/Bogota')::date)::bigint,
    max(l.peso_kg),
    (array_agg(l.repeticiones order by l.peso_kg desc, l.repeticiones desc))[1],
    min((l.realizado_en at time zone 'America/Bogota')::date),
    max((l.realizado_en at time zone 'America/Bogota')::date)
  from v
  join public.routine_logs l
    on l.user_id = v.user_id
   and l.realizado_en between v.desde and v.hasta
   and l.exercise_id in (select i.exercise_id from ids i)
  group by l.exercise_id;
$$;

revoke all on function public.resumen_periodo_rutina(uuid) from public, anon;
grant execute on function public.resumen_periodo_rutina(uuid) to authenticated;
