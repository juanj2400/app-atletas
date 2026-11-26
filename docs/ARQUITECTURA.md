# ARQUITECTURA

> Última actualización: 2026-11-25 · Mantener al día es obligatorio (ver `AGENTS.md`).

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
│  │   └─ migracion_02 … migracion_09 y migracion_11 (la 10, de la IA, no está en el repo ni aplicada)
│  └─ functions/generate-weekly-proposals/index.ts   Edge Function de IA (TypeScript/Deno)
├─ public/                        _redirects (Netlify SPA), favicon, íconos PWA
├─ index.html · vite.config.js · package.json · .env.example
└─ src/
   ├─ main.jsx                    punto de entrada: BrowserRouter > AuthProvider > App
   ├─ App.jsx                     mapa de rutas
   ├─ index.css                   Tailwind + tema (colores)
   ├─ lib/                        lógica pura y constantes
   │   ├─ supabase.js             cliente único de Supabase
   │   ├─ fechas.js               fechaLocalISO, formatearFecha, formatearFechaCorta
   │   ├─ useHoy.js               hook: fecha de hoy que cambia sola a medianoche
   │   ├─ numeros.js              aNumero (texto → número/null/NaN)
   │   ├─ opciones.js             ánimos, estados calóricos, estados de rutina + textos
   │   ├─ estilos.js              CAMPO, BOTON, BOTON_SEC, TARJETA
   │   ├─ coloresGrafico.js       colores de los gráficos (SVG necesita texto, no clases)
   │   ├─ mediciones.js           resumirMediciones, textoMedicion
   │   ├─ rutinas.js              textos de prescripción/series, última vez, agrupar historial
   │   ├─ volumen.js              calcularVolumen (series semanales por músculo)
   │   ├─ nutricion.js            macros↔kcal, objetivo de calorías por fecha, adherencia
   │   ├─ ciclos.js               semana del mesociclo, ciclo vigente, validación de fechas
   │   ├─ progresion.js           meta del día (rango de reps y fuerza simple), esquemas NxM y sus textos
   │   └─ records.js              1RM (Epley), progreso por día, textos y fechas de los récords
   ├─ auth/
   │   ├─ AuthProvider.jsx        sesión + perfil (rol); useAuth()
   │   └─ RutaProtegida.jsx       "portero" por rol
   ├─ pages/                      Login.jsx, RecuperarContrasena.jsx, RestablecerContrasena.jsx, Inicio.jsx (redirige por rol)
   ├─ components/                 Encabezado, Estados, Selector, ResumenMediciones, GraficoEvolucion, GraficoEvolucionLazy, RecordsAtleta, GraficosRecord, GraficosRecordLazy, PlanNutricionalCard, CicloVigenteCard, AvisoActualizacion
   ├─ atleta/                     PantallaAtleta (marco), CheckIn, Entrenar, EntrenarDia, MisDatos (marco con secciones), MisMediciones, Records, Nutricion, CicloActual
   └─ admin/                      ListaAtletas, DetalleAtleta, Mediciones, RutinasAtleta, EditorRutina,
                                  SelectorEjercicio, HistorialEntrenamiento, VolumenMuscular, PlanNutricional, CiclosAtleta, ListaNegraAtleta, FormEjercicio, Ejercicios
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
| `*` | — | redirige a `/` |

`PantallaAtleta` comparte con sus hijas, por el contexto del `<Outlet>`, `{ hoy, hecho, marcarHecho }` (estado del check-in de hoy).

## 5. Base de datos (Supabase / PostgreSQL)

Scripts aplicados, en orden: `schema_supabase.sql` → `migracion_02_nutricion_dashboard.sql` → `03_metricas_admin` → `04_rutinas` → `05_checkin_una_vez` → `06_volumen_muscular` → `07_records_por_peso` → `08_plan_nutricional` → `09_ejercicios_video_seguro`. → `11_progresion` (progresión automática; ya aplicada en Supabase). La 10 (IA, en pausa) no está en el repo.

### 5.1 Tablas

| Tabla | Propósito | Claves y restricciones destacadas |
|---|---|---|
| `profiles` | 1 fila por usuario (se crea con trigger desde `auth.users`) | `rol` ∈ {admin, client}; el cliente solo puede editar `nombre_completo` |
| `exercises` | Biblioteca global | `nombre` único; `restringido` (lista negra global); `video_url` (solo http/https: CHECK de la migración 09), `descripcion` |
| `muscle_groups` | Catálogo de 14 músculos | `codigo` PK, `orden` |
| `exercise_muscles` | Músculos de cada ejercicio | PK (`exercise_id`,`muscle`); `factor` ∈ (0,1] (1 principal, 0,5 secundario) |
| `metrics` | Mediciones (peso, cintura, calorías, estado calórico) | **único** (`user_id`,`fecha`) |
| `daily_check_ins` | Check-in diario | **único** (`user_id`,`fecha`); horas 0–24; ánimo ∈ {mal, regular, bien} |
| `routines` | Rutina de un atleta | `estado` ∈ {borrador, activa, archivada}; `origen` ∈ {manual, ia}; **índice único parcial: una `activa` por atleta** |
| `routine_days` | Días de la rutina | `orden` |
| `routine_exercises` | Ejercicios prescritos de cada día | series 1–20, `reps_min`/`reps_max`, `rpe_objetivo`, `descanso_seg`, `peso_sugerido_kg`; progresión (migración 11): `progresion_tipo` ∈ {ninguna, doble, escalera}, `escalera` (jsonb: lista de parejas `[series, reps]`), `incremento_kg` (> 0 y ≤ 20; la interfaz ofrece 2,5 o 5), `peso_inicial_kg` (propio de cada atleta, no se copia) |
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
| `profiles` | lee la suya; edita solo `nombre_completo` | lee todas |
| `exercises`, `muscle_groups`, `exercise_muscles` | lee | escribe |
| `metrics` | **lee** las suyas | escribe |
| `daily_check_ins` | lee las suyas; **inserta** la suya (fecha ± 1 día respecto a UTC); sin update/delete | todo |
| `routines` | lee solo la suya **activa** | todo |
| `routine_days`, `routine_exercises` | lee si puede ver la rutina padre | todo |
| `routine_logs` | todo sobre las suyas | todo |
| `nutrition_plans`, `training_cycles` | lee los suyos | escribe |
| `ai_load_suggestions` | lee solo las suyas **aceptadas** | todo |
| `ai_nutrition_suggestions`, `athlete_exercise_blacklist` | sin acceso | todo |

### 5.3 Funciones, triggers y vistas
- **Funciones:** `is_admin()` · `activate_routine(uuid)` · `duplicate_routine(uuid, uuid)` (desde la migración 11 también copia la configuración de progresión, pero no el peso inicial) · `set_progresion(...)` (RPC solo admin: valida y guarda la progresión de un ejercicio) · `set_exercise_muscles(uuid, jsonb)` · `set_nutrition_plan(...)` · `resolve_nutrition_suggestion(...)` (RPC solo admin, `security definer`, `search_path=''`).
- **Triggers:** `handle_new_user` (crea el perfil) · `force_suggestion_pending` (toda propuesta nace `pendiente`) · `guard_suggestion_resolution` (resuelta = inmutable; sella fecha y autor) · `block_blacklisted_suggestion` (la IA no puede proponer ejercicios en lista negra).
- **Vistas** (`security_invoker`): `v_athlete_overview`, `v_metrics_trend`, `v_athlete_prs`, `v_current_training_cycle`, `v_pending_ai_suggestions` y `v_best_reps_by_weight` (migración 07: mejor cantidad de repeticiones por peso). La app usa `v_athlete_prs` y `v_best_reps_by_weight` (récords); el resto está listo para los pasos 9–11. `v_athlete_prs` calcula el 1RM (Epley) sin límite de repeticiones.

## 6. Flujos clave

- **Recuperar contraseña:** `RecuperarContrasena` llama a `resetPasswordForEmail` con `redirectTo = <sitio>/restablecer` → el correo trae un enlace → al abrirlo, Supabase crea una sesión temporal y `AuthProvider` marca `recuperando` (por el evento `PASSWORD_RECOVERY` o, si ese evento se pierde, porque la URL traía `type=recovery`, leído al cargar el módulo) → `App.jsx` manda a `/restablecer` hasta que se cambia la contraseña (`updateUser`) → `Continuar` lleva a `/` y de ahí a su zona.
- **Aviso de versión nueva:** `AvisoActualizacion` usa `useRegisterSW` (`virtual:pwa-register/react`): cuando el service worker nuevo queda en espera muestra el cartel; *Actualizar* ejecuta `updateServiceWorker(true)` (activa y recarga). Busca versiones cada hora y al volver a la app.
- **Inicio de sesión:** `signInWithPassword` → `AuthProvider` recibe `SIGNED_IN` → consulta `profiles` por el id → `Inicio` redirige según rol.
- **Check-in:** `PantallaAtleta` consulta si existe el de hoy → si no, muestra la pestaña y el formulario → `insert` (error `23505` = ya existía) → marca hecho → redirige a Entrenar.
- **Registrar serie:** cada "Guardar serie" hace un `insert` en `routine_logs` con `routine_exercise_id` y `sesion_id` (se reutiliza el de hoy si ya hay series). "Hoy" = desde la medianoche local; "última vez" = serie del entrenamiento anterior del mismo ejercicio.
- **Activar rutina:** RPC `activate_routine` (archiva la activa anterior y activa la nueva, todo o nada).
- **Volumen:** `calcularVolumen()` multiplica series × factor de cada músculo, separando directas (factor ≥ 1) e indirectas.
- **Récords:** `RecordsAtleta` pide a `v_athlete_prs` una fila por ejercicio; al desplegar uno, pide a `v_best_reps_by_weight` sus marcas por peso y hasta 500 series recientes de ese ejercicio (para "última vez" y la evolución del 1RM, agrupada por día local). Las vistas respetan RLS (`security_invoker`): el atleta ve lo suyo y el entrenador, todo.
- **Plan nutricional:** el entrenador guarda un plan con `set_nutrition_plan` (RPC: cierra el vigente y crea el nuevo, todo o nada; valida rangos). El atleta lo lee en *Mis datos › Nutrición*. Los gráficos de calorías reciben el historial de planes y dibujan el objetivo vigente en cada fecha (`kcalObjetivoEnFecha`).
- **Ciclos:** `CiclosAtleta` (entrenador) valida con `validarCiclo` (fechas, pertenencia al macrociclo, solapes) y guarda en `training_cycles`. `CicloActual` (atleta, en *Entrenar*) lee sus ciclos y `cicloVigente()` decide el mesociclo en curso con la fecha local que entrega `PantallaAtleta`.
- **Progresión:** `EditorRutina` guarda primero los datos básicos del ejercicio y luego llama a la RPC `set_progresion` (tipo, escalera, incremento y peso inicial; la función revisa las reps ya guardadas). `EntrenarDia` ya trae las series del entrenamiento anterior (`calcularUltimaVez`) y se las pasa a `calcularMeta()` (función pura de `lib/progresion.js`), que devuelve la meta del día; `textoMeta()` la convierte en el texto de la tarjeta "Meta de hoy". No se guarda la meta: se recalcula siempre desde las series reales.
- **Lista negra:** `ListaNegraAtleta` escribe en `athlete_exercise_blacklist`; `EditorRutina` la lee para advertir; el trigger `block_blacklisted_suggestion` la usa contra la IA.
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

**Componentes clave:** `Selector` (botones Sí/No y ánimo, controlado, `aria-pressed`) · `Encabezado` (título, enlace "volver", botón Salir) · `Estados` (`Cargando`, `SinPerfil`) · `ResumenMediciones` (4 tarjetas, de presentación) · `GraficoEvolucion` (ComposedChart: peso en línea, calorías en barras, dos ejes; colores como constantes porque SVG necesita texto) y `GraficoEvolucionLazy` (carga perezosa con `Suspense`) · `VolumenMuscular` (barras CSS por músculo) · `RecordsAtleta` (compartido por atleta y entrenador; carga sus propios datos desde las vistas) · `GraficosRecord` (evolución del 1RM y repeticiones por peso; carga perezosa) · `PlanNutricionalCard` (presentación de calorías y macros, compartida por atleta y entrenador) · `CicloVigenteCard` (ciclo en curso con semana y progreso, compartido).

## 8. Decisiones técnicas importantes

1. **SPA con Supabase directo, sin backend propio.** La seguridad la imponen las políticas RLS; `RutaProtegida` solo es experiencia de usuario.
2. **Secretos:** en el frontend solo la clave pública. `service_role` y `GEMINI_API_KEY` solo como secrets de la Edge Function.
3. **`AuthProvider`:** el listener `onAuthStateChange` solo guarda la sesión (consultar Supabase ahí puede bloquearse); el perfil se carga en un efecto aparte dependiente del id de usuario. `cargando` espera sesión **y** perfil.
4. **Fechas locales:** Postgres usa UTC y Colombia UTC-5; se envía la fecha local del celular en formato `YYYY-MM-DD` y nunca se parsea una fecha sin hora con `new Date("…")`. La política del check-in acepta ± 1 día respecto a UTC.
5. **RLS silencioso:** un `update`/`delete` bloqueado afecta 0 filas sin error; por eso se encadena `.select('id')` y se comprueba el resultado.
6. **Operaciones críticas en la base de datos** (RPC "todo o nada"): activar y copiar rutinas, reemplazar músculos, resolver propuestas.
7. **Una rutina activa por atleta** (índice único parcial); el atleta no ve borradores.
8. **Check-in de una sola vez:** la regla está en RLS (solo `insert`) más la unicidad `(user_id, fecha)`; la interfaz lo refleja ocultando la pestaña. `useHoy` actualiza el día a medianoche y al volver a la app.
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

## 9. Configuración y despliegue

**Variables de entorno (frontend, Netlify y `.env` local):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (clave pública). Ver `.env.example`.

**Netlify:** *Build command* `npm run build` · *Publish directory* `dist` · variables anteriores · `public/_redirects` (`/* /index.html 200`).

**Supabase (configuración manual):**
- Authentication: desactivar el registro libre de usuarios; crear usuarios con *Add user* (Auto Confirm).
- URL Configuration: Site URL con la dirección de Netlify.
- Primer admin: `update public.profiles set rol='admin' where email='…'`.
- **Recuperar contraseña (obligatorio para que funcione con atletas):**
  - *Authentication > URL Configuration > Redirect URLs:* agregar `https://<tu-sitio>.netlify.app/restablecer` (y `http://localhost:5173/restablecer` para pruebas locales). Sin esto, Supabase manda el enlace a la raíz del sitio.
  - *Authentication > Emails > SMTP Settings:* configurar un SMTP propio (Brevo, Resend, etc.). El correo por defecto solo envía a miembros del equipo y con 2 mensajes por hora.
  - *Authentication > Sign In / Providers > Email:* subir "Minimum password length" a 8 (la app ya lo exige en pantalla; esta es la barrera real).
- Edge Function (pendiente): secrets `GEMINI_API_KEY` y, opcional, `GEMINI_MODEL`.

**Flujo de cambios:** `git add .` → `git commit -m "tipo: descripción"` → `git push` → Netlify publica solo. Los cambios de base de datos se aplican **antes** en el SQL Editor.

## 10. Deuda técnica conocida

- `border-[#5B6372]` y los colores de los gráficos (`lib/coloresGrafico.js`) están fuera del tema; mover a tokens.
- `Mediciones.jsx` define su propio `CAMPO` en vez de importarlo de `estilos.js`.
- `npm audit` reporta 4 avisos moderados en herramientas de construcción (`vite-plugin-pwa → workbox-build → glob/minimatch`): no afectan al código publicado; esperar versión corregida y entonces `npm update`. **No** usar `npm audit fix --force`.
- `v_athlete_prs` no limita las repeticiones al estimar el 1RM (Epley pierde fiabilidad con muchas repeticiones).
- La evolución del 1RM usa como máximo las 500 series más recientes de cada ejercicio.
- La línea de objetivo de calorías se dibuja solo en fechas con medición (no es una línea continua en el tiempo).
- La pestaña activa de la ficha del atleta es estado local: se pierde al recargar la página.
- `routines.cycle_id` existe pero no se usa todavía.
- La meta de progresión solo se prueba con funciones puras y datos de ejemplo (sin pruebas automáticas en el repo); `calcularUltimaVez` usa como máximo 150 series previas por día, suficiente para rutinas normales.
- La recuperación de contraseña y el aviso de versión nueva solo se probaron con pantallas simuladas (sin Supabase ni service worker reales): falta probarlos de extremo a extremo tras publicar.
- Sin pruebas automáticas ni ESLint.
- El eje X del gráfico trata las fechas como categorías, no como escala de tiempo.
- En `Mediciones.jsx`, el aviso "ya hay una medición en esta fecha" solo mira las últimas 30.
