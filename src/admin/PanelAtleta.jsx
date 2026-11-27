// =====================================================================
// PanelAtleta — vista general (dashboard) de UN atleta, al abrir su ficha.
//
// Muestra, de un vistazo: avisos de atención y una tarjeta por cada apartado (check-ins,
// rutina, semana, última sesión, peso, nutrición, ciclo, récords, lista negra, volumen).
// Cada tarjeta es un botón: al tocarla la ficha cambia a la pestaña correcta y baja hasta
// esa sección para editarla (`onIr(pestana, seccion)`, lo resuelve DetalleAtleta).
//
// Carga sus propios datos con consultas LIVIANAS (conteos y la fila más reciente), no las
// pantallas completas. Al volver al panel se vuelve a montar y se refresca solo.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TARJETA } from '../lib/estilos'
import { useHoy } from '../lib/useHoy'
import { formatearFechaCorta, inicioSemanaISO } from '../lib/fechas'
import { resumirMediciones } from '../lib/mediciones'
import { cicloVigente, semanaActual, semanasTotales } from '../lib/ciclos'
import { esRecordReciente, textoKg } from '../lib/records'
import { textoEstadoCalorico } from '../lib/opciones'
import {
  alertasAtleta, diasDesdeTimestamp, diasRealizadosSemana, resumenCheckIns, textoHace,
} from '../lib/panelAtleta'

const COLUMNAS_CICLO = 'id, parent_id, nivel, nombre, fecha_inicio, fecha_fin'
const COLUMNAS_PLAN = 'id, calorias_objetivo, proteina_g, carbohidratos_g, grasas_g, objetivo_calorico, vigente_desde'

// Una tarjeta del panel: toda ella es un botón para ir a editar esa sección.
function Tarjeta({ titulo, valor, detalle, destino, onIr }) {
  return (
    <button
      type="button"
      onClick={() => onIr(destino.pestana, destino.seccion)}
      aria-label={`${titulo}: ver y editar`}
      className={`${TARJETA} flex min-h-11 w-full items-start justify-between gap-2 text-left`}
    >
      <span className="min-w-0">
        <span className="block text-sm text-suave">{titulo}</span>
        <span className="block text-xl font-bold leading-tight">{valor}</span>
        {detalle && <span className="mt-0.5 block text-sm text-suave">{detalle}</span>}
      </span>
      <span className="text-xl text-enlace" aria-hidden="true">›</span>
    </button>
  )
}

export default function PanelAtleta({ atletaId, checkIns, onIr }) {
  const hoy = useHoy()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const semana = inicioSemanaISO()

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const res = await Promise.all([
        supabase.from('routines').select('id, nombre, modo_hibrido, routine_days ( id )')
          .eq('user_id', atletaId).eq('estado', 'activa').maybeSingle(),
        supabase.from('routine_day_completions').select('routine_day_id')
          .eq('user_id', atletaId).eq('semana_inicio', semana),
        supabase.from('routine_logs').select('realizado_en')
          .eq('user_id', atletaId).order('realizado_en', { ascending: false }).limit(1),
        supabase.from('metrics')
          .select('fecha, peso_corporal_kg, perimetro_cintura_cm, calorias_consumidas, estado_calorico')
          .eq('user_id', atletaId).order('fecha', { ascending: false }).limit(30),
        supabase.from('nutrition_plans').select(COLUMNAS_PLAN)
          .eq('user_id', atletaId).is('vigente_hasta', null).maybeSingle(),
        supabase.from('training_cycles').select(COLUMNAS_CICLO).eq('user_id', atletaId),
        supabase.from('athlete_exercise_blacklist').select('id', { count: 'exact', head: true }).eq('user_id', atletaId),
        supabase.from('v_athlete_prs').select('exercise_id, fecha_pr').eq('user_id', atletaId),
      ])
      if (cancelado) return
      if (res.some((r) => r.error)) { setError('No se pudo cargar el panel del atleta.'); setCargando(false); return }
      const [rutina, completados, ultima, medidas, plan, ciclos, negra, prs] = res
      setDatos({
        rutina: rutina.data,
        completados: completados.data,
        ultimaSerie: ultima.data?.[0]?.realizado_en ?? null,
        mediciones: medidas.data,
        plan: plan.data,
        ciclos: ciclos.data,
        enListaNegra: negra.count ?? 0,
        records: prs.data,
      })
      setError('')
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [atletaId, semana])

  const chk = resumenCheckIns(checkIns, hoy)

  // ---- Tarjetas que no necesitan consultas (salen de los check-ins ya cargados)
  const tarjetaCheckIn = (
    <Tarjeta
      titulo="Check-ins (7 días)"
      valor={`${chk.en7} de 7`}
      detalle={chk.promedioSueno === null ? 'Sueño promedio: —' : `Sueño promedio: ${chk.promedioSueno.toFixed(1)} h`}
      destino={{ pestana: 'resumen', seccion: 'seccion-checkins' }}
      onIr={onIr}
    />
  )

  if (cargando || error || !datos) {
    return (
      <section id="panel-atleta" className="flex scroll-mt-20 flex-col gap-3" aria-label="Vista general del atleta">
        {cargando && <p className="text-suave">Cargando vista general...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{tarjetaCheckIn}</div>
      </section>
    )
  }

  const { rutina, completados, ultimaSerie, mediciones, plan, ciclos, enListaNegra, records } = datos
  const semanaRut = diasRealizadosSemana(rutina, completados)
  const med = resumirMediciones(mediciones)
  const { macro, meso } = cicloVigente(ciclos, hoy)
  const cicloActual = meso ?? macro
  const nuevos = records.filter((r) => r.fecha_pr && esRecordReciente(r.fecha_pr)).length
  const diasUltima = ultimaSerie ? diasDesdeTimestamp(ultimaSerie, hoy) : null

  const avisos = alertasAtleta({
    hoy, resumenChk: chk, rutinaActiva: rutina, ultimaSerie, plan,
    ultimaMedicionFecha: mediciones[0]?.fecha ?? null,
  })

  const textoDelta = med.delta === null
    ? null
    : med.delta === 0 ? 'Igual que la medición anterior'
    : `${med.delta < 0 ? 'Bajó' : 'Subió'} ${textoKg(Math.abs(med.delta))} kg vs. la anterior`

  return (
    <section id="panel-atleta" className="flex scroll-mt-20 flex-col gap-3" aria-label="Vista general del atleta">
      {avisos.length > 0 && (
        <div className={`${TARJETA} border-alerta`}>
          <h3 className="font-bold text-alerta">Atención</h3>
          <ul className="mt-1 flex flex-col">
            {avisos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onIr(a.pestana, a.seccion)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm"
                >
                  <span>{a.texto}</span>
                  <span className="text-enlace" aria-hidden="true">Revisar ›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tarjetaCheckIn}
        <Tarjeta
          titulo="Rutina activa"
          valor={rutina ? rutina.nombre : 'Sin rutina activa'}
          detalle={rutina
            ? `${rutina.routine_days.length} ${rutina.routine_days.length === 1 ? 'día' : 'días'}${rutina.modo_hibrido ? ' · híbrida' : ''}`
            : 'Crea o activa una'}
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-rutinas' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Esta semana"
          valor={rutina ? `${semanaRut.hechos} de ${semanaRut.total} días` : '—'}
          detalle="Días de la rutina terminados (lun–dom)"
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-cargas' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Último entrenamiento"
          valor={diasUltima === null ? 'Sin registros' : textoHace(diasUltima)}
          detalle={ultimaSerie ? 'Ver entrenamientos recientes' : 'Aún no registra series'}
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-historial' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Peso actual"
          valor={med.pesoActual ? `${textoKg(med.pesoActual.peso_corporal_kg)} kg` : '—'}
          detalle={textoDelta ?? (mediciones.length === 0 ? 'Sin mediciones' : 'Ver mediciones y gráficas')}
          destino={{ pestana: 'cuerpo', seccion: 'seccion-mediciones' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Plan nutricional"
          valor={plan ? `${plan.calorias_objetivo.toLocaleString('es-CO')} kcal` : 'Sin plan vigente'}
          detalle={plan
            ? [
                plan.objetivo_calorico && textoEstadoCalorico(plan.objetivo_calorico),
                plan.proteina_g !== null && `P ${plan.proteina_g} g`,
              ].filter(Boolean).join(' · ') || 'Ver plan'
            : 'Define las calorías y macros'}
          destino={{ pestana: 'cuerpo', seccion: 'seccion-plan' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Ciclo en curso"
          valor={cicloActual ? cicloActual.nombre : 'Sin ciclo en curso'}
          detalle={cicloActual
            ? `Semana ${semanaActual(cicloActual, hoy)} de ${semanasTotales(cicloActual)} · hasta ${formatearFechaCorta(cicloActual.fecha_fin)}`
            : 'Macrociclos y mesociclos'}
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-ciclos' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Récords"
          valor={nuevos > 0 ? `${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'}` : 'Sin récords nuevos'}
          detalle={`${records.length} ${records.length === 1 ? 'ejercicio con marca' : 'ejercicios con marca'} · últimos 14 días`}
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-records' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Volumen semanal"
          valor="Series por músculo"
          detalle="De su rutina activa"
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-volumen' }}
          onIr={onIr}
        />
        <Tarjeta
          titulo="Lista negra"
          valor={`${enListaNegra} ${enListaNegra === 1 ? 'ejercicio' : 'ejercicios'}`}
          detalle="Ejercicios que no debe hacer"
          destino={{ pestana: 'entrenamiento', seccion: 'seccion-listanegra' }}
          onIr={onIr}
        />
      </div>
    </section>
  )
}
