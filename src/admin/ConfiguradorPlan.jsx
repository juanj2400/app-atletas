// =====================================================================
// ConfiguradorPlan — formulario inteligente del «Plan nutricional» (paso 36).
//
// El entrenador elige objetivo físico, intensidad y tipo de dieta; con la edad, peso, estatura, sexo
// y actividad del atleta se calculan SOLOS (lib/planNutricional.js, sin IA) el metabolismo basal
// (Mifflin-St Jeor), el gasto, las calorías y los macros. Todo es editable:
//   - Cambiar objetivo / intensidad / dieta / datos físicos / gasto  → se recalculan calorías y macros.
//   - Editar calorías o un macro (en g o en %)                       → los demás se ajustan para que
//     el total siga cuadrando; los macros con «Fijar» no se tocan.
// Lo que se guarda aquí es el ÚNICO objetivo de «Comidas del día» (las comidas se reajustan solas).
// Un plan manual sigue funcionando: sin datos completos no hay cálculo, solo edición directa.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aNumero } from '../lib/numeros'
import { cargarPesoReciente } from '../lib/cargarPesoReciente'
import { edadEnFecha } from '../lib/cumpleanos'
import { useHoy } from '../lib/useHoy'
import { diferenciaMacrosPct } from '../lib/nutricion'
import { ESTADOS_CALORICOS, textoEstadoCalorico } from '../lib/opciones'
import {
  INTENSIDADES, NIVELES_ACTIVIDAD, OBJETIVOS, SEXOS, TIPOS_DIETA,
  calcularPlan, estadoCaloricoDe, kcalDeMacrosG, leerNumeroPlan, porcentajes, reequilibrar,
} from '../lib/planNutricional'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

const MACROS_UI = [
  { clave: 'proteina', etiqueta: 'Proteína' },
  { clave: 'carbohidratos', etiqueta: 'Carbohidratos' },
  { clave: 'grasas', etiqueta: 'Grasas' },
]
const VACIO = { kcal: 0, proteina: 0, carbohidratos: 0, grasas: 0 }
const COLOR_MENSAJE = { error: 'text-alerta', ok: 'text-enlace' }

const numeroONull = (texto) => {
  const n = aNumero(texto)
  return n === null || Number.isNaN(n) ? null : n
}
const formato = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

// Campo numérico que deja escribir libremente mientras tiene el foco (el valor "oficial" del
// padre solo se muestra cuando no se está editando), y avisa en cada cambio válido.
function CampoNumero({ id, etiqueta, valor, onValor, ayuda, className = '' }) {
  const [texto, setTexto] = useState(null) // null = sin foco
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs text-suave">{etiqueta}</label>
      <input
        id={id}
        inputMode="decimal"
        value={texto ?? String(valor)}
        onFocus={() => setTexto(String(valor))}
        onBlur={() => setTexto(null)}
        onChange={(e) => {
          setTexto(e.target.value)
          const n = numeroONull(e.target.value)
          if (n !== null) onValor(n)
        }}
        className={CAMPO}
      />
      {ayuda && <p className="text-xs text-suave">{ayuda}</p>}
    </div>
  )
}

// Fila de botones tipo "pastilla" (una sola opción activa).
function Opciones({ titulo, lista, valor, onElegir }) {
  return (
    <div>
      <p className="text-sm text-suave">{titulo}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {lista.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={valor === o.valor}
            onClick={() => onElegir(o.valor)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${
              valor === o.valor ? 'border-primario bg-primario text-white' : 'border-borde'
            }`}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {lista.find((o) => o.valor === valor)?.descripcion && (
        <p className="mt-1 text-xs text-suave">{lista.find((o) => o.valor === valor).descripcion}</p>
      )}
    </div>
  )
}

export default function ConfiguradorPlan({ atletaId, fechaNacimiento, activo, perfil, onGuardado }) {
  const hoy = useHoy()
  const edad = fechaNacimiento ? edadEnFecha(fechaNacimiento, hoy) : null

  // Datos físicos y configuración (texto/valores de los controles)
  const [datos, setDatos] = useState(() => ({
    sexo: perfil?.sexo ?? '',
    estatura: perfil?.estatura_cm != null ? String(perfil.estatura_cm) : '',
    actividad: perfil?.nivel_actividad ?? '',
    peso: activo?.peso_base_kg != null ? String(activo.peso_base_kg) : '',
  }))
  const [config, setConfig] = useState(() => ({
    objetivo: activo?.objetivo_fisico ?? '',
    intensidad: activo?.intensidad ?? '',
    dieta: activo?.tipo_dieta ?? '',
  }))
  // Gasto ajustado a mano: '' = usar el estimado
  const [gastoTexto, setGastoTexto] = useState('')
  const [valores, setValores] = useState(() => (activo
    ? { kcal: activo.calorias_objetivo, proteina: activo.proteina_g ?? 0, carbohidratos: activo.carbohidratos_g ?? 0, grasas: activo.grasas_g ?? 0 }
    : VACIO))
  const [bloqueados, setBloqueados] = useState([])
  const [estadoManual, setEstadoManual] = useState(activo?.objetivo_calorico ?? '')
  const [notas, setNotas] = useState('')
  const [avisosEdicion, setAvisosEdicion] = useState([])
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [pesoSugerido, setPesoSugerido] = useState(null)

  // Entradas del cálculo según lo que hay en pantalla
  const argumentos = (d = datos, c = config, g = gastoTexto) => ({
    sexo: d.sexo, edad, pesoKg: numeroONull(d.peso), estaturaCm: numeroONull(d.estatura), nivelActividad: d.actividad,
    objetivo: c.objetivo, intensidad: c.intensidad, dieta: c.dieta,
    gastoManual: g.trim() === '' ? null : numeroONull(g),
  })
  const calculo = calcularPlan(argumentos())
  const completo = !calculo.error

  // Si el plan guardado usó un gasto distinto del estimado, se muestra como gasto ajustado a mano.
  useEffect(() => {
    if (activo?.gasto_kcal == null) return
    const estimado = calcularPlan({ ...argumentos(), gastoManual: null })
    if (!estimado.error && estimado.gasto !== activo.gasto_kcal) setGastoTexto(String(activo.gasto_kcal))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar con el plan guardado
  }, [])

  // Peso: si el plan no trae uno, se sugiere el más reciente del atleta (medición o check-in).
  useEffect(() => {
    if (datos.peso !== '') return
    let cancelado = false
    cargarPesoReciente(atletaId).then((r) => {
      if (cancelado || r.error || r.peso == null) return
      setPesoSugerido(r)
      setDatos((d) => (d.peso === '' ? { ...d, peso: String(r.peso) } : d))
    })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [])

  // Aplica un cálculo nuevo a los valores en pantalla (reinicia fijados y avisos de edición).
  function aplicarCalculo(extra = {}) {
    const resultado = calcularPlan(argumentos(extra.datos ?? datos, extra.config ?? config, extra.gasto ?? gastoTexto))
    if (resultado.error) return false
    setValores({ kcal: resultado.kcal, proteina: resultado.proteina, carbohidratos: resultado.carbohidratos, grasas: resultado.grasas })
    setBloqueados([])
    setAvisosEdicion([])
    return true
  }

  // Cambios de objetivo/intensidad/dieta/datos/gasto: actualizan el control y, si ya hay todo, recalculan.
  const cambiarConfig = (campo, valor) => {
    const nueva = { ...config, [campo]: valor }
    setConfig(nueva); setMensaje(null)
    aplicarCalculo({ config: nueva })
  }
  const cambiarDatos = (campo, valor) => {
    const nuevos = { ...datos, [campo]: valor }
    setDatos(nuevos); setMensaje(null)
    aplicarCalculo({ datos: nuevos })
  }
  const cambiarGasto = (texto) => {
    setGastoTexto(texto); setMensaje(null)
    aplicarCalculo({ gasto: texto })
  }

  // Edición directa de calorías o macros: los demás se reequilibran.
  const editar = (campo, valor, unidad = 'g') => {
    const r = reequilibrar(valores, { campo, valor, unidad }, bloqueados)
    setValores(r.estado)
    setAvisosEdicion(r.avisos)
    setMensaje(null)
  }
  const alternarBloqueo = (clave) =>
    setBloqueados((b) => (b.includes(clave) ? b.filter((x) => x !== clave) : [...b, clave]))

  const pct = porcentajes(valores)
  const pesoKg = numeroONull(datos.peso)
  const sumaMacros = kcalDeMacrosG(valores)
  const diferencia = valores.kcal > 0 && sumaMacros > 0
    ? diferenciaMacrosPct(valores.kcal, valores.proteina, valores.carbohidratos, valores.grasas)
    : null
  // Con configuración completa el estado calórico sale de comparar calorías y gasto.
  const estadoAuto = completo ? estadoCaloricoDe(valores.kcal, calculo.gasto) : ''

  async function guardar(evento) {
    evento.preventDefault()
    setMensaje(null)
    const error = (texto) => setMensaje({ tipo: 'error', texto })

    const k = leerNumeroPlan(String(valores.kcal), 'las calorías objetivo')
    if (k.error) return error(k.error)
    if (k.valor < 500 || k.valor > 10000) return error('Las calorías deben ser un número entero entre 500 y 10.000.')
    for (const m of MACROS_UI) {
      const r = leerNumeroPlan(String(valores[m.clave]), `${m.etiqueta.toLowerCase()} (g)`, { maximo: 1000 })
      if (r.error) return error(r.error)
    }

    const carga = {
      p_user_id: atletaId,
      p_calorias: k.valor,
      p_proteina_g: valores.proteina,
      p_carbohidratos_g: valores.carbohidratos,
      p_grasas_g: valores.grasas,
      p_objetivo: (completo ? estadoAuto : estadoManual) || null,
      p_notas: notas.trim() || null,
    }
    // Configuración: todo o nada (la base de datos lo exige con un CHECK)
    if (completo) {
      Object.assign(carga, {
        p_objetivo_fisico: config.objetivo,
        p_intensidad: config.intensidad,
        p_tipo_dieta: config.dieta,
        p_tmb: calculo.tmb,
        p_gasto: calculo.gasto,
        p_peso_base: numeroONull(datos.peso),
      })
    }
    // Datos físicos del atleta (se guardan en su perfil): solo si son válidos
    const estatura = numeroONull(datos.estatura)
    if (datos.sexo) carga.p_sexo = datos.sexo
    if (estatura !== null && estatura >= 100 && estatura <= 250) carga.p_estatura_cm = estatura
    if (datos.actividad) carga.p_nivel_actividad = datos.actividad

    setGuardando(true)
    const { error: errorBD } = await supabase.rpc('set_nutrition_plan', carga)
    setGuardando(false)
    if (errorBD) {
      // P0001 = mensaje que escribimos nosotros en la función (ya viene en español).
      return error(errorBD.code === 'P0001' ? errorBD.message : 'No se pudo guardar el plan. Inténtalo de nuevo.')
    }
    setNotas('')
    setMensaje({ tipo: 'ok', texto: 'Plan guardado. El atleta ya lo ve y «Comidas del día» se reajusta a este plan.' })
    onGuardado?.()
  }

  return (
    <form onSubmit={guardar} className={`${TARJETA} flex flex-col gap-4`}>
      <div>
        <h4 className="font-semibold">{activo ? 'Cambiar plan' : 'Definir plan'}</h4>
        <p className="text-sm text-suave">
          Elige el objetivo y el sistema calcula calorías y macros con los datos del atleta. Puedes editar cualquier valor.
        </p>
      </div>

      {/* 1. Datos del atleta */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">1. Datos del atleta</legend>
        <p className="text-sm">
          Edad:{' '}
          {edad === null
            ? <span className="text-alerta">falta la fecha de nacimiento (agrégala en la cabecera de la ficha)</span>
            : <span className="font-bold">{edad} años</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="cfg-sexo" className="text-xs text-suave">Sexo</label>
            <select id="cfg-sexo" value={datos.sexo} onChange={(e) => cambiarDatos('sexo', e.target.value)} className={CAMPO}>
              <option value="">Elige...</option>
              {SEXOS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cfg-actividad" className="text-xs text-suave">Actividad física</label>
            <select id="cfg-actividad" value={datos.actividad} onChange={(e) => cambiarDatos('actividad', e.target.value)} className={CAMPO}>
              <option value="">Elige...</option>
              {NIVELES_ACTIVIDAD.map((n) => <option key={n.valor} value={n.valor}>{n.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cfg-peso" className="text-xs text-suave">Peso (kg)</label>
            <input id="cfg-peso" inputMode="decimal" value={datos.peso} onChange={(e) => cambiarDatos('peso', e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="cfg-estatura" className="text-xs text-suave">Estatura (cm)</label>
            <input id="cfg-estatura" inputMode="decimal" value={datos.estatura} onChange={(e) => cambiarDatos('estatura', e.target.value)} className={CAMPO} />
          </div>
        </div>
        {pesoSugerido && datos.peso === String(pesoSugerido.peso) && (
          <p className="text-xs text-suave">
            Peso tomado de {pesoSugerido.origen === 'oficial' ? 'la última medición' : 'el último check-in'}; cámbialo si no es el actual.
          </p>
        )}
        {datos.actividad && (
          <p className="text-xs text-suave">{NIVELES_ACTIVIDAD.find((n) => n.valor === datos.actividad)?.descripcion}</p>
        )}
      </fieldset>

      {/* 2. Objetivo */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">2. Objetivo</legend>
        <Opciones titulo="Objetivo físico" lista={OBJETIVOS} valor={config.objetivo} onElegir={(v) => cambiarConfig('objetivo', v)} />
        <Opciones titulo="Intensidad" lista={INTENSIDADES} valor={config.intensidad} onElegir={(v) => cambiarConfig('intensidad', v)} />
        <Opciones titulo="Tipo de dieta" lista={TIPOS_DIETA} valor={config.dieta} onElegir={(v) => cambiarConfig('dieta', v)} />
      </fieldset>

      {/* 3. Resultado del cálculo */}
      {completo ? (
        <div className="rounded-xl bg-hundido p-3 text-sm">
          <p>
            Metabolismo basal (Mifflin-St Jeor): <span className="font-bold">{formato(calculo.tmb)} kcal</span>
          </p>
          <p>
            Gasto estimado (× {String(calculo.factor).replace('.', ',')}): <span className="font-bold">{formato(Math.round(calculo.tmb * calculo.factor))} kcal</span>
          </p>
          <p>
            Ajuste: <span className="font-bold">{calculo.ajustePct > 0 ? '+' : ''}{Math.round(calculo.ajustePct * 100)} %</span>
            {' '}sobre un gasto de {formato(calculo.gasto)} kcal
          </p>
          <div className="mt-2">
            <label htmlFor="cfg-gasto" className="text-xs text-suave">Gasto energético (vacío = el estimado)</label>
            <input id="cfg-gasto" inputMode="numeric" value={gastoTexto} placeholder={String(Math.round(calculo.tmb * calculo.factor))}
              onChange={(e) => cambiarGasto(e.target.value)} className={CAMPO} />
          </div>
          <p className="mt-2 text-xs text-suave">
            Estimación con ecuaciones poblacionales: en atletas puede desviarse. Ajusta el gasto con la evolución real del peso.
          </p>
        </div>
      ) : (
        <p role="status" className="text-sm text-suave">Para calcular automático: {calculo.error} Mientras tanto puedes escribir calorías y macros a mano.</p>
      )}
      {completo && calculo.avisos.length > 0 && (
        <ul role="status" className="list-disc pl-5 text-sm text-alerta">
          {calculo.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}

      {/* 4. Calorías y macros editables */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">3. Calorías y macros (editables)</legend>
        <CampoNumero id="cfg-kcal" etiqueta="Calorías objetivo (por día)" valor={valores.kcal} onValor={(n) => editar('kcal', n)}
          ayuda="Al cambiarlas, los macros no fijados se reparten para cuadrar." />
        <div className="flex flex-col gap-2">
          {MACROS_UI.map((m) => (
            <div key={m.clave} className="rounded-xl bg-hundido p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{m.etiqueta}</p>
                <label className="flex min-h-11 items-center gap-2 text-xs">
                  <input type="checkbox" checked={bloqueados.includes(m.clave)} onChange={() => alternarBloqueo(m.clave)} />
                  Fijar
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CampoNumero id={`cfg-${m.clave}-g`} etiqueta="Gramos" valor={valores[m.clave]} onValor={(n) => editar(m.clave, n, 'g')} />
                <CampoNumero id={`cfg-${m.clave}-pct`} etiqueta="% de las calorías" valor={pct[m.clave]} onValor={(n) => editar(m.clave, n, 'pct')} />
              </div>
              {pesoKg !== null && pesoKg > 0 && (
                <p className="text-xs text-suave">{formato(Math.round((valores[m.clave] / pesoKg) * 100) / 100)} g por kg de peso</p>
              )}
            </div>
          ))}
        </div>
        {avisosEdicion.length > 0 && (
          <ul role="status" className="list-disc pl-5 text-sm text-alerta">
            {avisosEdicion.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
        {sumaMacros > 0 && (
          <p className={`text-sm ${diferencia !== null && Math.abs(diferencia) > 10 ? 'text-alerta' : 'text-suave'}`}>
            Los macros suman {formato(sumaMacros)} kcal
            {diferencia !== null && (Math.abs(diferencia) > 10
              ? ` (${diferencia > 0 ? '+' : ''}${diferencia} % respecto al objetivo: revisa los números).`
              : ' (coherente con el objetivo).')}
          </p>
        )}
        {completo && (
          <button type="button" onClick={() => aplicarCalculo()} className={BOTON_SEC}>Restablecer a lo calculado</button>
        )}
      </fieldset>

      {/* Estado calórico: automático si hay configuración completa; manual si no */}
      {completo ? (
        <p className="text-sm">
          Estado calórico: <span className="font-bold">{textoEstadoCalorico(estadoAuto)}</span>
          <span className="text-suave"> (según las calorías frente al gasto)</span>
        </p>
      ) : (
        <div>
          <label htmlFor="cfg-estado" className="text-sm text-suave">Estado calórico (opcional)</label>
          <select id="cfg-estado" value={estadoManual} onChange={(e) => setEstadoManual(e.target.value)} className={CAMPO}>
            <option value="">Sin definir</option>
            {ESTADOS_CALORICOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="cfg-notas" className="text-sm text-suave">Notas para el atleta (opcional)</label>
        <textarea id="cfg-notas" rows={2} maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)}
          className="w-full rounded-xl border border-[#5B6372] bg-fondo p-3" />
      </div>

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={COLOR_MENSAJE[mensaje.tipo]}>{mensaje.texto}</p>
      )}
      <p className="text-xs text-suave">
        Al guardar, el plan actual pasa al historial, el atleta ve el nuevo al instante y «Comidas del día» se reajusta a estas calorías y macros.
      </p>
      <button type="submit" disabled={guardando} className={BOTON}>
        {guardando ? 'Guardando...' : 'Guardar nuevo plan'}
      </button>
    </form>
  )
}
