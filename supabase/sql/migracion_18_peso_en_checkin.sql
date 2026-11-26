-- =====================================================================
-- Migración 18 — Peso corporal opcional en el check-in diario (paso 22)
--
-- Qué hace:
--   1) Columna nueva daily_check_ins.peso_corporal_kg (opcional, hasta 1 decimal) con una
--      regla CHECK: si hay valor, debe estar entre 20 y 400 kg (la misma regla que las
--      mediciones oficiales). null = el atleta no lo quiso anotar.
--
-- Lo que NO cambia (a propósito):
--   - Las políticas RLS de daily_check_ins (migración 05): el atleta solo CREA su check-in
--     de hoy, una vez por día (único user_id + fecha); no puede modificarlo ni borrarlo.
--     La columna nueva hereda esas reglas: el peso se declara al crear el check-in y ya no
--     se cambia. El admin conserva todos los permisos.
--   - La tabla metrics: sigue siendo SOLO del entrenador (el atleta únicamente la lee).
--     El peso del check-in es un dato DECLARADO por el atleta, aparte de la medición oficial:
--     no se copia a metrics ni la reemplaza, así los gráficos de evolución y la tendencia
--     siguen usando solo lo que mide el entrenador.
--
-- No elimina nada (sin DROP ni DELETE): el SQL Editor no debería mostrar el aviso
-- "Potential issue". Las filas existentes quedan con peso_corporal_kg = null.
--
-- Requiere: esquema inicial y migración 05.
-- Aplicar PRIMERO este SQL y después subir el código (la app nueva envía la columna nueva).
-- =====================================================================

alter table public.daily_check_ins
  add column if not exists peso_corporal_kg numeric(4,1)
    check (peso_corporal_kg between 20 and 400);

comment on column public.daily_check_ins.peso_corporal_kg is
  'Peso (kg) que el atleta declara al hacer el check-in; opcional. No es una medición oficial (esas están en metrics y solo las escribe el admin).';
