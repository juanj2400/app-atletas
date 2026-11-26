-- =====================================================================
-- Migración 13 — Cierre de ejercicio con nota (paso 13)
--
-- Qué hace: crea la tabla exercise_closures. Cuando el atleta da un ejercicio
-- por terminado SIN completar todas las series, se guarda aquí el motivo (nota
-- obligatoria) para que el entrenador lo vea en el historial del atleta.
--
-- Reglas (todas impuestas en la base de datos, no solo en la pantalla):
--   * Una fila por atleta, ejercicio de la rutina y día local (unique).
--   * La nota es obligatoria: entre 3 y 500 caracteres sin contar espacios sobrantes.
--   * El atleta solo crea y borra (para "reabrir") cierres PROPIOS de ejercicios
--     de SU rutina activa; no los modifica. El admin ve y gestiona todos.
--   * series_hechas / series_objetivo son una "foto" del momento del cierre.
--
-- Requiere: esquema inicial y migración 04 (routine_exercises).
-- No contiene sentencias destructivas (sin drop ni delete).
-- Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================

create table public.exercise_closures (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  exercise_id         uuid not null references public.exercises (id) on delete restrict,
  -- set null: si el entrenador borra la rutina, la nota del atleta se conserva
  routine_exercise_id uuid references public.routine_exercises (id) on delete set null,
  fecha               date not null,                 -- día LOCAL del atleta (lo manda la app)
  nota                text not null
                        check (char_length(btrim(nota)) between 3 and 500),
  series_hechas       smallint not null check (series_hechas >= 0),
  series_objetivo     smallint not null check (series_objetivo between 1 and 20),
  cerrado_en          timestamptz not null default now(),
  check (series_hechas < series_objetivo),           -- si completó todo no hay nada que justificar
  unique (user_id, routine_exercise_id, fecha)
);

create index exercise_closures_user_fecha_idx
  on public.exercise_closures (user_id, fecha desc);

alter table public.exercise_closures enable row level security;

-- Lectura: el atleta ve los suyos; el admin, todos.
create policy "closures_select" on public.exercise_closures
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Crear: el atleta solo a su nombre y sobre un ejercicio de su rutina activa
-- (la subconsulta respeta RLS: el atleta solo ve su rutina activa).
create policy "closures_insert_atleta" on public.exercise_closures
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.routine_exercises re
      join public.routine_days d on d.id = re.day_id
      join public.routines r on r.id = d.routine_id
      where re.id = exercise_closures.routine_exercise_id
        and re.exercise_id = exercise_closures.exercise_id
        and r.user_id = (select auth.uid())
        and r.estado = 'activa'
    )
  );

-- Borrar: el atleta quita su propio cierre (reabrir el ejercicio).
create policy "closures_delete_atleta" on public.exercise_closures
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- El admin gestiona todo.
create policy "closures_admin_all" on public.exercise_closures
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
