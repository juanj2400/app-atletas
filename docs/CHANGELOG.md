# CHANGELOG

Formato: las entradas más recientes arriba. Cada cambio de código debe agregar una entrada breve (ver regla en `AGENTS.md`).
Tipos: `feat`, `fix`, `style`, `refactor`, `docs`, `chore`, `db`.

---

## 2026-11-25 · Paso 13 — Finalizar ejercicios con nota y confirmar la rutina del día

- **feat:** el atleta puede **finalizar un ejercicio sin completar las series** escribiendo una nota obligatoria con el motivo (3–500 caracteres). Queda marcado "finalizado" y puede reabrirlo.
- **feat:** el entrenador ve en **Entrenamientos recientes** "Finalizó con X de N series" y el motivo, incluso si el ejercicio no tiene series.
- **feat:** al completar o finalizar todos los ejercicios del día aparece el indicador **"¡Rutina del día completada!"** (fondo `primario`, sin colores nuevos) y *Terminar rutina* vuelve a *Entrenar* con la misma confirmación.
- **refactor:** nueva `src/lib/cierres.js` (funciones puras, probadas con datos de ejemplo).
- **db:** `migracion_13_cierre_ejercicio.sql` — tabla `exercise_closures` con RLS (el atleta solo crea y borra lo suyo en su rutina activa; el admin gestiona todo), CHECK de nota y de series, único por ejercicio y día. Probada con un Postgres real (políticas incluidas). No elimina nada. **Aplicar primero el SQL y después subir el código.**
- **docs:** `AGENTS.md` (invariante 11), `REQUERIMIENTOS.md`, `ARQUITECTURA.md` y `supabase/sql/README.md` actualizados.

**Commit sugerido:** `feat: finalizar ejercicios con nota e indicar rutina del día completada`

---

## 2026-11-25 · Paso 12 (parte 2) — Tope de series y RPE opcional por ejercicio

- **feat:** el atleta **no puede anotar más series de las que le tocan** en cada ejercicio: al completarlas desaparece el formulario y aparece "Completaste las N series ✓" (si borra una, el formulario vuelve). En fuerza simple el tope de hoy es el número de series del paso de la meta.
- **feat:** el entrenador decide, **ejercicio por ejercicio, si se pide RPE** (selector Sí/No en el editor de rutinas). Si es No, el atleta no ve ni llena el RPE, el RPE objetivo se guarda vacío y no se muestra en la prescripción. Los ejercicios que ya existen siguen pidiendo RPE.
- **db:** `migracion_12_series_y_rpe.sql` — columna `pide_rpe` (por defecto true), trigger `limitar_series_por_ejercicio` (tope en la base de datos, a prueba de doble toque y de inserciones simultáneas) y `duplicate_routine` actualizada para copiar `pide_rpe`. Probada con un Postgres real. No elimina nada. **Aplicar primero el SQL y después subir el código.**
- **docs:** `AGENTS.md` (invariante 10), `REQUERIMIENTOS.md`, `ARQUITECTURA.md` y `supabase/sql/README.md` actualizados.

**Commit sugerido:** `feat: limitar series al número prescrito y hacer el RPE opcional por ejercicio`

---

## 2026-11-25 · Paso 12 (parte 1) — Aviso de versión nueva, recuperar contraseña y nombre MyProgress

- **feat:** **aviso de versión nueva** en la PWA: cartel "Hay una versión nueva de MyProgress" con *Actualizar* y *Después*. La app busca versiones cada hora y al volver a abrirse. Cambia `registerType` de `autoUpdate` a `prompt`.
- **feat:** **recuperar contraseña**: enlace "¿Olvidaste tu contraseña?" en el login → correo con enlace → pantalla para elegir la contraseña nueva (mínimo 8 caracteres). El mensaje no revela si el correo existe. `AuthProvider` marca `recuperando` y `App.jsx` fuerza `/restablecer` hasta cambiarla.
- **chore:** la app pasa a llamarse **MyProgress** (manifest, título, pantalla de login, README). Los celulares con la app ya instalada pueden seguir mostrando el nombre anterior hasta reinstalarla.
- **chore:** `.gitignore` ignora `*.zip`; se quita del repositorio `progresion-paso11b.zip`, que se había subido por error.
- **docs:** `AGENTS.md`, `REQUERIMIENTOS.md` y `ARQUITECTURA.md` actualizados, con la configuración necesaria en Supabase (Redirect URLs, SMTP propio, longitud mínima). Sin cambios de base de datos y sin dependencias nuevas.

**Commit sugerido:** `feat: agregar aviso de versión nueva, recuperar contraseña y renombrar la app a MyProgress`

---

## 2026-11-25 · Paso 11B — Progresión automática de repeticiones y carga (sin IA)

- **feat:** el entrenador elige por ejercicio una **progresión**: *rango de repeticiones* (`doble`: una más cada semana; si no mejora se mantiene; al llegar al tope sugiere subir 2,5 o 5 kg y vuelve a empezar) o *fuerza simple* (`escalera`: pasos N×M marcados con casillas; primero suben las series, luego las repeticiones y al final el peso). Opcionalmente, un peso inicial por atleta.
- **feat:** el atleta ve en *Entrenar* una tarjeta **"Meta de hoy"** con series, repeticiones, peso y el motivo. El formulario viene precargado con la meta. El sistema detecta solo el peso que el atleta usó (el más alto de la última sesión).
- **refactor:** nueva `src/lib/progresion.js` (funciones puras); `textoPrescripcion` muestra la escalera. El editor guarda la progresión con la RPC `set_progresion`.
- **db:** `migracion_11_progresion.sql` (ya aplicada en Supabase; se guarda en el repo tal cual se ejecutó) — columnas `progresion_tipo`, `escalera`, `incremento_kg`, `peso_inicial_kg`, función `set_progresion` y `duplicate_routine` actualizada. Verificada en un Postgres real. No elimina nada.
- **docs:** `AGENTS.md` (invariante 5), `REQUERIMIENTOS.md`, `ARQUITECTURA.md` y `supabase/sql/README.md` actualizados. **La IA sigue en pausa.**

**Commit sugerido:** `feat: agregar progresión automática de repeticiones y carga por ejercicio`

---

## 2026-11-22 · Paso 10 — Ciclos, lista negra y biblioteca de ejercicios editable

- **feat:** el entrenador crea y edita **macrociclos y mesociclos** de cada atleta (nombre, fase, fechas, objetivo, notas) con validación de fechas (dentro del macrociclo, sin solapes). Muestra el ciclo en curso con su semana y progreso.
- **feat:** el atleta ve su **ciclo en curso** (fase y semana) en la parte superior de *Entrenar*.
- **feat:** **lista negra por atleta**: el entrenador agrega ejercicios (con motivo) y los quita; el editor de rutinas ya advertía al usarlos.
- **feat:** **crear y editar ejercicios** desde la biblioteca (nombre único, grupo, cómo se hace, enlace de video, restringido). Al crear uno se abre su editor de músculos.
- **refactor:** la **ficha del atleta pasa a tres pestañas** (*Resumen*, *Entrenamiento*, *Cuerpo y nutrición*) porque ya tenía demasiadas secciones en una sola página.
- **refactor:** `SelectorEjercicio` acepta opciones (`avisarRestringidos`, `textoBoton`, `titulo`) para reutilizarlo en la lista negra.
- **db:** `migracion_09_ejercicios_video_seguro.sql` — CHECK: `video_url` solo http/https. Probada con un Postgres real.
- **docs:** `REQUERIMIENTOS.md`, `ARQUITECTURA.md`, `AGENTS.md` (regla de enlaces externos e invariante de ciclos) y `supabase/sql/README.md` actualizados.

**Commit sugerido:** `feat: agregar ciclos de entrenamiento, lista negra y gestión de ejercicios`

---

## 2026-11-22 · Paso 9 — Plan nutricional manual

- **feat:** el entrenador define y cambia el **plan nutricional** de cada atleta (calorías, proteína, carbohidratos, grasas, estado calórico, notas) desde su ficha, con historial de planes anteriores y opción de finalizar el vigente. Avisa si los macros no cuadran con las calorías (sin bloquear).
- **feat:** el atleta ve su plan en **Mis datos › Nutrición** (tercera sección) junto con su promedio de calorías de los últimos 7 días frente al objetivo.
- **feat:** los gráficos de evolución (atleta y entrenador) dibujan una **línea punteada con el objetivo de calorías** que cambia en la fecha de cada plan nuevo; la tarjeta de calorías muestra el objetivo.
- **db:** `migracion_08_plan_nutricional.sql` — función `set_nutrition_plan` (cierra el plan vigente y crea el nuevo, todo o nada; valida rangos). Probada con un Postgres real. La tabla `nutrition_plans` y sus permisos ya existían desde la migración 02.
- **docs:** `REQUERIMIENTOS.md`, `ARQUITECTURA.md`, `AGENTS.md` y `supabase/sql/README.md` actualizados.

**Commit sugerido:** `feat: agregar plan nutricional manual con línea de objetivo en el gráfico`

---

## 2026-11-21 · Paso 8b — Récords con gráficas dentro de "Mis datos"

- **feat:** el atleta ve sus récords **con gráficas**: ranking visual de 1RM y, por ejercicio, evolución del 1RM en el tiempo y repeticiones máximas con cada peso. También las ve el entrenador en la ficha del atleta.
- **refactor:** los récords dejan de ser una pestaña aparte; ahora son la sección **Récords** dentro de **Mis datos** (secciones *Medidas* y *Récords*, con rutas anidadas `/atleta/datos` y `/atleta/datos/records`). La barra inferior vuelve a tener 3 pestañas.
- **refactor:** lo que era `MisDatos` (peso, cintura, calorías) pasa a `MisMediciones.jsx`; `MisDatos.jsx` es ahora el marco con las dos secciones.
- **refactor:** colores de gráficos centralizados en `src/lib/coloresGrafico.js` (antes duplicados en `GraficoEvolucion.jsx`).
- **docs:** `REQUERIMIENTOS.md`, `ARQUITECTURA.md` y `AGENTS.md` actualizados. Sin cambios de base de datos.

**Commit sugerido:** `feat: mostrar récords con gráficas dentro de Mis datos`

---

## 2026-11-21 · Paso 8 — Récords personales y mejores repeticiones por peso

- **feat:** nueva pestaña **Récords** para el atleta y sección "Récords personales" en la ficha del entrenador: por ejercicio, mejor serie y 1RM estimado (Epley), etiqueta "Nuevo" (últimos 14 días), y al desplegar: mejores repeticiones con cada peso y "última vez".
- **db:** `migracion_07_records_por_peso.sql` — vista `v_best_reps_by_weight` (resume en la base de datos para esquivar el límite de 1.000 filas de Supabase). Probada con un Postgres real en datos de ejemplo.
- **docs:** `AGENTS.md` (regla del límite de filas), `REQUERIMIENTOS.md`, `ARQUITECTURA.md` y `supabase/sql/README.md` actualizados.
- Prepara la **Idea 1** (progresión semanal de repeticiones): ya existe el dato "reps logradas con cada peso".

**Commit sugerido:** `feat: agregar récords personales y mejores repeticiones por peso`

---

## 2026-11-21 · Estado inicial documentado (pasos 1 a 7)

**docs:** se crean `AGENTS.md`, `docs/REQUERIMIENTOS.md`, `docs/ARQUITECTURA.md` y este archivo para que el contexto del proyecto viva en el repositorio.
**chore:** los scripts SQL (esquema y migraciones 02 a 06) se guardan en `supabase/sql/`, con un `README.md` que indica el orden de aplicación y el nombre de cada uno en el SQL Editor de Supabase.

Resumen del estado al momento de documentar (historial de pasos anteriores):

### Paso 7 — Check-in de una sola vez y volumen por músculo
- **feat:** el check-in se llena una vez por día; la pestaña desaparece al completarlo y reaparece a las 12 a. m. hora local (`useHoy`). Al guardar, redirige a "Entrenar" con aviso. Contexto compartido por `Outlet`.
- **db:** `migracion_05_checkin_una_vez.sql` — el atleta solo puede crear su check-in (sin update/delete); el admin conserva todo.
- **feat:** volumen semanal por músculo (series × factor; compuestos reparten volumen) en la ficha del atleta y dentro del editor de rutinas.
- **feat:** "Biblioteca de ejercicios" para editar los músculos de cada ejercicio.
- **db:** `migracion_06_volumen_muscular.sql` — `muscle_groups` (14 músculos), `exercise_muscles`, función `set_exercise_muscles` y valores iniciales para los 14 ejercicios.

### Paso 6 — Entrenar y registrar series
- **feat:** pestaña "Entrenar": el atleta ve su rutina activa, elige el día y registra cada serie (peso, reps, RPE) con "última vez" y ayuda del ejercicio.
- **feat:** el admin ve "Entrenamientos recientes" en la ficha del atleta.

### Paso 5 — Rutinas asignadas por el entrenador
- **feat:** creación y edición de rutinas (días y ejercicios con series, reps, RPE, descanso), activar/archivar/borrador, copiar a otro atleta, advertencias de lista negra.
- **db:** `migracion_04_rutinas.sql` — `routines`, `routine_days`, `routine_exercises`, `routine_logs.routine_exercise_id`, funciones `activate_routine` y `duplicate_routine`.

### Paso 4 — Vista de datos del atleta y gráfico
- **feat:** pestaña "Mis datos" (solo lectura) con resumen, gráfico y historial; barra inferior y rutas anidadas.
- **feat:** gráfico de evolución con Recharts (peso en línea, calorías en barras) también en la ficha del admin; carga perezosa.
- **refactor:** lógica compartida en `lib/mediciones.js`, `ResumenMediciones`, `GraficoEvolucion`.

### Paso 3 — Mediciones (solo admin)
- **feat:** el admin registra/edita/elimina mediciones de peso, cintura, calorías y estado calórico.
- **db:** `migracion_03_metricas_admin.sql` — índice único `(user_id, fecha)`; el atleta solo lee, el admin escribe.

### Paso 2 — Check-in diario y ficha del atleta
- **feat:** formulario de check-in del atleta (calorías de ayer, sueño, ánimo, recuperación).
- **feat:** el admin abre a cada atleta (`/admin/atletas/:id`) y ve sus check-ins.
- **feat:** utilidades de fechas locales (`fechas.js`), `Selector`, `numeros.js`.

### Paso 1 — Proyecto base
- **feat:** proyecto React + Vite + Tailwind 4 (tema oscuro) + PWA, conexión a Supabase, login con redirección por rol y rutas protegidas.
- **chore:** despliegue continuo GitHub → Netlify.

### Paso 0 — Base de datos
- **db:** `schema_supabase.sql` — `profiles`, `exercises`, `metrics`, `routine_logs`, `ai_load_suggestions`, `daily_check_ins`, trigger de perfiles, RLS y 14 ejercicios iniciales.
- **db:** `migracion_02_nutricion_dashboard.sql` — `nutrition_plans`, `ai_nutrition_suggestions`, `training_cycles`, `athlete_exercise_blacklist`, vistas del dashboard, triggers de seguridad de la IA y `resolve_nutrition_suggestion`.
- **feat (sin desplegar):** Edge Function `generate-weekly-proposals` (Gemini 3.8 Flash).

**Commit sugerido para este paso:** `docs: agregar AGENTS.md y documentación inicial del proyecto`
