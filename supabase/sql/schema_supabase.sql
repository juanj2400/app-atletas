-- =====================================================================
-- ESQUEMA INICIAL: App privada de gestión de atletas (Supabase / PostgreSQL)
-- Ejecutar UNA sola vez en: Dashboard > SQL Editor > New query
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES  (extiende auth.users; 1 fila por usuario)
-- ---------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  rol             text not null default 'client'
                    check (rol in ('admin', 'client')),
  nombre_completo text,
  email           text unique,
  created_at      timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de cada usuario, vinculado 1:1 a auth.users.';


-- ---------------------------------------------------------------------
-- 2. EXERCISES  (biblioteca global)
-- ---------------------------------------------------------------------
create table public.exercises (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  grupo_muscular text,
  descripcion    text,
  video_url      text,
  restringido    boolean not null default false,  -- true = lista negra / no asignar
  created_at     timestamptz not null default now()
);

comment on column public.exercises.restringido is
  'Control de restricciones: true marca el ejercicio como no recomendable/bloqueado.';


-- ---------------------------------------------------------------------
-- 3. METRICS  (historial antropométrico y calórico)
-- ---------------------------------------------------------------------
create table public.metrics (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  fecha                 date not null default current_date,
  peso_corporal_kg      numeric(5,2) check (peso_corporal_kg > 0),
  perimetro_cintura_cm  numeric(5,2) check (perimetro_cintura_cm > 0),
  calorias_consumidas   integer      check (calorias_consumidas >= 0),
  estado_calorico       text         check (estado_calorico in ('deficit', 'superavit', 'normocalorica')),
  notas                 text,
  created_at            timestamptz not null default now()
);

create index metrics_user_fecha_idx on public.metrics (user_id, fecha desc);


-- ---------------------------------------------------------------------
-- 4. ROUTINE_LOGS  (una fila por serie ejecutada)
-- ---------------------------------------------------------------------
create table public.routine_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  sesion_id     uuid,                                  -- opcional: agrupar series de un mismo entrenamiento
  numero_serie  smallint check (numero_serie > 0),
  repeticiones  smallint not null check (repeticiones > 0),
  peso_kg       numeric(6,2) not null check (peso_kg >= 0),   -- 0 = peso corporal
  rpe           numeric(3,1) check (rpe between 1 and 10),    -- admite 7.5, 8.5, etc.
  notas         text,
  realizado_en  timestamptz not null default now()
);

create index routine_logs_user_fecha_idx on public.routine_logs (user_id, realizado_en desc);
create index routine_logs_exercise_idx   on public.routine_logs (exercise_id);
create index routine_logs_user_ex_idx    on public.routine_logs (user_id, exercise_id, realizado_en desc);


-- ---------------------------------------------------------------------
-- 5. AI_LOAD_SUGGESTIONS  (buzón de propuestas de la IA)
-- ---------------------------------------------------------------------
create table public.ai_load_suggestions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  exercise_id           uuid not null references public.exercises (id) on delete cascade,
  peso_actual_kg        numeric(6,2) check (peso_actual_kg >= 0),
  peso_sugerido_kg      numeric(6,2) not null check (peso_sugerido_kg >= 0),
  repeticiones_sugeridas smallint check (repeticiones_sugeridas > 0),
  razon                 text,                          -- justificación de la IA
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente', 'aceptado', 'rechazado')),
  created_at            timestamptz not null default now(),
  resuelto_en           timestamptz                    -- NULL mientras esté pendiente
);

create index ai_suggestions_user_estado_idx on public.ai_load_suggestions (user_id, estado);


-- ---------------------------------------------------------------------
-- 6. DAILY_CHECK_INS  (encuesta previa al entrenamiento)
-- ---------------------------------------------------------------------
create table public.daily_check_ins (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  fecha                   date not null default current_date,
  calorias_ayer_cumplidas boolean,                     -- ¿cumpliste las calorías de ayer? sí/no
  horas_sueno             numeric(3,1) check (horas_sueno between 0 and 24),
  estado_animo            text check (estado_animo in ('mal', 'regular', 'bien')),  -- 😞 😐 😄
  se_siente_recuperado    boolean,                     -- sensación de recuperación sí/no
  created_at              timestamptz not null default now(),
  unique (user_id, fecha)                              -- 1 check-in por atleta y día
);


-- =====================================================================
-- AUTOMATIZACIÓN: crear el perfil al registrarse un usuario en Auth
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nombre_completo)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre_completo'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =====================================================================
-- SEGURIDAD: Row Level Security (RLS)
-- =====================================================================

-- Función auxiliar (security definer evita recursión infinita en las políticas)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

alter table public.profiles            enable row level security;
alter table public.exercises           enable row level security;
alter table public.metrics             enable row level security;
alter table public.routine_logs        enable row level security;
alter table public.ai_load_suggestions enable row level security;
alter table public.daily_check_ins     enable row level security;

-- PROFILES: cada quien ve y edita su perfil; el admin ve todos
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Un cliente NO puede auto-asignarse el rol 'admin': solo puede editar su nombre
revoke update on public.profiles from authenticated, anon;
grant  update (nombre_completo) on public.profiles to authenticated;

-- EXERCISES: todos los autenticados leen; solo el admin escribe
create policy "exercises_select" on public.exercises
  for select to authenticated using (true);

create policy "exercises_admin_write" on public.exercises
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- METRICS / ROUTINE_LOGS / DAILY_CHECK_INS: dueño con CRUD completo, admin ve y gestiona todo
create policy "metrics_owner_or_admin" on public.metrics
  for all to authenticated
  using      (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

create policy "routine_logs_owner_or_admin" on public.routine_logs
  for all to authenticated
  using      (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

create policy "check_ins_owner_or_admin" on public.daily_check_ins
  for all to authenticated
  using      (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

-- AI_LOAD_SUGGESTIONS: el atleta lee y responde (aceptar/rechazar) las suyas; el admin gestiona todas
-- (La IA insertará desde el servidor con la service_role key, que ignora RLS.)
create policy "ai_suggestions_select" on public.ai_load_suggestions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "ai_suggestions_update_own" on public.ai_load_suggestions
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "ai_suggestions_admin_all" on public.ai_load_suggestions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =====================================================================
-- SEED: biblioteca inicial de ejercicios clásicos de fuerza
-- =====================================================================
insert into public.exercises (nombre, grupo_muscular, descripcion, video_url, restringido) values
  ('Sentadilla trasera (Back Squat)',  'Piernas',   'Barra sobre trapecios, descenso controlado hasta paralelo o más, espalda neutra y empuje a través del medio pie.', null, false),
  ('Press de banca plano',             'Pecho',     'Tumbado en banco, escápulas retraídas, baja la barra al pecho y empuja en trayectoria ligeramente diagonal.', null, false),
  ('Peso muerto convencional',         'Espalda',   'Barra desde el suelo, espalda neutra, empuja el suelo con las piernas y extiende cadera hasta bloquear.', null, false),
  ('Press militar de pie',             'Hombros',   'Barra desde clavículas hasta sobre la cabeza, glúteos y abdomen contraídos, sin hiperextender la lumbar.', null, false),
  ('Dominadas pronas',                 'Espalda',   'Agarre prono algo más ancho que hombros, sube hasta que la barbilla supere la barra con control.', null, false),
  ('Remo con barra (Pendlay/inclinado)','Espalda',  'Torso inclinado, espalda neutra, tira de la barra hacia el abdomen bajo sin impulso del tronco.', null, false),
  ('Peso muerto rumano',               'Isquiotibiales', 'Bisagra de cadera con rodillas semiflexionadas, la barra baja pegada a las piernas hasta sentir tensión en isquios.', null, false),
  ('Sentadilla frontal (Front Squat)', 'Piernas',   'Barra apoyada en deltoides anteriores, torso erguido y codos altos; gran énfasis en cuádriceps.', null, false),
  ('Fondos en paralelas',              'Pecho/Tríceps', 'Cuerpo ligeramente inclinado hacia delante, baja hasta ~90° de codo y empuja hasta extensión.', null, false),
  ('Hip thrust con barra',             'Glúteos',   'Espalda alta apoyada en banco, barra sobre la cadera, extensión completa de cadera con pausa arriba.', null, false),
  ('Zancadas caminando',               'Piernas',   'Paso largo alternando piernas, rodilla delantera alineada con el pie, torso estable.', null, false),
  ('Press de banca inclinado',         'Pecho',     'Banco a 30-45°, énfasis en la porción clavicular del pectoral y deltoides anterior.', null, false),
  ('Curl de bíceps con barra',         'Bíceps',    'De pie, codos fijos junto al torso, flexiona sin balanceo y baja controlado.', null, false),
  ('Press francés (barra Z)',          'Tríceps',   'Tumbado, flexiona solo los codos llevando la barra hacia la frente y extiende sin abrir los codos.', null, false)
on conflict (nombre) do nothing;


-- =====================================================================
-- PASO MANUAL TRAS REGISTRARTE: conviértete en admin
-- (descomenta, cambia el email y ejecútalo SOLO esta línea)
-- =====================================================================
-- update public.profiles set rol = 'admin' where email = 'tu_correo@ejemplo.com';
