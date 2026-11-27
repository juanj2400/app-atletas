# REQUERIMIENTOS — MyProgress
> Última actualización: 2026-11-27 (paso 31) · Mantener al día según `AGENTS.md`.

## 1. Producto y Roles
PWA privada, mobile-first y solo oscura para un entrenador (`admin`) y 15–30 atletas (`client`). Costo cero (Supabase, Netlify, Gemini AI Studio).
- **Atleta (`client`):** ve su perfil (edita solo nombre), crea 1 check-in diario (inmutable), lee sus mediciones, ve solo su rutina activa, gestiona sus series/cierres/días realizados, lee su plan nutricional, comidas y ciclos.
- **Entrenador (`admin`):** gestión total de atletas (alta, edición, desactivación, contraseñas, fecha nacimiento), mediciones, rutinas, cargas, ciclos, lista negra, plan nutricional, comidas del día y biblioteca de ejercicios.

## 2. Funcionalidades Construidas

### 2.1 Comunes
- Login con redirección por rol (`/atleta` o `/admin`), recuperación de contraseña (`/recuperar` -> correo -> `/restablecer`, mín. 8 chars), rutas protegidas y PWA con aviso de actualización (`AvisoActualizacion`, `registerType: 'prompt'`).

### 2.2 Zona del Atleta (`/atleta`)
Barra inferior con 3 pestañas: **Entrenar**, **Nutrición**, **Mis datos**.
- **Check-in diario (`/atleta`):** obligatorio cada día (bloquea navegación hija y oculta barra hasta completarse; reinicia a las 00:00 local). Campos: calorías de ayer (`cumplio`/`menos`/`mas`), horas sueño, peso corporal opcional (20–400 kg, no afecta `metrics`), ánimo, recuperado. Inmutable tras guardar.
- **Entrenar (`/atleta/entrenar` y `:diaId`):** muestra ciclo vigente (`CicloActual`), lista de días con contador semanal (lunes–domingo) y estado "Realizado ✓" (días realizados se ven en solo lectura con `ResumenDiaRealizado` y se bloquean hasta el lunes). Soporta **rutina híbrida** (bloques halterofilia y musculación). En cada ejercicio: prescripción, "última vez", tarjeta **"Meta de hoy"** si tiene progresión, registro de series con tope estricto (RPE solo si `pide_rpe = true`) y opción de finalizar ejercicio incompleto con nota obligatoria (3–500 chars). Al completar/finalizar todo, *Terminar rutina* marca el día realizado.
- **Nutrición (`/atleta/nutricion`):** muestra (1) "Tus comidas del día" (tarjetas plegables con alimentos, cantidades exactas y notas), (2) objetivo diario vigente (kcal, macros, estado calórico) y (3) promedio de calorías de últimos 7 días vs objetivo.
- **Mis datos (`/atleta/datos`):**
  - *Medidas:* gráficas de tendencia/proyección a 14 días (mín. 3 pesos y 7 días), oscilación del peso, tarjetas resumen, evolución peso + calorías con línea de objetivo e historial.
  - *Récords (`/records`):* ranking top 8 de 1RM, buscador de ejercicios (sin tildes/mayúsculas) y detalle bajo demanda: 1RM estimado (Epley, solo ejercicios no `aislado`) con gráfica por fecha y últimas 8 marcas, evolución de peso máximo y repeticiones por sesión, y mejores reps por peso exacto.

### 2.3 Zona del Entrenador (`/admin`)
- **Lista de atletas (`/admin`):** bloque de **Cumpleaños** (próximos 30 días, 29 feb -> 28 feb en no bisiestos, cumpleaños pasados del mes y atletas sin fecha) + listado de atletas con indicador de acceso desactivado.
- **Gestión de usuarios (`/admin/usuarios`):** vía Edge Function `admin-usuarios`. Crear atleta (generador de contraseña + copiar mensaje WhatsApp), editar nombre/fecha, activar/desactivar acceso (ban en Auth + `profiles.activo = false`) y cambiar contraseña. No permite crear/editar admins ni borrar cuentas.
- **Ficha del atleta (`/admin/atletas/:id`):** cabecera con edad/fecha de nacimiento y 3 pestañas con navegación rápida:
  1. *Resumen (Panel general):* bloque "Atención" (alertas por inactividad en check-in >=2d, sin rutina, sin entrenar >=7d, sin plan nutricional, sin medición >=14d), tarjetas KPI clicables que navegan a cada sección y check-ins recientes.
  2. *Entrenamiento:* rutinas (crear/activar/archivar/copiar), **Cargas y progresión** (ajuste por ejercicio y separado por disciplina en híbridas), **Periodos de la rutina** (historial solo lectura con diffs entre snapshots y actividad real del atleta), ciclos (macro/mesociclos sin solapes), volumen semanal por músculo, lista negra de ejercicios y entrenamientos recientes (incluye cierres con motivo).
  3. *Cuerpo y nutrición:* **Plan nutricional** (versionado al guardar, aviso si macros difieren >10% de kcal), **Comidas del día** (editor en borrador hasta 10 comidas x 30 alimentos, reordenamiento, guardado atómico vía `set_meal_plan` y alerta de cambios sin guardar), mediciones (CRUD 1 por día) y récords.
- **Editor de rutinas (`/admin/rutinas/:rutinaId`):** interruptor modo híbrido, días, ejercicios, descansos rápidos (30s, 1m, 2m, 3m), `pide_rpe`, progresión (`ninguna`, `doble` por rango de reps, `escalera` fuerza simple NxM), alertas de lista negra y volumen en vivo.
- **Biblioteca de ejercicios (`/admin/ejercicios`):** crear/editar ejercicios (`tipo_ejercicio`, video http/https, restringido global) y asignar músculos principales (1.0) / secundarios (0.5).

## 3. Reglas de Negocio Clave
- **Progresión:** Evalúa la mejor serie del peso más alto de la última sesión del ejercicio (historial continuo por `exercise_id`, sobrevive cambios de rutina). En `doble`: sube +1 rep hasta `reps_max`, luego sugiere `+incremento_kg` y reinicia a `reps_min`. En `escalera`: avanza pasos ordenados por reps y luego series; al completar el último sube peso y vuelve al primero.
- **Récords:** Epley `peso * (1 + reps/30)` con `peso > 0`; excluido si `tipo_ejercicio = 'aislado'`.
- **Comidas:** Máx. 10 comidas (nombre 2–40 chars), máx. 30 alimentos/comida (nombre 2–80 chars, cantidad >0..10000 hasta 2 decimales, unidad `g`/`ml`/`unidad`/`porcion`).

## 4. Pendientes y Hoja de Ruta
- **En pausa (dejar para el final) — Paso 11 (IA):** desplegar `generate-weekly-proposals` + secrets Gemini, botón generar propuestas y bandeja de aprobación admin (`ai_load_suggestions`, `ai_nutrition_suggestions`), filtrando `profiles.activo = true`.
- **Pendientes operativos (Paso 12):** configurar SMTP propio en Supabase para recuperación de contraseña, pantalla admin para corregir check-ins erróneos y respaldos periódicos manuales de Supabase.
- **Backlog opcional:** reordenar días/ejercicios en rutinas, enlazar `routines.cycle_id` a mesociclos, cronómetro de descanso, modo offline para series, indicadores en `ListaAtletas` usando `v_athlete_overview`.