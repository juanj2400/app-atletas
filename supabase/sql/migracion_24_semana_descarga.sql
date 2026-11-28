-- =====================================================================
-- Migración 24 — Semana de descarga (deload) aplicable por el entrenador
--
-- Qué hace:
--   1) Crea la tabla `deload_weeks`: una fila por semana de descarga de un atleta, de
--      EXACTAMENTE 7 días locales (fecha_fin = fecha_inicio + 6). No toca la rutina del
--      atleta: la reducción de series y cargas se calcula en la app (lib/descarga.js)
--      mientras la semana esté vigente. Al terminar, la rutina y la progresión siguen
--      tal como estaban.
--   2) Agrega `routine_logs.en_descarga` y un trigger que la marca SOLA al guardar cada
--      serie (según la fecha de Bogotá, igual que `bloquear_dia_realizado`). El cliente
--      no puede escribirla: el trigger la sobrescribe.
--   3) Reemplaza `ultimas_series_por_ejercicio` para IGNORAR las series hechas en descarga.
--      Así la progresión posterior parte de la última sesión NORMAL y no se "hunde" por
--      haber entrenado más liviano durante la descarga.
--   4) RPC `activar_descarga` (inicia hoy) y `cancelar_descarga`: solo admin. La tabla no
--      tiene políticas de escritura: todo pasa por estas funciones.
--
-- Seguridad: RLS activado. El atleta solo lee las suyas; el admin lee todas.
-- Requiere: esquema inicial (profiles, routine_logs, is_admin). Independiente de la 21:
-- aquí se vuelve a definir `ultimas_series_por_ejercicio` completa.
-- Sentencias destructivas: NINGUNA (sin drop ni delete). Solo `create or replace` de
-- `ultimas_series_por_ejercicio` (mismo nombre, mismos parámetros, mismo retorno).
-- Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabla de semanas de descarga
-- ---------------------------------------------------------------------
create table public.deload_weeks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  fecha_inicio  date not null,                       -- día LOCAL de inicio (lo manda la app)
  fecha_fin     date not null,                       -- último día incluido (inicio + 6)
  creado_por    uuid references public.profiles (id) on delete set null,
  cancelada_en  timestamptz,                         -- null = no cancelada
  created_at    timestamptz not null default now(),
  -- 7 días exactos: inicio, +1, ..., +6 (ambos extremos incluidos)
  constraint deload_weeks_siete_dias check (fecha_fin = fecha_inicio + 6)
);

create index deload_weeks_user_inicio_idx
  on public.deload_weeks (user_id, fecha_inicio desc);

alter table public.deload_weeks enable row level security;

-- Lectura: el atleta ve las suyas; el admin, todas. Sin políticas de escritura:
-- solo escriben las RPC `security definer` de más abajo.
create policy "deload_select" on public.deload_weeks
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());


-- ---------------------------------------------------------------------
-- 2. Marca automática de las series hechas durante una descarga
-- ---------------------------------------------------------------------
alter table public.routine_logs
  add column if not exists en_descarga boolean not null default false;

comment on column public.routine_logs.en_descarga is
  'true si la serie se hizo dentro de una semana de descarga (la marca el trigger marcar_serie_en_descarga).';

create or replace function public.marcar_serie_en_descarga()
returns trigger
language plpgsql
security definer          -- el atleta no puede leer todas las filas de deload_weeks sin RLS
set search_path = ''
as $$
begin
  new.en_descarga := exists (
    select 1
      from public.deload_weeks d
     where d.user_id = new.user_id
       -- una descarga cancelada solo cuenta para series anteriores a la cancelación
       and (d.cancelada_en is null or d.cancelada_en > new.realizado_en)
       and (new.realizado_en at time zone 'America/Bogota')::date between d.fecha_inicio and d.fecha_fin
  );
  return new;
end;
$$;

revoke all on function public.marcar_serie_en_descarga() from public, anon, authenticated;

create or replace trigger routine_logs_marcar_descarga
  before insert on public.routine_logs
  for each row execute function public.marcar_serie_en_descarga();


-- ---------------------------------------------------------------------
-- 3. "Última vez" por ejercicio sin contar las series de descarga
--    (misma función de la migración 21 + el filtro `not r.en_descarga`)
-- ---------------------------------------------------------------------
create or replace function public.ultimas_series_por_ejercicio(
  p_user_id      uuid,
  p_exercise_ids uuid[],
  p_antes        timestamptz default null,
  p_max          integer     default 40
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
      and not r.en_descarga
      and (p_antes is null or r.realizado_en < p_antes)
    order by r.realizado_en desc, r.numero_serie desc
    limit least(greatest(coalesce(p_max, 40), 1), 100)
  ) as l
  order by l.exercise_id, l.realizado_en desc, l.numero_serie desc;
$$;

revoke all on function public.ultimas_series_por_ejercicio(uuid, uuid[], timestamptz, integer) from public, anon;
grant execute on function public.ultimas_series_por_ejercicio(uuid, uuid[], timestamptz, integer) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Activar la semana de descarga (empieza en la fecha local que manda la app)
-- ---------------------------------------------------------------------
create or replace function public.activar_descarga(p_user_id uuid, p_fecha_inicio date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_id  uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el entrenador puede activar una semana de descarga.';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and rol = 'client') then
    raise exception 'No se encontró al atleta.';
  end if;

  -- Debe empezar hoy (se tolera ±1 día por el desfase entre el celular y el servidor).
  if p_fecha_inicio is null or abs(p_fecha_inicio - v_hoy) > 1 then
    raise exception 'La fecha de inicio no es válida. Recarga la pantalla e inténtalo de nuevo.';
  end if;

  -- Si dos toques llegan a la vez, se atienden uno tras otro (evita dos descargas solapadas).
  perform pg_advisory_xact_lock(hashtextextended('descarga:' || p_user_id::text, 0));

  if exists (
    select 1 from public.deload_weeks
     where user_id = p_user_id
       and cancelada_en is null
       and fecha_fin >= p_fecha_inicio
  ) then
    raise exception 'Este atleta ya tiene una semana de descarga en curso. Cancélala antes de crear otra.';
  end if;

  insert into public.deload_weeks (user_id, fecha_inicio, fecha_fin, creado_por)
  values (p_user_id, p_fecha_inicio, p_fecha_inicio + 6, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.activar_descarga(uuid, date) from public, anon;
grant execute on function public.activar_descarga(uuid, date) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Cancelar la semana de descarga en curso (el atleta vuelve a su rutina normal)
-- ---------------------------------------------------------------------
create or replace function public.cancelar_descarga(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_n   integer;
begin
  if not public.is_admin() then
    raise exception 'Solo el entrenador puede cancelar una semana de descarga.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('descarga:' || p_user_id::text, 0));

  update public.deload_weeks
     set cancelada_en = now()
   where user_id = p_user_id
     and cancelada_en is null
     and fecha_fin >= v_hoy;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'Este atleta no tiene una semana de descarga activa para cancelar.';
  end if;
  return v_n;
end;
$$;

revoke all on function public.cancelar_descarga(uuid) from public, anon;
grant execute on function public.cancelar_descarga(uuid) to authenticated;
