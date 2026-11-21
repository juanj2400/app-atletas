-- =====================================================================
-- MIGRACIÓN 03: las mediciones (metrics) las registra SOLO el administrador
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- Requiere haber ejecutado antes schema_supabase.sql y la migración 02.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Un solo registro por atleta y día
--    Permite "reemplazar la medición de ese día" con upsert (onConflict
--    'user_id,fecha'). SIN este índice, el guardado de la app falla.
--
--    Si esta sentencia da error "could not create unique index... duplicate key",
--    significa que ya tienes dos mediciones del mismo atleta en el mismo día.
--    Bórralas desde Table Editor y vuelve a ejecutar.
-- ---------------------------------------------------------------------
create unique index if not exists metrics_user_fecha_uniq
  on public.metrics (user_id, fecha);

-- El índice anterior (user_id, fecha desc) queda redundante: un índice
-- ordenado puede recorrerse en ambos sentidos. Lo eliminamos para no
-- mantener dos índices que hacen lo mismo.
drop index if exists public.metrics_user_fecha_idx;


-- ---------------------------------------------------------------------
-- 2. Permisos (RLS): el atleta solo LEE sus mediciones; el admin gestiona todo
--
--    Antes existía una política "metrics_owner_or_admin" que dejaba al dueño
--    escribir. Aunque la pantalla del atleta no tenga formulario, un atleta
--    podría llamar a la API directamente con su sesión y registrar datos
--    falsos. Ocultar un botón NO es seguridad; la política sí lo es.
-- ---------------------------------------------------------------------
drop policy if exists "metrics_owner_or_admin" on public.metrics;

-- Lectura: el atleta ve las suyas (para que más adelante pueda ver su progreso)
-- y el admin ve todas.
create policy "metrics_select_own_or_admin" on public.metrics
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Escritura (insertar, modificar, borrar): solo el admin.
create policy "metrics_admin_write" on public.metrics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Si prefieres que el atleta NO vea sus mediciones, elimina la política de
-- lectura de arriba y deja solo la del admin:
--   drop policy "metrics_select_own_or_admin" on public.metrics;
--   create policy "metrics_admin_select" on public.metrics
--     for select to authenticated using (public.is_admin());
--
-- Nota: la función de IA lee estas tablas con la service_role key, que ignora
-- RLS, así que este cambio no la afecta.
