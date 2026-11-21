-- =====================================================================
-- MIGRACIÓN 02: Nutrición con IA + Dashboard individual del atleta
-- Requiere haber ejecutado antes schema_supabase.sql
-- Ejecutar UNA sola vez en: Dashboard > SQL Editor > New query
-- =====================================================================


-- ---------------------------------------------------------------------
-- A. NUTRITION_PLANS  (plan nutricional OFICIAL aplicado al atleta)
--    Solo el admin escribe aquí. Mantiene historial: el plan vigente
--    es el que tiene vigente_hasta = NULL.
-- ---------------------------------------------------------------------
create table public.nutrition_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  calorias_objetivo integer not null check (calorias_objetivo > 0),
  proteina_g        integer check (proteina_g >= 0),
  carbohidratos_g   integer check (carbohidratos_g >= 0),
  grasas_g          integer check (grasas_g >= 0),
  objetivo_calorico text check (objetivo_calorico in ('deficit', 'superavit', 'normocalorica')),
  origen            text not null default 'manual'
                      check (origen in ('manual', 'ia_aceptada', 'ia_editada')),
  vigente_desde     timestamptz not null default now(),
  vigente_hasta     timestamptz,                         -- NULL = plan activo
  creado_por        uuid references public.profiles (id) on delete set null,
  notas             text,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- Garantiza un único plan activo por atleta
create unique index nutrition_plans_one_active_idx
  on public.nutrition_plans (user_id) where vigente_hasta is null;
create index nutrition_plans_user_idx
  on public.nutrition_plans (user_id, vigente_desde desc);


-- ---------------------------------------------------------------------
-- B. AI_NUTRITION_SUGGESTIONS  (buzón de la IA; gemelo de ai_load_suggestions)
-- ---------------------------------------------------------------------
create table public.ai_nutrition_suggestions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  plan_actual_id           uuid references public.nutrition_plans (id) on delete set null,
  calorias_actuales        integer check (calorias_actuales > 0),
  calorias_sugeridas       integer not null check (calorias_sugeridas > 0),
  proteina_g_sugerida      integer check (proteina_g_sugerida >= 0),
  carbohidratos_g_sugerido integer check (carbohidratos_g_sugerido >= 0),
  grasas_g_sugerida        integer check (grasas_g_sugerida >= 0),
  objetivo_calorico        text check (objetivo_calorico in ('deficit', 'superavit', 'normocalorica')),
  razon                    text,
  datos_analisis           jsonb,       -- snapshot: tendencia de peso, kcal promedio, sensaciones...
  estado                   text not null default 'pendiente'
                             check (estado in ('pendiente', 'aceptado', 'editado', 'rechazado')),
  notas_admin              text,
  plan_resultante_id       uuid references public.nutrition_plans (id) on delete set null,
  created_at               timestamptz not null default now(),
  resuelto_en              timestamptz,
  resuelto_por             uuid references public.profiles (id) on delete set null
);

create index ai_nutrition_user_estado_idx
  on public.ai_nutrition_suggestions (user_id, estado);


-- ---------------------------------------------------------------------
-- C. TRAINING_CYCLES  (macro / meso / microciclos, jerárquico)
-- ---------------------------------------------------------------------
create table public.training_cycles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  parent_id    uuid references public.training_cycles (id) on delete cascade,
  nivel        text not null check (nivel in ('macrociclo', 'mesociclo', 'microciclo')),
  nombre       text not null,
  fase         text,        -- libre: acumulacion, intensificacion, realizacion, descarga...
  objetivo     text,
  fecha_inicio date not null,
  fecha_fin    date not null,
  notas        text,
  created_at   timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index training_cycles_user_dates_idx
  on public.training_cycles (user_id, fecha_inicio, fecha_fin);


-- ---------------------------------------------------------------------
-- D. ATHLETE_EXERCISE_BLACKLIST  (lista negra POR atleta)
--    exercises.restringido sigue siendo la lista negra GLOBAL.
-- ---------------------------------------------------------------------
create table public.athlete_exercise_blacklist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  motivo      text,
  creado_por  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create index blacklist_user_idx on public.athlete_exercise_blacklist (user_id);


-- ---------------------------------------------------------------------
-- E. AJUSTES A ai_load_suggestions (ahora SOLO el admin resuelve)
-- ---------------------------------------------------------------------
alter table public.ai_load_suggestions
  add column if not exists resuelto_por   uuid references public.profiles (id) on delete set null,
  add column if not exists datos_analisis jsonb;


-- =====================================================================
-- F. TRIGGERS: la IA NUNCA decide por su cuenta
-- =====================================================================

-- F1. Toda propuesta nace 'pendiente', sin importar quién la inserte
create or replace function public.force_suggestion_pending()
returns trigger
language plpgsql
as $$
begin
  new.estado       := 'pendiente';
  new.resuelto_en  := null;
  new.resuelto_por := null;
  return new;
end;
$$;

create trigger trg_load_force_pending
  before insert on public.ai_load_suggestions
  for each row execute function public.force_suggestion_pending();

create trigger trg_nutrition_force_pending
  before insert on public.ai_nutrition_suggestions
  for each row execute function public.force_suggestion_pending();

-- F2. Una propuesta resuelta es inmutable; al resolverla se sellan fecha y autor
create or replace function public.guard_suggestion_resolution()
returns trigger
language plpgsql
as $$
begin
  if old.estado <> 'pendiente' then
    raise exception 'La propuesta ya fue resuelta (%) y no puede modificarse.', old.estado;
  end if;
  if new.estado <> 'pendiente' then
    new.resuelto_en  := now();
    new.resuelto_por := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_load_guard_resolution
  before update on public.ai_load_suggestions
  for each row execute function public.guard_suggestion_resolution();

create trigger trg_nutrition_guard_resolution
  before update on public.ai_nutrition_suggestions
  for each row execute function public.guard_suggestion_resolution();

-- F3. La IA no puede sugerir cargas de ejercicios en lista negra (global o del atleta)
create or replace function public.block_blacklisted_suggestion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
        select 1 from public.athlete_exercise_blacklist b
        where b.user_id = new.user_id and b.exercise_id = new.exercise_id
     )
     or exists (
        select 1 from public.exercises e
        where e.id = new.exercise_id and e.restringido
     )
  then
    raise exception 'Ejercicio restringido para este atleta: no se admiten sugerencias sobre él.';
  end if;
  return new;
end;
$$;

create trigger trg_load_block_blacklist
  before insert on public.ai_load_suggestions
  for each row execute function public.block_blacklisted_suggestion();


-- =====================================================================
-- G. FUNCIÓN DE APLICACIÓN: aceptar / editar / rechazar propuesta nutricional
--    Única vía para convertir una sugerencia en plan oficial. Solo admin.
-- =====================================================================
create or replace function public.resolve_nutrition_suggestion(
  p_id               uuid,
  p_accion           text,                 -- 'aceptar' | 'editar' | 'rechazar'
  p_calorias         integer default null, -- solo se usan si p_accion = 'editar'
  p_proteina_g       integer default null,
  p_carbohidratos_g  integer default null,
  p_grasas_g         integer default null,
  p_notas_admin      text    default null
)
returns uuid                               -- id del nuevo plan (NULL si se rechazó)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s         public.ai_nutrition_suggestions%rowtype;
  v_plan_id uuid;
  v_editar  boolean := (p_accion = 'editar');
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede resolver propuestas nutricionales.'
      using errcode = '42501';
  end if;

  if p_accion not in ('aceptar', 'editar', 'rechazar') then
    raise exception 'Acción inválida: %. Usa aceptar, editar o rechazar.', p_accion;
  end if;

  select * into s from public.ai_nutrition_suggestions where id = p_id for update;
  if not found then
    raise exception 'Propuesta no encontrada.';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'La propuesta ya fue resuelta (%).', s.estado;
  end if;

  if p_accion = 'rechazar' then
    update public.ai_nutrition_suggestions
       set estado = 'rechazado', notas_admin = p_notas_admin
     where id = p_id;
    return null;
  end if;

  -- Cierra el plan vigente y crea el nuevo
  update public.nutrition_plans
     set vigente_hasta = now()
   where user_id = s.user_id and vigente_hasta is null;

  insert into public.nutrition_plans (
    user_id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g,
    objetivo_calorico, origen, creado_por, notas
  ) values (
    s.user_id,
    case when v_editar then coalesce(p_calorias,        s.calorias_sugeridas)       else s.calorias_sugeridas       end,
    case when v_editar then coalesce(p_proteina_g,      s.proteina_g_sugerida)      else s.proteina_g_sugerida      end,
    case when v_editar then coalesce(p_carbohidratos_g, s.carbohidratos_g_sugerido) else s.carbohidratos_g_sugerido end,
    case when v_editar then coalesce(p_grasas_g,        s.grasas_g_sugerida)        else s.grasas_g_sugerida        end,
    s.objetivo_calorico,
    case when v_editar then 'ia_editada' else 'ia_aceptada' end,
    (select auth.uid()),
    p_notas_admin
  )
  returning id into v_plan_id;

  update public.ai_nutrition_suggestions
     set estado             = case when v_editar then 'editado' else 'aceptado' end,
         notas_admin        = p_notas_admin,
         plan_resultante_id = v_plan_id
   where id = p_id;

  return v_plan_id;
end;
$$;

revoke all on function public.resolve_nutrition_suggestion(uuid, text, integer, integer, integer, integer, text)
  from public, anon;
grant execute on function public.resolve_nutrition_suggestion(uuid, text, integer, integer, integer, integer, text)
  to authenticated;


-- =====================================================================
-- H. VISTAS PARA EL DASHBOARD (security_invoker = respetan el RLS)
-- =====================================================================

-- H1. Listado general de atletas (pantalla /admin/atletas)
create or replace view public.v_athlete_overview
with (security_invoker = true) as
select
  p.id               as user_id,
  p.nombre_completo,
  p.email,
  m.fecha            as ultima_medicion,
  m.peso_corporal_kg as peso_actual_kg,
  c.fecha            as ultimo_check_in,
  np.calorias_objetivo as kcal_objetivo,
  (
    (select count(*) from public.ai_load_suggestions s
      where s.user_id = p.id and s.estado = 'pendiente')
    +
    (select count(*) from public.ai_nutrition_suggestions n
      where n.user_id = p.id and n.estado = 'pendiente')
  )::int             as propuestas_pendientes
from public.profiles p
left join lateral (
  select fecha, peso_corporal_kg from public.metrics
  where user_id = p.id and peso_corporal_kg is not null
  order by fecha desc limit 1
) m on true
left join lateral (
  select fecha from public.daily_check_ins
  where user_id = p.id order by fecha desc limit 1
) c on true
left join lateral (
  select calorias_objetivo from public.nutrition_plans
  where user_id = p.id and vigente_hasta is null limit 1
) np on true
where p.rol = 'client';

-- H2. Evolución de peso y calorías con medias móviles de 7 días (gráfico)
create or replace view public.v_metrics_trend
with (security_invoker = true) as
select
  user_id,
  fecha,
  peso_corporal_kg,
  perimetro_cintura_cm,
  calorias_consumidas,
  estado_calorico,
  round(avg(peso_corporal_kg)    over w, 2) as peso_media_7d,
  round(avg(calorias_consumidas) over w, 0)  as calorias_media_7d
from public.metrics
window w as (
  partition by user_id
  order by fecha
  range between interval '6 days' preceding and current row
);

-- H3. Récords personales por ejercicio (mejor 1RM estimado, fórmula de Epley)
create or replace view public.v_athlete_prs
with (security_invoker = true) as
with calc as (
  select
    rl.user_id, rl.exercise_id, rl.peso_kg, rl.repeticiones, rl.rpe, rl.realizado_en,
    case when rl.repeticiones = 1 then rl.peso_kg
         else round(rl.peso_kg * (1 + rl.repeticiones / 30.0), 1)
    end as e1rm_kg
  from public.routine_logs rl
  where rl.peso_kg > 0
),
ranked as (
  select calc.*,
         row_number() over (
           partition by user_id, exercise_id
           order by e1rm_kg desc, realizado_en asc
         ) as rn
  from calc
)
select
  r.user_id, r.exercise_id,
  e.nombre as ejercicio, e.grupo_muscular,
  r.peso_kg, r.repeticiones, r.rpe, r.e1rm_kg,
  r.realizado_en as fecha_pr
from ranked r
join public.exercises e on e.id = r.exercise_id
where r.rn = 1;

-- H4. Mesociclo vigente con su macrociclo y progreso semanal
create or replace view public.v_current_training_cycle
with (security_invoker = true) as
select
  me.user_id,
  ma.id        as macrociclo_id,
  ma.nombre    as macrociclo,
  ma.objetivo  as macro_objetivo,
  me.id        as mesociclo_id,
  me.nombre    as mesociclo,
  me.fase,
  me.objetivo  as meso_objetivo,
  me.fecha_inicio,
  me.fecha_fin,
  ((current_date - me.fecha_inicio) / 7) + 1                       as semana_actual,
  ceil(((me.fecha_fin - me.fecha_inicio) + 1) / 7.0)::int          as semanas_totales
from public.training_cycles me
left join public.training_cycles ma on ma.id = me.parent_id
where me.nivel = 'mesociclo'
  and current_date between me.fecha_inicio and me.fecha_fin;

-- H5. Bandeja unificada de propuestas pendientes (entrenamiento + nutrición)
create or replace view public.v_pending_ai_suggestions
with (security_invoker = true) as
select
  'entrenamiento'::text as tipo,
  s.id, s.user_id,
  e.nombre              as titulo,
  format('%s kg → %s kg', coalesce(s.peso_actual_kg::text, '?'), s.peso_sugerido_kg) as resumen,
  s.razon,
  s.created_at
from public.ai_load_suggestions s
join public.exercises e on e.id = s.exercise_id
where s.estado = 'pendiente'
union all
select
  'nutricion'::text,
  n.id, n.user_id,
  'Ajuste nutricional',
  format('%s → %s kcal', coalesce(n.calorias_actuales::text, '?'), n.calorias_sugeridas),
  n.razon,
  n.created_at
from public.ai_nutrition_suggestions n
where n.estado = 'pendiente';


-- =====================================================================
-- I. SEGURIDAD (RLS)
-- =====================================================================
alter table public.nutrition_plans             enable row level security;
alter table public.ai_nutrition_suggestions    enable row level security;
alter table public.training_cycles             enable row level security;
alter table public.athlete_exercise_blacklist  enable row level security;

-- Plan nutricional: el atleta ve el suyo; solo el admin escribe
create policy "nutrition_plans_select" on public.nutrition_plans
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "nutrition_plans_admin_write" on public.nutrition_plans
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Propuestas nutricionales: SOLO admin (el atleta ve únicamente el plan ya aprobado)
create policy "ai_nutrition_admin_all" on public.ai_nutrition_suggestions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Ciclos: el atleta los ve; solo el admin los gestiona
create policy "cycles_select" on public.training_cycles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "cycles_admin_write" on public.training_cycles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Lista negra por atleta: solo admin (el "motivo" es información interna)
create policy "blacklist_admin_all" on public.athlete_exercise_blacklist
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Corrección sobre ai_load_suggestions: el atleta YA NO resuelve propuestas.
-- Solo ve las que el admin aprobó; el admin gestiona todas.
drop policy if exists "ai_suggestions_update_own" on public.ai_load_suggestions;
drop policy if exists "ai_suggestions_select"     on public.ai_load_suggestions;

create policy "ai_suggestions_select_approved" on public.ai_load_suggestions
  for select to authenticated
  using (
    public.is_admin()
    or (user_id = (select auth.uid()) and estado = 'aceptado')
  );


-- =====================================================================
-- EJEMPLOS DE USO (descomenta para probar, cambiando los UUID)
-- =====================================================================
-- Aceptar una propuesta nutricional tal cual:
--   select public.resolve_nutrition_suggestion('UUID_PROPUESTA', 'aceptar');
-- Editarla antes de aplicarla (kcal, proteína, carbos, grasas, nota):
--   select public.resolve_nutrition_suggestion('UUID_PROPUESTA', 'editar', 2450, 180, 270, 70, 'Ajuste más conservador');
-- Rechazarla:
--   select public.resolve_nutrition_suggestion('UUID_PROPUESTA', 'rechazar', p_notas_admin => 'Mantener plan actual');
-- Aprobar una propuesta de cargas (un clic):
--   update public.ai_load_suggestions set estado = 'aceptado' where id = 'UUID_PROPUESTA';
