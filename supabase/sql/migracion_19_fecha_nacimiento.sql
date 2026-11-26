-- =====================================================================
-- Migración 19 — Fecha de nacimiento del atleta (paso 23)
--
-- Qué hace:
--   1) Columna nueva profiles.fecha_nacimiento (tipo date, opcional). Los atletas que ya
--      existen quedan con null hasta que el entrenador la anote.
--   2) Regla CHECK: no puede ser anterior al 1 de enero de 1900.
--   3) Trigger validar_fecha_nacimiento: rechaza fechas futuras. Va en un trigger y no en
--      un CHECK porque "hoy" cambia cada día y un CHECK con current_date no es estable
--      (puede fallar al restaurar una copia de seguridad).
--   4) Función set_fecha_nacimiento(atleta, fecha): la ÚNICA vía para escribir la columna.
--      Solo el admin puede llamarla (comprueba is_admin()). Con fecha null la borra.
--
-- Permisos (a propósito):
--   - Hoy el atleta solo puede editar la columna nombre_completo de su perfil (GRANT por
--     columna de la migración inicial). La columna nueva NO se concede, así que el atleta no
--     puede cambiar su fecha de nacimiento ni la de nadie; el admin escribe con la función.
--   - La lectura sigue igual (política profiles_select): el atleta ve su perfil y el admin
--     ve todos. No se crea ninguna política nueva.
--
-- No elimina nada (sin DROP ni DELETE): el SQL Editor no debería mostrar el aviso
-- "Potential issue".
--
-- Requiere: esquema inicial (tabla profiles y función is_admin).
-- Aplicar PRIMERO este SQL y después subir el código (la app nueva pide la columna nueva).
-- =====================================================================

alter table public.profiles
  add column if not exists fecha_nacimiento date
    check (fecha_nacimiento >= date '1900-01-01');

comment on column public.profiles.fecha_nacimiento is
  'Fecha de nacimiento del atleta; opcional. La escribe solo el admin con set_fecha_nacimiento().';

-- ---------------------------------------------------------------------
-- Trigger: la fecha no puede ser futura.
-- Se compara con la fecha UTC de Postgres. Colombia (UTC-5) nunca va por delante de UTC,
-- así que "hoy" en el celular siempre es una fecha válida.
-- ---------------------------------------------------------------------
create or replace function public.validar_fecha_nacimiento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fecha_nacimiento is not null and new.fecha_nacimiento > current_date then
    raise exception 'La fecha de nacimiento no puede ser futura.';
  end if;
  return new;
end;
$$;

create or replace trigger validar_fecha_nacimiento
  before insert or update of fecha_nacimiento on public.profiles
  for each row execute function public.validar_fecha_nacimiento();

-- ---------------------------------------------------------------------
-- RPC: guardar (o borrar) la fecha de nacimiento de un atleta. Solo admin.
-- security definer: corre con los permisos del dueño de la función, por eso comprueba
-- is_admin() ella misma y fija search_path vacío.
-- ---------------------------------------------------------------------
create or replace function public.set_fecha_nacimiento(p_atleta uuid, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el entrenador puede cambiar la fecha de nacimiento.';
  end if;

  if p_fecha is not null and p_fecha < date '1900-01-01' then
    raise exception 'La fecha de nacimiento no puede ser anterior a 1900.';
  end if;

  update public.profiles
     set fecha_nacimiento = p_fecha
   where id = p_atleta and rol = 'client';

  if not found then
    raise exception 'No se encontró al atleta.';
  end if;
end;
$$;

revoke all on function public.set_fecha_nacimiento(uuid, date) from public, anon;
grant execute on function public.set_fecha_nacimiento(uuid, date) to authenticated;
