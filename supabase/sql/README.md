# Scripts SQL de la base de datos

Estos archivos son la **fuente de verdad del esquema** de Supabase. Se ejecutan **a mano**, una sola vez cada uno y **en orden**, en el SQL Editor (*New snippet* → pegar → *Run*). Guardarlos aquí no los ejecuta: son el registro de lo que ya se aplicó.

## Orden de aplicación

| Orden | Archivo del repositorio | Nombre del snippet en el SQL Editor | Qué hace | Estado |
|---|---|---|---|---|
| 0 | `schema_supabase.sql` | `Gestion_Atletas_Inicial` | Tablas base (`profiles`, `exercises`, `metrics`, `routine_logs`, `ai_load_suggestions`, `daily_check_ins`), trigger que crea el perfil, RLS y 14 ejercicios iniciales | Aplicado |
| 2 | `migracion_02_nutricion_dashboard.sql` | `migracion_02` | Plan nutricional, buzón nutricional de la IA, ciclos de entrenamiento, lista negra por atleta, vistas del dashboard, triggers de seguridad de la IA, `resolve_nutrition_suggestion` | Aplicado |
| 3 | `migracion_03_metricas_admin.sql` | `migracion_03_metricas_admin.sql` | Mediciones solo del admin (el atleta solo lee) e índice único `(user_id, fecha)` | Aplicado |
| 4 | `migracion_04_rutinas.sql` | `migracion_04_Rutinas` | `routines`, `routine_days`, `routine_exercises`, enlace desde `routine_logs`, `activate_routine`, `duplicate_routine` | Aplicado |
| 5 | `migracion_05_checkin_una_vez.sql` | `migracion_05_checkin_una_sola_vez` | El atleta solo crea su check-in (sin modificar ni borrar) | Aplicado |
| 6 | `migracion_06_volumen_muscular.sql` | `migracion_06_volumen_por_musculo` | `muscle_groups`, `exercise_muscles`, `set_exercise_muscles` y músculos de los 14 ejercicios iniciales | Aplicado |
| 7 | `migracion_07_records_por_peso.sql` | `migracion_07_records_por_peso` (nombre sugerido) | Vista `v_best_reps_by_weight`: mejor cantidad de repeticiones con cada peso (récords) | Aplicado con el paso 8 |
| 8 | `migracion_08_plan_nutricional.sql` | `migracion_08_plan_nutricional` (nombre sugerido) | Función `set_nutrition_plan`: el entrenador define o cambia el plan nutricional (cierra el vigente y crea el nuevo) | Aplicado con el paso 9 |
| 9 | `migracion_09_ejercicios_video_seguro.sql` | `migracion_09_ejercicios_video_seguro` (nombre sugerido) | Regla CHECK: el `video_url` de un ejercicio solo puede ser http/https | Aplicado con el paso 10 |
| 11 | `migracion_11_progresion.sql` | `migracion_11_progresion` (nombre sugerido) | Progresión automática: columnas `progresion_tipo`, `escalera`, `incremento_kg` y `peso_inicial_kg` en `routine_exercises` (con CHECK), función `set_progresion` y `duplicate_routine` actualizada | Aplicado (el archivo es el mismo texto que se ejecutó) |
| 12 | `migracion_12_series_y_rpe.sql` | `migracion_12` (nombre sugerido) | Columna `pide_rpe`, trigger `limitar_series_por_ejercicio` y `duplicate_routine` actualizada | Aplicado |
| 13 | `migracion_13_cierre_ejercicio.sql` | `migracion_13_cierre_ejercicio` (nombre sugerido) | Tabla `exercise_closures`: ejercicio finalizado con nota obligatoria, con RLS | Aplicado |
| 14 | `migracion_14_dias_realizados.sql` | `migracion_14_dias_realizados` (nombre sugerido) | Tabla `routine_day_completions` (día realizado por semana, con RLS) y trigger `bloquear_dia_realizado` | Aplicado |
| 15 | `migracion_15_tipo_ejercicio_1rm.sql` | `migracion_15_tipo_ejercicio_1rm` (nombre sugerido) | Columna `exercises.tipo_ejercicio` (compuesto/fuerza/halterofilia/aislado) y vista `v_athlete_prs` sin 1RM para aislados | Aplicado |
| 18 | `migracion_18_peso_en_checkin.sql` | `migracion_18_peso_en_checkin` (nombre sugerido) | Columna `daily_check_ins.peso_corporal_kg` (opcional, CHECK 20–400) | Aplicado |
| 19 | `migracion_19_fecha_nacimiento.sql` | `migracion_19_fecha_nacimiento` (nombre sugerido) | Columna `profiles.fecha_nacimiento` (opcional, CHECK ≥ 1900), trigger `validar_fecha_nacimiento` (no futura) y RPC `set_fecha_nacimiento` (solo admin) | Aplicado |
| 20 | `migracion_20_gestion_usuarios.sql` | `migracion_20_gestion_usuarios` (nombre sugerido) | Columna `profiles.activo` (estado del atleta) y RPC `set_perfil_atleta` (solo admin: nombre y fecha de nacimiento) | **Pendiente de aplicar** |
| 17 | `migracion_17_cumplimiento_calorias.sql` | `migracion_17_cumplimiento_calorias` (nombre sugerido) | Columna `daily_check_ins.cumplimiento_calorias` (cumplio/menos/mas, con CHECK), copia de los "sí" antiguos y trigger que mantiene sincronizado el sí/no antiguo | Aplicado |
| 16 | `migracion_16_rutina_hibrida.sql` | `migracion_16_rutina_hibrida` (nombre sugerido) | `routines.modo_hibrido`, `routine_exercises.bloque`, dos triggers y `duplicate_routine` actualizada | Aplicado |

La migración 10 (IA, paso 11A) no está en este repositorio.

No existe una "migración 01": el esquema inicial hace de base. La numeración sigue la de las migraciones.

## Dependencias

- La 02 requiere el esquema inicial.
- La 03 y la 05 modifican políticas de tablas creadas antes.
- La 04 requiere la 02 (usa `training_cycles`).
- La 06 requiere el esquema inicial (usa `exercises`).
- La 09 requiere el esquema inicial (usa `exercises`).
- La 08 requiere la 02 (usa `nutrition_plans`).
- La 07 requiere el esquema inicial y la 02 (usa `routine_logs`; complementa la vista `v_athlete_prs`).
- La 11 requiere la 04 (usa `routine_exercises` y `duplicate_routine`).
- La 16 requiere la 04, la 11 y la 12 (usa `pide_rpe` y reemplaza `duplicate_routine`).
- La 19 requiere el esquema inicial (usa `profiles` e `is_admin()`).
- La 20 requiere la 19 (usa `profiles.fecha_nacimiento` y su trigger). Además, la app nueva necesita desplegar la Edge Function `supabase/functions/admin-usuarios` (ver `docs/ARQUITECTURA.md`, sección 9).
- La 17 y la 18 requieren el esquema inicial y la 05 (modifican `daily_check_ins`).
- La 15 requiere el esquema inicial y la 02 (modifica `v_athlete_prs` y `exercises`).
- La 13 y la 14 requieren el esquema inicial y la 04 (usan `routines`, `routine_days`, `routine_exercises`).

## Reglas

1. **Nunca edites un script ya aplicado.** Un cambio nuevo es un archivo nuevo: `migracion_07_descripcion.sql`, luego `08`, etc.
2. Cada migración nueva debe: explicar en comentarios qué hace y por qué, activar RLS con políticas si crea tablas, y validar su sintaxis antes de entregarse.
3. **Primero la base de datos, después el código** que depende de ella.
4. **No vuelvas a ejecutar** un script ya aplicado: fallaría con "already exists" o duplicaría datos.
5. Al agregar una migración: súbela aquí, añade su fila a la tabla de arriba y actualiza `docs/ARQUITECTURA.md` y `docs/CHANGELOG.md`.

## Avisos esperables del SQL Editor

Supabase muestra "Potential issue detected" cuando un script contiene `drop` o `delete`. Es normal en estos casos: la 02, la 03 y la 05 eliminan políticas o índices antiguos para reemplazarlos, y la 06 contiene un `delete` dentro de una función que solo se ejecuta cuando guardas los músculos de un ejercicio desde la app. Ninguna borra tablas ni datos de los usuarios. La 07, la 08, la 09, la 11, la 17, la 18, la 19 y la 20 no eliminan nada (vistas, funciones, columnas y reglas de validación nuevas), así que no deberían mostrar el aviso.
