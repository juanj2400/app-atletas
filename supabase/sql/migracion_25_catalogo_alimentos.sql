-- =====================================================================
-- Migración 25 — Catálogo de alimentos + snapshot de macros en las comidas (paso 34)
--
-- Qué hace:
--   1. Crea la tabla `foods`: catálogo PROPIO de alimentos con sus macros por 100 g,
--      su estado de preparación (crudo / cocido / n/a) y su macro dominante.
--      El entrenador lo administra desde la app (/admin/alimentos), sin IA.
--   2. Carga un seed inicial (~100 alimentos de nutrición deportiva; crudo y cocido
--      cuando aplica). Son valores de referencia APROXIMADOS (tipo tablas USDA): el
--      entrenador puede ajustarlos desde la app. Las marcas comerciales varían.
--   3. Agrega a `meal_foods` las columnas del SNAPSHOT: de qué alimento del catálogo
--      viene, su estado, sus macros base por 100 g y los macros ASIGNADOS (los de los
--      gramos exactos). Así, si luego el entrenador cambia el catálogo, el menú ya
--      guardado del atleta NO cambia.
--   4. Reemplaza `set_meal_plan` (misma firma) para aceptar y validar ese snapshot.
--      Los alimentos manuales (sin catálogo) siguen funcionando igual que antes.
--
-- Decisiones:
--   * El catálogo es GLOBAL y solo lo ve y escribe el admin (RLS). El atleta NO lo lee:
--     le basta el snapshot que viaja en `meal_foods` (ya legible por él).
--   * `macro_dominante` es una columna GENERADA (por aporte calórico: 4 kcal/g proteína
--     y carbohidratos, 9 kcal/g grasa): nunca queda desincronizada de los macros.
--   * `nombre_busqueda` (sin tildes, en minúsculas) también es generada: la búsqueda se
--     hace en el servidor con `ilike` y `limit`, sin descargar el catálogo completo.
--   * Los macros ASIGNADOS los calcula la base de datos (base × gramos / 100): el cliente
--     no puede mandar una cuenta distinta a la de los gramos.
--   * Sin `delete` de alimentos desde la app: se DESACTIVAN (`activo = false`). Así el
--     historial y los snapshots siguen siendo coherentes.
--
-- Requiere: esquema inicial (is_admin()) y la migración 23 (meals, meal_foods, set_meal_plan).
-- Orden: aplicar PRIMERO este SQL y después subir el código.
--
-- AVISO: `set_meal_plan` conserva su `delete` interno (borra las comidas anteriores del
-- atleta para reemplazarlas al guardar). El SQL Editor puede mostrar "Potential issue
-- detected": es esperable. No se borra ninguna tabla ni dato de otros atletas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogo de alimentos
-- ---------------------------------------------------------------------
create table public.foods (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (char_length(btrim(nombre)) between 2 and 80),
  categoria         text not null
                      check (categoria in ('proteina', 'carbohidrato', 'grasa', 'lacteo', 'fruta', 'verdura', 'legumbre', 'otro')),
  estado            text not null default 'n/a' check (estado in ('crudo', 'cocido', 'n/a')),
  -- Valores por 100 g
  calorias          numeric(6,1) not null check (calorias >= 0 and calorias <= 1000),
  proteina_g        numeric(5,1) not null check (proteina_g >= 0 and proteina_g <= 100),
  carbohidratos_g   numeric(5,1) not null check (carbohidratos_g >= 0 and carbohidratos_g <= 100),
  grasas_g          numeric(5,1) not null check (grasas_g >= 0 and grasas_g <= 100),
  -- Lo que más aporta (por kcal). NULL si el alimento no tiene macros (p. ej. agua).
  macro_dominante   text generated always as (
    case
      when proteina_g > 0 and proteina_g * 4 >= carbohidratos_g * 4 and proteina_g * 4 >= grasas_g * 9 then 'proteina'
      when carbohidratos_g > 0 and carbohidratos_g * 4 >= grasas_g * 9 then 'carbohidratos'
      when grasas_g > 0 then 'grasas'
      else null
    end
  ) stored,
  -- Para buscar sin tildes ni mayúsculas ("platano" encuentra "Plátano")
  nombre_busqueda   text generated always as (
    lower(translate(nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
  ) stored,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  -- 100 g no pueden pesar más de 100 g (0,5 de margen por redondeos de las tablas)
  check (proteina_g + carbohidratos_g + grasas_g <= 100.5)
);

-- Un mismo alimento no se repite en el mismo estado (sí puede estar crudo Y cocido)
create unique index foods_nombre_estado_uidx
  on public.foods (lower(btrim(nombre)), estado);

alter table public.foods enable row level security;

create policy "foods_admin_all" on public.foods
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. Seed inicial (valores por 100 g, aproximados tipo USDA; ajustables desde la app)
--    Columnas: nombre, categoria, estado, calorias, proteina_g, carbohidratos_g, grasas_g
-- ---------------------------------------------------------------------
insert into public.foods (nombre, categoria, estado, calorias, proteina_g, carbohidratos_g, grasas_g) values
  -- Proteínas
  ('Pechuga de pollo sin piel', 'proteina', 'crudo', 120, 22.5, 0, 2.6),
  ('Pechuga de pollo sin piel', 'proteina', 'cocido', 165, 31.0, 0, 3.6),
  ('Muslo de pollo sin piel', 'proteina', 'crudo', 121, 19.7, 0, 4.1),
  ('Muslo de pollo sin piel', 'proteina', 'cocido', 179, 24.8, 0, 8.2),
  ('Carne molida de res magra (95/5)', 'proteina', 'crudo', 137, 21.4, 0, 5.0),
  ('Carne molida de res magra (95/5)', 'proteina', 'cocido', 171, 26.1, 0, 6.5),
  ('Lomo de res magro', 'proteina', 'crudo', 143, 22.2, 0, 5.4),
  ('Lomo de res magro', 'proteina', 'cocido', 206, 32.0, 0, 8.0),
  ('Lomo de cerdo magro', 'proteina', 'crudo', 143, 21.0, 0, 5.8),
  ('Lomo de cerdo magro', 'proteina', 'cocido', 195, 29.0, 0, 8.0),
  ('Pechuga de pavo', 'proteina', 'crudo', 114, 23.7, 0, 1.5),
  ('Pechuga de pavo', 'proteina', 'cocido', 135, 30.1, 0, 0.7),
  ('Salmón', 'proteina', 'crudo', 208, 20.4, 0, 13.4),
  ('Salmón', 'proteina', 'cocido', 206, 22.1, 0, 12.4),
  ('Tilapia', 'proteina', 'crudo', 96, 20.1, 0, 1.7),
  ('Tilapia', 'proteina', 'cocido', 128, 26.2, 0, 2.7),
  ('Atún en agua (enlatado, escurrido)', 'proteina', 'n/a', 116, 25.5, 0, 0.8),
  ('Camarón', 'proteina', 'crudo', 85, 20.1, 0.2, 0.5),
  ('Camarón', 'proteina', 'cocido', 99, 24.0, 0.2, 0.3),
  ('Huevo entero', 'proteina', 'crudo', 143, 12.6, 0.7, 9.5),
  ('Huevo entero', 'proteina', 'cocido', 155, 12.6, 1.1, 10.6),
  ('Clara de huevo', 'proteina', 'crudo', 52, 10.9, 0.7, 0.2),
  ('Tofu firme', 'proteina', 'n/a', 144, 17.3, 2.8, 8.7),
  ('Proteína whey en polvo (genérica)', 'proteina', 'n/a', 390, 78.0, 8.0, 6.0),
  -- Carbohidratos
  ('Arroz blanco', 'carbohidrato', 'crudo', 365, 7.1, 80.0, 0.7),
  ('Arroz blanco', 'carbohidrato', 'cocido', 130, 2.7, 28.2, 0.3),
  ('Arroz integral', 'carbohidrato', 'crudo', 370, 7.9, 77.2, 2.9),
  ('Arroz integral', 'carbohidrato', 'cocido', 123, 2.7, 25.6, 1.0),
  ('Pasta', 'carbohidrato', 'crudo', 371, 13.0, 74.7, 1.5),
  ('Pasta', 'carbohidrato', 'cocido', 158, 5.8, 30.9, 0.9),
  ('Avena en hojuelas', 'carbohidrato', 'crudo', 389, 16.9, 66.3, 6.9),
  ('Avena en hojuelas', 'carbohidrato', 'cocido', 71, 2.5, 12.0, 1.5),
  ('Papa', 'carbohidrato', 'crudo', 77, 2.0, 17.5, 0.1),
  ('Papa', 'carbohidrato', 'cocido', 87, 1.9, 20.1, 0.1),
  ('Batata (camote)', 'carbohidrato', 'crudo', 86, 1.6, 20.1, 0.1),
  ('Batata (camote)', 'carbohidrato', 'cocido', 76, 1.4, 17.7, 0.1),
  ('Plátano de cocción', 'carbohidrato', 'crudo', 122, 1.3, 31.9, 0.4),
  ('Plátano de cocción', 'carbohidrato', 'cocido', 116, 0.8, 31.2, 0.2),
  ('Quinoa', 'carbohidrato', 'crudo', 368, 14.1, 64.2, 6.1),
  ('Quinoa', 'carbohidrato', 'cocido', 120, 4.4, 21.3, 1.9),
  ('Pan integral', 'carbohidrato', 'n/a', 247, 13.0, 41.0, 3.4),
  ('Pan blanco', 'carbohidrato', 'n/a', 265, 9.0, 49.0, 3.2),
  ('Tortilla de maíz', 'carbohidrato', 'n/a', 218, 5.7, 44.6, 2.9),
  ('Galleta de arroz', 'carbohidrato', 'n/a', 387, 8.2, 81.5, 2.8),
  ('Miel', 'carbohidrato', 'n/a', 304, 0.3, 82.4, 0),
  -- Legumbres
  ('Lentejas', 'legumbre', 'crudo', 352, 24.6, 63.4, 1.1),
  ('Lentejas', 'legumbre', 'cocido', 116, 9.0, 20.1, 0.4),
  ('Frijoles negros', 'legumbre', 'crudo', 341, 21.6, 62.4, 1.4),
  ('Frijoles negros', 'legumbre', 'cocido', 132, 8.9, 23.7, 0.5),
  ('Garbanzos', 'legumbre', 'crudo', 378, 20.5, 62.9, 6.0),
  ('Garbanzos', 'legumbre', 'cocido', 164, 8.9, 27.4, 2.6),
  ('Hummus', 'legumbre', 'n/a', 166, 7.9, 14.3, 9.6),
  -- Grasas
  ('Aceite de oliva', 'grasa', 'n/a', 884, 0, 0, 100.0),
  ('Aguacate', 'grasa', 'n/a', 160, 2.0, 8.5, 14.7),
  ('Almendras', 'grasa', 'n/a', 579, 21.2, 21.6, 49.9),
  ('Maní', 'grasa', 'n/a', 567, 25.8, 16.1, 49.2),
  ('Nueces', 'grasa', 'n/a', 654, 15.2, 13.7, 65.2),
  ('Mantequilla de maní', 'grasa', 'n/a', 588, 25.1, 20.0, 50.4),
  ('Mantequilla', 'grasa', 'n/a', 717, 0.9, 0.1, 81.1),
  ('Semillas de chía', 'grasa', 'n/a', 486, 16.5, 42.1, 30.7),
  ('Linaza', 'grasa', 'n/a', 534, 18.3, 28.9, 42.2),
  ('Chocolate oscuro 70 %', 'grasa', 'n/a', 598, 7.8, 45.9, 42.6),
  -- Lácteos
  ('Leche entera', 'lacteo', 'n/a', 61, 3.2, 4.8, 3.3),
  ('Leche descremada', 'lacteo', 'n/a', 34, 3.4, 5.0, 0.1),
  ('Yogur griego natural sin grasa', 'lacteo', 'n/a', 59, 10.2, 3.6, 0.4),
  ('Yogur griego natural entero', 'lacteo', 'n/a', 97, 9.0, 3.9, 5.0),
  ('Queso cottage bajo en grasa', 'lacteo', 'n/a', 81, 10.5, 4.8, 2.3),
  ('Queso mozzarella parcialmente descremado', 'lacteo', 'n/a', 254, 24.3, 2.8, 15.9),
  -- Frutas
  ('Banano', 'fruta', 'n/a', 89, 1.1, 22.8, 0.3),
  ('Manzana', 'fruta', 'n/a', 52, 0.3, 13.8, 0.2),
  ('Fresas', 'fruta', 'n/a', 32, 0.7, 7.7, 0.3),
  ('Mango', 'fruta', 'n/a', 60, 0.8, 15.0, 0.4),
  ('Piña', 'fruta', 'n/a', 50, 0.5, 13.1, 0.1),
  ('Naranja', 'fruta', 'n/a', 47, 0.9, 11.8, 0.1),
  ('Papaya', 'fruta', 'n/a', 43, 0.5, 10.8, 0.3),
  ('Uvas', 'fruta', 'n/a', 69, 0.7, 18.1, 0.2),
  ('Arándanos', 'fruta', 'n/a', 57, 0.7, 14.5, 0.3),
  ('Sandía', 'fruta', 'n/a', 30, 0.6, 7.6, 0.2),
  -- Verduras
  ('Brócoli', 'verdura', 'crudo', 34, 2.8, 6.6, 0.4),
  ('Brócoli', 'verdura', 'cocido', 35, 2.4, 7.2, 0.4),
  ('Espinaca', 'verdura', 'crudo', 23, 2.9, 3.6, 0.4),
  ('Espinaca', 'verdura', 'cocido', 23, 3.0, 3.8, 0.3),
  ('Zanahoria', 'verdura', 'crudo', 41, 0.9, 9.6, 0.2),
  ('Zanahoria', 'verdura', 'cocido', 35, 0.8, 8.2, 0.2),
  ('Tomate', 'verdura', 'n/a', 18, 0.9, 3.9, 0.2),
  ('Cebolla', 'verdura', 'n/a', 40, 1.1, 9.3, 0.1),
  ('Pepino', 'verdura', 'n/a', 15, 0.7, 3.6, 0.1),
  ('Lechuga', 'verdura', 'n/a', 15, 1.4, 2.9, 0.2),
  ('Pimentón', 'verdura', 'n/a', 31, 1.0, 6.0, 0.3),
  ('Champiñones', 'verdura', 'n/a', 22, 3.1, 3.3, 0.3),
  ('Coliflor', 'verdura', 'crudo', 25, 1.9, 5.0, 0.3),
  ('Habichuela (judía verde)', 'verdura', 'n/a', 31, 1.8, 7.0, 0.2)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Snapshot en meal_foods (todas las columnas son opcionales: los alimentos
--    manuales y los menús ya guardados siguen siendo válidos)
-- ---------------------------------------------------------------------
alter table public.meal_foods
  add column food_id              uuid references public.foods (id) on delete set null,
  add column estado               text check (estado in ('crudo', 'cocido', 'n/a')),
  -- Macros por 100 g del alimento EN EL MOMENTO de guardar (para poder recalcular al editar)
  add column base_calorias        numeric(6,1) check (base_calorias >= 0 and base_calorias <= 1000),
  add column base_proteina_g      numeric(5,1) check (base_proteina_g >= 0 and base_proteina_g <= 100),
  add column base_carbohidratos_g numeric(5,1) check (base_carbohidratos_g >= 0 and base_carbohidratos_g <= 100),
  add column base_grasas_g        numeric(5,1) check (base_grasas_g >= 0 and base_grasas_g <= 100),
  -- Macros ASIGNADOS a los gramos exactos de esta fila (base × cantidad / 100)
  add column calorias             numeric(8,1) check (calorias >= 0),
  add column proteina_g           numeric(8,1) check (proteina_g >= 0),
  add column carbohidratos_g      numeric(8,1) check (carbohidratos_g >= 0),
  add column grasas_g             numeric(8,1) check (grasas_g >= 0);

-- O el snapshot está completo, o no hay ninguno (nunca a medias)
alter table public.meal_foods
  add constraint meal_foods_snapshot_completo check (
    (estado is null
      and base_calorias is null and base_proteina_g is null
      and base_carbohidratos_g is null and base_grasas_g is null
      and calorias is null and proteina_g is null
      and carbohidratos_g is null and grasas_g is null)
    or
    (estado is not null
      and base_calorias is not null and base_proteina_g is not null
      and base_carbohidratos_g is not null and base_grasas_g is not null
      and calorias is not null and proteina_g is not null
      and carbohidratos_g is not null and grasas_g is not null
      and unidad = 'g')
  );

-- ---------------------------------------------------------------------
-- 4. set_meal_plan (misma firma que en la migración 23): ahora acepta el snapshot
--
--   Cada alimento puede traer, además de lo de siempre, estos datos OPCIONALES:
--     "food_id": "uuid del catálogo"  (si ya no existe, se guarda sin enlace)
--     "estado":  "crudo" | "cocido" | "n/a"
--     "base":    { "calorias": 130, "proteina_g": 2.7, "carbohidratos_g": 28.2, "grasas_g": 0.3 }
--   Si trae "base", la unidad debe ser "g" y la base de datos CALCULA los macros asignados
--   (base × gramos / 100, a 1 decimal). Sin "base", el alimento queda manual, como antes.
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
  -- Snapshot
  v_base      jsonb;
  v_food_id   uuid;
  v_estado    text;
  b_cal       numeric;
  b_p         numeric;
  b_c         numeric;
  b_g         numeric;
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
      v_cantidad := round(v_cantidad, 2);

      v_unidad := v_alimento ->> 'unidad';
      if v_unidad is null or v_unidad not in ('g', 'ml', 'unidad', 'porcion') then
        raise exception 'La unidad de «%» (en «%») debe ser g, ml, unidad o porcion.', v_nombre_a, v_nombre;
      end if;

      v_nota := nullif(btrim(coalesce(v_alimento ->> 'nota', '')), '');
      if v_nota is not null and char_length(v_nota) > 120 then
        raise exception 'La nota de «%» no puede pasar de 120 caracteres.', v_nombre_a;
      end if;

      -- ---- Snapshot opcional (alimento del catálogo) ----
      v_base := v_alimento -> 'base';
      v_food_id := null;
      v_estado := null;
      b_cal := null; b_p := null; b_c := null; b_g := null;

      if v_base is not null and jsonb_typeof(v_base) = 'object' then
        if v_unidad <> 'g' then
          raise exception 'El alimento «%» (en «%») del catálogo debe medirse en gramos.', v_nombre_a, v_nombre;
        end if;

        v_estado := v_alimento ->> 'estado';
        if v_estado is null or v_estado not in ('crudo', 'cocido', 'n/a') then
          raise exception 'El estado de «%» (en «%») debe ser crudo, cocido o n/a.', v_nombre_a, v_nombre;
        end if;

        -- food_id: si no es un uuid válido es un error; si el alimento ya no existe, se guarda sin enlace
        if v_alimento ->> 'food_id' is not null then
          if jsonb_typeof(v_alimento -> 'food_id') <> 'string'
             or (v_alimento ->> 'food_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
            raise exception 'El identificador de «%» (en «%») no es válido.', v_nombre_a, v_nombre;
          end if;
          v_food_id := (v_alimento ->> 'food_id')::uuid;
          if not exists (select 1 from public.foods where id = v_food_id) then
            v_food_id := null;
          end if;
        end if;

        b_cal := case when jsonb_typeof(v_base -> 'calorias') = 'number' then (v_base ->> 'calorias')::numeric end;
        b_p   := case when jsonb_typeof(v_base -> 'proteina_g') = 'number' then (v_base ->> 'proteina_g')::numeric end;
        b_c   := case when jsonb_typeof(v_base -> 'carbohidratos_g') = 'number' then (v_base ->> 'carbohidratos_g')::numeric end;
        b_g   := case when jsonb_typeof(v_base -> 'grasas_g') = 'number' then (v_base ->> 'grasas_g')::numeric end;

        if b_cal is null or b_p is null or b_c is null or b_g is null
           or b_cal < 0 or b_cal > 1000
           or b_p < 0 or b_p > 100 or b_c < 0 or b_c > 100 or b_g < 0 or b_g > 100
           or b_p + b_c + b_g > 100.5 then
          raise exception 'Los macros por 100 g de «%» (en «%») no son válidos.', v_nombre_a, v_nombre;
        end if;
        b_cal := round(b_cal, 1); b_p := round(b_p, 1); b_c := round(b_c, 1); b_g := round(b_g, 1);
      elsif v_base is not null and jsonb_typeof(v_base) <> 'null' then
        raise exception 'Los macros de «%» (en «%») no tienen el formato correcto.', v_nombre_a, v_nombre;
      end if;

      insert into public.meal_foods
        (meal_id, user_id, alimento, cantidad, unidad, nota, orden,
         food_id, estado,
         base_calorias, base_proteina_g, base_carbohidratos_g, base_grasas_g,
         calorias, proteina_g, carbohidratos_g, grasas_g)
      values
        (v_meal_id, p_user_id, v_nombre_a, v_cantidad, v_unidad, v_nota, v_pos_a,
         v_food_id, v_estado,
         b_cal, b_p, b_c, b_g,
         -- Macros asignados: los calcula la base de datos (null si el alimento es manual)
         round(b_cal * v_cantidad / 100, 1), round(b_p * v_cantidad / 100, 1),
         round(b_c * v_cantidad / 100, 1), round(b_g * v_cantidad / 100, 1));
    end loop;
  end loop;
end;
$$;

revoke all on function public.set_meal_plan(uuid, jsonb) from public, anon;
grant execute on function public.set_meal_plan(uuid, jsonb) to authenticated;
