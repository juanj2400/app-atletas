# CHANGELOG — MyProgress

Registro cronológico de cambios. Agregar entradas nuevas arriba (`feat`, `fix`, `refactor`, `db`, `docs`, `chore`).

---

## 2026-11-28 · Paso 37 — Rediseño visual y marco de escritorio
- **style:** Nuevos tokens en `@theme` (`elevada`, `borde-suave`, `borde-campo`, `primario-fuerte`, `exito`, `halterofilia`, `musculacion`); todos los hex sueltos migrados a tokens (las gráficas usan `var(--color-*)`). Foco visible global, hover en botones y `tabular-nums` en toda la app. Etiquetas de disciplina suaves en `EntrenarDia`.
- **feat (solo presentación):** Escritorio (`md:`/`lg:`): barra lateral (`MarcoApp`) con logo, usuario/rol, navegación y «Cerrar sesión» para atleta y entrenador; barra inferior del atleta `md:hidden`; contenido más ancho (`CONTENIDO_ATLETA`/`CONTENIDO_ADMIN`). El celular queda igual. Sin cambios de rutas, datos ni lógica.
- **style:** Marca nueva (`Logo`, `favicon.svg`, PNG de la PWA regenerados) y login rediseñado (tarjeta centrada, mostrar/ocultar contraseña, aviso de acceso privado); `PaginaCentrada` para recuperar/restablecer/estados.
- **docs:** `AGENTS.md` §4 actualizado (anchos). Sin SQL.

## 2026-11-28 · Paso 36 — Plan nutricional inteligente conectado a «Comidas del día»
- **feat:** «Plan nutricional» es ahora un configurador (`ConfiguradorPlan`): objetivo físico (déficit/recomposición/volumen), intensidad (conservadora/moderada/agresiva) y tipo de dieta; con edad (de la fecha de nacimiento), peso (precargado de la última medición/check-in), estatura, sexo y actividad calcula metabolismo basal (Mifflin-St Jeor), gasto, calorías y macros (`lib/planNutricional.js`, sin IA). Proteína/carbos/grasas en g y % editables; al editar uno los demás se reequilibran (con «Fijar»); gasto editable; estado calórico automático. Un plan manual sigue funcionando.
- **feat:** «Comidas del día» usa el plan vigente como ÚNICA referencia (`ObjetivoDieta`, `usePlanVigente`, `ajustarAlPlan` en `lib/dieta.js`): ajuste automático de gramos al agregar/quitar/cambiar alimentos y al cambiar el plan; escribir gramos fija ese alimento; «Reajustar al plan», «Soltar gramos fijados», reparto por comida (`peso_reparto`). Al abrir no se modifica el menú guardado.
- **refactor:** se elimina `CalculadoraDieta` (calculadora independiente). `PlanNutricionalCard`, `Nutricion` y `PanelAtleta` muestran objetivo/intensidad/dieta.
- **db:** `migracion_26_plan_configurador.sql` — columnas de datos físicos en `profiles`, configuración en `nutrition_plans`, ajustes de autocálculo en `meals`/`meal_foods`, `set_nutrition_plan` y `set_meal_plan` reemplazadas. **Aplicar SQL primero.**

## 2026-11-27 · Paso 35 — PWA sin internet (datos locales y cola de sincronización)
- **feat:** El atleta puede abrir la app, ver su rutina/metas/plan nutricional y registrar check-in, series, cierres y *Terminar rutina* sin señal. Los datos se guardan en IndexedDB por usuario y los registros pendientes suben solos en orden (id y hora generados en el celular, subida idempotente y sin duplicados). `IndicadorConexion` muestra el estado y los pendientes; `NotaDatosGuardados` avisa cuando se ve una copia. Acciones del entrenador/IA sin internet muestran aviso claro (`AvisoSoloConConexion`, `exigirConexion`).
- **fix:** Con el token vencido y sin red ya no se cae al login: sesión local con perfil recordado (`AuthProvider`, `identidadLocal.js`).
- **refactor:** `lib/almacenLocal.js`, `cacheOffline.js`, `colaOffline.js`, `vistaOffline.js`, `useCola.js`, `conexion.js`; `cargarComidas`/`cargarDescarga` devuelven también `errorBD`. `vite.config.js` deja explícito `navigateFallback`. Sin cambios de SQL.

## 2026-11-27 · Paso 34 — Catálogo de alimentos y autocálculo de gramos
- **feat:** Catálogo propio de alimentos (`/admin/alimentos`, `Alimentos`, `FormAlimento`) con crudo/cocido, macros por 100 g y búsqueda ligera (`lib/buscarAlimentos.js`, `useBusquedaAlimentos`). Creador de dieta (`PlanComidas`) con `BuscadorAlimentos` y `CalculadoraDieta`: calcula gramos con `lib/dieta.js` (JS puro, sin IA), edición manual, intercambio de alimentos y totales por comida/día en vivo. `ListaComidas` y `Nutricion` muestran estado crudo/cocido, gramos exactos y macros.
- **db:** `migracion_25_catalogo_alimentos.sql` — tabla `foods` (RLS solo admin) + seed, snapshot en `meal_foods` y `set_meal_plan` actualizada. **Aplicar SQL primero** (independiente de la 24).
- **refactor:** `lib/comidas.js` (snapshot, intercambio), `lib/cargarComidas.js`, `lib/alimentos.js`.

## 2026-11-27 · Paso 33 — Peso del check-in en tendencia y peso actual
- **feat:** El peso del check-in diario se suma, solo en la vista del atleta (`MisMediciones`), a la tendencia/proyección, la oscilación y "Peso actual". La gráfica marca con punto hueco los pesos de check-in y con relleno los oficiales; si el mismo día hay medición oficial, manda esa.
- **refactor:** `lib/pesoCombinado.js` (`combinarPesos`). No copia nada a `metrics` (invariante 2) ni requiere SQL.

## 2026-11-27 · Paso 32 — Semana de descarga
- **feat:** El entrenador activa/cancela una semana de descarga (7 días desde hoy) en la pestaña Entrenamiento (`DescargaAtleta.jsx`). El atleta ve aviso (`AvisoDescarga.jsx`) y una meta liviana por ejercicio (series −40 %, carga −10 % / −20 % en halterofilia, RPE ≤ 7, progresión en pausa) sin tocar su rutina; al terminar vuelve solo a lo anterior.
- **db:** `migracion_24_semana_descarga.sql` — tabla `deload_weeks` (RLS, solo lectura directa), `routine_logs.en_descarga` + trigger, RPC `activar_descarga` / `cancelar_descarga` y `ultimas_series_por_ejercicio` ignora series de descarga. **Aplicar SQL primero.**
- **refactor:** `lib/descarga.js`, `lib/cargarDescarga.js`; `seriesObjetivoDe` (`lib/cierres.js`) acepta la descarga.

## 2026-11-27 · Paso 31 — Nutrición principal y comidas del día
- **feat:** Pestaña principal **Nutrición** (`/atleta/nutricion`, redirige desde `/atleta/datos/nutricion`) con tarjetas plegables de comidas del día, objetivo diario y promedio 7d. Editor de menú en ficha admin (`PlanComidas.jsx`) con borrador, reordenamiento y alerta sin guardar.
- **db:** `migracion_23_comidas_del_dia.sql` — tablas `meals`, `meal_foods`, RLS y RPC atómica `set_meal_plan` (desacoplada de `nutrition_plans`). **Aplicar SQL primero.**
- **refactor:** `lib/comidas.js`, `lib/cargarComidas.js`, `ListaComidas.jsx`.

## 2026-11-26 · Paso 30 — Buscador en récords y 1RM por fecha
- **feat:** Buscador de ejercicios sin tildes/mayúsculas en `RecordsAtleta` (carga perezosa al seleccionar) y gráfica principal de 1RM estimado por fecha con lista de últimas 8 marcas en `GraficosRecord`.
- **refactor:** `normalizarBusqueda` y `filtrarEjercicios` en `lib/records.js`.

## 2026-11-26 · Paso 29 — Periodos de la rutina (snapshots)
- **feat:** Vista `HistorialRutina` en ficha admin con comparativa de cambios entre versiones de rutina y actividad real del atleta por periodo.
- **db:** `migracion_22_historial_rutina.sql` — tabla `routine_versions`, funciones `foto_rutina`, `congelar_version_rutina`, `resumen_periodo_rutina` y triggers `before`. **Aplicar SQL primero.**
- **refactor:** `lib/versionesRutina.js`.

## 2026-11-26 · Paso 28 — Descansos rápidos en editor
- **feat/refactor:** Botones de 30 s, 1, 2 y 3 min (`DESCANSOS_RAPIDOS` en `lib/rutinas.js`) en `EditorRutina`.

## 2026-11-26 · Paso 27 — Panel general en ficha del atleta
- **feat/refactor:** Pestaña *Resumen* convertida en `PanelAtleta` (`lib/panelAtleta.js`) con bloque "Atención", tarjetas KPI clicables hacia cada sección e índice de navegación en pestañas.

## 2026-11-26 · Paso 26 — Historial continuo por ejercicio (rutinas largas)
- **fix/db:** `migracion_21_ultima_vez_por_ejercicio.sql` — RPC `ultimas_series_por_ejercicio` (`lateral join`) para evitar que ejercicios poco frecuentes pierdan su progresión por límites globales de filas. **Aplicar SQL primero.**

## 2026-11-26 · Paso 25 — Vista solo lectura de días realizados
- **feat/refactor:** `ResumenDiaRealizado.jsx` y `resumenDiaRealizado` en `lib/cierres.js` para consultar series y cierres de días ya completados en la semana.

## 2026-11-26 · Paso 24 — Gestión de usuarios admin
- **feat:** Pantalla `/admin/usuarios` (`GestionUsuarios`, `FormNuevoAtleta`, `EditarAtleta`) y Edge Function `admin-usuarios` (alta, cambio de contraseña y bloqueo de acceso).
- **db:** `migracion_20_gestion_usuarios.sql` — `profiles.activo` y RPC `set_perfil_atleta`. **Aplicar SQL y desplegar función antes del código.**

## 2026-11-26 · Paso 23 — Cumpleaños y fecha de nacimiento
- **feat/db:** `migracion_19_fecha_nacimiento.sql` (`profiles.fecha_nacimiento`, trigger y RPC `set_fecha_nacimiento`), `CumpleanosAtletas.jsx`, `FechaNacimientoAtleta.jsx` y `lib/cumpleanos.js`.

## 2026-11-26 · Paso 22 — Peso opcional en check-in
- **feat/db:** `migracion_18_peso_en_checkin.sql` (`daily_check_ins.peso_corporal_kg` 20–400 kg) visible en check-ins del entrenador.

## 2026-11-26 · Paso 21 — Cumplimiento calórico en 3 estados
- **feat/db:** `migracion_17_cumplimiento_calorias.sql` (`cumplio`/`menos`/`mas` + trigger de compatibilidad con booleano legado).

## 2026-11-26 · Paso 20 — Check-in diario obligatorio
- **feat:** `PantallaAtleta` bloquea rutas hijas y oculta barra inferior hasta completar el check-in del día local.

## 2026-11-26 · Pasos 18 y 19 — Gráficas de tendencia, oscilación y progreso por ejercicio
- **feat:** `GraficoTendenciaPeso` (`lib/tendenciaPeso.js`, proyección 14d), `GraficoOscilacionPeso` (`lib/oscilacionPeso.js`) y evolución de peso/reps por sesión en `GraficosRecord` (`LineaTemporal.jsx`).

## 2026-11-26 · Pasos 15, 16 y 17 — Tipos de ejercicio, rutina híbrida y cargas
- **feat/db:** `migracion_15` (`tipo_ejercicio`, excluye `aislado` de 1RM en `v_athlete_prs`), `migracion_16` (`modo_hibrido` y `bloque` halterofilia/musculación con triggers) y pantalla `CargasAtleta` (`lib/bloques.js`).

## 2026-11-26 · Pasos 13 y 14 — Cierre de ejercicio con nota y días realizados
- **feat/db:** `migracion_13` (`exercise_closures` con nota obligatoria) y `migracion_14` (`routine_day_completions` + trigger `bloquear_dia_realizado` semanal lunes–domingo).

## 2026-11-25 · Pasos 11B y 12 — Progresión automática, tope de series, RPE opcional y PWA prompt
- **feat/db:** `migracion_11` (`progresion_tipo` doble/escalera + `set_progresion`), `migracion_12` (`pide_rpe` + trigger `limitar_series_por_ejercicio`), `AvisoActualizacion` (`registerType: 'prompt'`), flujo `/recuperar` + `/restablecer` y marca **MyProgress**.

## 2026-11-21 a 2026-11-22 · Pasos 0 a 10 — Base del proyecto
- **feat/db:** Auth/RLS, check-ins, mediciones (`migracion_03`), rutinas (`migracion_04`), check-in único (`migracion_05`), volumen muscular (`migracion_06`), récords/1RM (`migracion_07`), plan nutricional versionado (`migracion_08`), ciclos/lista negra/ejercicios (`migracion_09` + pestañas en ficha admin) y Edge Function IA en pausa (`migracion_02`).