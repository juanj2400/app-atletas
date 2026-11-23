-- =====================================================================
-- MIGRACIÓN 09: el enlace de video de un ejercicio debe ser http o https
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- No elimina nada. Solo añade una regla de validación (CHECK) a exercises.
--
-- Por qué: el atleta ve el enlace "Ver video" en su pantalla de entrenamiento.
-- Un enlace malicioso (por ejemplo "javascript:...") podría ejecutar código al
-- tocarlo. Solo el entrenador puede escribir este campo, pero la base de datos
-- debe impedirlo igualmente (defensa en profundidad: no depender de la pantalla).
--
-- Si al ejecutarla sale un error de que alguna fila no cumple la regla, revisa en
-- Table Editor la columna video_url de `exercises` y corrige esos valores.
-- =====================================================================

alter table public.exercises
  add constraint exercises_video_url_http
  check (video_url is null or video_url ~* '^https?://');
