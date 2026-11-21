# REQUERIMIENTOS — Qué hace la app y qué falta

> Última actualización: 2026-11-21 · Estado: pasos 1 a 7 construidos y publicados.
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
Barra inferior con pestañas: **Check-in** (solo mientras esté pendiente), **Entrenar**, **Mis datos**.

- **Check-in diario:** ¿cumpliste las calorías de ayer? (sí/no), horas dormidas, estado de ánimo (😞 😐 😄) y ¿te sientes recuperado? (sí/no).
  - Se llena **una sola vez por día** y no se puede modificar. Al guardarlo, la pestaña desaparece y la app lo lleva a "Entrenar" con un aviso.
  - El día cambia a las **12 a. m. hora del celular**; la pestaña reaparece sola (aunque la app quede abierta).
- **Entrenar:** ve su rutina **activa** y elige el día a entrenar. En cada día ve, por ejercicio: lo prescrito (series × reps · RPE · descanso), notas del entrenador, "última vez" (marca del entrenamiento anterior), "Cómo se hace" (descripción y video si existen) y registra **cada serie** (peso, repeticiones, RPE obligatorio). La serie se guarda al instante; puede borrarla. El peso de la siguiente serie viene precargado.
- **Mis datos (solo lectura):** tarjetas de resumen (peso actual y cambio, cintura, calorías promedio de 7 días, estado calórico), gráfico de evolución (peso en línea y calorías en barras) e historial de mediciones.

### 3.3 Zona del entrenador (`/admin`)
- **Lista de atletas** (nombre y correo) con acceso a cada ficha y a la Biblioteca de ejercicios.
- **Ficha del atleta** (`/admin/atletas/:id`):
  - Resumen: check-ins de los últimos 7 días y sueño promedio.
  - **Rutinas** del atleta: lista y creación de una nueva.
  - **Volumen semanal por músculo** de su rutina activa.
  - **Mediciones:** resumen, gráfico, formulario para registrar/editar/eliminar (una por día; reemplazo por fecha).
  - **Entrenamientos recientes:** series registradas, agrupadas por día y ejercicio.
  - **Check-ins recientes** (últimos 14).
- **Editor de rutinas** (`/admin/rutinas/:rutinaId`):
  - Rutina → días → ejercicios; por ejercicio: series, repeticiones (mín–máx), RPE objetivo, descanso, notas.
  - Buscador de ejercicios por nombre y grupo; **advertencia** si el ejercicio es restringido (global) o está en la lista negra del atleta.
  - Estados: **borrador** (el atleta no la ve), **activa**, **archivada**. Activar archiva la activa anterior automáticamente y exige al menos un ejercicio.
  - **Copiar a otro atleta** (la copia nace como borrador, sin pesos sugeridos) y eliminar.
  - **Volumen semanal por músculo** de la rutina, recalculado en vivo.
- **Biblioteca de ejercicios** (`/admin/ejercicios`): ver ejercicios y **editar los músculos** de cada uno (principal = cuenta 1 serie, secundario = cuenta 0,5). Filtro para ver los que no tienen músculos asignados.

### 3.4 Reglas de negocio vigentes
- Mediciones: una por atleta y día. Validación de interfaz: peso 20–400 kg, cintura 30–250 cm, calorías 0–10.000; al menos un dato; fecha no futura. Estado calórico opcional: déficit, superávit o normocalórica.
- Series: peso 0–1.000 kg (0 = peso corporal), repeticiones enteras 1–100, RPE 1–10 (obligatorio en la interfaz; opcional en la base de datos).
- Prescripción: series 1–20, repeticiones 1–100 (mín ≤ máx), RPE 1–10 (admite decimales), descanso 0–900 s.
- Una sola rutina activa por atleta; el atleta nunca ve borradores ni archivadas.
- Volumen: series semanales × factor del músculo (1 principal, 0,5 secundario). **Supone que cada día de la rutina se entrena una vez por semana.** Muestra también los músculos en 0.

## 4. Ya existe en la base de datos, pero aún sin pantalla

Creado en el esquema inicial y la migración 02; listo para usar cuando se construya su interfaz:

| Elemento | Para qué |
|---|---|
| `nutrition_plans` | Plan nutricional oficial (kcal y macros) con historial por atleta |
| `ai_nutrition_suggestions` / `ai_load_suggestions` | Buzones de propuestas de la IA (siempre `pendiente` hasta que el admin resuelve) |
| `training_cycles` | Macro/mesociclos del atleta |
| `athlete_exercise_blacklist` | Lista negra de ejercicios por atleta (el editor de rutinas ya la **lee** para advertir) |
| Vistas `v_athlete_overview`, `v_athlete_prs`, `v_current_training_cycle`, `v_pending_ai_suggestions`, `v_metrics_trend` | Listado enriquecido, récords, mesociclo vigente, bandeja de pendientes, tendencia de peso (esta última la usa la Edge Function) |
| `supabase/functions/generate-weekly-proposals/` | Edge Function que llama a Gemini. **Escrita, no desplegada ni probada contra Supabase.** |

## 5. Lo que falta por construir (en este orden)

| Paso | Qué | Notas |
|---|---|---|
| **8** | **Récords personales** por ejercicio + **mejores repeticiones con cada peso** | Base de la Idea 1. Usa la vista `v_athlete_prs`; visible para el entrenador y el atleta. |
| **9** | **Plan nutricional manual** | El entrenador define kcal y macros por atleta; el atleta los ve. Línea de objetivo en el gráfico de calorías. |
| **10** | **Mesociclos y lista negra** (interfaz) + **crear/editar ejercicios** | Hoy los ejercicios nuevos se agregan desde Table Editor. |
| **11** | **La IA** | Desplegar la Edge Function y sus secrets; botón "Generar propuestas de la semana"; bandeja de aprobación (Aceptar / Editar / Rechazar) para nutrición, cargas y rutinas; **progresión semanal (Idea 1)**; uso del volumen por músculo al proponer rutinas. |
| **12** | **Pulido** | Aviso de "hay versión nueva" en la PWA, recuperar contraseña, respaldos periódicos, pantalla para que el admin corrija un check-in. |

### Idea 1 (registrada, sin construir): progresión semanal de repeticiones
- El entrenador da un **rango de repeticiones**; el atleta anota las que logró con cada peso.
- Según lo logrado (criterio de la IA **y** del entrenador) se define la meta de la semana siguiente (ej.: hizo 6 → intentar 7; al llegar al tope del rango → subir el peso).
- Se guarda cuántas repeticiones se lograron con cada peso, para llevar **marcas personales** y saber con cuánto trabajar cada vez que se use ese ejercicio.
- Conexión: la base son las **mejores repeticiones por peso** (paso 8); la propuesta la genera la IA (paso 11) en `ai_load_suggestions` y el entrenador aprueba; el atleta ve su **meta del día** en "Entrenar" (usará `peso_sugerido_kg` y un objetivo de repeticiones).
- **Decisión pendiente del dueño:** regla exacta (cuántas repeticiones antes de subir el peso, cuánto subir, si cuenta la mejor serie o todas).

## 6. Backlog técnico sugerido (no solicitado aún)

- Reordenar ejercicios y días con flechas (hoy se ordenan por orden de creación).
- Cronómetro de descanso en el entrenamiento.
- Contar días repetidos en la semana para el volumen; objetivos mínimo/máximo de volumen por músculo.
- Modo sin conexión para registrar series en gimnasios con mala señal.
- Indicadores en la lista de atletas (check-in de hoy, propuestas pendientes) usando `v_athlete_overview`.

## 7. Limitaciones conocidas

- **Sin internet no se guarda nada** (la app muestra el error y conserva lo escrito para reintentar).
- Un check-in mal llenado solo lo corrige el entrenador (desde Table Editor).
- Los ejercicios solo se crean desde Table Editor.
- Supabase gratis **pausa el proyecto tras una semana sin actividad** y no incluye copias diarias: hacer respaldos manuales.
- La capa gratuita de Gemini puede usar el contenido enviado para mejorar productos de Google (por eso no se envían identificadores).
- El gráfico reparte las fechas a distancias iguales aunque haya huecos entre mediciones.
- Sin pruebas automáticas ni ESLint.
