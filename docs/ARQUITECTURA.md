# ARQUITECTURA — MyProgress
> Última actualización: 2026-11-27 (paso 34) · Mantener al día según `AGENTS.md`.

## 1. Visión y Stack
SPA (sin backend propio). El navegador habla directo con Supabase; la seguridad real reside en **PostgreSQL RLS**. Hosting en Netlify vía `git push`.
- **Frontend:** React ^19.3.1, Vite ^8.3.5, Tailwind CSS ^4.3.3 (`@tailwindcss/vite`, tema en `src/index.css` `@theme`, sin `tailwind.config.js`), `react-router-dom` ^7.18.5, `vite-plugin-pwa` ^2.0.0 (`registerType: 'prompt'`, `workbox-window`), `recharts` ^3.11.0 (carga perezosa). Node >= 20.19.
- **Backend/Cloud:** `@supabase/supabase-js` ^2.118.0 (Auth, PostgREST, Postgres, Edge Functions Deno), Netlify (plan gratuito comercial), Gemini `gemini-3.8-flash` (capa gratuita, solo Edge Function, actualmente en pausa).

## 2. Estructura de Carpetas (`/`)
- `AGENTS.md`, `README.md`, `index.html`, `vite.config.js`, `package.json`, `.env.example`, `public/_redirects` (`/* /index.html 200`).
- `docs/`: `REQUERIMIENTOS.md`, `ARQUITECTURA.md`, `CHANGELOG.md`.
- `supabase/sql/`: `README.md`, `schema_supabase.sql`, `migracion_02` a `25` (la `10` de IA no está aplicada).
- `supabase/functions/`:
  - `admin-usuarios/index.ts`: Edge Function (crear atletas, cambiar contraseñas, activar/desactivar acceso; usa `service_role`, valida JWT + rol admin).
  - `generate-weekly-proposals/index.ts`: Edge Function IA (pendiente de desplegar).
- `src/`:
  - `main.jsx`, `App.jsx`, `index.css`
  - `auth/`: `AuthProvider.jsx` (`useAuth()`), `RutaProtegida.jsx` (incluye `CuentaDesactivada`).
  - `pages/`: `Login.jsx`, `RecuperarContrasena.jsx`, `RestablecerContrasena.jsx`, `Inicio.jsx`.
  - `components/`: `Encabezado`, `Estados` (`Cargando`, `SinPerfil`), `Selector`, `ResumenMediciones`, `GraficoEvolucion` (+`Lazy`), `GraficoTendenciaPeso` (+`Lazy`), `GraficoOscilacionPeso` (+`Lazy`), `LineaTemporal`, `RecordsAtleta`, `GraficosRecord` (+`Lazy`), `PlanNutricionalCard`, `ListaComidas`, `CicloVigenteCard`, `AvisoDescarga`, `ResumenDiaRealizado`, `AvisoActualizacion`.
  - `lib/` (lógica pura y helpers): `supabase.js`, `fechas.js`, `useHoy.js`, `numeros.js`, `opciones.js`, `estilos.js` (`CAMPO`, `BOTON`, `BOTON_SEC`, `TARJETA`), `coloresGrafico.js`, `usuarios.js`, `adminUsuarios.js`, `oscilacionPeso.js`, `tendenciaPeso.js`, `panelAtleta.js`, `cumpleanos.js`, `mediciones.js`, `cierres.js`, `bloques.js`, `rutinas.js`, `versionesRutina.js`, `volumen.js`, `nutricion.js`, `comidas.js`, `cargarComidas.js`, `alimentos.js`, `dieta.js` (autocálculo de gramos), `buscarAlimentos.js`, `useBusquedaAlimentos.js`, `ciclos.js`, `descarga.js`, `cargarDescarga.js`, `pesoCombinado.js`, `progresion.js`, `tiposEjercicio.js`, `records.js`.
  - `atleta/`: `PantallaAtleta` (marco + contexto `{ hoy, hecho, marcarHecho }`), `CheckIn`, `Entrenar`, `EntrenarDia`, `MisDatos` (marco), `MisMediciones`, `Records`, `Nutricion`, `CicloActual`.
  - `admin/`: `ListaAtletas`, `CumpleanosAtletas`, `DetalleAtleta`, `PanelAtleta`, `FechaNacimientoAtleta`, `GestionUsuarios`, `FormNuevoAtleta`, `EditarAtleta`, `Mediciones`, `RutinasAtleta`, `DescargaAtleta`, `CargasAtleta`, `EditorRutina`, `SelectorEjercicio`, `HistorialEntrenamiento`, `HistorialRutina`, `VolumenMuscular`, `PlanNutricional`, `PlanComidas`, `CiclosAtleta`, `ListaNegraAtleta`, `FormEjercicio`, `Ejercicios`, `Alimentos`, `FormAlimento`, `BuscadorAlimentos`, `CalculadoraDieta`.

## 3. Rutas
- Públicas: `/login` (`Login`), `/recuperar` (`RecuperarContrasena`).
- Sesión cualquiera: `/restablecer` (`RestablecerContrasena`, sin `RutaProtegida`), `/` (`Inicio` -> redirige por rol).
- Atleta (`client`, marco `PantallaAtleta`):
  - `/atleta` -> `CheckIn` (si ya está hecho, redirige a `/atleta/entrenar`; si está pendiente, bloquea rutas hijas y oculta barra inferior).
  - `/atleta/entrenar` (`Entrenar`), `/atleta/entrenar/:diaId` (`EntrenarDia`).
  - `/atleta/nutricion` (`Nutricion`), `/atleta/datos/nutricion` (redirige a `/atleta/nutricion`).
  - `/atleta/datos` (`MisDatos` -> índice `MisMediciones`), `/atleta/datos/records` (`Records`).
- Admin (`admin`): `/admin` (`ListaAtletas`), `/admin/atletas/:id` (`DetalleAtleta`), `/admin/rutinas/:rutinaId` (`EditorRutina`), `/admin/ejercicios` (`Ejercicios`), `/admin/alimentos` (`Alimentos`), `/admin/usuarios` (`GestionUsuarios`).
- Fallback: `*` -> `/`.

## 4. Base de Datos (Supabase / PostgreSQL)
Migraciones en orden: `schema_supabase.sql`, `02`–`09`, `11`–`25` (10 omitida; la `24` y la `25` están pendientes de aplicar).

### Tablas y Permisos (RLS)
- `profiles`: `rol` (`admin`/`client`), `nombre_completo`, `fecha_nacimiento` (CHECK >= 1900, trigger no futura), `activo` (bool, default true). Atleta lee la suya y edita solo `nombre_completo`. Admin lee todas; escribe nombre/fecha vía RPC; `activo` solo Edge Function.
- `exercises`, `muscle_groups` (14), `exercise_muscles` (`factor` 1 o 0.5): atleta lee, admin escribe. `exercises.tipo_ejercicio` ∈ {`compuesto`, `fuerza`, `halterofilia`, `aislado`}, `restringido` (bool), `video_url` (http/https).
- `metrics`: único `(user_id, fecha)`. Atleta lee; admin escribe.
- `daily_check_ins`: único `(user_id, fecha)`, `peso_corporal_kg` (20–400), `cumplimiento_calorias` (`cumplio`/`menos`/`mas`), `calorias_ayer_cumplidas` (legado sincronizado por trigger). Atleta lee e inserta (±1 día UTC, sin update/delete); admin todo.
- `routines`: `estado` (`borrador`/`activa`/`archivada`), `modo_hibrido` (bool), índice único parcial 1 `activa` por atleta. Atleta lee solo su `activa`; admin todo.
- `routine_days`, `routine_exercises`: atleta lee si ve rutina padre; admin todo. `routine_exercises` incluye `bloque` (`musculacion`/`halterofilia`), `progresion_tipo` (`ninguna`/`doble`/`escalera`), `escalera` (jsonb), `incremento_kg`, `peso_inicial_kg`, `pide_rpe` (bool).
- `routine_logs`: series ejecutadas (`routine_exercise_id`, `sesion_id`, `numero_serie`, `rpe`, `en_descarga` marcada por trigger). Atleta todo sobre las suyas; admin todo.
- `deload_weeks`: semana de descarga (`fecha_inicio`, `fecha_fin = inicio + 6` por CHECK, `cancelada_en`). Atleta lee las suyas; admin lee todas; solo escriben las RPC `activar_descarga` / `cancelar_descarga` (sin políticas de escritura).
- `routine_day_completions`: único `(user_id, routine_day_id, semana_inicio)`. Atleta ve y crea en su rutina activa (sin update/delete); admin todo.
- `exercise_closures`: único `(user_id, routine_exercise_id, fecha)`, `nota` (3–500), `series_hechas < series_objetivo`. Atleta ve, crea y borra las suyas; admin todo.
- `routine_versions`: snapshots automáticos por trigger (`routine_id` set null, `numero`, `desde`/`hasta`, `series_registradas`, `foto` jsonb). Atleta sin acceso; admin solo lectura.
- `meals` (orden 1–10) y `meal_foods` (orden 1–30, `cantidad` >0..10000, `unidad`: `g`/`ml`/`unidad`/`porcion`, FK compuesta `(meal_id, user_id)`). Atleta lee; solo RPC `set_meal_plan` escribe. Desde la `25`, `meal_foods` guarda un **snapshot** opcional (todo o nada por CHECK): `food_id` (set null), `estado`, macros base por 100 g (`base_*`) y macros asignados a los gramos exactos (`calorias`, `proteina_g`, `carbohidratos_g`, `grasas_g`), calculados por la RPC (base × g / 100, 1 decimal); solo con `unidad = 'g'`.
- `foods` (catálogo global, migración 25): `nombre`, `categoria` (`proteina`/`carbohidrato`/`grasa`/`lacteo`/`fruta`/`verdura`/`legumbre`/`otro`), `estado` (`crudo`/`cocido`/`n/a`), macros por 100 g, `macro_dominante` y `nombre_busqueda` (generadas), `activo`. Único `(lower(nombre), estado)`. **Solo admin** lee y escribe (el atleta usa el snapshot de `meal_foods`). No se borra: se desactiva.
- `nutrition_plans` (1 vigente `vigente_hasta is null`), `training_cycles` (macro/meso): atleta lee; admin escribe vía RPC/tabla.
- `ai_load_suggestions` (atleta lee `aceptadas`), `ai_nutrition_suggestions`, `athlete_exercise_blacklist` (solo admin).

### RPCs, Triggers y Vistas clave
- **RPCs:** `is_admin()`, `activate_routine(uuid)`, `duplicate_routine(uuid, uuid)`, `set_progresion(...)`, `set_fecha_nacimiento(uuid, date)`, `set_perfil_atleta(uuid, text, date)`, `ultimas_series_por_ejercicio(uuid, uuid[], timestamptz, integer)`, `foto_rutina(uuid)`, `resumen_periodo_rutina(uuid)`, `set_exercise_muscles(uuid, jsonb)`, `set_meal_plan(uuid, jsonb)`, `activar_descarga(uuid, date)`, `cancelar_descarga(uuid)`, `set_nutrition_plan(...)`, `resolve_nutrition_suggestion(...)`.
- **Triggers:** `handle_new_user`, `sincronizar_cumplimiento_calorias`, `validar_fecha_nacimiento`, `limitar_series_por_ejercicio`, `bloquear_dia_realizado`, `marcar_serie_en_descarga` (fija `routine_logs.en_descarga` con fecha de Bogotá), `bloquear_bloque_sin_hibrido`, `reiniciar_bloques_sin_hibrido`, triggers `before` de versionado (`routine_exercises_versionar`, `routine_days_versionar`, `routines_versionar_hibrido`, `routines_versionar_borrado` -> llaman `congelar_version_rutina`), y triggers de seguridad IA.
- **Vistas (`security_invoker`):** `v_athlete_prs` y `v_best_reps_by_weight` (usadas en récords); `v_athlete_overview`, `v_metrics_trend`, `v_current_training_cycle`, `v_pending_ai_suggestions` (disponibles para pasos futuros).

## 5. Decisiones Técnicas y Reglas Críticas
1. **Fechas locales:** Postgres opera en UTC y los atletas en Colombia (UTC-5). Siempre enviar fechas locales `YYYY-MM-DD` desde el cliente (`lib/fechas.js`, `useHoy`) y nunca parsear fechas sin hora con `new Date("YYYY-MM-DD")`.
2. **AuthProvider:** `onAuthStateChange` solo actualiza estado de sesión; las consultas a `profiles` ocurren en un `useEffect` aparte para evitar deadlocks.
3. **RLS silencioso:** Encadenar `.select('id')` en `update`/`delete` para confirmar filas afectadas.
4. **Progresión y Cargas:** Calculadas en cliente (`lib/progresion.js`) sobre las últimas series de **cada ejercicio por separado** (`ultimas_series_por_ejercicio`), sin guardar la meta en BD. Permite rutinas de larga duración sin pérdida de historial.
5. **Versionado perezoso de rutinas:** Triggers `before` congelan foto en `routine_versions` solo si existen series nuevas desde la última foto.
6. **Catálogo y autocálculo (paso 34):** búsqueda ligera en servidor (`ilike` sobre `nombre_busqueda`, `limit`, columnas mínimas, *debounce* 300 ms; el buscador del creador de dieta no consulta hasta 2 letras o un filtro; nunca se descarga el catálogo completo). El cálculo de gramos es JS puro y determinista (`lib/dieta.js`): cada alimento cubre un macro (`rol`, por defecto su macro dominante), el objetivo se reparte entre comidas por peso y se resuelve por rondas descontando macros indirectos; respeta alimentos con gramos fijos; los manuales no entran. Los macros asignados se recalculan en vivo en cliente y la BD los vuelve a calcular al guardar (mismo redondeo, mitad hacia arriba).
6b. **Comidas del día:** Pertenecen al atleta (`meals`), desacopladas de `nutrition_plans` (versionado por calorías/macros) para no duplicar menús al ajustar macros.
7. **Semana de descarga:** no modifica la rutina. `lib/descarga.js` calcula en cliente una prescripción liviana (series −40 %, carga −10 % musculación / −20 % halterofilia, RPE ≤ 7, progresión en pausa) mientras haya una `deload_weeks` vigente (fecha local). `ultimas_series_por_ejercicio` ignora series `en_descarga`, por eso la progresión retoma desde la última sesión normal. Una sola descarga sin cancelar por atleta (validado en la RPC con lock).
8. **Peso del check-in en la vista de peso:** `lib/pesoCombinado.js` suma, solo para mostrar, los pesos de `daily_check_ins` a las mediciones de `metrics` (por día manda la medición oficial con peso). NO se copia nada a `metrics` (invariante 2): el atleta no puede crear/editar/borrar mediciones oficiales. Lo usa `MisMediciones` para tendencia/proyección, oscilación y "peso actual"; la gráfica distingue punto relleno (oficial) y hueco (check-in). Sin cambios de SQL (el atleta ya lee sus check-ins).
9. **Diseño UI:** Solo modo oscuro (`fondo: #0F1115`, `superficie: #181B22`, `hundido: #12151B`, `borde: #2A2F3A`, `texto: #E8EAEE`, `suave: #A3A9B5`, `primario: #2F5FE3`, `enlace: #7AA2FF`, `alerta: #F0A040`). Táctil >= 44px (`min-h-11`). Atleta `max-w-md`, Admin `max-w-3xl`.

## 6. Despliegue y Configuración Manual
- **Env vars frontend (Netlify y `.env`):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`.
- **Supabase Auth:** Desactivar registro libre; configurar Site URL y Redirect URLs (`https://<sitio>.netlify.app/restablecer`); SMTP propio (Brevo/Resend) para recuperación; contraseña mínima 8 chars.
- **Edge Function `admin-usuarios`:** Desplegar manual en Supabase con *Verify JWT* activo (usa vars internas `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Flujo de entrega:** Aplicar SQL en Supabase SQL Editor **antes** de subir código -> `git add . && git commit -m "tipo: desc" && git push` -> Netlify despliega automático.

## 7. Deuda Técnica Relevante
- Sin ESLint ni suite de tests automatizados en repo (se prueban funciones puras y SQL manualmente).
- `border-[#5B6372]` y `lib/coloresGrafico.js` fuera de `@theme` en `index.css`; `Mediciones.jsx` duplica constante `CAMPO`.
- `routines.cycle_id` sin interfaz; pestaña activa en `DetalleAtleta` se pierde al recargar; `PanelAtleta` repite 8 consultas al volver (sin caché).
- Peso del check-in: solo se combina en `MisMediciones` (últimos 60 check-ins con peso); `PanelAtleta`, `Mediciones` (admin) y `GraficoEvolucion` siguen usando solo `metrics`.
- Descarga: reglas fijas en constantes de `lib/descarga.js` (sin editor por atleta); no hay indicador en `PanelAtleta`/`HistorialEntrenamiento` ni caducidad automática en BD (el fin se deduce de `fecha_fin`).
- Check-in obligatorio validado solo en UI (`PantallaAtleta`), sin trigger en `routine_logs`.
- Desactivar usuario en Auth tarda hasta 1h en caducar JWT activo (UI bloquea al abrir app).
- Comidas del día: sin plantillas ni checklist de consumo. Autocálculo: 1 alimento = 1 rol y solo ajusta gramos (no sugiere alimentos); si los macros indirectos ya superan el objetivo, el alimento queda en 0 g con aviso. Menús guardados antes de la migración 25 no tienen snapshot (se ven sin macros). El seed del catálogo son valores aproximados tipo USDA, a revisar por el entrenador. Sin tests automáticos del motor (se probó con scripts manuales).