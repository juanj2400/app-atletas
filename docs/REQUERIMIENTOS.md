# REQUERIMIENTOS — Qué hace la app y qué falta

> Última actualización: 2026-11-21 · Estado: pasos 1 a 10 construidos y publicados.
> Mantener este archivo al día es obligatorio (ver regla en `AGENTS.md`).

## 1. Resumen del producto

Aplicación web privada e instalable (PWA), mobile-first y en modo oscuro, para un **entrenador de fuerza** y **15–30 atletas**. El entrenador arma y asigna rutinas, registra mediciones corporales y calóricas y supervisa el entrenamiento. El atleta registra su check-in diario y sus series, y consulta su progreso. Más adelante, una IA (Gemini) propondrá ajustes que el entrenador **siempre aprueba**.

Costo objetivo: **cero** (capas gratuitas de Supabase, Netlify y Google AI Studio).

## 2. Roles y permisos

| | Atleta (`client`) | Entrenador (`admin`) |
|---|---|---|
| Perfil | Ve el suyo (solo edita su nombre) | Ve todos |
| Check-in diario | **Crea** el de hoy (una vez); lo ve; no modifica ni borra | Ve todos; puede corregir (hoy solo desde Table Editor) |
| Mediciones (peso, cintura, calorías) | **Solo lectura** de las suyas | Crea, edita, elimina |
| Rutinas | Ve **solo la rutina activa** | Crea, edita, activa, archiva, copia, elimina |
| Series de entrenamiento | Crea, ve y borra las **suyas** | Ve todas |
| Biblioteca de ejercicios | Lee | Lee y edita los **músculos** de cada ejercicio |
| Registro de usuarios | Solo por invitación del entrenador | Crea usuarios desde el panel de Supabase |

El primer admin se asigna a mano en SQL (`update public.profiles set rol='admin' where email='...'`). Los demás usuarios nacen como `client`.

## 3. Lo que ya está construido

### 3.1 Comunes
- **Login** con correo y contraseña; redirección automática según rol (`/atleta` o `/admin`). Sesión persistente.
- **Rutas protegidas** por rol; si el rol no corresponde, se redirige a su zona.
- **PWA instalable** (manifest, íconos, service worker con actualización automática).
- Desplegada en Netlify con despliegue continuo desde GitHub.

### 3.2 Zona del atleta (`/atleta`)
Barra inferior con pestañas: **Check-in** (solo mientras esté pendiente), **Entrenar**, **Mis datos** (con tres secciones: *Medidas*, *Récords* y *Nutrición*).

- **Check-in diario:** ¿cumpliste las calorías de ayer? (sí/no), horas dormidas, estado de ánimo (😞 😐 😄) y ¿te sientes recuperado? (sí/no).
  - Se llena **una sola vez por día** y no se puede modificar. Al guardarlo, la pestaña desaparece y la app lo lleva a "Entrenar" con un aviso.
  - El día cambia a las **12 a. m. hora del celular**; la pestaña reaparece sola (aunque la app quede abierta).
- **Entrenar:** arriba ve el **ciclo en curso** (macrociclo, mesociclo, fase y semana, con barra de progreso) si el entrenador lo definió. Ve su rutina **activa** y elige el día a entrenar. En cada día ve, por ejercicio: lo prescrito (series × reps · RPE · descanso), notas del entrenador, "última vez" (marca del entrenamiento anterior), "Cómo se hace" (descripción y video si existen) y registra **cada serie** (peso, repeticiones, RPE obligatorio). La serie se guarda al instante; puede borrarla. El peso de la siguiente serie viene precargado.
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
  - **Entrenamientos recientes:** series registradas, agrupadas por día y ejercicio.
  - **Check-ins recientes** (últimos 14).
- **Editor de rutinas** (`/admin/rutinas/:rutinaId`):
  - Rutina → días → ejercicios; por ejercicio: series, repeticiones (mín–máx), RPE objetivo, descanso, notas.
  - Buscador de ejercicios por nombre y grupo; **advertencia** si el ejercicio es restringido (global) o está en la lista negra del atleta.
  - Estados: **borrador** (el atleta no la ve), **activa**, **archivada**. Activar archiva la activa anterior automáticamente y exige al menos un ejercicio.
  - **Copiar a otro atleta** (la copia nace como borrador, sin pesos sugeridos) y eliminar.
  - **Volumen semanal por músculo** de la rutina, recalculado en vivo.
- **Biblioteca de ejercicios** (`/admin/ejercicios`): **crear y editar ejercicios** (nombre único, grupo muscular, "cómo se hace", enlace de video http/https y marca de *restringido* = lista negra global) y **editar los músculos** de cada uno (principal = cuenta 1 serie, secundario = cuenta 0,5). Al crear un ejercicio se abre su editor de músculos. Filtro para ver los que no tienen músculos asignados.

### 3.4 Reglas de negocio vigentes
- Mediciones: una por atleta y día. Validación de interfaz: peso 20–400 kg, cintura 30–250 cm, calorías 0–10.000; al menos un dato; fecha no futura. Estado calórico opcional: déficit, superávit o normocalórica.
- Series: peso 0–1.000 kg (0 = peso corporal), repeticiones enteras 1–100, RPE 1–10 (obligatorio en la interfaz; opcional en la base de datos).
- Prescripción: series 1–20, repeticiones 1–100 (mín ≤ máx), RPE 1–10 (admite decimales), descanso 0–900 s.
- Una sola rutina activa por atleta; el atleta nunca ve borradores ni archivadas.
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
| **11** | **La IA** | Desplegar la Edge Function y sus secrets; botón "Generar propuestas de la semana"; bandeja de aprobación (Aceptar / Editar / Rechazar) para nutrición, cargas y rutinas; **progresión semanal (Idea 1)**; uso del volumen por músculo al proponer rutinas. |
| **12** | **Pulido** | Aviso de "hay versión nueva" en la PWA, recuperar contraseña, respaldos periódicos, pantalla para que el admin corrija un check-in. |

### Idea 1 (registrada, sin construir): progresión semanal de repeticiones
- El entrenador da un **rango de repeticiones**; el atleta anota las que logró con cada peso.
- Según lo logrado (criterio de la IA **y** del entrenador) se define la meta de la semana siguiente (ej.: hizo 6 → intentar 7; al llegar al tope del rango → subir el peso).
- Se guarda cuántas repeticiones se lograron con cada peso, para llevar **marcas personales** y saber con cuánto trabajar cada vez que se use ese ejercicio.
- Conexión: la base ya está construida: las **mejores repeticiones por peso** (paso 8, vista `v_best_reps_by_weight`); la propuesta la genera la IA (paso 11) en `ai_load_suggestions` y el entrenador aprueba; el atleta ve su **meta del día** en "Entrenar" (usará `peso_sugerido_kg` y un objetivo de repeticiones).
- **Decisión pendiente del dueño:** regla exacta (cuántas repeticiones antes de subir el peso, cuánto subir, si cuenta la mejor serie o todas).

## 6. Backlog técnico sugerido (no solicitado aún)

- Reordenar ejercicios y días con flechas (hoy se ordenan por orden de creación).
- Enlazar cada rutina con un mesociclo (`routines.cycle_id` ya existe, sin uso) y mostrarlo en el editor.
- Microciclos (la base de datos los admite; no hay interfaz).
- Cronómetro de descanso en el entrenamiento.
- Contar días repetidos en la semana para el volumen; objetivos mínimo/máximo de volumen por músculo.
- Modo sin conexión para registrar series en gimnasios con mala señal.
- Indicadores en la lista de atletas (check-in de hoy, propuestas pendientes) usando `v_athlete_overview`.

## 7. Limitaciones conocidas

- **Sin internet no se guarda nada** (la app muestra el error y conserva lo escrito para reintentar).
- Un check-in mal llenado solo lo corrige el entrenador (desde Table Editor).
- Los ejercicios no se pueden eliminar desde la app (hay historial que depende de ellos); solo se editan.
- Supabase gratis **pausa el proyecto tras una semana sin actividad** y no incluye copias diarias: hacer respaldos manuales.
- La capa gratuita de Gemini puede usar el contenido enviado para mejorar productos de Google (por eso no se envían identificadores).
- El gráfico reparte las fechas a distancias iguales aunque haya huecos entre mediciones.
- El 1RM estimado (Epley) es solo una referencia: poco fiable con más de ~10 repeticiones.
- La línea de objetivo de calorías solo se dibuja en las fechas con medición, y las calorías las carga el entrenador (el atleta no las registra).
- Sin pruebas automáticas ni ESLint.
