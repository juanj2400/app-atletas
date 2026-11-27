# ARQUITECTURA

> Última actualización: 2026-11-26 (paso 29) · Mantener al día es obligatorio (ver `AGENTS.md`).

## 1. Visión general

```
Celular / navegador (React, PWA)
        │  supabase-js + JWT del usuario (clave PÚBLICA)
        ▼
Supabase ── Auth (sesiones, JWT)
        ├─ API REST automática (PostgREST) ── Postgres + RLS  ◀── la seguridad real vive aquí
        └─ Edge Function (service_role + GEMINI_API_KEY) ──▶ Google AI Studio (Gemini)   [pendiente de desplegar]

Código ──git push──▶ GitHub ──aviso──▶ Netlify ──npm run build──▶ https://<sitio>.netlify.app (HTTPS)
```

Es una **SPA** (una sola página; React dibuja todo en el navegador). No hay servidor propio: el navegador habla directo con Supabase y las políticas RLS deciden qué datos puede ver o escribir cada usuario.

## 2. Stack y versiones

| Capa | Tecnología | Versión (package.json) | Por qué esta y no otra |
|---|---|---|---|
| Interfaz | React | ^19.3.1 | Ecosistema más grande; lo pidió el dueño |
| Empaquetado | Vite | ^8.3.5 | Arranque instantáneo; genera archivos estáticos. Descartados: Create React App (sin mantenimiento) y Next.js (servidor/SSR innecesarios) |
| Estilos | Tailwind CSS (+ `@tailwindcss/vite`) | ^4.3.3 | Estilos en el propio JSX; tema en CSS (`@theme`), sin `tailwind.config.js` |
| Rutas | react-router-dom | ^7.18.5 | Navegación sin recargar; rutas anidadas |
| PWA | vite-plugin-pwa | ^2.0.0 | Manifest + service worker; **no bajar a 1.x** (incompatible con Vite 8). El aviso de versión nueva usa `workbox-window` (dependencia par ya instalada: no se agregó nada) |
| Datos/Auth | @supabase/supabase-js | ^2.118.0 | Cliente oficial |
| Gráficos | recharts | ^3.11.0 | Componentes React declarativos; se carga perezosa |
| Plugin React | @vitejs/plugin-react | ^6.1.2 | JSX y recarga en caliente |
| Base de datos | Supabase (PostgreSQL) plan gratuito | — | Datos relacionales + RLS; descartado Firebase |
| Hosting | Netlify | — | Plan gratuito permite uso comercial (el plan Hobby de Vercel no) |
| IA | Gemini 3.8 Flash (`gemini-3.8-flash`) | variable `GEMINI_MODEL` | Capa gratuita; **solo desde la Edge Function** |

Node >= 20.19 (requisito de Vite 8). Gestor: npm; `package-lock.json` versionado.

## 3. Estructura de carpetas

```
/
├─ AGENTS.md                      reglas para IAs
├─ README.md                      arranque rápido
├─ docs/
│  ├─ REQUERIMIENTOS.md           qué hace la app / qué falta
│  ├─ ARQUITECTURA.md             este archivo
│  └─ CHANGELOG.md                historial de cambios
├─ supabase/
│  ├─ sql/                        scripts SQL (esquema y migraciones), se aplican a mano en el SQL Editor
│  │   ├─ README.md               orden de aplicación y nombre de cada uno en el SQL Editor
│  │   ├─ schema_supabase.sql
│  │   └─ migracion_02 … migracion_09, migracion_11, migracion_12, migracion_13, migracion_14, migracion_15 … migracion_22 (la 10, de la IA, no está en el repo ni aplicada)
│  └─ functions/
│      ├─ admin-usuarios/index.ts            Edge Function: crear atletas, cambiar contraseñas, activar/desactivar acceso (service_role, solo admin)
│      └─ generate-weekly-proposals/index.ts Edge Function de IA (TypeScript/Deno)
├─ public/                        _redirects (Netlify SPA), favicon, íconos PWA
├─ index.html · vite.config.js · package.json · .env.example
└─ src/
   ├─ main.jsx                    punto de entrada: BrowserRouter > AuthProvider > App
   ├─ App.jsx                     mapa de rutas
   ├─ index.css                   Tailwind + tema (colores)
   ├─ lib/                        lógica pura y constantes
   │   ├─ supabase.js             cliente único de Supabase
   │   ├─ fechas.js               fechaLocalISO, formatearFecha, formatearFechaCorta, inicioSemanaISO (lunes local), inicioSemanaSiguienteISO, inicioDeFechaISO (medianoche local de una fecha, como instante)
   │   ├─ usuarios.js             validar nombre, correo y contraseña de un atleta, generar contraseña temporal aleatoria y texto de acceso para compartir (función pura)
   │   ├─ adminUsuarios.js        llamada a la Edge Function admin-usuarios (devuelve {data} o {error} en español) y copiar al portapapeles
   │   ├─ useHoy.js               hook: fecha de hoy que cambia sola a medianoche
   │   ├─ numeros.js              aNumero (texto → número/null/NaN)
   │   ├─ opciones.js             ánimos, estados calóricos, estados de rutina + textos
   │   ├─ estilos.js              CAMPO, BOTON, BOTON_SEC, TARJETA
   │   ├─ oscilacionPeso.js       oscilación del peso: cambio entre mediciones, mínimo, máximo, rango y promedio (función pura)
   │   ├─ tendenciaPeso.js        tendencia del peso: regresión lineal sobre días transcurridos, proyección y texto (función pura)
   │   ├─ coloresGrafico.js       colores de los gráficos (SVG necesita texto, no clases)
   │   ├─ panelAtleta.js          panel general del atleta (entrenador): resumen de check-ins, días realizados de la semana, avisos de atención y textos (función pura)
   │   ├─ cumpleanos.js           cumpleaños: validar fecha de nacimiento, edad, próximo cumpleaños (29 feb) y resumen para la lista (función pura)
   │   ├─ mediciones.js           resumirMediciones, textoMedicion
   │   ├─ cierres.js              estado de cada ejercicio (completo/finalizado/pendiente), rutina del día completa, validar nota, unir cierres al historial, resumen de solo lectura de un día realizado (`resumenDiaRealizado`, `textoResumenSeries`)
│   ├─ bloques.js              rutina híbrida: agrupar ejercicios por bloque (halterofilia primero), texto "2 de halterofilia + 5 de musculación" y cargas por disciplina
│   ├─ rutinas.js              textos de prescripción/series, descansos rápidos (`DESCANSOS_RAPIDOS`), última vez, agrupar historial
   │   ├─ versionesRutina.js      periodos de la rutina: comparar dos fotos (`compararFotos`), periodo anterior, rango de fechas y texto de la actividad (función pura)
   │   ├─ volumen.js              calcularVolumen (series semanales por músculo)
   │   ├─ nutricion.js            macros↔kcal, objetivo de calorías por fecha, adherencia
   │   ├─ ciclos.js               semana del mesociclo, ciclo vigente, validación de fechas
   │   ├─ progresion.js           meta del día (rango de reps y fuerza simple), esquemas NxM y sus textos
   │   ├─ tiposEjercicio.js       tipos de ejercicio (compuesto/fuerza/halterofilia/aislado) y si aplican a 1RM
   │   └─ records.js              1RM (Epley), progreso del 1RM por día, evolución del peso máximo y las repeticiones por día, textos y fechas de los récords
   ├─ auth/
   │   ├─ AuthProvider.jsx        sesión + perfil (rol); useAuth()
   │   └─ RutaProtegida.jsx       "portero" por rol
   ├─ pages/                      Login.jsx, RecuperarContrasena.jsx, RestablecerContrasena.jsx, Inicio.jsx (redirige por rol)
   ├─ components/                 Encabezado, Estados, Selector, ResumenMediciones, GraficoEvolucion, GraficoEvolucionLazy, GraficoTendenciaPeso, GraficoTendenciaPesoLazy, GraficoOscilacionPeso, GraficoOscilacionPesoLazy, LineaTemporal, RecordsAtleta, GraficosRecord, GraficosRecordLazy, PlanNutricionalCard, CicloVigenteCard, ResumenDiaRealizado, AvisoActualizacion
   ├─ atleta/                     PantallaAtleta (marco), CheckIn, Entrenar, EntrenarDia, MisDatos (marco con secciones), MisMediciones, Records, Nutricion, CicloActual
   └─ admin/                      ListaAtletas, CumpleanosAtletas, DetalleAtleta, PanelAtleta, FechaNacimientoAtleta, GestionUsuarios, FormNuevoAtleta, EditarAtleta, Mediciones, RutinasAtleta, CargasAtleta, EditorRutina,
                                  SelectorEjercicio, HistorialEntrenamiento, HistorialRutina, VolumenMuscular, PlanNutricional, CiclosAtleta, ListaNegraAtleta, FormEjercicio, Ejercicios
```

> Los scripts SQL viven en `supabase/sql/`. Si se adopta la CLI de Supabase en el futuro, esta carpeta se reconciliará con `supabase/migrations/`.

## 4. Rutas

| Ruta | Rol | Pantalla |
|---|---|---|
| `/login` | público | `Login` |
| `/recuperar` | público | `RecuperarContrasena` (pide el correo) |
| `/restablecer` | con sesión (la del enlace del correo), cualquier rol | `RestablecerContrasena` (elegir contraseña nueva; sin `RutaProtegida`) |
| `/` | cualquiera | `Inicio` → redirige a `/atleta` o `/admin` |
| `/atleta` | client | `PantallaAtleta` (marco). Índice: `CheckIn` (si ya está hecho, redirige a `/atleta/entrenar`) |
| `/atleta/entrenar` | client | `Entrenar` (días de la rutina activa) |
| `/atleta/entrenar/:diaId` | client | `EntrenarDia` (registro de series) |
| `/atleta/datos` | client | `MisDatos` (marco con dos secciones); índice: `MisMediciones` (Medidas) |
| `/atleta/datos/records` | client | `Records` (récords con gráficas) |
| `/atleta/datos/nutricion` | client | `Nutricion` (plan de calorías y macros) |
| `/admin` | admin | `ListaAtletas` |
| `/admin/atletas/:id` | admin | `DetalleAtleta` |
| `/admin/rutinas/:rutinaId` | admin | `EditorRutina` |
| `/admin/ejercicios` | admin | `Ejercicios` |
| `/admin/usuarios` | admin | `GestionUsuarios` (crear atleta con `FormNuevoAtleta`; editar datos, acceso y contraseña con `EditarAtleta`) |
| `*` | — | redirige a `/` |

`PantallaAtleta` comparte con sus hijas, por el contexto del `<Outlet>`, `{ hoy, hecho, marcarHecho }` (estado del check-in de hoy).

## 5. Base de datos (Supabase / PostgreSQL)

Scripts aplicados, en orden: `schema_supabase.sql` → `migracion_02_nutricion_dashboard.sql` → `03_metricas_admin` → `04_rutinas` → `05_checkin_una_vez` → `06_volumen_muscular` → `07_records_por_peso` → `08_plan_nutricional` → `09_ejercicios_video_seguro`. → `11_progresion` (progresión automática; ya aplicada en Supabase). La 10 (IA, en pausa) no está en el repo. → `12_series_y_rpe` (tope de series y `pide_rpe`; ya aplicada) → `13_cierre_ejercicio` (tabla `exercise_closures`; ya aplicada) → `14_dias_realizados` (tabla `routine_day_completions` y trigger `bloquear_dia_realizado`; ya aplicada) → `15_tipo_ejercicio_1rm` (columna `tipo_ejercicio` y vista `v_athlete_prs` actualizada; ya aplicada) → `16_rutina_hibrida` (columnas `modo_hibrido` y `bloque`, dos triggers y `duplicate_routine` actualizada; ya aplicada) → `17_cumplimiento_calorias` (columna `cumplimiento_calorias` y trigger `sincronizar_cumplimiento_calorias`; ya aplicada) → `18_peso_en_checkin` (columna `daily_check_ins.peso_corporal_kg`; ya aplicada) → `19_fecha_nacimiento` (columna `profiles.fecha_nacimiento`, trigger `validar_fecha_nacimiento` y RPC `set_fecha_nacimiento`; ya aplicada) → `20_gestion_usuarios` (columna `profiles.activo` y RPC `set_perfil_atleta`; **SQL primero, luego el código**) → `21_ultima_vez_por_ejercicio` (función `ultimas_series_por_ejercicio`; **SQL primero, luego el código**) → `22_historial_rutina` (tabla `routine_versions`, funciones `foto_rutina`, `congelar_version_rutina` y `resumen_periodo_rutina` y triggers de versionado; **SQL primero, luego el código**).

### 5.1 Tablas

| Tabla | Propósito | Claves y restricciones destacadas |
|---|---|---|
| `profiles` | 1 fila por usuario (se crea con trigger desde `auth.users`) | `rol` ∈ {admin, client}; el cliente solo puede editar `nombre_completo`; `fecha_nacimiento` date opcional (migración 19: CHECK ≥ 1900, trigger contra fechas futuras; solo se escribe con la RPC `set_fecha_nacimiento` o `set_perfil_atleta`); `activo` boolean (migración 20, por defecto true; el atleta no tiene permiso de escritura y solo la cambia la Edge Function `admin-usuarios`, que además bloquea el login en Auth) |
| `exercises` | Biblioteca global | `nombre` único; `tipo_ejercicio` ∈ {compuesto, fuerza, halterofilia, aislado} (migración 15, por defecto `compuesto`; los aislados no tienen 1RM); `restringido` (lista negra global); `video_url` (solo http/https: CHECK de la migración 09), `descripcion` |
| `muscle_groups` | Catálogo de 14 músculos | `codigo` PK, `orden` |
| `exercise_muscles` | Músculos de cada ejercicio | PK (`exercise_id`,`muscle`); `factor` ∈ (0,1] (1 principal, 0,5 secundario) |
| `metrics` | Mediciones (peso, cintura, calorías, estado calórico) | **único** (`user_id`,`fecha`) |
| `daily_check_ins` | Check-in diario | **único** (`user_id`,`fecha`); horas 0–24; ánimo ∈ {mal, regular, bien}; `peso_corporal_kg` numeric(4,1) opcional, CHECK 20–400 (migración 18; dato declarado por el atleta, no es una medición oficial); `cumplimiento_calorias` ∈ {cumplio, menos, mas} (migración 17; null = sin dato); `calorias_ayer_cumplidas` boolean es el legado sí/no, que un trigger mantiene sincronizado |
| `routines` | Rutina de un atleta | `estado` ∈ {borrador, activa, archivada}; `origen` ∈ {manual, ia}; **índice único parcial: una `activa` por atleta**; `modo_hibrido` (migración 16: bloques de halterofilia y musculación) |
| `routine_days` | Días de la rutina | `orden` |
| `routine_exercises` | Ejercicios prescritos de cada día | `bloque` ∈ {musculacion, halterofilia} (migración 16), series 1–20, `reps_min`/`reps_max`, `rpe_objetivo`, `descanso_seg`, `peso_sugerido_kg`; progresión (migración 11): `progresion_tipo` ∈ {ninguna, doble, escalera}, `escalera` (jsonb: lista de parejas `[series, reps]`), `incremento_kg` (> 0 y ≤ 20; la interfaz ofrece 2,5 o 5), `peso_inicial_kg` (propio de cada atleta, no se copia); `pide_rpe` boolean, por defecto true (migración 12: si es false, el atleta no ve ni llena el RPE) |
| `routine_day_completions` | Día de rutina terminado por el atleta en una semana (migración 14) | `routine_day_id` (cascade), `fecha` y `semana_inicio` (lunes local, validado por CHECK), conteos de ejercicios; único `(user_id, routine_day_id, semana_inicio)` |
| `exercise_closures` | Ejercicio finalizado por el atleta sin completar las series (migración 13) | `routine_exercise_id` (set null), `fecha` (día local), `nota` 3–500, `series_hechas` < `series_objetivo`; único `(user_id, routine_exercise_id, fecha)` |
| `routine_versions` | Periodos de una rutina (migración 22): foto de la prescripción y rango real de series | `routine_id` (set null: sobrevive al borrado de la rutina), `user_id` (cascade), `numero` por rutina, `desde`/`hasta` (primera y última serie), `series_registradas`, `foto` jsonb; único `(routine_id, numero)`. Solo la escribe el trigger |
| `routine_logs` | Cada serie ejecutada | `routine_exercise_id` (opcional), `sesion_id`, `numero_serie`, RPE 1–10 |
| `nutrition_plans` | Plan nutricional oficial (manual: `set_nutrition_plan`; IA: `resolve_nutrition_suggestion`) | **único parcial**: un plan vigente por atleta (`vigente_hasta is null`) |
| `ai_load_suggestions` | Buzón de cargas de la IA | estados pendiente/aceptado/rechazado |
| `ai_nutrition_suggestions` | Buzón nutricional de la IA | estados pendiente/aceptado/editado/rechazado |
| `training_cycles` | Macro/meso/microciclos | jerárquica (`parent_id`); la app usa macrociclo y mesociclo (el microciclo no tiene interfaz) |
| `athlete_exercise_blacklist` | Lista negra por atleta | único (`user_id`,`exercise_id`) |

Todas las llaves foráneas a usuarios son `on delete cascade` sobre `profiles`; `routine_logs.exercise_id` y `routine_exercises.exercise_id` usan `restrict` (no se borra un ejercicio con historial).

### 5.2 Permisos (RLS) — estado actual

| Tabla | Atleta | Admin |
|---|---|---|
| `profiles` | lee la suya; edita solo `nombre_completo` | lee todas; escribe `nombre_completo` y `fecha_nacimiento` solo vía RPC (`set_perfil_atleta`, `set_fecha_nacimiento`); `activo` solo la Edge Function |
| `exercises`, `muscle_groups`, `exercise_muscles` | lee | escribe |
| `metrics` | **lee** las suyas | escribe |
| `daily_check_ins` | lee las suyas; **inserta** la suya (fecha ± 1 día respecto a UTC); sin update/delete | todo |
| `routines` | lee solo la suya **activa** | todo |
| `routine_days`, `routine_exercises` | lee si puede ver la rutina padre | todo |
| `routine_logs` | todo sobre las suyas | todo |
| `routine_versions` | sin acceso | solo lectura (nadie escribe desde la app: solo el trigger `security definer`) |
| `routine_day_completions` | ve las suyas; crea (solo días de su rutina activa); no modifica ni borra | todo |
| `exercise_closures` | ve las suyas; crea (solo ejercicios de su rutina activa) y borra las suyas; no modifica | todo |
| `nutrition_plans`, `training_cycles` | lee los suyos | escribe |
| `ai_load_suggestions` | lee solo las suyas **aceptadas** | todo |
| `ai_nutrition_suggestions`, `athlete_exercise_blacklist` | sin acceso | todo |

### 5.3 Funciones, triggers y vistas
- **Funciones:** `is_admin()` · `activate_routine(uuid)` · `duplicate_routine(uuid, uuid)` (desde la migración 11 también copia la configuración de progresión, pero no el peso inicial) · `set_progresion(...)` (RPC solo admin: valida y guarda la progresión de un ejercicio) · `set_fecha_nacimiento(uuid, date)` (RPC solo admin, `security definer`, `search_path=''`; null borra la fecha) · `set_perfil_atleta(uuid, text, date)` (RPC solo admin, `security definer`, `search_path=''`; guarda nombre y fecha de nacimiento de un atleta, solo sobre `rol = 'client'`) · `ultimas_series_por_ejercicio(uuid, uuid[], timestamptz, integer)` (migración 21; `security invoker`, `stable`, `search_path=''`: devuelve las últimas N series [40 por defecto, máx. 100] de CADA ejercicio por separado; RLS de `routine_logs` manda) · `foto_rutina(uuid)` (migración 22; `security invoker`, `stable`: la rutina con días y ejercicios como JSON) · `congelar_version_rutina(uuid)` (migración 22; `security definer`, `search_path=''`, sin permiso para `anon` ni `authenticated`: solo la llaman los triggers) · `resumen_periodo_rutina(uuid)` (migración 22; `security invoker`: por ejercicio, series, días, mejor serie de un periodo) · `set_exercise_muscles(uuid, jsonb)` · `set_nutrition_plan(...)` · `resolve_nutrition_suggestion(...)` (RPC solo admin, `security definer`, `search_path=''`).
- **Triggers:** `handle_new_user` (crea el perfil) · `force_suggestion_pending` (toda propuesta nace `pendiente`) · `guard_suggestion_resolution` (resuelta = inmutable; sella fecha y autor) · `block_blacklisted_suggestion` (la IA no puede proponer ejercicios en lista negra) · `sincronizar_cumplimiento_calorias` (migración 17; `before insert or update` en `daily_check_ins`: el booleano antiguo refleja la columna nueva, y un "sí" de una app vieja completa `cumplimiento_calorias`) · `validar_fecha_nacimiento` (migración 19; `before insert or update` de `fecha_nacimiento` en `profiles`: rechaza fechas futuras) · `routine_exercises_versionar`, `routine_days_versionar`, `routines_versionar_hibrido` y `routines_versionar_borrado` (migración 22; `before` de cada cambio: guardan el periodo con `congelar_version_rutina` si hay series nuevas del atleta) · `limitar_series_por_ejercicio` (migración 12; `before insert` en `routine_logs`: rechaza una serie si ya hay tantas como las prescritas para ese ejercicio en ese `sesion_id`; `security definer`, con candado para que dos inserciones simultáneas no se salten el tope).
- **Vistas** (`security_invoker`): `v_athlete_overview`, `v_metrics_trend`, `v_athlete_prs`, `v_current_training_cycle`, `v_pending_ai_suggestions` y `v_best_reps_by_weight` (migración 07: mejor cantidad de repeticiones por peso). La app usa `v_athlete_prs` y `v_best_reps_by_weight` (récords); el resto está listo para los pasos 9–11. `v_athlete_prs` calcula el 1RM (Epley) sin límite de repeticiones.

## 6. Flujos clave

- **Recuperar contraseña:** `RecuperarContrasena` llama a `resetPasswordForEmail` con `redirectTo = <sitio>/restablecer` → el correo trae un enlace → al abrirlo, Supabase crea una sesión temporal y `AuthProvider` marca `recuperando` (por el evento `PASSWORD_RECOVERY` o, si ese evento se pierde, porque la URL traía `type=recovery`, leído al cargar el módulo) → `App.jsx` manda a `/restablecer` hasta que se cambia la contraseña (`updateUser`) → `Continuar` lleva a `/` y de ahí a su zona.
- **Aviso de versión nueva:** `AvisoActualizacion` usa `useRegisterSW` (`virtual:pwa-register/react`): cuando el service worker nuevo queda en espera muestra el cartel; *Actualizar* ejecuta `updateServiceWorker(true)` (activa y recarga). Busca versiones cada hora y al volver a la app.
- **Inicio de sesión:** `signInWithPassword` → `AuthProvider` recibe `SIGNED_IN` → consulta `profiles` por el id → `Inicio` redirige según rol.
- **Check-in (obligatorio):** `PantallaAtleta` consulta si existe el de hoy → mientras no se sepa muestra "Cargando..." sin dibujar pantallas hijas; si está pendiente, redirige cualquier ruta distinta de `/atleta` al formulario y oculta la barra inferior (con un aviso arriba) → `insert` (error `23505` = ya existía) → marca hecho → redirige a Entrenar.
- **Registrar serie:** cada "Guardar serie" hace un `insert` en `routine_logs` con `routine_exercise_id` y `sesion_id` (se reutiliza el de hoy si ya hay series). "Hoy" = desde la medianoche local; "última vez" = serie del entrenamiento anterior del mismo ejercicio. Cuando se completan las series de un ejercicio, el formulario desaparece; si aun así llega una de más (pantalla desactualizada, doble toque), el trigger responde con un error `P0001` ya redactado en español y la pantalla se recarga. Si el ejercicio no pide RPE (`pide_rpe = false`), el campo no se dibuja y se guarda `rpe = null`.
- **Activar rutina:** RPC `activate_routine` (archiva la activa anterior y activa la nueva, todo o nada).
- **Volumen:** `calcularVolumen()` multiplica series × factor de cada músculo, separando directas (factor ≥ 1) e indirectas.
- **Récords:** `RecordsAtleta` pide a `v_athlete_prs` una fila por ejercicio (con `aplica_1rm`: en los aislados `e1rm_kg` es null y la mejor serie es la de mayor peso; no entran al ranking y su detalle no pide ni dibuja la evolución del 1RM); al desplegar uno, pide a `v_best_reps_by_weight` sus marcas por peso y hasta 500 series recientes de ese ejercicio (para "última vez", la evolución del 1RM y la evolución del peso máximo y las repeticiones, todas agrupadas por día local con esas mismas series: sin consultas nuevas). La evolución de peso/repeticiones se dibuja también en los aislados (que no tienen 1RM) y con peso corporal (0 kg: solo repeticiones). Las vistas respetan RLS (`security_invoker`): el atleta ve lo suyo y el entrenador, todo.
- **Plan nutricional:** el entrenador guarda un plan con `set_nutrition_plan` (RPC: cierra el vigente y crea el nuevo, todo o nada; valida rangos). El atleta lo lee en *Mis datos › Nutrición*. Los gráficos de calorías reciben el historial de planes y dibujan el objetivo vigente en cada fecha (`kcalObjetivoEnFecha`).
- **Ciclos:** `CiclosAtleta` (entrenador) valida con `validarCiclo` (fechas, pertenencia al macrociclo, solapes) y guarda en `training_cycles`. `CicloActual` (atleta, en *Entrenar*) lee sus ciclos y `cicloVigente()` decide el mesociclo en curso con la fecha local que entrega `PantallaAtleta`.
- **Gestión de cargas:** `CargasAtleta` (pestaña Entrenamiento de la ficha) carga la rutina activa con sus ejercicios y, con `ultimas_series_por_ejercicio`, las últimas series de cada ejercicio, separa los ejercicios con `cargasPorDisciplina` (halterofilia / musculación, agrupados por día; sin modo híbrido todo es musculación) y por ejercicio muestra la última vez y la próxima meta (`calcularUltimaVez` + `calcularMeta`). Los ajustes (progresión, incremento, peso inicial) se guardan con la RPC `set_progresion`, igual que el editor.
- **Periodos de la rutina:** el editor no cambia: cada `insert`/`update`/`delete` sobre `routine_exercises` o `routine_days` (y el cambio de `modo_hibrido` o el borrado de `routines`) dispara un trigger `before` que llama a `congelar_version_rutina(routine_id)`. Esta cuenta las series del atleta ligadas a la rutina con `realizado_en` posterior al `hasta` de su última foto; si hay, inserta una fila con `foto_rutina()` (estado ANTES del cambio), `desde`/`hasta` = primera/última de esas series y `numero + 1`; si no hay, no hace nada. `HistorialRutina` (ficha › Entrenamiento › *Periodos*) pide hasta 50 periodos, la rutina activa y su `foto_rutina`, y compara con `compararFotos` (pura) la rutina actual con el último periodo y cada periodo con el anterior de la misma rutina; al abrir un periodo pide `resumen_periodo_rutina` (la base resume; no se traen series al cliente).
- **Rutina híbrida:** `EditorRutina` tiene el interruptor `ModoHibrido` (actualiza `routines.modo_hibrido`) y, con el modo activo, `DiaRutina` muestra dos bloques con su propio botón de agregar y cada fila elige su `bloque`. `EntrenarDia` pide `routines ( modo_hibrido )` y `routine_exercises.bloque`, agrupa con `agruparPorBloque` y etiqueta cada ejercicio; `Entrenar` muestra el resumen de bloques por día. Los triggers de la migración 16 impiden la halterofilia sin modo híbrido y reinician los bloques al desactivarlo.
- **Día realizado:** *Terminar rutina* inserta en `routine_day_completions` (fecha y lunes locales). `Entrenar` carga los de la semana actual (se recalcula con `useHoy`) y marca esos días; `EntrenarDia` consulta el día y, si ya está realizado, muestra el aviso y un **resumen de solo lectura** (`ResumenDiaRealizado`) en vez del formulario: en ese caso hace una consulta extra con las series (`routine_logs`, hasta 500) y los cierres (`exercise_closures`) de la semana lunes–domingo local, y `resumenDiaRealizado()` los une con lo prescrito. `Entrenar` enlaza el día realizado a esa vista. Sin SQL nuevo: las políticas ya dejan al atleta leer lo suyo. El trigger `bloquear_dia_realizado` rechaza (P0001, mensaje en español) las series de ese día durante la misma semana; calcula la semana con `America/Bogota`.
- **Cerrar ejercicio y rutina del día:** `EntrenarDia` carga los cierres de hoy (`exercise_closures`, por `fecha` local) junto con las series. Cada ejercicio es `completo`, `cerrado` (con nota) o `pendiente` (`lib/cierres.js`); sin pendientes aparece el indicador de rutina completada (fondo `primario`, el token más fuerte del tema, porque no hay token verde) y *Terminar rutina* navega a `Entrenar` con `state.rutinaCompletada`. `HistorialEntrenamiento` une los cierres a los días con `unirCierres`.
- **Progresión:** `EditorRutina` guarda primero los datos básicos del ejercicio y luego llama a la RPC `set_progresion` (tipo, escalera, incremento y peso inicial; la función revisa las reps ya guardadas). `EntrenarDia` ya trae las series del entrenamiento anterior de cada ejercicio (RPC `ultimas_series_por_ejercicio` con `p_antes` = hoy 00:00 local, luego `calcularUltimaVez`) y se las pasa a `calcularMeta()` (función pura de `lib/progresion.js`), que devuelve la meta del día; `textoMeta()` la convierte en el texto de la tarjeta "Meta de hoy". No se guarda la meta: se recalcula siempre desde las series reales.
- **Panel del atleta:** `DetalleAtleta` abre siempre en la pestaña *Resumen*, que muestra `PanelAtleta`. Este hace 8 consultas livianas en paralelo (rutina activa con sus días, días terminados esta semana, última serie, 30 mediciones, plan vigente, ciclos, conteo de lista negra y `v_athlete_prs`) y calcula con `lib/panelAtleta.js` los avisos y los contadores. Cada tarjeta llama a `irA(pestana, seccion)` de `DetalleAtleta`: cambia la pestaña y, tras 80 ms, hace `scrollIntoView` al contenedor con id `seccion-*` que envuelve cada sección. Los contenedores existen desde el primer dibujado, aunque sus datos lleguen después. Al volver al panel se vuelve a montar y refresca los datos.
- **Cumpleaños:** `ListaAtletas` pide `fecha_nacimiento` junto con nombre y correo (consulta que ya existía) y `CumpleanosAtletas` llama a `resumirCumpleanos(atletas, hoy)` (`lib/cumpleanos.js`) con la fecha local de `useHoy`. La fecha se anota en `FechaNacimientoAtleta` (ficha), que guarda con la RPC `set_fecha_nacimiento` y avisa a `DetalleAtleta` para refrescar el dato sin recargar.
- **Lista negra:** `ListaNegraAtleta` escribe en `athlete_exercise_blacklist`; `EditorRutina` la lee para advertir; el trigger `block_blacklisted_suggestion` la usa contra la IA.
- **Usuarios:** `GestionUsuarios` lista los perfiles `client` (con `activo`) y abre `FormNuevoAtleta` o `EditarAtleta`. Nombre y fecha se guardan con la RPC `set_perfil_atleta`. Crear atleta, activar/desactivar y cambiar contraseña pasan por `lib/adminUsuarios.js` → Edge Function `admin-usuarios` (`supabase.functions.invoke` envía la sesión del entrenador). La función verifica el JWT y `rol = 'admin'` con un cliente "como el usuario", y solo entonces crea el cliente `service_role`. Crear: `auth.admin.createUser` con `email_confirm: true` y el nombre en `user_metadata` (el trigger `handle_new_user` crea el perfil), después guarda la fecha y, si algo falla, borra el usuario recién creado. Estado: `ban_duration` en Auth (876000 h = bloqueado, `none` = libre) y luego `profiles.activo`. `RutaProtegida` muestra `CuentaDesactivada` si `perfil.activo === false`; `Login` traduce el error `user_banned`.
- **IA (pendiente):** botón admin → Edge Function por lotes de 3 atletas → Gemini con esquema JSON → validación con límites (±10 % en kcal y cargas) → inserción como `pendiente` → el admin aprueba/edita/rechaza.

## 7. Diseño visual

**Principios:** solo oscuro · mobile-first · táctil (≥ 44 px) · sobrio y legible. Zona del atleta `max-w-md` con barra inferior fija; zona del admin `max-w-3xl`.

**Colores** (definidos en `src/index.css`, bloque `@theme`; se usan como `bg-superficie`, `text-suave`, etc.):

| Token | Hex | Uso |
|---|---|---|
| `fondo` | `#0F1115` | Fondo de pantalla, campos |
| `superficie` | `#181B22` | Tarjetas, barra inferior |
| `hundido` | `#12151B` | Tarjetas dentro de tarjetas |
| `borde` | `#2A2F3A` | Bordes, rejillas |
| `texto` | `#E8EAEE` | Texto principal |
| `suave` | `#A3A9B5` | Texto secundario |
| `primario` | `#2F5FE3` | Botones principales (texto blanco), barras |
| `enlace` | `#7AA2FF` | Enlaces, estados activos, avisos de éxito |
| `alerta` | `#F0A040` | Errores, pendientes, advertencias |
| (deuda) `#5B6372` | — | Borde de campos de formulario, escrito como `border-[#5B6372]` |

**Tipografía:** pila de fuentes del sistema (por defecto de Tailwind: `ui-sans-serif, system-ui…`); no se cargan fuentes externas. Jerarquía usada: pantalla `text-xl`/`text-2xl font-bold`; sección `text-lg font-bold`; cifras KPI `text-2xl font-bold`; secundario `text-sm text-suave`; micro `text-xs text-suave`.

**Patrones de componentes**
- Tarjeta: `rounded-2xl border border-borde bg-superficie p-4` (constante `TARJETA`).
- Botón principal: `min-h-11 rounded-xl bg-primario px-4 font-semibold text-white` (`BOTON`); secundario con borde (`BOTON_SEC`); destructivo: secundario con `text-alerta`.
- Campo: `min-h-11 w-full rounded-xl border border-[#5B6372] bg-fondo px-3` (`CAMPO`).
- Barra inferior del atleta: `fixed`, pestañas `min-h-14`, con `env(safe-area-inset-bottom)`; el `body` aplica los márgenes seguros del notch.
- Avisos: `role="alert"` (errores, `text-alerta`) / `role="status"` (éxito, `text-enlace`).

**Componentes clave:** `Selector` (botones Sí/No, ánimo y cumplimiento de calorías; controlado, `aria-pressed`; `vertical` apila las opciones largas) · `Encabezado` (título, enlace "volver", botón Salir) · `Estados` (`Cargando`, `SinPerfil`) · `ResumenMediciones` (4 tarjetas, de presentación) · `GraficoEvolucion` (ComposedChart: peso en línea, calorías en barras, dos ejes; colores como constantes porque SVG necesita texto) y `GraficoEvolucionLazy` (carga perezosa con `Suspense`) · `GraficoTendenciaPeso` y su `Lazy` (peso real, tendencia y proyección sobre eje X numérico de días; colores de `coloresGrafico.js`) · `GraficoOscilacionPeso` y su `Lazy` (línea del peso con promedio + barras del cambio entre mediciones; atleta y entrenador) · `LineaTemporal` (línea "valor por día" compartida por la oscilación del peso y las gráficas de peso/repeticiones de los récords; solo se importa desde componentes perezosos) · `VolumenMuscular` (barras CSS por músculo) · `RecordsAtleta` (compartido por atleta y entrenador; carga sus propios datos desde las vistas) · `GraficosRecord` (¿he mejorado?: peso máximo y repeticiones por entrenamiento, evolución del 1RM y repeticiones por peso; carga perezosa) · `PlanNutricionalCard` (presentación de calorías y macros, compartida por atleta y entrenador) · `CicloVigenteCard` (ciclo en curso con semana y progreso, compartido).

## 8. Decisiones técnicas importantes

1. **SPA con Supabase directo, sin backend propio.** La seguridad la imponen las políticas RLS; `RutaProtegida` solo es experiencia de usuario.
2. **Secretos:** en el frontend solo la clave pública. `service_role` y `GEMINI_API_KEY` solo como secrets de la Edge Function.
3. **`AuthProvider`:** el listener `onAuthStateChange` solo guarda la sesión (consultar Supabase ahí puede bloquearse); el perfil se carga en un efecto aparte dependiente del id de usuario. `cargando` espera sesión **y** perfil.
4. **Fechas locales:** Postgres usa UTC y Colombia UTC-5; se envía la fecha local del celular en formato `YYYY-MM-DD` y nunca se parsea una fecha sin hora con `new Date("…")`. La política del check-in acepta ± 1 día respecto a UTC.
5. **RLS silencioso:** un `update`/`delete` bloqueado afecta 0 filas sin error; por eso se encadena `.select('id')` y se comprueba el resultado.
6. **Operaciones críticas en la base de datos** (RPC "todo o nada"): activar y copiar rutinas, reemplazar músculos, resolver propuestas.
7. **Una rutina activa por atleta** (índice único parcial); el atleta no ve borradores.
8. **Check-in de una sola vez y obligatorio cada día:** la regla de "una vez" está en RLS (solo `insert`) más la unicidad `(user_id, fecha)`; la obligatoriedad (no entrar a Entrenar, Mis datos, etc. sin él) la impone solo la interfaz, en `PantallaAtleta`, que además oculta la barra inferior mientras esté pendiente. `useHoy` actualiza el día a medianoche y al volver a la app.
9. **Mediciones solo del admin;** el atleta las lee. Reemplazo por fecha con `upsert` sobre `(user_id, fecha)`.
10. **Volumen por músculo en el cliente** (función pura `calcularVolumen`): simple y rápido para 30 atletas. Factores 1 / 0,5 editables por ejercicio.
11. **IA como asistente, nunca autónoma:** propuestas `pendiente` forzadas por trigger; aplicación solo por RPC de admin; sin identificadores personales hacia Gemini; límites de ±10 %; lotes de 3 atletas por llamada por el límite de la capa gratuita y el tiempo de ejecución.
12. **PWA:** `registerType: 'prompt'` (desde el paso 12): la versión nueva queda en espera y el atleta decide cuándo actualizar con `AvisoActualizacion`, para no recargar la pantalla a mitad de una serie. El service worker precachea solo archivos de la app, nunca respuestas de Supabase. El primer cambio desde `autoUpdate` llega de forma automática una vez; después ya aparece el aviso.
13. **Carga perezosa del gráfico:** Recharts pesa mucho; se separa en su propio archivo para no penalizar el login.
14. **Rutas anidadas** en la zona del atleta (`Outlet` + contexto) para compartir el estado del check-in con una sola consulta.
15. **Netlify** en lugar de Vercel por permitir uso comercial en el plan gratuito.
16. **Los récords los resume la base de datos** (vistas), no la app: Supabase devuelve como máximo 1.000 filas por consulta y el historial de series crece sin parar. El detalle por ejercicio se carga solo al desplegarlo. 1RM con fórmula de Epley; marcas por peso exacto. La evolución del 1RM se agrupa por día **local** en el cliente (agrupar en SQL por día UTC movería un día los entrenamientos nocturnos), por eso se limita a 500 series por ejercicio.
17. **Plan nutricional versionado:** nunca se edita un plan, se crea uno nuevo y el anterior pasa al historial (`vigente_hasta`). Así se conserva cómo evolucionó el objetivo y el gráfico puede dibujar la línea correcta en cada fecha. Un cambio el mismo día vale desde ese día; un plan finalizado deja de dibujarse desde el día siguiente.
18. **Ciclos calculados en el cliente** con la fecha local (`lib/ciclos.js`) en vez de la vista `v_current_training_cycle`, que usa `current_date` en UTC y desplazaría la semana/fase a ciertas horas en Colombia.
19. **Enlaces externos validados en dos capas:** la interfaz (`FormEjercicio`) y un CHECK en la base de datos (migración 09) exigen http/https para `video_url`, porque el atleta lo toca desde su pantalla.
20. **Ficha del atleta en pestañas** (Resumen, Entrenamiento, Cuerpo y nutrición) con estado local, al crecer a más de diez secciones.
21. **Progresión por reglas fijas, calculada en el cliente y sin guardar la meta:** la meta de hoy sale de las series reales de la última sesión (`lib/progresion.js`), así no hay estado que se desincronice ni columnas nuevas en `routine_logs`. El peso de trabajo es el más alto de la última sesión: el sistema detecta solo cuánto subió el atleta. La configuración (tipo, escalera, incremento, peso inicial) vive en `routine_exercises` y se guarda solo por la RPC `set_progresion`, que valida en la base de datos. La IA queda fuera de este flujo (en pausa).
22. **Recuperar contraseña con el flujo estándar de Supabase** (correo con enlace + `updateUser`), sin servidor propio. Lo que decide quién puede cambiar la contraseña es el enlace del correo (la sesión temporal); la app no revela si un correo existe. `AuthProvider` solo guarda estado al recibir `PASSWORD_RECOVERY` (respeta la regla de no consultar dentro del listener).
23. **Tope de series y RPE opcional en dos capas:** la pantalla oculta el formulario al completar las series y no dibuja el RPE si el ejercicio no lo pide; la base de datos es la barrera real (trigger `limitar_series_por_ejercicio` y columna `pide_rpe`). `pide_rpe` vive en `routine_exercises` (decisión por ejercicio y por atleta, como el resto de la prescripción) y por defecto es true para no cambiar lo ya existente.

24. **Tendencia del peso calculada en el cliente, en días reales:** `lib/tendenciaPeso.js` ajusta una recta (mínimos cuadrados) a los pesos de las últimas 30 mediciones que ya carga `MisMediciones` y la prolonga 14 días (proyección). Usa el número de días entre fechas (no la posición en la lista), así los huecos entre mediciones cuentan. Exige mínimo 3 pesos y 7 días de diferencia; si no, muestra un aviso en vez de una recta engañosa. `Date.UTC` solo se usa como aritmética de calendario, nunca para saber "hoy". No hay SQL nuevo.
25. **Oscilación del peso y evolución por ejercicio sin tocar la base de datos:** ambas se calculan en el cliente con datos que las pantallas ya cargan (30 mediciones; hasta 500 series del ejercicio desplegado). Para el peso/repeticiones de un ejercicio se toma, por día local, la serie de mayor peso (con empate, la de más repeticiones), para no mezclar calentamientos con series de trabajo; el peso 0 sí cuenta aquí (en el 1RM no). El veredicto compara el primer y el último entrenamiento disponibles.
26. **Cumplimiento de calorías con tres estados, de forma aditiva:** `daily_check_ins.cumplimiento_calorias` (cumplio / menos / mas, con CHECK) se añade sin tocar la columna booleana antigua. Los "sí" antiguos se copian a `cumplio`; los "no" quedan en null porque no se sabe la dirección (no se inventa). Un trigger mantiene el booleano coherente, así la Edge Function de la IA (en pausa) y las apps ya instaladas sin actualizar siguen funcionando. Las etiquetas viven en `lib/opciones.js` (`CUMPLIMIENTO_CALORIAS`, `textoCumplimientoCalorias`). Las mediciones del entrenador (`metrics`) no tienen "cumplimiento": allí la caloría es un número y el estado calórico ya tiene sus propias opciones.
27. **Peso del check-in separado de las mediciones oficiales:** el atleta puede anotar su peso (opcional) al crear el check-in; se guarda en `daily_check_ins.peso_corporal_kg` y hereda las reglas de esa tabla (el atleta solo crea una vez al día, no modifica ni borra). No se escribe en `metrics`, que sigue siendo solo del entrenador: así los gráficos de tendencia y oscilación siguen usando únicamente lo que él mide y el atleta nunca altera una medición oficial. El entrenador ve el peso en *Check-ins recientes*. El rango 20–400 kg se valida en la pantalla (`aNumero`) y con un CHECK en la base de datos.

28. **Fecha de nacimiento solo del entrenador, por RPC, con cumpleaños en el cliente:** la columna vive en `profiles` y se escribe únicamente con `set_fecha_nacimiento` (comprueba `is_admin()`); no hay política de `update` nueva ni se amplía el `grant` por columnas, así el atleta no puede cambiarla. "No futura" va en un trigger (un CHECK con `current_date` no es estable) y "≥ 1900" en un CHECK. Los cumpleaños se calculan en el navegador con la fecha local (`lib/cumpleanos.js`; `Date.UTC` solo como aritmética de calendario), así Colombia no ve el cumpleaños un día corrido. No se creó vista ni consulta nueva: se reutiliza la lista de atletas (≤ 30 filas).

29. **Gestión de usuarios por Edge Function, sin exponer `service_role`:** crear cuentas, cambiar contraseñas y bloquear el login son operaciones de la API de administración de Auth y exigen la clave `service_role`, así que viven solo en `supabase/functions/admin-usuarios` (Supabase la inyecta como variable de entorno; no hay secrets que crear ni nada en el frontend). La función es la barrera real: verifica JWT y rol admin antes de crear el cliente privilegiado, valida todo otra vez, solo actúa sobre perfiles `client` (nunca un admin ni uno mismo) y no registra contraseñas. **Desactivar** es doble: `ban_duration` en Auth (impide iniciar sesión y renovar) y `profiles.activo` (para mostrarlo y bloquear en pantalla); no existe función SQL para cambiar `activo` a propósito, así ambos no se descuadran, y la acción es repetible si una mitad falla. **El rol no se cambia desde la app:** un entrenador único no necesita más admins y evita que un error de clic otorgue control total. Nombre y fecha usan la RPC `set_perfil_atleta` (atómica), no la función. Se prefirió desactivar a eliminar para no perder historial (las tablas dependen de `profiles` con `on delete cascade`).

30. **Rutina de larga duración sin cortes en el historial:** la progresión se calcula con las series reales del ejercicio (`routine_logs.exercise_id`), no con la rutina ni con su fecha de activación; por eso una rutina activa puede durar el tiempo que decida el entrenador y el historial sobrevive a ediciones y a cambios de rutina. El corte real estaba en la consulta: un tope global de filas (150/800) ordenadas por fecha dejaba fuera a los ejercicios que el atleta dejaba de entrenar unas semanas, y su meta volvía al inicio. La función `ultimas_series_por_ejercicio` (migración 21) toma las últimas N series de cada ejercicio por separado con un `lateral join`; es `security invoker` para no abrir permisos nuevos y devuelve filas de `routine_logs`, así `calcularUltimaVez` no cambia (el agrupado por día local sigue en el cliente).

31. **Panel general como pestaña inicial, con navegación a las secciones y sin duplicar su edición:** en vez de reescribir cada sección dentro del panel, el panel solo **resume** y **lleva** a la sección que ya sabe editar (cambio de pestaña + scroll). Así no hay dos lugares que editen lo mismo ni se duplican reglas; y cada sección sigue cargando sus datos solo cuando se abre su pestaña. Los umbrales de los avisos (2 días sin check-in, 7 sin entrenar, 14 sin medir) son constantes en `lib/panelAtleta.js`. Las consultas son livianas (conteo con `head: true`, última fila con `limit 1`) y respetan RLS como el resto de la ficha.

32. **Versionado de la rutina por trigger y "perezoso", delimitado por series reales:** el editor hace varios `update` sueltos, así que la barrera está en la base de datos (un trigger no se puede saltar y no obliga a tocar el editor). La foto se toma justo antes de un cambio y solo si hay series nuevas desde la última foto: así no se llena de fotos vacías ni repetidas, y cada periodo está acotado por lo que el atleta realmente entrenó (de su primera a su última serie), no por la fecha en que el entrenador edita. Se prefirió una foto completa en `jsonb` a copiar filas de rutina: no hay que duplicar tablas ni tocar `duplicate_routine`, y la foto guarda los nombres de los ejercicios (no cambian si luego se renombran). Las series no se reasignan ni se reescriben; el rango temporal y los `exercise_id` bastan para unir el periodo con la actividad. `routine_id` es `set null` para que borrar una rutina no borre su historial. Solo el admin lee la tabla; `congelar_version_rutina` no se concede a nadie (solo los triggers).

## 9. Configuración y despliegue

**Variables de entorno (frontend, Netlify y `.env` local):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (clave pública). Ver `.env.example`.

**Netlify:** *Build command* `npm run build` · *Publish directory* `dist` · variables anteriores · `public/_redirects` (`/* /index.html 200`).

**Supabase (configuración manual):**
- Authentication: **desactivar el registro libre de usuarios** (*Sign In / Providers* → "Allow new users to sign up" apagado; la Edge Function crea cuentas igual). Los atletas se crean desde la app (*Usuarios › Crear atleta*); *Add user* del panel sigue sirviendo.
- URL Configuration: Site URL con la dirección de Netlify.
- Primer admin: `update public.profiles set rol='admin' where email='…'`.
- **Recuperar contraseña (obligatorio para que funcione con atletas):**
  - *Authentication > URL Configuration > Redirect URLs:* agregar `https://<tu-sitio>.netlify.app/restablecer` (y `http://localhost:5173/restablecer` para pruebas locales). Sin esto, Supabase manda el enlace a la raíz del sitio.
  - *Authentication > Emails > SMTP Settings:* configurar un SMTP propio (Brevo, Resend, etc.). El correo por defecto solo envía a miembros del equipo y con 2 mensajes por hora.
  - *Authentication > Sign In / Providers > Email:* subir "Minimum password length" a 8 (la app ya lo exige en pantalla; esta es la barrera real).
- **Edge Function `admin-usuarios` (obligatoria para crear usuarios y cambiar contraseñas/estado):** *Edge Functions > Deploy a new function > Via Editor*, nombre exacto `admin-usuarios`, pegar el contenido de `supabase/functions/admin-usuarios/index.ts` y *Deploy*. Dejar activada la opción *Verify JWT* (por defecto). No hay secrets que crear (`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase). Cada vez que cambie el archivo del repositorio hay que volver a desplegarla.
- Edge Function de IA (pendiente): secrets `GEMINI_API_KEY` y, opcional, `GEMINI_MODEL`.

**Flujo de cambios:** `git add .` → `git commit -m "tipo: descripción"` → `git push` → Netlify publica solo. Los cambios de base de datos se aplican **antes** en el SQL Editor.

## 10. Deuda técnica conocida

- `border-[#5B6372]` y los colores de los gráficos (`lib/coloresGrafico.js`) están fuera del tema; mover a tokens.
- `Mediciones.jsx` define su propio `CAMPO` en vez de importarlo de `estilos.js`.
- `npm audit` reporta 4 avisos moderados en herramientas de construcción (`vite-plugin-pwa → workbox-build → glob/minimatch`): no afectan al código publicado; esperar versión corregida y entonces `npm update`. **No** usar `npm audit fix --force`.
- `v_athlete_prs` no limita las repeticiones al estimar el 1RM (Epley pierde fiabilidad con muchas repeticiones).
- Tipo de ejercicio: los ejercicios creados antes de la migración 15 (salvo los 6 iniciales que clasificó) quedan como `compuesto` hasta que el entrenador los revise. La Edge Function de la IA (en pausa) usa su propia fórmula de 1RM para elegir la mejor serie y no distingue tipos.
- La evolución del 1RM usa como máximo las 500 series más recientes de cada ejercicio.
- La línea de objetivo de calorías se dibuja solo en fechas con medición (no es una línea continua en el tiempo).
- La pestaña activa de la ficha del atleta es estado local: se pierde al recargar la página.
- `routines.cycle_id` existe pero no se usa todavía.
- La meta de progresión solo se prueba con funciones puras y datos de ejemplo (sin pruebas automáticas en el repo); desde la migración 21 la "última vez" usa hasta 40 series por ejercicio (una sesión completa; el tope por ejercicio es 20).
- La recuperación de contraseña y el aviso de versión nueva solo se probaron con pantallas simuladas (sin Supabase ni service worker reales): falta probarlos de extremo a extremo tras publicar.
- El tope de series se controla por `sesion_id`: quien manipule la app a mano puede mandar otro `sesion_id` y saltárselo (protege de errores, no de un atacante; solo afecta datos propios). En fuerza simple la base usa como tope el paso con más series de la escalera, más permisivo que el tope exacto de cada día, que solo calcula la pantalla.
- Si el atleta borra una serie intermedia, el número de la siguiente se calcula como el mayor + 1 y puede superar las series prescritas (por ejemplo "Serie 4" de 3); no afecta al tope, que cuenta filas.
- Cierre de ejercicio: `series_hechas` y `series_objetivo` son una foto; si luego borra o agrega series el historial muestra la foto, no el recuento actual. El indicador de rutina completada se calcula en pantalla (no se guarda): no hay registro de "rutina terminada" por día.
- Resumen del día realizado: se arma con las series de **toda la semana** de ese día (hasta 500), no solo las de la fecha en que pulsó *Terminar rutina*; si el mismo ejercicio está en dos días de la rutina, sus series se mezclarían en ambos resúmenes (igual que ya pasa con la progresión). Muestra peso y repeticiones, no el RPE.
- Día realizado: el trigger usa la zona `America/Bogota` y la pantalla la del celular (coinciden en Colombia; fuera de ella podrían diferir cerca de la medianoche del lunes). Nada verifica en la base de datos que el día realmente se completó: *Terminar rutina* lo registra el cliente. La semana es de lunes a domingo, no la "semana del ciclo"; `routines.cycle_id` sigue sin usarse.
- Rutina híbrida: el bloque no depende del tipo del ejercicio (`tipo_ejercicio`): el entrenador decide en qué bloque va cada uno. El historial del entrenador no indica el bloque de cada serie.
- `CargasAtleta` calcula la próxima meta con las series de la última sesión registrada (incluida la de hoy) y, desde la migración 21, ve las últimas series de cada ejercicio (un ejercicio antiguo ya no desaparece). No hay ajuste en bloque por disciplina (cada ejercicio se ajusta aparte).
- El peso del check-in no alimenta los gráficos ni el resumen de Medidas (solo se ve en Check-ins recientes del entrenador); no hay botón para convertirlo en medición oficial. Si el atleta se equivoca al escribirlo no puede corregirlo (el check-in no se modifica): el entrenador puede editarlo desde Table Editor.
- Cumplimiento de calorías: los check-ins viejos con "no" se ven como "No cumplió (sin detalle)". El booleano `calorias_ayer_cumplidas` queda como legado (la Edge Function de la IA lo cuenta como sí/no; cuando se retome la IA conviene que use las tres categorías). Si el admin corrige un check-in desde Table Editor, debe cambiar `cumplimiento_calorias` (el booleano se recalcula solo).
- Check-in obligatorio solo en pantalla: un atleta que llame a la API a mano (o con la app desactualizada) podría leer sus datos o registrar series sin check-in. Solo afecta a sus propios datos; si se quiere blindar, una migración con un trigger en `routine_logs` que exija el check-in del día. Si falla la consulta del check-in (sin conexión) se trata como pendiente y el atleta queda en el formulario hasta recuperar la conexión.
- Cumpleaños: la ventana es fija (30 días, `DIAS_ADELANTE` en `lib/cumpleanos.js`); no hay aviso fuera de la app ni envío de felicitaciones. El atleta no ve su propia fecha en pantalla ni puede corregirla (la anota el entrenador). La validación de edad 5–100 solo está en el navegador; la base solo exige ≥ 1900 y no futura.
- Usuarios: la función `admin-usuarios` se probó con Deno contra un Supabase simulado (no contra el real) y la migración 20 con un Postgres real; la función solo funciona tras desplegarla a mano en Supabase y no se redespliega sola con Netlify. Un token de sesión ya emitido sigue válido hasta ≤ 1 h tras desactivar (Auth lo bloquea al renovar); la pantalla lo corta al abrir la app. La Edge Function de la IA (en pausa) no mira `profiles.activo`: al retomarla debe omitir atletas desactivados. `Access-Control-Allow-Origin` es `*` (la protección real es el JWT + rol admin). No hay límite de intentos propio (solo lo que ponga Supabase). Sin lista paginada: pensada para ≤ 30 atletas.
- Periodos de la rutina: no hay fotos de los cambios hechos antes de la migración 22 (el primer periodo de una rutina con historial previo puede incluirlos). Un periodo une todas las series registradas entre dos fotos: si cambias un ejercicio y el atleta aún no entrenó nada, no se crea periodo hasta que haya series. `routine_logs.routine_exercise_id` sigue pasando a null al quitar un ejercicio (la foto conserva la prescripción y las series conservan `exercise_id`). La actividad de un ejercicio presente en dos días de la rutina se muestra igual en ambos. Los días se cuentan con la fecha de América/Bogotá. Renombrar la rutina o activarla/archivarla no genera periodo (no cambia la prescripción); el historial muestra hasta 50 periodos, sin paginar. La pantalla solo se probó con funciones puras y compilando (no en un navegador real contra Supabase).
- Sin pruebas automáticas ni ESLint.
- El eje X del gráfico de evolución (peso + calorías) trata las fechas como categorías; el de tendencia del peso ya usa escala de días.
- La evolución de peso/repeticiones compara primer y último entrenamiento dentro de las 500 series más recientes del ejercicio; no suaviza días malos ni descuenta calentamientos por debajo del peso más alto del día. La oscilación usa las 30 mediciones más recientes.
- La tendencia del peso usa como máximo las 30 mediciones más recientes (límite de `MisMediciones`) y una recta simple: con pocos datos o mucha variación diaria (agua, sal) es solo una referencia.
- En `Mediciones.jsx`, el aviso "ya hay una medición en esta fecha" solo mira las últimas 30.
- Panel del atleta (`PanelAtleta`): cada vez que se vuelve al panel repite sus 8 consultas (no hay caché). Las 30 mediciones y `v_athlete_prs` se piden completas solo para sacar un número; el desplazamiento a una sección usa un retraso fijo de 80 ms y, si las secciones de arriba aún cargan, el punto de llegada puede moverse un poco. La tarjeta de volumen no muestra cifras (solo lleva a la sección). Los umbrales de los avisos no son configurables desde la app.
