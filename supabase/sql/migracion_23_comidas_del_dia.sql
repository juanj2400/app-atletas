-- =====================================================================
-- Migración 23 — Comidas del día con alimentos y cantidades (paso 31)
--
-- Qué hace: el entrenador arma, de forma MANUAL, el menú de un atleta:
--   comidas del día (desayuno, almuerzo, cena, snacks...) y, dentro de cada una,
--   los alimentos con su cantidad exacta (gramos, mililitros, unidades o porciones).
--   El atleta solo lo LEE, en su nueva sección "Nutrición".
--
-- Decisiones:
--   * El menú es del ATLETA, no del plan de calorías: cambiar las calorías o los
--     macros (set_nutrition_plan) no toca las comidas ni las duplica.
--   * Se guarda completo con UNA función (set_meal_plan): reemplaza todas las comidas
--     del atleta de una vez (todo o nada), igual que set_exercise_muscles con los
--     músculos. Así nunca queda un menú a medias.
--   * Dos capas de validación: la pantalla y esta base de datos (CHECK + función).
--
-- Tablas nuevas (con RLS en este mismo script):
--   meals       una fila por comida del día de un atleta (nombre, orden, notas).
--   meal_foods  una fila por alimento de una comida (alimento, cantidad, unidad, nota).
--
-- Permisos: el atleta lee lo suyo; solo el admin escribe (directo o por la función).
-- Requiere: esquema inicial (profiles, is_admin()).
--
-- AVISO: la función contiene un `delete` (borra las comidas anteriores del atleta
-- para reemplazarlas por las nuevas). El SQL Editor puede mostrar "Potential issue
-- detected": es esperable. Solo actúa cuando el entrenador pulsa "Guardar comidas".
-- Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Comidas del día
-- ---------------------------------------------------------------------
create table public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  nombre     text not null check (char_length(btrim(nombre)) between 2 and 40),
  notas      text check (notas is null or char_length(notas) <= 200),
  orden      smallint not null check (orden between 1 and 10),   -- posición en el día (1 = primera)
  created_at timestamptz not null default now(),                 -- cada guardado recrea las filas: es "actualizado el"
  unique (user_id, orden),
  unique (id, user_id)   -- permite que meal_foods apunte a (comida, atleta) y no pueda desalinearse
);

-- ---------------------------------------------------------------------
-- 2. Alimentos de cada comida
-- ---------------------------------------------------------------------
create table public.meal_foods (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null,
  user_id    uuid not null,   -- copia del dueño de la comida: hace simple y rápida la política RLS
  alimento   text not null check (char_length(btrim(alimento)) between 2 and 80),
  cantidad   numeric(7,2) not null check (cantidad > 0 and cantidad <= 10000),
  unidad     text not null check (unidad in ('g', 'ml', 'unidad', 'porcion')),
  nota       text check (nota is null or char_length(nota) <= 120),
  orden      smallint not null check (orden between 1 and 30),
  created_at timestamptz not null default now(),
  -- (meal_id, user_id) debe existir en meals: el alimento siempre es del mismo atleta que su comida.
  -- on delete cascade: al borrar una comida (o al atleta) se van sus alimentos.
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade,
  unique (meal_id, orden)
);

create index meal_foods_user_idx on public.meal_foods (user_id);

-- ---------------------------------------------------------------------
-- 3. Seguridad (RLS)
-- ---------------------------------------------------------------------
alter table public.meals      enable row level security;
alter table public.meal_foods enable row level security;

create policy "meals_select" on public.meals
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "meals_admin_write" on public.meals
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "meal_foods_select" on public.meal_foods
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "meal_foods_admin_write" on public.meal_foods
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. set_meal_plan: reemplaza TODAS las comidas de un atleta (todo o nada)
--
--   p_comidas = lista JSON en el orden del día, por ejemplo:
--     [ { "nombre": "Desayuno", "notas": "Antes de entrenar",
--         "alimentos": [ { "alimento": "Avena", "cantidad": 60, "unidad": "g", "nota": null },
--                        { "alimento": "Huevos", "cantidad": 3, "unidad": "unidad" } ] },
--       { "nombre": "Almuerzo", "alimentos": [ ... ] } ]
--   Una lista vacía [] deja al atleta sin comidas.
--   Si algo no cumple las reglas, se lanza un error en español y NO se cambia nada.
-- ---------------------------------------------------------------------
create or replace function public.set_meal_plan(
  p_user_id uuid,
  p_comidas jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comida    jsonb;
  v_pos       bigint;
  v_alimentos jsonb;
  v_alimento  jsonb;
  v_pos_a     bigint;
  v_nombre    text;
  v_nombre_a  text;
  v_notas     text;
  v_nota      text;
  v_unidad    text;
  v_cantidad  numeric;
  v_meal_id   uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede definir las comidas de un atleta.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id and rol = 'client') then
    raise exception 'El destinatario no es un atleta.';
  end if;

  if p_comidas is null or jsonb_typeof(p_comidas) <> 'array' then
    raise exception 'Las comidas deben enviarse como una lista.';
  end if;
  if jsonb_array_length(p_comidas) > 10 then
    raise exception 'Un día puede tener como máximo 10 comidas.';
  end if;

  -- Se borra lo anterior y se inserta lo nuevo. Si algo falla más abajo, la excepción
  -- deshace TODO (también este delete): el atleta nunca se queda con un menú a medias.
  delete from public.meals where user_id = p_user_id;

  for v_comida, v_pos in
    select e.value, e.ordinality
      from jsonb_array_elements(p_comidas) with ordinality as e(value, ordinality)
     order by e.ordinality
  loop
    if jsonb_typeof(v_comida) <> 'object' then
      raise exception 'La comida % no tiene el formato correcto.', v_pos;
    end if;

    v_nombre := btrim(coalesce(v_comida ->> 'nombre', ''));
    if char_length(v_nombre) < 2 or char_length(v_nombre) > 40 then
      raise exception 'La comida % necesita un nombre de 2 a 40 caracteres.', v_pos;
    end if;

    v_notas := nullif(btrim(coalesce(v_comida ->> 'notas', '')), '');
    if v_notas is not null and char_length(v_notas) > 200 then
      raise exception 'Las notas de «%» no pueden pasar de 200 caracteres.', v_nombre;
    end if;

    v_alimentos := coalesce(v_comida -> 'alimentos', '[]'::jsonb);
    if jsonb_typeof(v_alimentos) <> 'array' then
      raise exception 'Los alimentos de «%» deben ser una lista.', v_nombre;
    end if;
    if jsonb_array_length(v_alimentos) > 30 then
      raise exception '«%» puede tener como máximo 30 alimentos.', v_nombre;
    end if;

    insert into public.meals (user_id, nombre, notas, orden)
    values (p_user_id, v_nombre, v_notas, v_pos)
    returning id into v_meal_id;

    for v_alimento, v_pos_a in
      select e.value, e.ordinality
        from jsonb_array_elements(v_alimentos) with ordinality as e(value, ordinality)
       order by e.ordinality
    loop
      if jsonb_typeof(v_alimento) <> 'object' then
        raise exception 'El alimento % de «%» no tiene el formato correcto.', v_pos_a, v_nombre;
      end if;

      v_nombre_a := btrim(coalesce(v_alimento ->> 'alimento', ''));
      if char_length(v_nombre_a) < 2 or char_length(v_nombre_a) > 80 then
        raise exception 'El alimento % de «%» necesita un nombre de 2 a 80 caracteres.', v_pos_a, v_nombre;
      end if;

      -- La cantidad debe llegar como NÚMERO (no como texto). Se usa CASE porque, a diferencia
      -- de OR, garantiza que solo se convierte a número lo que ya se comprobó que es número.
      v_cantidad := case when jsonb_typeof(v_alimento -> 'cantidad') = 'number'
                         then (v_alimento ->> 'cantidad')::numeric end;
      if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 10000 then
        raise exception 'La cantidad de «%» (en «%») debe ser un número mayor que 0 y hasta 10.000.', v_nombre_a, v_nombre;
      end if;

      v_unidad := v_alimento ->> 'unidad';
      if v_unidad is null or v_unidad not in ('g', 'ml', 'unidad', 'porcion') then
        raise exception 'La unidad de «%» (en «%») debe ser g, ml, unidad o porcion.', v_nombre_a, v_nombre;
      end if;

      v_nota := nullif(btrim(coalesce(v_alimento ->> 'nota', '')), '');
      if v_nota is not null and char_length(v_nota) > 120 then
        raise exception 'La nota de «%» no puede pasar de 120 caracteres.', v_nombre_a;
      end if;

      insert into public.meal_foods (meal_id, user_id, alimento, cantidad, unidad, nota, orden)
      values (v_meal_id, p_user_id, v_nombre_a, round(v_cantidad, 2), v_unidad, v_nota, v_pos_a);
    end loop;
  end loop;
end;
$$;

revoke all on function public.set_meal_plan(uuid, jsonb) from public, anon;
grant execute on function public.set_meal_plan(uuid, jsonb) to authenticated;
