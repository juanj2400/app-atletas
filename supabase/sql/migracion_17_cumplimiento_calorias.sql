-- =====================================================================
-- Migración 17 — Cumplimiento de calorías con tres estados (paso 21)
--
-- Antes, el check-in preguntaba "¿cumpliste las calorías de ayer?" y solo guardaba
-- sí/no (daily_check_ins.calorias_ayer_cumplidas, boolean). Un "no" no decía si el
-- atleta comió de menos o de más, y para el entrenador son situaciones distintas.
--
-- Qué hace:
--   1) Columna nueva daily_check_ins.cumplimiento_calorias, con una regla CHECK que solo
--      admite tres valores:
--        'cumplio'  -> "Cumplí las calorías"
--        'menos'    -> "Consumí menos de las estipuladas"
--        'mas'      -> "Consumí más de las estipuladas"
--      (null = sin dato: check-ins viejos con "no" y otros sin respuesta).
--   2) Copia lo antiguo: los check-ins que decían "sí" pasan a 'cumplio'. Los que decían
--      "no" se quedan en null, porque no sabemos si fue de más o de menos (la pantalla
--      los muestra como "No cumplió (sin detalle)"). No se inventa ningún dato.
--   3) Trigger sincronizar_cumplimiento_calorias: mantiene la columna antigua
--      (calorias_ayer_cumplidas) coherente con la nueva (true solo si 'cumplio'). Así
--      lo que ya lee esa columna (la Edge Function de la IA, en pausa) sigue funcionando
--      y una versión vieja de la app (instalada en un celular sin actualizar) puede
--      seguir guardando sí/no sin romperse.
--
-- La columna antigua NO se elimina ni se cambia de tipo. No se elimina nada:
-- el SQL Editor no debería mostrar el aviso de "Potential issue". Hay un UPDATE con WHERE
-- (paso 2) que solo rellena la columna nueva.
--
-- Las políticas RLS de daily_check_ins (migración 05) no cambian: el atleta solo crea su
-- check-in de hoy; el admin puede todo. La columna nueva hereda esas reglas.
--
-- Requiere: esquema inicial y migración 05.
-- Aplicar PRIMERO este SQL y después subir el código (la app nueva guarda en la columna nueva).
-- =====================================================================

alter table public.daily_check_ins
  add column if not exists cumplimiento_calorias text
    check (cumplimiento_calorias in ('cumplio', 'menos', 'mas'));

comment on column public.daily_check_ins.cumplimiento_calorias is
  'Calorías de ayer: cumplio | menos | mas. null = sin dato (check-ins viejos con "no").';
comment on column public.daily_check_ins.calorias_ayer_cumplidas is
  'Legado sí/no. Se mantiene sincronizada por trigger: true solo si cumplimiento_calorias = cumplio.';

-- 2) Los "sí" antiguos pasan a 'cumplio'. Los "no" quedan en null (se desconoce la dirección).
update public.daily_check_ins
   set cumplimiento_calorias = 'cumplio'
 where calorias_ayer_cumplidas is true
   and cumplimiento_calorias is null;

-- 3) Mantener coherentes las dos columnas.
create or replace function public.sincronizar_cumplimiento_calorias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cumplimiento_calorias is not null then
    -- La columna nueva manda: el booleano antiguo es solo un reflejo.
    new.calorias_ayer_cumplidas := (new.cumplimiento_calorias = 'cumplio');
  elsif new.calorias_ayer_cumplidas is true then
    -- Una app vieja que solo manda "sí": se completa la columna nueva.
    new.cumplimiento_calorias := 'cumplio';
  end if;
  return new;
end;
$$;

create trigger sincronizar_cumplimiento_calorias
  before insert or update on public.daily_check_ins
  for each row execute function public.sincronizar_cumplimiento_calorias();
