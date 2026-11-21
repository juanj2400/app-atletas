-- =====================================================================
-- MIGRACIÓN 06: volumen por grupo muscular (con reparto en ejercicios compuestos)
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
--
-- Idea: cada ejercicio trabaja VARIOS músculos, cada uno con un "factor":
--   factor 1    = músculo principal   (cada serie cuenta como 1 serie)
--   factor 0.5  = músculo secundario  (cada serie cuenta como media serie)
-- Ejemplo: press de banca, 4 series -> pecho +4, tríceps +2, hombro frontal +2.
-- Es una guía para tu criterio: puedes ajustar los músculos de cada ejercicio.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogo de músculos (más fino que el campo antiguo "grupo_muscular",
--    que se conserva para mostrar y filtrar)
-- ---------------------------------------------------------------------
create table public.muscle_groups (
  codigo  text primary key,
  nombre  text not null,
  orden   smallint not null default 0
);

insert into public.muscle_groups (codigo, nombre, orden) values
  ('pecho',            'Pecho',                    1),
  ('dorsales',         'Dorsales',                 2),
  ('espalda_alta',     'Espalda alta',             3),
  ('hombro_frontal',   'Hombro frontal',           4),
  ('hombro_lateral',   'Hombro lateral',           5),
  ('hombro_posterior', 'Hombro posterior',         6),
  ('biceps',           'Bíceps',                   7),
  ('triceps',          'Tríceps',                  8),
  ('antebrazos',       'Antebrazos',               9),
  ('cuadriceps',       'Cuádriceps',              10),
  ('isquios',          'Isquiotibiales',          11),
  ('gluteos',          'Glúteos',                 12),
  ('pantorrillas',     'Pantorrillas',            13),
  ('core',             'Core (abdomen y lumbar)', 14);


-- ---------------------------------------------------------------------
-- 2. Qué músculos trabaja cada ejercicio y con qué factor
-- ---------------------------------------------------------------------
create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle      text not null references public.muscle_groups (codigo) on delete restrict,
  factor      numeric(3,2) not null default 1 check (factor > 0 and factor <= 1),
  primary key (exercise_id, muscle)
);

create index exercise_muscles_muscle_idx on public.exercise_muscles (muscle);


-- ---------------------------------------------------------------------
-- 3. Valores iniciales para los 14 ejercicios de la biblioteca inicial
--    (ajústalos desde la app: Biblioteca de ejercicios > Editar músculos)
-- ---------------------------------------------------------------------
insert into public.exercise_muscles (exercise_id, muscle, factor)
select e.id, v.muscle, v.factor
from (values
  ('Sentadilla trasera (Back Squat)',     'cuadriceps',       1.0),
  ('Sentadilla trasera (Back Squat)',     'gluteos',          0.5),
  ('Press de banca plano',                'pecho',            1.0),
  ('Press de banca plano',                'triceps',          0.5),
  ('Press de banca plano',                'hombro_frontal',   0.5),
  ('Peso muerto convencional',            'gluteos',          1.0),
  ('Peso muerto convencional',            'isquios',          1.0),
  ('Peso muerto convencional',            'core',             0.5),
  ('Peso muerto convencional',            'espalda_alta',     0.5),
  ('Press militar de pie',                'hombro_frontal',   1.0),
  ('Press militar de pie',                'hombro_lateral',   0.5),
  ('Press militar de pie',                'triceps',          0.5),
  ('Dominadas pronas',                    'dorsales',         1.0),
  ('Dominadas pronas',                    'biceps',           0.5),
  ('Dominadas pronas',                    'espalda_alta',     0.5),
  ('Remo con barra (Pendlay/inclinado)',  'dorsales',         1.0),
  ('Remo con barra (Pendlay/inclinado)',  'espalda_alta',     1.0),
  ('Remo con barra (Pendlay/inclinado)',  'biceps',           0.5),
  ('Remo con barra (Pendlay/inclinado)',  'hombro_posterior', 0.5),
  ('Peso muerto rumano',                  'isquios',          1.0),
  ('Peso muerto rumano',                  'gluteos',          0.5),
  ('Peso muerto rumano',                  'core',             0.5),
  ('Sentadilla frontal (Front Squat)',    'cuadriceps',       1.0),
  ('Sentadilla frontal (Front Squat)',    'gluteos',          0.5),
  ('Sentadilla frontal (Front Squat)',    'core',             0.5),
  ('Fondos en paralelas',                 'pecho',            1.0),
  ('Fondos en paralelas',                 'triceps',          1.0),
  ('Fondos en paralelas',                 'hombro_frontal',   0.5),
  ('Hip thrust con barra',                'gluteos',          1.0),
  ('Hip thrust con barra',                'isquios',          0.5),
  ('Zancadas caminando',                  'cuadriceps',       1.0),
  ('Zancadas caminando',                  'gluteos',          1.0),
  ('Press de banca inclinado',            'pecho',            1.0),
  ('Press de banca inclinado',            'hombro_frontal',   0.5),
  ('Press de banca inclinado',            'triceps',          0.5),
  ('Curl de bíceps con barra',            'biceps',           1.0),
  ('Curl de bíceps con barra',            'antebrazos',       0.5),
  ('Press francés (barra Z)',             'triceps',          1.0)
) as v(nombre, muscle, factor)
join public.exercises e on e.nombre = v.nombre
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 4. Seguridad (RLS): todos los usuarios autenticados LEEN; solo el admin escribe
-- ---------------------------------------------------------------------
alter table public.muscle_groups    enable row level security;
alter table public.exercise_muscles enable row level security;

create policy "muscle_groups_select" on public.muscle_groups
  for select to authenticated using (true);
create policy "muscle_groups_admin_write" on public.muscle_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "exercise_muscles_select" on public.exercise_muscles
  for select to authenticated using (true);
create policy "exercise_muscles_admin_write" on public.exercise_muscles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 5. Función: reemplazar los músculos de un ejercicio de una sola vez
--    (borra los anteriores e inserta los nuevos en una sola operación: todo o nada)
--    p_muscles es una lista JSON: [{"muscle":"pecho","factor":1}, ...]
-- ---------------------------------------------------------------------
create or replace function public.set_exercise_muscles(p_exercise_id uuid, p_muscles jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede editar los músculos de un ejercicio.'
      using errcode = '42501';
  end if;

  delete from public.exercise_muscles where exercise_id = p_exercise_id;

  insert into public.exercise_muscles (exercise_id, muscle, factor)
  select p_exercise_id, m ->> 'muscle', (m ->> 'factor')::numeric
  from jsonb_array_elements(p_muscles) as m;
end;
$$;

revoke all on function public.set_exercise_muscles(uuid, jsonb) from public, anon;
grant execute on function public.set_exercise_muscles(uuid, jsonb) to authenticated;
