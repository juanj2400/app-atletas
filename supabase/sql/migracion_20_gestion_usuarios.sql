-- =====================================================================
-- Migración 20 — Gestión de usuarios desde la app (paso 24)
--
-- Qué hace:
--   1) Columna nueva profiles.activo (boolean, por defecto true): estado del atleta.
--      Los atletas que ya existen quedan activos. La columna NO se concede al atleta
--      (el GRANT por columnas de la migración inicial solo le deja editar nombre_completo),
--      así que solo la puede cambiar la Edge Function "admin-usuarios" (service_role), que
--      además bloquea o desbloquea el inicio de sesión en Supabase Auth. Por eso no hay
--      función SQL para cambiarla: así el estado y el bloqueo de Auth nunca se descuadran.
--   2) Función set_perfil_atleta(atleta, nombre, fecha_nacimiento): la vía para que el admin
--      edite el nombre y la fecha de nacimiento de un atleta en una sola operación. Solo
--      admin (comprueba is_admin()), solo sobre perfiles con rol 'client'. El trigger
--      validar_fecha_nacimiento (migración 19) sigue rechazando fechas futuras.
--
-- Permisos (a propósito):
--   - No se crea ninguna política nueva ni se amplía el GRANT: el atleta sigue pudiendo
--     editar únicamente su nombre_completo. El rol NO se puede cambiar desde la app (un
--     entrenador único no necesita crear otros admin; se hace a mano en el SQL Editor).
--   - La creación de usuarios NO va aquí: necesita la clave service_role, que solo vive en
--     la Edge Function (supabase/functions/admin-usuarios). El trigger handle_new_user ya
--     crea el perfil (rol 'client', activo = true) cuando la función crea el usuario.
--
-- No elimina nada (sin DROP ni DELETE): el SQL Editor no debería mostrar el aviso
-- "Potential issue".
--
-- Requiere: esquema inicial y migración 19 (usa profiles.fecha_nacimiento).
-- Aplicar PRIMERO este SQL y después subir el código (la app nueva pide la columna activo).
-- =====================================================================

alter table public.profiles
  add column if not exists activo boolean not null default true;

comment on column public.profiles.activo is
  'false = acceso desactivado por el entrenador. Solo lo cambia la Edge Function admin-usuarios (que además bloquea el login en Auth).';

-- ---------------------------------------------------------------------
-- RPC: editar nombre y fecha de nacimiento de un atleta. Solo admin.
-- security definer: corre con los permisos del dueño de la función, por eso comprueba
-- is_admin() ella misma y fija search_path vacío. Los mensajes van en español porque la
-- pantalla los muestra tal cual (código P0001).
-- ---------------------------------------------------------------------
create or replace function public.set_perfil_atleta(p_atleta uuid, p_nombre text, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  if not public.is_admin() then
    raise exception 'Solo el entrenador puede editar el perfil del atleta.';
  end if;

  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'El nombre debe tener entre 2 y 80 caracteres.';
  end if;

  if p_fecha is not null and p_fecha < date '1900-01-01' then
    raise exception 'La fecha de nacimiento no puede ser anterior a 1900.';
  end if;

  update public.profiles
     set nombre_completo = v_nombre,
         fecha_nacimiento = p_fecha
   where id = p_atleta and rol = 'client';

  if not found then
    raise exception 'No se encontró al atleta.';
  end if;
end;
$$;

revoke all on function public.set_perfil_atleta(uuid, text, date) from public, anon;
grant execute on function public.set_perfil_atleta(uuid, text, date) to authenticated;
