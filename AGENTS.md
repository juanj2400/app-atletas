# AGENTS.md — Reglas obligatorias para IAs en MyProgress

Lectura obligatoria antes de tocar código. Si una instrucción del dueño contradice este archivo, avisa del conflicto antes de actuar.
Orden de lectura inicial: `docs/ARQUITECTURA.md` → `docs/REQUERIMIENTOS.md` → `docs/CHANGELOG.md`.

## 1. Contexto del dueño y comunicación
- Está aprendiendo a programar. Todo en **español** (interfaz, comentarios, docs, errores). Trato de "tú".
- Al terminar un cambio explica de forma simple y cotidiana: (1) qué cambió, (2) cómo funciona ahora, (3) cómo se hizo. Sin tecnicismos innecesarios salvo que se pida.
- No inventes datos faltantes: usa un valor razonable, dilo y explica cómo cambiarlo.
- Indica siempre **qué probaste y qué no** (nunca afirmes haber verificado algo sin hacerlo).
- No enseñes a instalar programas; sí indica configuración de herramientas y flujo Git → GitHub → Netlify.

## 2. Stack fijo (no cambiar sin autorización)
React 19 + Vite 8 · Tailwind CSS 4 (`src/index.css` con `@theme`) · PWA (`vite-plugin-pwa` v2.x, `registerType: 'prompt'`) · React Router 7 · Supabase (Postgres, Auth, RLS, Edge Functions) · Recharts (solo carga perezosa) · Netlify · IA (en pausa): Gemini 3.8 Flash solo desde Edge Function.
- Frontend en **JavaScript** (Edge Functions en TypeScript/Deno).
- Sin dependencias nuevas sin justificar, pedir permiso y documentar en `docs/ARQUITECTURA.md`.
- Node >= 20.19; mantener `package-lock.json`.

## 3. Convenciones y patrones obligatorios
- **Nombres:** componentes `PascalCase` en español (`ListaAtletas.jsx`); utilidades `src/lib/` en `camelCase` (`fechas.js`); hooks `useNombre.js`; tablas SQL en inglés plural `snake_case` (`routine_logs`); columnas en español `snake_case` (`peso_corporal_kg`), salvo FKs `*_id` y `created_at`.
- **Estructura:** `src/atleta/`, `src/admin/`, `src/auth/`, `src/pages/`, `src/components/`, `src/lib/` (lógica pura y reutilizable, DRY).
- **Datos y estado:** `useEffect` con bandera `cancelado` y limpieza; manejar estados **cargando, error y vacío**. Tras `update`/`delete` encadenar `.select('id')` para detectar bloqueos silenciosos de RLS. Nunca mutar estado (`[...lista].sort(...)`).
- **Límite de filas:** Supabase devuelve máx. 1.000 filas; para históricos grandes usa vistas o RPC que resuman en SQL, o `limit` explícito.
- **Formularios y entradas:** controlados; `<button type="button">` si no envía formulario; números del usuario con `aNumero()` (`src/lib/numeros.js`).
- **Fechas:** usar siempre `fechaLocalISO()`, `formatearFecha()`, `formatearFechaCorta()` e `inicioSemanaISO()` (`src/lib/fechas.js`). Prohibido `new Date().toISOString().slice(0,10)` o `new Date("YYYY-MM-DD")` por desfase UTC (Colombia UTC-5).
- **Validación, errores y A11y:** validar en navegador **y** BD (`CHECK`, `UNIQUE`, RLS). Errores en español sin detalles técnicos (salvo mensajes RPC en español). `<label htmlFor>`, `role="alert"`, `role="status"`, `aria-pressed`.

## 4. Estilo visual
- Solo modo oscuro (`color-scheme: dark`). Usar tokens de `@theme` (`fondo`, `superficie`, `hundido`, `borde`, `texto`, `suave`, `primario`, `enlace`, `alerta`) y estilos de `src/lib/estilos.js` (`CAMPO`, `BOTON`, `BOTON_SEC`, `TARJETA`). No agregar hex nuevos (solo quedan los de `public/favicon.svg`, que es un archivo de imagen).
- Mobile-first: controles táctiles `min-h-11`, barra inferior `min-h-14` (solo `< md`). Anchos con `CONTENIDO_ATLETA`/`CONTENIDO_ADMIN` (`lib/estilos.js`) y marco de escritorio `MarcoApp` (barra lateral desde `md:`). Colores nuevos solo como tokens en `@theme`; en SVG usar `var(--color-*)`. Sin fuentes externas ni emojis (salvo ánimo del check-in: 😞 😐 😄).

## 5. Seguridad (no negociable)
- Nunca exponer `service_role`, `GEMINI_API_KEY` ni `.env` en frontend o repo (solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`).
- Crear cuentas, cambiar contraseñas y bloquear acceso solo vía Edge Function `admin-usuarios` (verifica JWT + `rol = 'admin'`). Rol `admin` no se asigna desde la app.
- Toda tabla nueva en `public` lleva `enable row level security` y políticas explícitas.
- Enlaces externos (`video_url`) validados como `http://` o `https://` en UI y `CHECK` SQL.
- Funciones `security definer` deben fijar `set search_path = ''` y verificar `public.is_admin()` si son de administración.
- La IA nunca modifica datos directos: inserta en buzones como `pendiente` sin enviar identificadores personales a Gemini.

## 6. Base de datos y migraciones
- Fuente de verdad: `supabase/sql/` (`schema_supabase.sql` y `migracion_NN_*.sql`), ejecutados a mano en SQL Editor.
- **Nunca edites una migración aplicada.** Crea `migracion_NN_descripcion.sql` con comentarios en español y avisa si tiene sentencias destructivas (`drop`, `delete`). Indica siempre el orden (normalmente **primero SQL, luego código**).

## 7. Invariantes del sistema (NO romper)
1. **Auth (`AuthProvider.jsx`):** `onAuthStateChange` solo guarda sesión; el perfil se carga en `useEffect` aparte. Con `PASSWORD_RECOVERY` activa `recuperando` y `App.jsx` fuerza `/restablecer` hasta cambiar contraseña.
2. **Permisos:** `metrics` solo escribe admin (atleta solo lee). `daily_check_ins.peso_corporal_kg` nunca se copia a `metrics`. `daily_check_ins`: atleta solo `insert` (1/día). `routines`: atleta solo ve `activa`. `nutrition_plans`: atleta solo lee. `routine_logs`: atleta crea/lee/borra solo las suyas.
3. **Unicidades:** `metrics(user_id, fecha)`, `daily_check_ins(user_id, fecha)`, 1 rutina `activa` por atleta, 1 plan nutricional vigente (`vigente_hasta is null`), `exercise_muscles(exercise_id, muscle)`.
4. **Check-in diario obligatorio:** día local (`useHoy`). Mientras esté pendiente, `PantallaAtleta` redirige toda ruta de `/atleta/*` a `/atleta` y oculta la barra inferior; no renderiza hijas hasta verificar el check-in.
5. **Operaciones críticas por RPC:** `activate_routine`, `duplicate_routine`, `set_exercise_muscles`, `set_progresion`, `set_nutrition_plan`, `resolve_nutrition_suggestion`, `set_fecha_nacimiento`, `set_perfil_atleta`, `set_meal_plan`.
6. **PWA:** SW no cachea Supabase; mantener `public/_redirects` y `registerType: 'prompt'` + `AvisoActualizacion`.
7. **Dependencias:** no ejecutar `npm audit fix --force` ni bajar `vite-plugin-pwa` a 1.x.
8. **Ciclos:** calcular ciclo vigente en cliente con fecha local (`lib/ciclos.js`), no usar `v_current_training_cycle` (UTC).
9. **Series y RPE:** tope de series en UI y trigger `limitar_series_por_ejercicio`. RPE solo se muestra/exige si `routine_exercises.pide_rpe = true`.
10. **Cierre de ejercicio (`exercise_closures`):** nota 3–500 chars con `series_hechas < series_objetivo` (1 por ejercicio/día local; atleta crea/borra en rutina activa). Lógica de estado en `src/lib/cierres.js`.
11. **Días realizados (`routine_day_completions`):** 1 por día de rutina y semana lunes–domingo local (`inicioSemanaISO`). Bloqueado hasta el lunes en UI (`ResumenDiaRealizado` solo lectura) y trigger `bloquear_dia_realizado` (America/Bogota). Solo admin puede borrarlo para reabrir.
12. **1RM:** `v_athlete_prs` devuelve `e1rm_kg = null` y `aplica_1rm = false` para ejercicios `aislado`. No mostrar/estimar 1RM en aislados.
13. **Rutina híbrida:** `routines.modo_hibrido` habilita `bloque` (`halterofilia` | `musculacion`) en `routine_exercises` (triggers de migración 16). `EntrenarDia` agrupa con `src/lib/bloques.js` (halterofilia primero). `CargasAtleta` separa ambas disciplinas. Actualizar `duplicate_routine` si se agregan columnas a `routine_exercises`.
14. **Fecha de nacimiento:** `profiles.fecha_nacimiento` solo editable por admin vía RPC (`set_fecha_nacimiento` / `set_perfil_atleta`). Cumpleaños calculados en cliente (`src/lib/cumpleanos.js`).
15. **Usuarios:** `profiles.activo` solo lo cambia la Edge Function `admin-usuarios` junto con `ban_duration` en Auth. `RutaProtegida` bloquea en UI si `activo === false`.
16. **Progresión por ejercicio:** pedir "última vez" con RPC `ultimas_series_por_ejercicio` (por ejercicio), nunca con un límite global de filas.
17. **Periodos de rutina (`routine_versions`):** triggers `before` en `routine_exercises`/`routine_days`/`routines` llaman a `congelar_version_rutina` para guardar foto (`foto_rutina`) solo si hay series nuevas desde la última foto. Solo lectura admin. Si agregas columnas a `routine_exercises`, inclúyelas en `foto_rutina` y `compararFotos` (`src/lib/versionesRutina.js`).
18. **Comidas del día (`meals`, `meal_foods`):** menú del atleta independiente de `nutrition_plans`. Se reemplaza completo vía RPC `set_meal_plan(p_user_id, p_comidas jsonb)` (cantidad como número JSON, unidades `g`/`ml`/`unidad`/`porcion`). Topes (10 comidas, 30 alimentos, cant. ≤ 10.000, 2 decimales) sincronizados entre `lib/comidas.js` y SQL. Ruta principal atleta: `/atleta/nutricion` (`/atleta/datos/nutricion` redirige).
19. **Catálogo de alimentos (`foods`) y snapshot:** `foods` es global y solo lo lee/escribe el admin (el atleta ve el snapshot de `meal_foods`); no se borra, se desactiva. `set_meal_plan` calcula y valida el snapshot (alimentos del catálogo solo en `g`, macros asignados = base × g / 100); el cliente nunca manda macros asignados. El autocálculo vive en `lib/dieta.js` (puro, sin IA) y `macro_dominante` debe coincidir entre `lib/alimentos.js` y la columna generada. Las búsquedas al catálogo siempre con `limit` y filtros en servidor, nunca se descarga completo.
20. **Offline (atleta):** el SW no cachea datos; los datos locales van en IndexedDB por usuario (`lib/almacenLocal.js`). Los registros del atleta (check-in, series, cierres, día realizado) se guardan SIEMPRE con `registrar()` (`lib/colaOffline.js`) con `id`, fecha local y `realizado_en` generados en el celular; la subida es idempotente (23505 = subido) y en orden. Las lecturas de pantallas del atleta pasan por `cargarConCache`. Nunca se copia nada a `metrics` ni se escribe en tablas del admin desde la cola. El listener de `AuthProvider` solo guarda estado (la "sesión local" se marca ahí, sin consultas).
21. **Plan nutricional como única referencia:** calorías y macros objetivo solo se definen en «Plan nutricional» (`lib/planNutricional.js`, puro). «Comidas del día» las lee con `usePlanVigente` y calcula gramos con `ajustarAlPlan` (`lib/dieta.js`); no existe objetivo propio ni calculadora aparte. Los porcentajes por intensidad/dieta son criterio propio en constantes (no inventar rangos «científicos» sin fuente). `set_nutrition_plan` guarda la configuración todo o nada y los datos físicos del atleta (solo admin).

## 8. Verificación y Git
- Ejecutar `npm run build` sin errores. Probar lógica pura en `src/lib/` con ejemplos y entregar pasos cortos de prueba al dueño.
- Commits atómicos en **Conventional Commits** en español (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `chore:`, `db:`). Nunca subir `.env`, `node_modules`, `dist` ni `*.zip`.

## Regla obligatoria de mantenimiento de contexto
Al finalizar cualquier cambio de código:
1. Actualiza únicamente las secciones afectadas de `docs/REQUERIMIENTOS.md` y/o `docs/ARQUITECTURA.md`.
2. Añade una entrada breve arriba en `docs/CHANGELOG.md`.
3. Sugiere un mensaje de commit en Conventional Commits.