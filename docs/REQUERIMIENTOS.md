# REQUERIMIENTOS — Qué hace la app y qué falta

> Última actualización: 2026-11-25 · Paso 13 (cierre de ejercicio con nota e indicador de rutina completada, migración 13 aplicada) y paso 14 (días realizados por semana, migración 14 **pendiente de aplicar**) entregados. Estado: pasos 1 a 10 y 11B (progresión automática, sin IA) construidos y publicados; paso 12 (parte 1: aviso de versión nueva, recuperar contraseña y nombre **MyProgress**) publicado (falta configurar el correo en Supabase); reglas de registro (tope de series y RPE opcional por ejercicio, migración 12) aplicadas. **La IA está en pausa: se deja para el final.**
> Mantener este archivo al día es obligatorio (ver regla en `AGENTS.md`).

## 1. Resumen del producto

Aplicación web privada e instalable (PWA) llamada **MyProgress**, mobile-first y en modo oscuro, para un **entrenador de fuerza** y **15–30 atletas**. El entrenador arma y asigna rutinas, registra mediciones corporales y calóricas y supervisa el entrenamiento. El atleta registra su check-in diario y sus series, y consulta su progreso. Más adelante, una IA (Gemini) propondrá ajustes que el entrenador **siempre aprueba**.

Costo objetivo: **cero** (capas gratuitas de Supabase, Netlify y Google AI Studio).

## 2. Roles y permisos

| | Atleta (`client`) | Entrenador (`admin`) |
|---|---|---|
| Perfil | Ve el suyo (solo edita su nombre) | Ve todos |
| Check-in diario | **Crea** el de hoy (una vez); lo ve; no modifica ni borra | Ve todos; puede corregir (hoy solo desde Table Editor) |
| Mediciones (peso, cintura, calorías) | **Solo lectura** de las suyas | Crea, edita, elimina |
| Rutinas | Ve **solo la rutina activa** | Crea, edita, activa, archiva, copia, elimina |
| Series de entrenamiento | Crea, ve y borra las **suyas** | Ve todas |
| Día de rutina realizado (`routine_day_completions`) | Lo registra al terminar el día; no lo modifica ni lo borra | Ve y gestiona todos (puede borrar uno para reabrir el día) |
| Cierre de ejercicio con nota (`exercise_closures`) | Crea (solo en su rutina activa) y borra los **suyos**; no los modifica | Ve y gestiona todos |
| Biblioteca de ejercicios | Lee | Lee y edita los **músculos** de cada ejercicio |
| Registro de usuarios | Solo por invitación del entrenador | Crea usuarios desde el panel de Supabase |

El primer admin se asigna a mano en SQL (`update public.profiles set rol='admin' where email='...'`). Los demás usuarios nacen como `client`.

## 3. Lo que ya está construido

### 3.1 Comunes
- **Login** con correo y contraseña; redirección automática según rol (`/atleta` o `/admin`). Sesión persistente.
- **Recuperar contraseña:** en el login, "¿Olvidaste tu contraseña?" pide el correo y Supabase envía un enlace; al abrirlo, la app lleva a una pantalla para elegir la contraseña nueva (mínimo 8 caracteres). El mensaje es el mismo exista o no el correo. **Requiere configurar el correo en Supabase** (ver ARQUITECTURA 9 y limitaciones). La misma pantalla (`/restablecer`) sirve para cambiar la contraseña estando dentro.
- **Rutas protegidas** por rol; si el rol no corresponde, se redirige a su zona.
- **PWA instalable** (manifest, íconos, service worker). Cuando hay una versión nueva aparece el aviso **"Hay una versión nueva de MyProgress"** con *Actualizar* y *Después*; la app busca versiones nuevas cada hora y cada vez que se vuelve a abrir.
- Desplegada en Netlify con despliegue continuo desde GitHub.

### 3.2 Zona del atleta (`/atleta`)
Barra inferior con pestañas: **Check-in** (solo mientras esté pendiente), **Entrenar**, **Mis datos** (con tres secciones: *Medidas*, *Récords* y *Nutrición*).

- **Check-in diario:** ¿cumpliste las calorías de ayer? (sí/no), horas dormidas, estado de ánimo (😞 😐 😄) y ¿te sientes recuperado? (sí/no).
  - Se llena **una sola vez por día** y no se puede modificar. Al guardarlo, la pestaña desaparece y la app lo lleva a "Entrenar" con un aviso.
  - El día cambia a las **12 a. m. hora del celular**; la pestaña reaparece sola (aunque la app quede abierta).
- **Entrenar:** arriba ve el **ciclo en curso** (macrociclo, mesociclo, fase y semana, con barra de progreso) si el entrenador lo definió. Ve su rutina **activa** y elige el día a entrenar. En cada día ve, por ejercicio: lo prescrito (series × reps · RPE · descanso), notas del entrenador, "última vez" (marca del entrenamiento anterior), "Cómo se hace" (descripción y video si existen) y registra **cada serie** (peso, repeticiones y, solo si el entrenador lo pide en ese ejercicio, RPE obligatorio; si no se pide, el campo no aparece). **No puede anotar más series de las que le tocan:** al completarlas desaparece el formulario y aparece "Completaste las N series ✓" (si borra una, el formulario vuelve). La serie se guarda al instante; puede borrarla. El peso de la siguiente serie viene precargado. **Finalizar sin completar:** si no logra todas las series, puede tocar "Finalizar sin completar las series" y escribir una **nota obligatoria** con el motivo (3–500 caracteres); el ejercicio queda "finalizado" con su nota y puede **reabrirlo**. Cuando todos los ejercicios del día están completos o finalizados aparece el indicador **"¡Rutina del día completada!"** y el botón *Terminar rutina* **registra el día como realizado** y vuelve a *Entrenar* con la misma confirmación. En la lista de días, el día realizado esta semana aparece marcado **"Realizado ✓"** (con su fecha) y no se puede abrir; si entra por enlace directo, ve "Día realizado" y no puede registrar series hasta el lunes. Arriba se indica cuántos días lleva esta semana. Si el entrenador activó una **progresión** en ese ejercicio, ve además una tarjeta **"Meta de hoy"** (series × repeticiones con qué peso y por qué) y el peso y las repeticiones vienen precargados con esa meta.
- **Mis datos › Medidas (solo lectura):** tarjetas de resumen (peso actual y cambio, cintura, calorías promedio de 7 días, estado calórico), gráfico de evolución (peso en línea, calorías en barras y una **línea punteada con el objetivo de calorías** del plan vigente) e historial de mediciones. La tarjeta de calorías muestra también el objetivo.
- **Mis datos › Récords (solo lectura, con gráficas):**
  - Arriba, un **ranking visual** del 1RM estimado de los ejercicios con mayor marca.
  - Una tarjeta por ejercicio con su mejor serie y el **1RM estimado**; etiqueta "Nuevo" si se logró en los últimos 14 días.
  - Al desplegar un ejercicio: **gráfica de la evolución del 1RM**, **gráfica de repeticiones máximas con cada peso**, lo que hizo la última vez y la lista de marcas por peso.
- **Mis datos › Nutrición (solo lectura):** el plan definido por su entrenador (calorías, macros, estado calórico, desde cuándo, notas) y su promedio de calorías de los últimos 7 días frente al objetivo ("X % por encima/por debajo").

### 3.3 Zona del entrenador (`/admin`)
- **Lista de atletas** (nombre y correo) con acceso a cada ficha y a la Biblioteca de ejercicios.
- **Ficha del atleta** (`/admin/atletas/:id`), organizada en **tres pestañas** (*Resumen*, *Entrenamiento*, *Cuerpo y nutrición*):
  - Resumen: check-ins de los últimos 7 días y sueño promedio.
  - **Rutinas** del atleta: lista y creación de una nueva.
  - **Ciclos de entrenamiento:** macrociclos y mesociclos (nombre, fase, fechas, objetivo, notas) con validación de fechas; muestra el ciclo en curso con su semana y progreso.
  - **Volumen semanal por músculo** de su rutina activa.
  - **Lista negra de ejercicios** del atleta: agregar (con motivo opcional) y quitar.
  - **Plan nutricional:** ver el plan vigente, definir o **cambiar** el plan (calorías, proteína, carbohidratos, grasas, estado calórico, notas), finalizarlo y consultar el historial de planes anteriores.
  - **Mediciones:** resumen, gráfico, formulario para registrar/editar/eliminar (una por día; reemplazo por fecha).
  - **Récords personales (con gráficas):** ranking de 1RM, y por ejercicio: mejor serie, evolución del 1RM, repeticiones máximas por peso y última vez.
  - **Entrenamientos recientes:** series registradas, agrupadas por día y ejercicio. Si el atleta finalizó un ejercicio sin completarlo, se ve "Finalizó con X de N series" y su **motivo**.
  - **Check-ins recientes** (últimos 14).
- **Editor de rutinas** (`/admin/rutinas/:rutinaId`):
  - Rutina → días → ejercicios; por ejercicio: series, repeticiones (mín–máx), RPE objetivo, **¿pedir RPE al atleta? (Sí/No)**, descanso, notas y **progresión** (sin progresión, rango de repeticiones o fuerza simple; ver 3.4). En fuerza simple se marcan casillas de pasos (series × reps); en ambos sistemas se elige el salto de peso (2,5 o 5 kg) y, opcionalmente, el peso inicial del atleta. Se guarda con la función `set_progresion`, que valida todo en la base de datos.
  - Buscador de ejercicios por nombre y grupo; **advertencia** si el ejercicio es restringido (global) o está en la lista negra del atleta.
  - Estados: **borrador** (el atleta no la ve), **activa**, **archivada**. Activar archiva la activa anterior automáticamente y exige al menos un ejercicio.
  - **Copiar a otro atleta** (la copia nace como borrador, sin pesos sugeridos) y eliminar.
  - **Volumen semanal por músculo** de la rutina, recalculado en vivo.
- **Biblioteca de ejercicios** (`/admin/ejercicios`): **crear y editar ejercicios** (nombre único, grupo muscular, "cómo se hace", enlace de video http/https y marca de *restringido* = lista negra global) y **editar los músculos** de cada uno (principal = cuenta 1 serie, secundario = cuenta 0,5). Al crear un ejercicio se abre su editor de músculos. Filtro para ver los que no tienen músculos asignados.

### 3.4 Reglas de negocio vigentes
- Mediciones: una por atleta y día. Validación de interfaz: peso 20–400 kg, cintura 30–250 cm, calorías 0–10.000; al menos un dato; fecha no futura. Estado calórico opcional: déficit, superávit o normocalórica.
- Series: peso 0–1.000 kg (0 = peso corporal), repeticiones enteras 1–100, RPE 1–10 (obligatorio en la interfaz solo si el ejercicio lo pide con `pide_rpe`, que por defecto es sí; opcional en la base de datos y se guarda vacío si no se pide).
- **Semana de entrenamiento:** de **lunes a domingo**, con la fecha local del celular (`inicioSemanaISO`). Un día de la rutina se puede realizar **una vez por semana**: al terminarlo se bloquea hasta el lunes siguiente (pantalla y trigger `bloquear_dia_realizado`). Para dejarlo abrir otra vez, el entrenador borra el registro en `routine_day_completions` (Table Editor). Un día cuenta como realizado solo al pulsar *Terminar rutina*; si entrena todo pero no lo pulsa, sigue abierto.
- **Cierre de ejercicio:** solo es posible con menos series que el objetivo (la base de datos lo exige: `series_hechas < series_objetivo`). Un cierre por ejercicio y día local; las series y el objetivo guardados son una foto del momento del cierre. Si después completa todas las series, el ejercicio cuenta como completo.
- **Tope de series:** en un mismo entrenamiento el atleta no puede guardar más series de las que le tocan en cada ejercicio. Tope = `series` del ejercicio; en fuerza simple, el número de series del paso de hoy (en pantalla) y, como barrera en la base de datos, el mayor número de series de la escalera. Lo comprueban la pantalla y el trigger `limitar_series_por_ejercicio` (migración 12).
- Prescripción: series 1–20, repeticiones 1–100 (mín ≤ máx), RPE 1–10 (admite decimales), descanso 0–900 s.
- Una sola rutina activa por atleta; el atleta nunca ve borradores ni archivadas.
- **Progresión automática** (por ejercicio de la rutina; reglas fijas, sin IA; lógica en `src/lib/progresion.js`). Siempre compara las series de la **última sesión** hechas con el **peso más alto de esa sesión** (el "peso de trabajo"); así, si el atleta sube el peso por su cuenta, se detecta solo.
  - **Rango de repeticiones (`doble`):** exige `reps_max` > `reps_min`. Meta = (mejor serie de la última vez) + 1, nunca por debajo de `reps_min`. Si no mejoró, la meta se mantiene. Al llegar a `reps_max` se sugiere subir `incremento_kg` (en la interfaz, 2,5 o 5 kg) y la meta vuelve a `reps_min`.
  - **Fuerza simple (`escalera`):** el entrenador marca pasos N×M (N series de M repeticiones; series 2–6 y reps 1–5 en las casillas; mínimo 2 pasos, la base de datos admite hasta 40). Se recorren ordenados por repeticiones y luego por series: primero suben las series, luego las repeticiones. Un paso cuenta como cumplido si hubo al menos N series con M reps o más. Al cumplir el último se sugiere subir el peso y se vuelve al primer paso; si no se cumplió ni el primero, se repite.
  - Sin historial, la meta empieza en el primer paso (o `reps_min`) con el **peso inicial del atleta** (`peso_inicial_kg`) o, si no hay, el peso sugerido. Ese peso es solo una sugerencia: el atleta escribe lo que de verdad levantó. El peso inicial no se copia al copiar la rutina a otro atleta (la configuración sí).
  - En fuerza simple el campo *Series* de la rutina solo cuenta para el volumen semanal.
- Volumen: series semanales × factor del músculo (1 principal, 0,5 secundario). **Supone que cada día de la rutina se entrena una vez por semana.** Muestra también los músculos en 0.
- Récords: el **1RM estimado** usa la fórmula de Epley (peso × (1 + reps/30); con 1 repetición es el propio peso) y solo cuenta series con peso mayor que 0. Las **marcas por peso** agrupan por peso exacto y guardan la mayor cantidad de repeticiones (si empatan, la fecha más antigua). **Gráficas:** evolución del 1RM (un punto por día de entrenamiento en **hora local**, con la mejor serie del día; usa hasta las 500 series más recientes del ejercicio), repeticiones máximas por peso y un ranking con los 8 mayores 1RM.
- Plan nutricional: calorías enteras 500–10.000; proteína, carbohidratos y grasas 0–1.000 g (opcionales). **Un solo plan vigente por atleta.** Cambiar el plan no lo edita: crea uno nuevo y el anterior pasa al historial (función `set_nutrition_plan`). La app avisa si los macros (4/4/9 kcal por gramo) difieren más de un 10 % de las calorías objetivo, sin bloquear el guardado. El atleta solo lee su plan.
- Ciclos: un macrociclo contiene mesociclos. Fecha de fin ≥ inicio; el mesociclo debe quedar dentro de su macrociclo; no se solapan mesociclos del mismo macrociclo ni macrociclos entre sí. La semana actual = días desde el inicio ÷ 7 (+1), con la **fecha local del celular**. Eliminar un macrociclo elimina sus mesociclos. Los ciclos aún no se enlazan con las rutinas.
- Lista negra por atleta: la ve y la gestiona solo el entrenador. El editor de rutinas **advierte** al usar un ejercicio de la lista (no lo bloquea) y la IA no podrá sugerir cargas de esos ejercicios. Agregar un ejercicio a la lista **no** lo quita de rutinas ya armadas.
- Ejercicios: nombre único; el enlace de video solo puede ser http/https (regla también en la base de datos, migración 09). No se eliminan desde la app: solo se editan.

## 4. Ya existe en la base de datos, pero aún sin pantalla

Creado en el esquema inicial y la migración 02; listo para usar cuando se construya su interfaz:

| Elemento | Para qué |
|---|---|
| `ai_nutrition_suggestions` / `ai_load_suggestions` | Buzones de propuestas de la IA (siempre `pendiente` hasta que el admin resuelve) |
| Vistas `v_athlete_overview`, `v_current_training_cycle`, `v_pending_ai_suggestions`, `v_metrics_trend` | Listado enriquecido, mesociclo vigente (la app calcula el ciclo en el cliente con la hora local y no la usa), bandeja de pendientes, tendencia de peso (esta última la usa la Edge Function). Las vistas `v_athlete_prs` y `v_best_reps_by_weight` **ya las usa la app** (récords) |
| `supabase/functions/generate-weekly-proposals/` | Edge Function que llama a Gemini. **Escrita, no desplegada ni probada contra Supabase.** |

## 5. Lo que falta por construir (en este orden)

| Paso | Qué | Notas |
|---|---|---|
| ~~**8**~~ | ~~Récords personales y mejores repeticiones por peso~~ | **Hecho (2026-11-21).** Base de la Idea 1. Visible para el entrenador y el atleta. |
| ~~**9**~~ | ~~Plan nutricional manual~~ | **Hecho (2026-11-22).** El entrenador define kcal y macros por atleta; el atleta los ve; línea de objetivo en el gráfico de calorías. |
| ~~**10**~~ | ~~Mesociclos y lista negra + crear/editar ejercicios~~ | **Hecho (2026-11-22).** Incluye la ficha del atleta en pestañas. |
| **11B** | **Progresión automática de repeticiones y carga (sin IA)** | **Entregado (2026-11-25).** Migración 11 ya aplicada. Rango de repeticiones y fuerza simple, configurables por ejercicio. |
| **11** | **La IA** | **EN PAUSA: se deja para el final.** Desplegar la Edge Function y sus secrets; botón "Generar propuestas de la semana"; bandeja de aprobación (Aceptar / Editar / Rechazar) para nutrición, cargas y rutinas; uso del volumen por músculo al proponer rutinas. (El paso 11A entregado, con su migración 10, está **sin aplicar**.) |
| **12** | **Pulido** | **Hecho (2026-11-25):** aviso de "hay versión nueva", recuperar contraseña y nombre MyProgress. **Falta:** respaldos periódicos y pantalla para que el admin corrija un check-in. |

### Idea 1: progresión semanal de repeticiones — **resuelta con reglas fijas (paso 11B)**
- La regla quedó definida por el dueño y ya no depende de la IA: ver "Progresión automática" en 3.4. Cuenta la **serie principal** (la mejor del peso de trabajo) en el rango de repeticiones, y el esquema N series × M reps en fuerza simple.
- Lo único que queda para la IA (al final): que **proponga** ajustes que el entrenador apruebe. La base ya existe (`ai_load_suggestions`, `v_best_reps_by_weight`).

## 6. Backlog técnico sugerido (no solicitado aún)

- Reordenar ejercicios y días con flechas (hoy se ordenan por orden de creación).
- Enlazar cada rutina con un mesociclo (`routines.cycle_id` ya existe, sin uso) y mostrarlo en el editor.
- Microciclos (la base de datos los admite; no hay interfaz).
- Cronómetro de descanso en el entrenamiento.
- Contar días repetidos en la semana para el volumen; objetivos mínimo/máximo de volumen por músculo.
- Modo sin conexión para registrar series en gimnasios con mala señal.
- Indicadores en la lista de atletas (check-in de hoy, propuestas pendientes) usando `v_athlete_overview`.

## 7. Limitaciones conocidas

- **Recuperar contraseña necesita un correo propio en Supabase:** el correo por defecto solo entrega a miembros del equipo del proyecto y con un límite de 2 mensajes por hora; para los atletas hay que configurar un SMTP propio (por ejemplo Brevo o Resend, con capa gratuita). Mientras tanto, el entrenador puede restablecer una contraseña desde Supabase (Authentication > Users).
- **Sin internet no se guarda nada** (la app muestra el error y conserva lo escrito para reintentar).
- Un check-in mal llenado solo lo corrige el entrenador (desde Table Editor).
- Los ejercicios no se pueden eliminar desde la app (hay historial que depende de ellos); solo se editan.
- Supabase gratis **pausa el proyecto tras una semana sin actividad** y no incluye copias diarias: hacer respaldos manuales.
- La capa gratuita de Gemini puede usar el contenido enviado para mejorar productos de Google (por eso no se envían identificadores).
- El gráfico reparte las fechas a distancias iguales aunque haya huecos entre mediciones.
- El 1RM estimado (Epley) es solo una referencia: poco fiable con más de ~10 repeticiones.
- La línea de objetivo de calorías solo se dibuja en las fechas con medición, y las calorías las carga el entrenador (el atleta no las registra).
- La progresión solo mira la **última sesión** de cada ejercicio (si el atleta no entrena ese ejercicio durante semanas, la meta sale de la última vez, sin descontar el tiempo). Si el mismo ejercicio está en dos días de la rutina, comparten historial.
- Si el atleta falla mucho (por ejemplo, 2 repeticiones por debajo de lo pedido), la meta del rango baja a "lo que hizo + 1" (nunca por debajo de `reps_min`), no se queda en la meta anterior.
- Sin pruebas automáticas ni ESLint.
