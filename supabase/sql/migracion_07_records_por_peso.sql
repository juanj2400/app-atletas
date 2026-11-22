-- =====================================================================
-- MIGRACIÓN 07: marcas personales — mejores repeticiones por peso
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- Requiere el esquema inicial (usa routine_logs) y la migración 02 (vista v_athlete_prs).
-- Esta migración NO elimina nada: solo crea una vista nueva.
--
-- Qué devuelve: por atleta, ejercicio y PESO, la mayor cantidad de repeticiones
-- lograda con ese peso. Ejemplo: con 100 kg -> 6 reps (RPE 8, el 14 nov).
-- Es la base para "saber con cuánto trabajar" cada ejercicio y para la
-- progresión semanal de repeticiones (se construye con la IA más adelante).
--
-- ¿Por qué una vista y no calcularlo en la app? Supabase devuelve como máximo
-- 1.000 filas por consulta y el historial de series crece sin parar. La base de
-- datos resume (una fila por peso) y la app solo recibe el resumen.
--
-- security_invoker = true: la vista respeta las políticas RLS de routine_logs
-- (el atleta ve solo lo suyo; el entrenador ve todo).
-- =====================================================================

create or replace view public.v_best_reps_by_weight
with (security_invoker = true) as
select distinct on (rl.user_id, rl.exercise_id, rl.peso_kg)
  rl.user_id,
  rl.exercise_id,
  rl.peso_kg,
  rl.repeticiones   as reps_max,       -- mejor marca con ese peso
  rl.rpe,                              -- RPE de esa serie
  rl.realizado_en   as fecha_mejor,    -- primera vez que se logró esa marca
  count(*) over (
    partition by rl.user_id, rl.exercise_id, rl.peso_kg
  )                 as series_totales  -- cuántas series se han hecho con ese peso
from public.routine_logs rl
where rl.peso_kg > 0                   -- el peso corporal (0 kg) no tiene "marca por peso"
order by rl.user_id, rl.exercise_id, rl.peso_kg,
         rl.repeticiones desc,         -- gana la serie con más repeticiones...
         rl.realizado_en asc;          -- ...y, si empatan, la más antigua (cuando se estableció)
