-- =====================================================================
-- MIGRACIÓN 08: plan nutricional manual (el entrenador lo define)
-- Ejecutar UNA vez en: Dashboard > SQL Editor > New query
-- Requiere la migración 02 (tabla nutrition_plans). No elimina nada.
--
-- La tabla nutrition_plans y sus permisos ya existen desde la migración 02:
--   - el atleta LEE sus planes; solo el admin escribe;
--   - un solo plan vigente por atleta (vigente_hasta = NULL).
-- Lo que falta es una forma segura de CAMBIAR el plan: esta función cierra el
-- plan vigente y crea el nuevo en una sola operación (todo o nada). Así el
-- historial queda completo y nunca hay dos planes vigentes ni ninguno por un
-- fallo a medias. (Es el equivalente manual de resolve_nutrition_suggestion,
-- que usará la IA más adelante.)
-- =====================================================================

create or replace function public.set_nutrition_plan(
  p_user_id          uuid,
  p_calorias         integer,
  p_proteina_g       integer default null,
  p_carbohidratos_g  integer default null,
  p_grasas_g         integer default null,
  p_objetivo         text    default null,   -- 'deficit' | 'superavit' | 'normocalorica' | NULL
  p_notas            text    default null
)
returns uuid                                  -- id del nuevo plan
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede definir planes nutricionales.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and rol = 'client') then
    raise exception 'El destinatario no es un atleta.';
  end if;

  if p_calorias is null or p_calorias < 500 or p_calorias > 10000 then
    raise exception 'Las calorías deben estar entre 500 y 10.000.';
  end if;

  if coalesce(p_proteina_g, 0) < 0 or coalesce(p_proteina_g, 0) > 1000
     or coalesce(p_carbohidratos_g, 0) < 0 or coalesce(p_carbohidratos_g, 0) > 1000
     or coalesce(p_grasas_g, 0) < 0 or coalesce(p_grasas_g, 0) > 1000 then
    raise exception 'Los macros deben estar entre 0 y 1.000 g.';
  end if;

  -- Cierra el plan vigente (si lo hay)...
  update public.nutrition_plans
     set vigente_hasta = now()
   where user_id = p_user_id and vigente_hasta is null;

  -- ...y crea el nuevo.
  insert into public.nutrition_plans
    (user_id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g,
     objetivo_calorico, origen, creado_por, notas)
  values
    (p_user_id, p_calorias, p_proteina_g, p_carbohidratos_g, p_grasas_g,
     p_objetivo, 'manual', (select auth.uid()), nullif(trim(p_notas), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_nutrition_plan(uuid, integer, integer, integer, integer, text, text)
  from public, anon;
grant execute on function public.set_nutrition_plan(uuid, integer, integer, integer, integer, text, text)
  to authenticated;
