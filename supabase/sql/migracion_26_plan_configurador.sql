-- =====================================================================
-- Migración 26 — Plan nutricional como configurador + Comidas del día conectadas (paso 36)
--
-- Qué hace:
--   1. DATOS FÍSICOS del atleta en `profiles`: sexo, estatura (cm) y nivel de actividad.
--      Hasta hoy no existían. Con ellos y con la edad (fecha de nacimiento, ya existente) y el
--      peso (ya existente) la app calcula el metabolismo basal y el gasto energético.
--      Permisos: el atleta NO los puede editar (el GRANT por columnas de la migración inicial
--      solo le deja cambiar nombre_completo); el admin los guarda con set_nutrition_plan.
--   2. CONFIGURADOR en `nutrition_plans`: objetivo físico (déficit / recomposición / volumen),
--      intensidad (conservadora / moderada / agresiva), tipo de dieta, y la foto del cálculo
--      (TMB, gasto energético y peso usado). Son opcionales: los planes manuales anteriores
--      siguen siendo válidos. Si hay configurador, tiene que estar COMPLETO (CHECK).
--   3. `set_nutrition_plan` se REEMPLAZA por una versión con parámetros nuevos (todos con valor
--      por defecto, así que una llamada vieja sigue funcionando). Es el único lugar que
--      escribe el plan, y ahora también guarda los datos físicos del atleta en la misma
--      operación (todo o nada).
--   4. COMIDAS DEL DÍA ligadas al plan: se guardan los ajustes del autocálculo para que
--      sobrevivan al guardar y recargar: `meals.peso_reparto` (peso de la comida en el reparto
--      del día), `meal_foods.rol_macro` (macro que cubre el alimento) y
--      `meal_foods.gramos_fijos` (gramos que el entrenador fijó a mano y el autoajuste respeta).
--      `set_meal_plan` se reemplaza (misma firma) para aceptarlos y validarlos.
--
-- AVISO: contiene un `drop function` (la versión anterior de set_nutrition_plan; si se
-- dejara, una llamada con los parámetros viejos sería ambigua) y el `delete` interno de
-- set_meal_plan. El SQL Editor puede mostrar "Potential issue detected": es esperable.
-- No se borra ninguna tabla ni dato.
--
-- Requiere: esquema inicial, migraciones 08 (set_nutrition_plan), 19 (fecha de nacimiento),
-- 23 y 25 (comidas y catálogo). Aplicar PRIMERO este SQL y después subir el código.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Datos físicos del atleta
-- ---------------------------------------------------------------------
alter table public.profiles
  add column sexo            text         check (sexo in ('masculino', 'femenino')),
  add column estatura_cm     numeric(4,1) check (estatura_cm >= 100 and estatura_cm <= 250),
  add column nivel_actividad text         check (nivel_actividad in ('sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso'));

comment on column public.profiles.sexo is 'Sexo biológico para las ecuaciones de gasto energético. Solo lo cambia el admin (set_nutrition_plan).';
comment on column public.profiles.estatura_cm is 'Estatura en cm (100–250). Solo lo cambia el admin.';
comment on column public.profiles.nivel_actividad is 'Nivel de actividad física (factor del gasto energético). Solo lo cambia el admin.';

-- ---------------------------------------------------------------------
-- 2. Configurador en nutrition_plans (todo opcional, pero completo si existe)
-- ---------------------------------------------------------------------
alter table public.nutrition_plans
  add column objetivo_fisico text check (objetivo_fisico in ('deficit', 'recomposicion', 'volumen')),
  add column intensidad      text check (intensidad in ('conservadora', 'moderada', 'agresiva')),
  add column tipo_dieta      text check (tipo_dieta in ('equilibrada', 'alta_proteina', 'alta_carbohidratos', 'baja_carbohidratos', 'cetogenica')),
  add column tmb_kcal        integer      check (tmb_kcal >= 500 and tmb_kcal <= 6000),
  add column gasto_kcal      integer      check (gasto_kcal >= 800 and gasto_kcal <= 10000),
  add column peso_base_kg    numeric(5,1) check (peso_base_kg >= 20 and peso_base_kg <= 400);

alter table public.nutrition_plans
  add constraint nutrition_plans_configurador_completo check (
    (objetivo_fisico is null and intensidad is null and tipo_dieta is null
       and tmb_kcal is null and gasto_kcal is null and peso_base_kg is null)
    or
    (objetivo_fisico is not null and intensidad is not null and tipo_dieta is not null
       and tmb_kcal is not null and gasto_kcal is not null and peso_base_kg is not null)
  );

-- ---------------------------------------------------------------------
-- 3. set_nutrition_plan nueva (reemplaza la de la migración 08)
-- ---------------------------------------------------------------------
drop function if exists public.set_nutrition_plan(uuid, integer, integer, integer, integer, text, text);

create function public.set_nutrition_plan(
  p_user_id          uuid,
  p_calorias         integer,
  p_proteina_g       integer default null,
  p_carbohidratos_g  integer default null,
  p_grasas_g         integer default null,
  p_objetivo         text    default null,   -- 'deficit' | 'superavit' | 'normocalorica' | NULL
  p_notas            text    default null,
  -- Configurador (todo o nada)
  p_objetivo_fisico  text    default null,   -- 'deficit' | 'recomposicion' | 'volumen'
  p_intensidad       text    default null,   -- 'conservadora' | 'moderada' | 'agresiva'
  p_tipo_dieta       text    default null,
  p_tmb              integer default null,
  p_gasto            integer default null,
  p_peso_base        numeric default null,
  -- Datos físicos del atleta (solo se actualiza lo que llega con valor)
  p_sexo             text    default null,
  p_estatura_cm      numeric default null,
  p_nivel_actividad  text    default null
)
returns uuid                                  -- id del nuevo plan
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id         uuid;
  v_config     integer;
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

  -- Configurador: o llegan los 6 datos o ninguno
  v_config := (p_objetivo_fisico is not null)::int + (p_intensidad is not null)::int
            + (p_tipo_dieta is not null)::int + (p_tmb is not null)::int
            + (p_gasto is not null)::int + (p_peso_base is not null)::int;
  if v_config not in (0, 6) then
    raise exception 'El configurador está incompleto: faltan datos del cálculo.';
  end if;
  if v_config = 6 then
    if p_objetivo_fisico not in ('deficit', 'recomposicion', 'volumen') then
      raise exception 'El objetivo físico debe ser déficit, recomposición o volumen.';
    end if;
    if p_intensidad not in ('conservadora', 'moderada', 'agresiva') then
      raise exception 'La intensidad debe ser conservadora, moderada o agresiva.';
    end if;
    if p_tipo_dieta not in ('equilibrada', 'alta_proteina', 'alta_carbohidratos', 'baja_carbohidratos', 'cetogenica') then
      raise exception 'El tipo de dieta no es válido.';
    end if;
    if p_tmb < 500 or p_tmb > 6000 or p_gasto < 800 or p_gasto > 10000 then
      raise exception 'El metabolismo basal o el gasto energético están fuera de rango.';
    end if;
    if p_peso_base < 20 or p_peso_base > 400 then
      raise exception 'El peso usado en el cálculo debe estar entre 20 y 400 kg.';
    end if;
  end if;

  -- Datos físicos del atleta (si llegan): se validan con los CHECK de la tabla, pero aquí
  -- se avisa en español.
  if p_sexo is not null and p_sexo not in ('masculino', 'femenino') then
    raise exception 'El sexo debe ser masculino o femenino.';
  end if;
  if p_estatura_cm is not null and (p_estatura_cm < 100 or p_estatura_cm > 250) then
    raise exception 'La estatura debe estar entre 100 y 250 cm.';
  end if;
  if p_nivel_actividad is not null
     and p_nivel_actividad not in ('sedentario', 'ligero', 'moderado', 'intenso', 'muy_intenso') then
    raise exception 'El nivel de actividad no es válido.';
  end if;

  update public.profiles
     set sexo            = coalesce(p_sexo, sexo),
         estatura_cm     = coalesce(round(p_estatura_cm, 1), estatura_cm),
         nivel_actividad = coalesce(p_nivel_actividad, nivel_actividad)
   where id = p_user_id
     and (p_sexo is not null or p_estatura_cm is not null or p_nivel_actividad is not null);

  -- Cierra el plan vigente (si lo hay)...
  update public.nutrition_plans
     set vigente_hasta = now()
   where user_id = p_user_id and vigente_hasta is null;

  -- ...y crea el nuevo.
  insert into public.nutrition_plans
    (user_id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g,
     objetivo_calorico, origen, creado_por, notas,
     objetivo_fisico, intensidad, tipo_dieta, tmb_kcal, gasto_kcal, peso_base_kg)
  values
    (p_user_id, p_calorias, p_proteina_g, p_carbohidratos_g, p_grasas_g,
     p_objetivo, 'manual', (select auth.uid()), nullif(trim(p_notas), ''),
     p_objetivo_fisico, p_intensidad, p_tipo_dieta, p_tmb, p_gasto, round(p_peso_base, 1))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_nutrition_plan(uuid, integer, integer, integer, integer, text, text,
  text, text, text, integer, integer, numeric, text, numeric, text) from public, anon;
grant execute on function public.set_nutrition_plan(uuid, integer, integer, integer, integer, text, text,
  text, text, text, integer, integer, numeric, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Comidas del día: ajustes del autocálculo que se guardan con el menú
-- ---------------------------------------------------------------------
alter table public.meals
  add column peso_reparto numeric(4,1) not null default 1
    check (peso_reparto >= 0 and peso_reparto <= 100);

alter table public.meal_foods
  add column rol_macro    text check (rol_macro in ('proteina', 'carbohidratos', 'grasas')),
  add column gramos_fijos boolean not null default false;

-- Un macro asignado solo tiene sentido en un alimento del catálogo (el que trae snapshot)
alter table public.meal_foods
  add constraint meal_foods_rol_solo_catalogo check (rol_macro is null or estado is not null);

-- ---------------------------------------------------------------------
-- 5. set_meal_plan (misma firma que en las migraciones 23 y 25): ahora acepta
--      comida:   "peso_reparto": número 0–100 (por defecto 1)
--      alimento: "rol_macro": "proteina" | "carbohidratos" | "grasas" (solo catálogo)
--                "gramos_fijos": true | false (por defecto false)
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
  -- Ajustes del autocálculo (migración 26)
  v_peso      numeric;
  v_rol       text;
  v_fijo      boolean;
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

    -- Peso de la comida en el reparto del día (opcional; por defecto 1). Si llega, debe ser un número
    -- (si la clave falta, jsonb_typeof da NULL y la condición no se cumple).
    if jsonb_typeof(v_comida -> 'peso_reparto') not in ('number', 'null') then
      raise exception 'El peso de reparto de «%» debe ser un número.', v_nombre;
    end if;
    v_peso := coalesce(case when jsonb_typeof(v_comida -> 'peso_reparto') = 'number'
                            then (v_comida ->> 'peso_reparto')::numeric end, 1);
    if v_peso < 0 or v_peso > 100 then
      raise exception 'El peso de reparto de «%» debe estar entre 0 y 100.', v_nombre;
    end if;
    v_peso := round(v_peso, 1);

    v_alimentos := coalesce(v_comida -> 'alimentos', '[]'::jsonb);
    if jsonb_typeof(v_alimentos) <> 'array' then
      raise exception 'Los alimentos de «%» deben ser una lista.', v_nombre;
    end if;
    if jsonb_array_length(v_alimentos) > 30 then
      raise exception '«%» puede tener como máximo 30 alimentos.', v_nombre;
    end if;

    insert into public.meals (user_id, nombre, notas, orden, peso_reparto)
    values (p_user_id, v_nombre, v_notas, v_pos, v_peso)
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

      -- Ajustes del autocálculo: macro que cubre el alimento y si sus gramos están fijados.
      -- Solo tienen sentido en alimentos del catálogo (los manuales no tienen macros).
      v_rol := nullif(v_alimento ->> 'rol_macro', '');
      if v_rol is not null and v_rol not in ('proteina', 'carbohidratos', 'grasas') then
        raise exception 'El macro que cubre «%» (en «%») debe ser proteina, carbohidratos o grasas.', v_nombre_a, v_nombre;
      end if;
      if v_rol is not null and v_estado is null then
        raise exception '«%» (en «%») es manual: no puede tener un macro asignado.', v_nombre_a, v_nombre;
      end if;
      if jsonb_typeof(v_alimento -> 'gramos_fijos') not in ('boolean', 'null') then
        raise exception 'Los gramos fijos de «%» (en «%») deben ser verdadero o falso.', v_nombre_a, v_nombre;
      end if;
      v_fijo := coalesce(case when jsonb_typeof(v_alimento -> 'gramos_fijos') = 'boolean'
                              then (v_alimento ->> 'gramos_fijos')::boolean end, false);

      insert into public.meal_foods
        (meal_id, user_id, alimento, cantidad, unidad, nota, orden,
         rol_macro, gramos_fijos,
         food_id, estado,
         base_calorias, base_proteina_g, base_carbohidratos_g, base_grasas_g,
         calorias, proteina_g, carbohidratos_g, grasas_g)
      values
        (v_meal_id, p_user_id, v_nombre_a, v_cantidad, v_unidad, v_nota, v_pos_a,
         v_rol, v_fijo,
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
