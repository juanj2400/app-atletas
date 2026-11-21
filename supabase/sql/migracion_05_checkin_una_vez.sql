-- =====================================================================
-- MIGRACIÓN 05: el check-in diario se llena UNA sola vez por día
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
--
-- Antes, el atleta podía corregir su check-in (política "para todo").
-- Ahora el atleta solo puede CREAR el de hoy: no puede modificarlo ni borrarlo.
-- Lo que impide repetirlo es la base de datos (no solo la pantalla):
--   - sin permiso de UPDATE/DELETE, no puede cambiarlo,
--   - la restricción unique (user_id, fecha) ya existente impide un segundo registro del mismo día.
-- El entrenador (admin) conserva todos los permisos.
-- =====================================================================

drop policy if exists "check_ins_owner_or_admin" on public.daily_check_ins;

-- Leer: el atleta ve los suyos; el admin ve todos.
create policy "check_ins_select_own_or_admin" on public.daily_check_ins
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Crear: solo a su nombre, y con una fecha razonable.
-- La fecha la envía el celular (hora local del país del atleta). Postgres usa
-- UTC, que puede diferir en hasta un día; por eso se acepta ayer, hoy o mañana.
-- Así nadie puede rellenar días lejanos del pasado o del futuro.
create policy "check_ins_insert_own" on public.daily_check_ins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and fecha between current_date - 1 and current_date + 1
  );

-- El admin puede todo (corregir o borrar un check-in si hace falta).
create policy "check_ins_admin_write" on public.daily_check_ins
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
