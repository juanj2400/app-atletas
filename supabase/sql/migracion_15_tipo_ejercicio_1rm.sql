-- =====================================================================
-- Migración 15 — Tipo de ejercicio y 1RM solo para compuestos/fuerza/halterofilia (paso 15)
--
-- Qué hace:
--   1) Agrega exercises.tipo_ejercicio: 'compuesto', 'fuerza', 'halterofilia' o 'aislado'.
--      Los ejercicios ya existentes quedan como 'compuesto' (así los récords actuales no
--      cambian); los dos aislados de los 14 iniciales (curl de bíceps y press francés) se
--      marcan 'aislado' y los 4 grandes levantamientos, 'fuerza'. El resto (y los que
--      hayas creado tú) hay que revisarlos en la Biblioteca de ejercicios.
--   2) Actualiza la vista v_athlete_prs: para los ejercicios aislados NO calcula 1RM
--      (e1rm_kg = null) y su "mejor serie" es la de mayor peso (y, a igual peso, más
--      repeticiones). Los compuestos se calculan exactamente igual que antes.
--      Se agregan al final las columnas tipo_ejercicio y aplica_1rm.
--   3) v_best_reps_by_weight NO cambia: los aislados siguen guardando sus mejores
--      repeticiones con cada peso.
--
-- Requiere: esquema inicial y migración 02 (v_athlete_prs).
-- Contiene dos UPDATE con WHERE (marcan los ejercicios iniciales); no borra nada.
-- Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================

alter table public.exercises
  add column if not exists tipo_ejercicio text not null default 'compuesto'
    check (tipo_ejercicio in ('compuesto', 'fuerza', 'halterofilia', 'aislado'));

comment on column public.exercises.tipo_ejercicio is
  'compuesto/fuerza/halterofilia: se estima su 1RM. aislado: solo mejores repeticiones por peso.';

-- Clasificación de los ejercicios iniciales (por nombre exacto; si no existen, no hace nada)
update public.exercises set tipo_ejercicio = 'aislado'
where nombre in ('Curl de bíceps con barra', 'Press francés (barra Z)');

update public.exercises set tipo_ejercicio = 'fuerza'
where nombre in ('Sentadilla trasera (Back Squat)', 'Press de banca plano',
                 'Peso muerto convencional', 'Press militar de pie');

create or replace view public.v_athlete_prs
with (security_invoker = true) as
with calc as (
  select
    rl.user_id, rl.exercise_id, rl.peso_kg, rl.repeticiones, rl.rpe, rl.realizado_en,
    e.tipo_ejercicio,
    (e.tipo_ejercicio <> 'aislado') as aplica_1rm,
    case when e.tipo_ejercicio = 'aislado' then null          -- aislado: sin estimación
         when rl.repeticiones = 1 then rl.peso_kg
         else round(rl.peso_kg * (1 + rl.repeticiones / 30.0), 1)
    end as e1rm_kg
  from public.routine_logs rl
  join public.exercises e on e.id = rl.exercise_id
  where rl.peso_kg > 0
),
ranked as (
  select calc.*,
         row_number() over (
           partition by user_id, exercise_id
           -- compuestos: mayor 1RM; aislados: mayor peso y luego más repeticiones.
           -- En ambos, a igualdad gana la serie más antigua.
           order by case when aplica_1rm then e1rm_kg else peso_kg end desc,
                    case when aplica_1rm then 0 else repeticiones end desc,
                    realizado_en asc
         ) as rn
  from calc
)
select
  r.user_id, r.exercise_id,
  e.nombre as ejercicio, e.grupo_muscular,
  r.peso_kg, r.repeticiones, r.rpe, r.e1rm_kg,
  r.realizado_en as fecha_pr,
  r.tipo_ejercicio, r.aplica_1rm
from ranked r
join public.exercises e on e.id = r.exercise_id
where r.rn = 1;
