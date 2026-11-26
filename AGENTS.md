# AGENTS.md — Reglas obligatorias para cualquier IA que trabaje en este repositorio

Este archivo es de lectura obligatoria **antes de tocar código**. Si una instrucción puntual del dueño contradice algo de aquí, avisa del conflicto antes de actuar.

## 0. Qué es este proyecto

Aplicación web privada (PWA) llamada **MyProgress** para que un entrenador de fuerza (rol `admin`) gestione a 15–30 atletas (rol `client`): rutinas, registro de series, mediciones corporales y calóricas, check-in diario, y —más adelante— propuestas de una IA que el entrenador siempre aprueba.

**Antes de empezar cualquier tarea lee, en este orden:**
1. `docs/ARQUITECTURA.md` (stack, estructura, diseño visual, decisiones).
2. `docs/REQUERIMIENTOS.md` (qué está hecho y qué falta).
3. `docs/CHANGELOG.md` (últimos cambios).

## 1. Contexto del dueño (importante para cómo respondes)

- El dueño **está aprendiendo a programar** con este proyecto. No es desarrollador profesional.
- Idioma de todo: **español** (interfaz, comentarios, documentación, mensajes de error al usuario). Trato de "tú".
- Al terminar un cambio, explica **de forma simple**: (1) qué cambiaste, (2) cómo funcionará la app/el flujo con ese cambio, (3) cómo lo hiciste, en lenguaje cotidiano. Sin tecnicismos innecesarios ni detalles línea por línea, salvo que lo pida.
- Si pides un dato que el usuario no ha dado, no inventes: usa un valor razonable, dilo y deja claro cómo cambiarlo.
- Dile siempre **qué probaste y qué no** (por ejemplo: "compila y la lógica está probada, pero no se probó contra Supabase"). No afirmes haber verificado algo que no verificaste.
- No le enseñes a instalar programas. Sí indícale qué configuración necesita cada herramienta y cómo se suben los cambios (git → GitHub → Netlify).

## 2. Stack (no cambiar sin autorización explícita)

React 19 + Vite 8 · Tailwind CSS 4 (configuración en `src/index.css`) · PWA con `vite-plugin-pwa` · React Router 7 · Supabase (Postgres, Auth, RLS, Edge Functions) · Recharts (solo gráficos, con carga perezosa) · Netlify (despliegue desde GitHub) · IA: Gemini 3.8 Flash (`gemini-3.8-flash`) vía Google AI Studio, **solo desde una Edge Function**.

- Frontend en **JavaScript** (no TypeScript). La Edge Function es TypeScript porque Supabase lo exige.
- No agregues dependencias nuevas sin justificarlas, pedir autorización y documentarlas en `docs/ARQUITECTURA.md`.
- Node >= 20.19. Respeta `package-lock.json` (se sube a GitHub).

## 3. Convenciones de código

**Nombres**
- Componentes y pantallas: `PascalCase` en español, un componente por archivo (`ListaAtletas.jsx`). Pueden existir subcomponentes internos no exportados en el mismo archivo si solo se usan ahí.
- Utilidades en `src/lib/`: `camelCase` (`fechas.js`). Los hooks propios empiezan por `use` (`useHoy.js`).
- Tablas SQL: inglés, plural, `snake_case` (`routine_logs`). Columnas: español `snake_case` (`peso_corporal_kg`, `fecha`), salvo llaves foráneas `*_id` y `created_at`.

**Organización**
- `src/atleta/` pantallas del atleta · `src/admin/` pantallas del entrenador · `src/auth/` sesión y rutas protegidas · `src/pages/` pantallas comunes · `src/components/` piezas reutilizables (casi todas de presentación; `RecordsAtleta` carga sus propios datos porque lo usan las dos zonas) · `src/lib/` funciones puras, constantes y conexión a Supabase.
- La lógica reutilizable o calculable va en `src/lib/` como **función pura** (recibe datos, devuelve resultado), no dentro de componentes. Si algo se usa en dos sitios, se extrae (DRY).

**Patrones obligatorios**
- Carga de datos: `useEffect` con bandera `cancelado` y limpieza; recarga con un contador `version`. Siempre se manejan los tres estados: **cargando, error y vacío**.
- **Límite de filas:** Supabase devuelve como máximo 1.000 filas por consulta. Para históricos que crecen (series, mediciones) usa vistas o funciones RPC que resuman en la base de datos, o `limit` explícito; no traigas todo para calcular en el cliente.
- Después de un `update`/`delete` por Supabase, encadena `.select('id')` y comprueba que volvió al menos una fila: RLS no da error cuando bloquea, solo afecta 0 filas.
- Estado de React: **nunca se muta**. Copia antes de ordenar (`[...lista].sort(...)`) y actualiza con `setX((anterior) => ({ ...anterior, campo }))`.
- Formularios controlados. Todo `<button>` dentro de un `<form>` que no deba enviarlo lleva `type="button"`.
- Números escritos por el usuario: usar `aNumero()` (`src/lib/numeros.js`); acepta coma decimal y distingue vacío (`null`) de inválido (`NaN`).
- Fechas: usar **siempre** `fechaLocalISO()`, `formatearFecha()` y `formatearFechaCorta()` (`src/lib/fechas.js`). Para la semana de entrenamiento usa `inicioSemanaISO()`. **Prohibido** `new Date().toISOString().slice(0,10)` para fechas de negocio ni `new Date("YYYY-MM-DD")` (desfase UTC en Colombia).
- Validar en el navegador **y** en la base de datos (`CHECK`, `UNIQUE`, RLS). La validación del navegador es comodidad; la de la base de datos es la barrera real.
- Mensajes de error para el usuario: en español, sin detalles técnicos. No mostrar `error.message` crudo salvo el de funciones RPC que lanzan mensajes ya redactados en español.
- Accesibilidad mínima: `<label htmlFor>` en cada campo, `role="alert"` para errores y `role="status"` para avisos, `aria-pressed` en botones de selección.
- Comentarios: en español, explican **el porqué**, no lo obvio. Mantén los existentes salvo que dejen de ser ciertos.

## 4. Estilo visual (resumen; detalle en `docs/ARQUITECTURA.md`)

- App **solo oscura** (`color-scheme: dark`). No se implementa modo claro sin autorización.
- Colores **solo** mediante los tokens de `@theme` en `src/index.css`: `fondo`, `superficie`, `hundido`, `borde`, `texto`, `suave`, `primario`, `enlace`, `alerta` (clases `bg-superficie`, `text-suave`, etc.). No escribas colores hexadecimales nuevos en componentes. Excepciones ya existentes (deuda técnica): `border-[#5B6372]` en campos y los colores de los gráficos en `src/lib/coloresGrafico.js`.
- Mobile-first. Controles táctiles **mínimo 44 px** (`min-h-11`); barra inferior del atleta `min-h-14`. Zona del atleta `max-w-md`; zona del admin `max-w-3xl`.
- Reutiliza `src/lib/estilos.js` (`CAMPO`, `BOTON`, `BOTON_SEC`, `TARJETA`) y los componentes existentes antes de crear estilos nuevos. Tarjetas: `rounded-2xl border border-borde bg-superficie p-4`.
- Tipografía: la del sistema (pila por defecto de Tailwind). No se cargan fuentes externas.
- Sin emojis salvo los del estado de ánimo del check-in (😞 😐 😄).
- Los gráficos con Recharts se cargan con carga perezosa (`GraficoEvolucionLazy`, `GraficosRecordLazy`); no importes Recharts en el paquete principal. Los colores de gráficos se toman de `src/lib/coloresGrafico.js`.

## 5. Seguridad (no negociable)

- **Nunca** pongas en el frontend ni en el repositorio: la clave `service_role`/secret de Supabase, `GEMINI_API_KEY` ni ningún secreto. En React solo existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (clave **pública**). `.env` nunca se sube a GitHub.
- **Ocultar un botón no es seguridad.** Toda regla de permisos debe existir como política RLS en Supabase. `RutaProtegida` solo mejora la experiencia.
- Toda tabla nueva en `public` debe tener `enable row level security` y políticas explícitas en el mismo script.
- **La IA nunca cambia datos del atleta por su cuenta.** Solo inserta propuestas con estado `pendiente` en los buzones; el entrenador las aprueba (rutinas, nutrición y cargas). Se aplican únicamente por funciones RPC que verifican `is_admin()`.
- Todo enlace externo que se guarde (por ejemplo `video_url`) se valida como `http://` o `https://` **en la interfaz y con un CHECK en la base de datos**. Nunca renderices un `href` con un valor sin validar.
- A Gemini **no** se envían nombres, correos ni IDs de usuario: solo cifras. (La capa gratuita de Google puede usar el contenido para mejorar sus productos.)
- Las funciones SQL `security definer` deben fijar `set search_path = ''` y comprobar `public.is_admin()` si son de administración.

## 6. Base de datos y migraciones

- La fuente de verdad del esquema son los scripts de `supabase/sql/` (`schema_supabase.sql` y `migracion_NN_*.sql`), que se ejecutan a mano en el SQL Editor de Supabase.
- **Nunca edites una migración ya aplicada.** Todo cambio nuevo es un archivo nuevo: `migracion_NN_descripcion.sql` (siguiente número libre).
- Cada migración lleva comentarios en español que explican qué hace y por qué, y avisa cuando contiene sentencias destructivas (`drop`, `delete`): el SQL Editor muestra una advertencia y el dueño necesita saber que es esperable.
- Valida la sintaxis antes de entregar. Indica en qué orden aplicar migración y código (normalmente: **primero SQL, luego código**).
- Si un cambio de código depende de una migración, dilo de forma explícita al entregarlo.

## 7. Qué NO romper (invariantes del sistema)

1. **Sesión y rol** (`src/auth/AuthProvider.jsx`): el listener `onAuthStateChange` solo guarda la sesión; el perfil se consulta en un `useEffect` aparte. No hacer consultas a Supabase dentro del listener (con `PASSWORD_RECOVERY` solo se cambia el estado `recuperando`; `App.jsx` lleva a `/restablecer` y no se sale de ahí hasta cambiar la contraseña).
2. **Permisos por rol:** `metrics` solo la escribe el admin (el atleta solo lee). `daily_check_ins`: el atleta solo **crea** (una vez por día), nunca modifica ni borra. `routines`: el atleta solo ve la **activa**. `nutrition_plans`: el atleta solo lo lee; solo el admin lo cambia. El atleta puede escribir y borrar solo sus propias series (`routine_logs`).
3. **Unicidades:** `metrics (user_id, fecha)`, `daily_check_ins (user_id, fecha)`, una sola rutina `activa` por atleta (índice parcial), un solo plan nutricional vigente por atleta (índice parcial), `exercise_muscles (exercise_id, muscle)`.
4. **Cambio de día a medianoche local** del dispositivo (`useHoy`, `fechaLocalISO`). El check-in desaparece al completarse y reaparece solo el día siguiente.
5. **Activar y copiar rutinas** se hace por RPC (`activate_routine`, `duplicate_routine`), no con varios `update` sueltos. Igual los músculos de un ejercicio (`set_exercise_muscles`), la progresión de un ejercicio (`set_progresion`), el plan nutricional manual (`set_nutrition_plan`) y la resolución de propuestas nutricionales (`resolve_nutrition_suggestion`).
6. **PWA:** el service worker solo guarda archivos de la app, **no** respuestas de Supabase. Mantén `public/_redirects` (sin él, recargar `/admin` da 404 en Netlify). Mantén `registerType: 'prompt'` con `AvisoActualizacion`: el atleta decide cuándo actualizar.
7. **No ejecutes** `npm audit fix --force` ni bajes `vite-plugin-pwa` a 1.x (no es compatible con Vite 8). Los 4 avisos de `npm audit` son de herramientas de construcción y no afectan a la app publicada.
8. Los scripts SQL y la Edge Function ya entregados se consideran aplicados salvo que `docs/` diga lo contrario.
9. **Ciclos:** el ciclo en curso se calcula en el cliente con la fecha local (`lib/ciclos.js`); no uses la vista `v_current_training_cycle` (trabaja con la fecha UTC).
10. **Registro de series:** el atleta no puede guardar más series de las prescritas por ejercicio (la pantalla oculta el formulario y el trigger `limitar_series_por_ejercicio` lo impone en la base de datos). El RPE solo se pide si `routine_exercises.pide_rpe` es true; si es false el campo no se muestra y se guarda `rpe = null`. Quien cambie una de las dos capas debe revisar la otra.
11. **Cierre de ejercicio con nota:** el atleta puede finalizar un ejercicio sin completar las series solo con una nota de motivo (3–500 caracteres), guardada en `exercise_closures` (una por ejercicio y día local; solo crea o borra las suyas, sobre su rutina activa; no las modifica). La rutina del día se considera completada cuando ningún ejercicio queda pendiente (lógica pura en `src/lib/cierres.js`). El entrenador ve los cierres en el historial del atleta. Quien cambie la pantalla debe revisar las políticas y los CHECK de la migración 13.
12. **Días realizados por semana:** al pulsar *Terminar rutina* se guarda una fila en `routine_day_completions` (una por día de rutina y semana; la semana va de **lunes a domingo en fecha local**, con `inicioSemanaISO()` de `src/lib/fechas.js`). Un día realizado aparece marcado en *Entrenar* y `EntrenarDia` no deja registrar series hasta el lunes; el trigger `bloquear_dia_realizado` lo impone en la base de datos (usa la hora de `America/Bogota`). El atleta solo crea el registro, nunca lo borra ni lo modifica; el admin sí (para reabrir un día). Quien cambie la pantalla debe revisar el trigger y la migración 14.

## 8. Cómo verificar antes de entregar

- `npm run build` debe terminar sin errores (con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` de prueba si no hay `.env`).
- La lógica nueva en `src/lib/` se prueba con datos de ejemplo cuando sea posible.
- No existe batería de pruebas automáticas ni ESLint todavía: no los des por hechos.
- Entrega al dueño una lista corta de **pasos para probar** el cambio en la app.

## 9. Control de versiones

- Un cambio coherente = un commit. Mensajes en **Conventional Commits**, en español: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `chore:`, `db:` (migraciones SQL).
- Ejemplo: `feat: registrar series de entrenamiento del atleta`.
- Nunca subas `.env`, `node_modules`, `dist` ni claves.

## Regla obligatoria de mantenimiento de contexto
Al finalizar cualquier cambio en el código (nueva funcionalidad, ajuste visual, refactorización o corrección):
1. Actualiza únicamente las secciones afectadas en `docs/REQUERIMIENTOS.md` y/o `docs/ARQUITECTURA.md` si cambió algún flujo, estructura, dependencia o regla visual.
2. Agrega una entrada breve en la parte superior de `docs/CHANGELOG.md` con lo que se modificó en este paso.
3. Sugiere un mensaje de commit claro siguiendo Conventional Commits (ej. `feat: ...`, `fix: ...`, `style: ...`).
No omitas este paso salvo que se indique explícitamente que es solo una consulta.
