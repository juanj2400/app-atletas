// =====================================================================
// PlanComidas — el entrenador arma las COMIDAS DEL DÍA de UN atleta (creador de dieta).
//
// Cada comida (desayuno, almuerzo, cena, snacks...) lleva sus alimentos con la cantidad exacta.
// Los alimentos pueden ser:
//   - del CATÁLOGO (/admin/alimentos): llevan estado (crudo/cocido), se miden en gramos y traen
//     macros. Sus gramos se calculan SOLOS (lib/dieta.js, sin IA) para cumplir el objetivo del
//     PLAN NUTRICIONAL vigente, que es la única referencia (no hay calculadora independiente).
//     Si el entrenador escribe los gramos de un alimento, queda "fijado" y el resto se ajusta.
//   - MANUALES (como antes): nombre libre y cualquier unidad, sin macros.
// El atleta lo ve en su pestaña Nutrición.
//
// Cómo funciona el guardado:
//   - Se EDITA un borrador en pantalla (estado local) y se guarda TODO junto con el botón
//     "Guardar comidas": la función de la base de datos `set_meal_plan` (migraciones 23 y 25)
//     reemplaza el menú completo en una sola operación (todo o nada) y guarda un SNAPSHOT de
//     los macros por 100 g y de los macros asignados a los gramos exactos.
//   - Al abrir NO se modifica el menú guardado (solo se avisa si se desvía del plan). Con el ajuste
//     automático activo, cada cambio estructural o del plan reajusta los gramos en el borrador;
//     nada se guarda hasta pulsar "Guardar comidas".
//   - Antes de enviar se valida en la pantalla (lib/comidas.js); la base de datos valida otra vez.
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cargarComidas } from '../lib/cargarComidas'
import { buscarVariante } from '../lib/buscarAlimentos'
import {
  COMIDAS_SUGERIDAS, MAX_ALIMENTOS, MAX_COMIDAS, UNIDADES,
  aBorrador, aPayload, alimentoNuevo, aplicarAlimentoCatalogo, comidaNueva, filaDeCatalogo,
  huellaBorrador, moverComida, resumenComidas, ultimaActualizacion, validarComidas,
} from '../lib/comidas'
import { MACROS, ajustarAlPlan, esDeCatalogo, macrosDeFila, objetivoDePlan, rolDeFila, totalesComida } from '../lib/dieta'
import { usePlanVigente } from '../lib/usePlanVigente'
import { TEXTO_MACRO, textoEstado } from '../lib/alimentos'
import { fechaCortaDeTimestamp } from '../lib/records'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
import BuscadorAlimentos from './BuscadorAlimentos'
import ObjetivoDieta from './ObjetivoDieta'

const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

// Un alimento dentro de una comida. Si es del catálogo: nombre fijo + estado, gramos, rol,
// "fijar gramos", macros en vivo y botones de intercambio. Si es manual: como siempre.
function FilaAlimento({ alimento: a, numero: n, nombreComida, onCambiar, onQuitar, onIntercambiar }) {
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const catalogo = esDeCatalogo(a)
  const macros = macrosDeFila(a)
  const rol = rolDeFila(a)
  const otroEstado = a.estado === 'crudo' ? 'cocido' : a.estado === 'cocido' ? 'crudo' : null

  async function pasarAOtroEstado() {
    setAviso('')
    setCambiandoEstado(true)
    const { alimento, error } = await buscarVariante(a.alimento, otroEstado)
    setCambiandoEstado(false)
    if (error) return setAviso(error)
    if (!alimento) return setAviso(`No hay «${a.alimento}» en estado ${otroEstado} en el catálogo. Agrégalo en el catálogo o usa «Cambiar alimento».`)
    onIntercambiar(alimento)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-hundido p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Alimento {n}{catalogo ? ' · catálogo' : ' · manual'}</span>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar el alimento ${n} de ${nombreComida || 'la comida'}`}
          className="min-h-11 px-2 text-sm font-semibold text-alerta"
        >
          Quitar
        </button>
      </div>

      {catalogo ? (
        <div>
          <p className="font-semibold">
            {a.alimento} <span className="text-sm font-normal text-enlace">· {textoEstado(a.estado)}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" onClick={() => setBuscando((b) => !b)} className={BOTON_SEC}>Cambiar alimento</button>
            {otroEstado && (
              <button type="button" onClick={pasarAOtroEstado} disabled={cambiandoEstado} className={BOTON_SEC}>
                {cambiandoEstado ? 'Buscando...' : `Pasar a ${otroEstado}`}
              </button>
            )}
          </div>
          {aviso && <p role="alert" className="mt-1 text-sm text-alerta">{aviso}</p>}
          {buscando && (
            <div className="mt-2">
              <BuscadorAlimentos
                titulo="Cambiar por otro alimento"
                textoBoton="Usar este"
                onCerrar={() => setBuscando(false)}
                onElegir={(alimento) => { onIntercambiar(alimento); setBuscando(false) }}
              />
            </div>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor={`${a.clave}-alimento`} className="text-xs text-suave">Alimento</label>
          <input id={`${a.clave}-alimento`} value={a.alimento} maxLength={80}
            onChange={(e) => onCambiar('alimento', e.target.value)}
            placeholder="Ej: Arroz blanco cocido" className={CAMPO} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${a.clave}-cantidad`} className="text-xs text-suave">{catalogo ? 'Gramos' : 'Cantidad'}</label>
          <input id={`${a.clave}-cantidad`} inputMode="decimal" value={a.cantidad}
            onChange={(e) => onCambiar('cantidad', e.target.value)}
            placeholder="Ej: 150" className={CAMPO} />
        </div>
        <div>
          <label htmlFor={`${a.clave}-unidad`} className="text-xs text-suave">Unidad</label>
          {catalogo ? (
            // Los macros del catálogo son por 100 g: la unidad no se puede cambiar.
            <p id={`${a.clave}-unidad`} className="flex min-h-11 items-center px-1 text-sm text-suave">Gramos (g)</p>
          ) : (
            <select id={`${a.clave}-unidad`} value={a.unidad}
              onChange={(e) => onCambiar('unidad', e.target.value)} className={CAMPO}>
              {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.etiqueta}</option>)}
            </select>
          )}
        </div>
      </div>

      {catalogo && (
        <>
          {/* Macros de estos gramos, en vivo */}
          <p className="text-sm">
            <span className="font-bold">{numero(macros.calorias)} kcal</span>
            <span className="text-suave"> · P {numero(macros.proteina)} · C {numero(macros.carbohidratos)} · G {numero(macros.grasas)} g</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${a.clave}-rol`} className="text-xs text-suave">Cubre (para el cálculo)</label>
              <select id={`${a.clave}-rol`} value={a.rol} onChange={(e) => onCambiar('rol', e.target.value)} className={CAMPO}>
                <option value="">Auto ({rol ? TEXTO_MACRO[rol] : 'sin macros'})</option>
                {MACROS.map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}
              </select>
            </div>
            <label className="flex min-h-11 items-end gap-2 pb-3 text-sm">
              <input type="checkbox" checked={a.fijo} onChange={(e) => onCambiar('fijo', e.target.checked)} />
              Fijar gramos
            </label>
          </div>
          <p className="text-xs text-suave">
            {a.fijo
              ? 'Gramos fijados: el ajuste automático no los cambia y calcula el resto alrededor.'
              : 'Los gramos los calcula el plan nutricional. Si los escribes tú, quedan fijados.'}
          </p>
        </>
      )}

      <div>
        <label htmlFor={`${a.clave}-nota`} className="text-xs text-suave">Nota (opcional)</label>
        <input id={`${a.clave}-nota`} value={a.nota} maxLength={120}
          onChange={(e) => onCambiar('nota', e.target.value)}
          placeholder="Ej: sin sal, a la plancha" className={CAMPO} />
      </div>
    </div>
  )
}

// Una comida: nombre, orden (subir/bajar), sus alimentos, total en vivo y acciones.
function TarjetaComida({
  comida, indice, total, onCambiar, onMover, onQuitar,
  onAgregarAlimento, onAgregarDelCatalogo, onCambiarAlimento, onQuitarAlimento, onIntercambiarAlimento,
}) {
  const [buscando, setBuscando] = useState(false)
  const nombre = comida.nombre.trim()
  const totales = totalesComida(comida)
  const lleno = comida.alimentos.length >= MAX_ALIMENTOS
  return (
    <div className={`${TARJETA} flex flex-col gap-3`}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${comida.clave}-nombre`} className="text-xs text-suave">
            Comida {indice + 1} · nombre
          </label>
          <input id={`${comida.clave}-nombre`} value={comida.nombre} maxLength={40}
            onChange={(e) => onCambiar('nombre', e.target.value)}
            placeholder="Ej: Desayuno" className={CAMPO} />
        </div>
        <button type="button" onClick={() => onMover(-1)} disabled={indice === 0}
          aria-label={`Subir ${nombre || `la comida ${indice + 1}`}`}
          className="min-h-11 min-w-11 rounded-xl border border-borde font-semibold disabled:opacity-40">↑</button>
        <button type="button" onClick={() => onMover(1)} disabled={indice === total - 1}
          aria-label={`Bajar ${nombre || `la comida ${indice + 1}`}`}
          className="min-h-11 min-w-11 rounded-xl border border-borde font-semibold disabled:opacity-40">↓</button>
      </div>

      <div>
        <label htmlFor={`${comida.clave}-notas`} className="text-xs text-suave">Notas de la comida (opcional)</label>
        <input id={`${comida.clave}-notas`} value={comida.notas} maxLength={200}
          onChange={(e) => onCambiar('notas', e.target.value)}
          placeholder="Ej: 1 hora antes de entrenar" className={CAMPO} />
      </div>

      {comida.alimentos.length === 0 && (
        <p className="text-sm text-suave">Esta comida aún no tiene alimentos.</p>
      )}
      {comida.alimentos.map((a, j) => (
        <FilaAlimento
          key={a.clave}
          alimento={a}
          numero={j + 1}
          nombreComida={nombre}
          onCambiar={(campo, valor) => onCambiarAlimento(a.clave, campo, valor)}
          onQuitar={() => onQuitarAlimento(a.clave)}
          onIntercambiar={(alimento) => onIntercambiarAlimento(a.clave, alimento)}
        />
      ))}

      {/* Total de la comida, en vivo */}
      {comida.alimentos.length > 0 && (
        <p className="rounded-xl bg-hundido p-3 text-sm">
          <span className="font-semibold">Total de la comida: </span>
          <span className="font-bold">{numero(totales.calorias)} kcal</span>
          <span className="text-suave"> · P {numero(totales.proteina)} · C {numero(totales.carbohidratos)} · G {numero(totales.grasas)} g</span>
          {totales.sinMacros > 0 && (
            <span className="block text-xs text-suave">
              {totales.sinMacros} {totales.sinMacros === 1 ? 'alimento manual no suma' : 'alimentos manuales no suman'}.
            </span>
          )}
        </p>
      )}

      {buscando && (
        <BuscadorAlimentos
          titulo="Agregar del catálogo"
          textoBoton="Agregar"
          onCerrar={() => setBuscando(false)}
          // El buscador queda abierto para sumar varios alimentos seguidos
          onElegir={(alimento) => onAgregarDelCatalogo(alimento)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setBuscando((b) => !b)} disabled={lleno} className={BOTON_SEC}>
            + Del catálogo
          </button>
          <button type="button" onClick={onAgregarAlimento} disabled={lleno} className={BOTON_SEC}>
            + Manual
          </button>
        </div>
        <button type="button" onClick={onQuitar} className={`${BOTON_SEC} text-alerta`}>
          Quitar comida
        </button>
      </div>
    </div>
  )
}

export default function PlanComidas({ atletaId, versionPlan = 0, onCambiosSinGuardar }) {
  const [borrador, setBorrador] = useState([])
  const [huellaGuardada, setHuellaGuardada] = useState(huellaBorrador([]))
  const [actualizado, setActualizado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [auto, setAuto] = useState(true)
  const [paso, setPaso] = useState(1)
  const [avisos, setAvisos] = useState([])
  const { plan, cargando: cargandoPlan, error: errorPlan } = usePlanVigente(atletaId, versionPlan)

  useEffect(() => {
    let cancelado = false
    cargarComidas(atletaId).then(({ comidas, error }) => {
      if (cancelado) return
      if (error) setErrorCarga(error)
      else {
        const inicial = aBorrador(comidas)
        setBorrador(inicial)
        setHuellaGuardada(huellaBorrador(inicial))
        setActualizado(ultimaActualizacion(comidas))
        setErrorCarga('')
        setAvisos([])
      }
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [atletaId, version])

  // ¿Hay cambios sin guardar? Se compara el contenido con el del último guardado (así, si
  // el entrenador deshace un cambio a mano, el aviso desaparece solo).
  const sucio = huellaBorrador(borrador) !== huellaGuardada

  // Avisa a la ficha (para que pregunte antes de cambiar de pestaña) y al navegador (cerrar o
  // recargar la página). Al desmontarse, se limpia el aviso.
  useEffect(() => {
    onCambiosSinGuardar?.(sucio)
    return () => onCambiosSinGuardar?.(false)
  }, [sucio, onCambiosSinGuardar])

  useEffect(() => {
    if (!sucio) return
    const avisar = (evento) => { evento.preventDefault(); evento.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  // Todo cambio al borrador pasa por `aplicar`: recibe el borrador NUEVO ya construido (copia, nunca
  // se muta). Si `reajustar` es true, los gramos de los alimentos no fijados se recalculan con el
  // plan nutricional vigente antes de guardarlo en pantalla.
  function aplicar(nuevo, reajustar, pasoUsado = paso) {
    setMensaje(null)
    if (!reajustar) return setBorrador(nuevo)
    const r = ajustarAlPlan({ comidas: nuevo, plan, paso: pasoUsado })
    setBorrador(r.comidas)
    setAvisos(r.avisos)
  }
  // Cambio de texto (nombre, notas, orden): no toca los gramos.
  const cambiar = (nuevo) => aplicar(nuevo, false)
  // Cambio que afecta al reparto (alimentos, roles, pesos): reajusta si el ajuste automático está activo.
  const cambiarYAjustar = (nuevo) => aplicar(nuevo, auto)

  // Si el plan nutricional cambia (el entrenador lo guardó arriba), las comidas se reajustan solas.
  // La primera lectura NO cuenta: abrir la ficha nunca modifica el menú guardado.
  const objetivoPlan = objetivoDePlan(plan)
  const claveObjetivo = objetivoPlan ? JSON.stringify(objetivoPlan) : ''
  const claveAnterior = useRef(null)
  useEffect(() => { claveAnterior.current = null }, [atletaId])
  useEffect(() => {
    if (cargandoPlan) return
    if (claveAnterior.current === null) { claveAnterior.current = claveObjetivo; return }
    if (claveAnterior.current === claveObjetivo) return
    claveAnterior.current = claveObjetivo
    if (auto && claveObjetivo && !cargando && !errorCarga) aplicar(borrador, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a un cambio del plan
  }, [claveObjetivo, cargandoPlan])

  const agregarComida = (nombre) =>
    // Empieza con una fila de alimento vacía para que escribir sea inmediato.
    cambiar([...borrador, { ...comidaNueva(nombre), alimentos: [alimentoNuevo()] }])

  const cambiarComida = (clave, campo, valor) =>
    cambiar(borrador.map((c) => (c.clave === clave ? { ...c, [campo]: valor } : c)))

  const cambiarPesoComida = (clave, valor) =>
    cambiarYAjustar(borrador.map((c) => (c.clave === clave ? { ...c, peso: valor } : c)))

  const quitarComida = (comida) => {
    if (comida.alimentos.length > 0 && !window.confirm(`¿Quitar «${comida.nombre.trim() || 'esta comida'}» con sus alimentos? (Se aplica al guardar.)`)) return
    cambiarYAjustar(borrador.filter((c) => c.clave !== comida.clave))
  }

  const agregarAlimento = (clave) =>
    cambiar(borrador.map((c) => {
      if (c.clave !== clave || c.alimentos.length >= MAX_ALIMENTOS) return c
      // La unidad del alimento anterior se repite: suele ser la misma (gramos, gramos...).
      return { ...c, alimentos: [...c.alimentos, alimentoNuevo(c.alimentos.at(-1)?.unidad)] }
    }))

  // Agrega un alimento del catálogo a la comida; sus gramos los calcula el plan (si hay ajuste automático).
  // Si la comida solo tiene la fila vacía inicial, la reemplaza en vez de dejarla sobrando.
  const agregarDelCatalogo = (clave, alimento) =>
    cambiarYAjustar(borrador.map((c) => {
      if (c.clave !== clave) return c
      const vacia = (a) => !a.base && a.alimento.trim() === '' && a.cantidad.trim() === '' && a.nota.trim() === ''
      const base = c.alimentos.length === 1 && vacia(c.alimentos[0]) ? [] : c.alimentos
      if (base.length >= MAX_ALIMENTOS) return c
      return { ...c, alimentos: [...base, filaDeCatalogo(alimento)] }
    }))

  // INTERCAMBIO: la misma fila pasa a otro alimento del catálogo; los gramos se recalculan
  // (el alimento nuevo tiene otros macros), salvo que la fila esté fijada.
  const intercambiarAlimento = (claveComida, claveAlimento, alimento) =>
    cambiarYAjustar(borrador.map((c) => (c.clave !== claveComida ? c : {
      ...c,
      alimentos: c.alimentos.map((a) => (a.clave === claveAlimento ? aplicarAlimentoCatalogo(a, alimento) : a)),
    })))

  const cambiarAlimento = (claveComida, claveAlimento, campo, valor) => {
    const nuevo = borrador.map((c) => (c.clave !== claveComida ? c : {
      ...c,
      alimentos: c.alimentos.map((a) => {
        if (a.clave !== claveAlimento) return a
        // Escribir los gramos de un alimento del catálogo lo FIJA: el resto se ajusta a su alrededor.
        if (campo === 'cantidad' && esDeCatalogo(a)) return { ...a, cantidad: valor, fijo: true }
        return { ...a, [campo]: valor }
      }),
    }))
    // Rol y fijo cambian el reparto; los gramos escritos también (los demás se reajustan).
    const afectaReparto = campo === 'rol' || campo === 'fijo' || campo === 'cantidad'
    if (afectaReparto) cambiarYAjustar(nuevo)
    else cambiar(nuevo)
  }

  const quitarAlimento = (claveComida, claveAlimento) =>
    cambiarYAjustar(borrador.map((c) => (c.clave !== claveComida ? c : {
      ...c, alimentos: c.alimentos.filter((a) => a.clave !== claveAlimento),
    })))

  const cambiarAuto = (valor) => {
    setAuto(valor)
    if (valor) aplicar(borrador, true) // al encenderlo se reajusta de inmediato
  }
  const cambiarPaso = (valor) => {
    setPaso(valor)
    if (auto) aplicar(borrador, true, valor)
  }
  const liberarFijados = () =>
    aplicar(borrador.map((c) => ({ ...c, alimentos: c.alimentos.map((a) => (a.fijo ? { ...a, fijo: false } : a)) })), true)

  async function guardar() {
    setMensaje(null)
    const problema = validarComidas(borrador)
    if (problema) return setMensaje({ tipo: 'error', texto: problema })

    setGuardando(true)
    const { error } = await supabase.rpc('set_meal_plan', {
      p_user_id: atletaId,
      p_comidas: aPayload(borrador),
    })
    setGuardando(false)

    if (error) {
      // P0001 = mensaje que escribimos nosotros en la función (ya viene en español).
      return setMensaje({
        tipo: 'error',
        texto: error.code === 'P0001' ? error.message : 'No se pudieron guardar las comidas. Inténtalo de nuevo.',
      })
    }
    setMensaje({ tipo: 'ok', texto: 'Comidas guardadas. El atleta ya las ve.' })
    setVersion((v) => v + 1) // vuelve a leer lo guardado: así se ve exactamente lo que verá el atleta
  }

  function descartar() {
    if (!window.confirm('¿Descartar los cambios y volver a lo último que guardaste?')) return
    setMensaje(null)
    setVersion((v) => v + 1)
  }

  const lleno = borrador.length >= MAX_COMIDAS
  const colorMensaje = { error: 'text-alerta', ok: 'text-enlace' }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-bold">Comidas del día</h3>
        <p className="text-sm text-suave">
          Arma el menú del atleta: cada comida con sus alimentos. Con alimentos del catálogo (crudo o cocido) los
          gramos se calculan solos para cumplir el Plan nutricional. Él lo consulta en su sección Nutrición.
        </p>
      </div>

      {cargando && <p className="text-suave">Cargando comidas...</p>}
      {errorCarga && <p role="alert" className="text-alerta">{errorCarga}</p>}

      {!cargando && !errorCarga && (
        <>
          <p className="text-sm text-suave">
            {resumenComidas(borrador)}
            {actualizado && ` · guardado el ${fechaCortaDeTimestamp(actualizado)}`}
          </p>

          <ObjetivoDieta
            plan={plan}
            cargandoPlan={cargandoPlan}
            errorPlan={errorPlan}
            comidas={borrador}
            auto={auto}
            paso={paso}
            avisos={avisos}
            onAuto={cambiarAuto}
            onPaso={cambiarPaso}
            onReajustar={() => aplicar(borrador, true)}
            onLiberar={liberarFijados}
            onPesoComida={cambiarPesoComida}
          />

          {borrador.length === 0 && (
            <div className={TARJETA}>
              <p className="text-sm text-suave">Aún no hay comidas. Agrega la primera con los botones de abajo.</p>
            </div>
          )}

          {borrador.map((comida, i) => (
            <TarjetaComida
              key={comida.clave}
              comida={comida}
              indice={i}
              total={borrador.length}
              onCambiar={(campo, valor) => cambiarComida(comida.clave, campo, valor)}
              onMover={(delta) => cambiar(moverComida(borrador, i, delta))}
              onQuitar={() => quitarComida(comida)}
              onAgregarAlimento={() => agregarAlimento(comida.clave)}
              onAgregarDelCatalogo={(alimento) => agregarDelCatalogo(comida.clave, alimento)}
              onCambiarAlimento={(claveAlimento, campo, valor) => cambiarAlimento(comida.clave, claveAlimento, campo, valor)}
              onQuitarAlimento={(claveAlimento) => quitarAlimento(comida.clave, claveAlimento)}
              onIntercambiarAlimento={(claveAlimento, alimento) => intercambiarAlimento(comida.clave, claveAlimento, alimento)}
            />
          ))}

          <div className={`${TARJETA} flex flex-col gap-2`}>
            <p className="text-sm text-suave">Agregar una comida</p>
            <div className="flex flex-wrap gap-2">
              {COMIDAS_SUGERIDAS.map((nombre) => (
                <button key={nombre} type="button" onClick={() => agregarComida(nombre)} disabled={lleno} className={BOTON_SEC}>
                  + {nombre}
                </button>
              ))}
              <button type="button" onClick={() => agregarComida('')} disabled={lleno} className={BOTON_SEC}>
                + Otra
              </button>
            </div>
            {lleno && <p className="text-xs text-suave">Llegaste al máximo de {MAX_COMIDAS} comidas por día.</p>}
          </div>

          {mensaje && (
            <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={colorMensaje[mensaje.tipo]}>
              {mensaje.texto}
            </p>
          )}
          {sucio && <p role="status" className="text-sm text-alerta">Tienes cambios sin guardar.</p>}

          <div className="flex gap-2">
            <button type="button" onClick={guardar} disabled={guardando || !sucio} className={`${BOTON} flex-1`}>
              {guardando ? 'Guardando...' : 'Guardar comidas'}
            </button>
            {sucio && !guardando && (
              <button type="button" onClick={descartar} className={BOTON_SEC}>Descartar</button>
            )}
          </div>
          <p className="text-xs text-suave">
            Al guardar, el menú anterior se reemplaza por este y el atleta ve el nuevo al instante. Se guardan los macros
            de cada alimento tal como están ahora: si luego cambias el catálogo, este menú no se modifica.
          </p>
        </>
      )}
    </section>
  )
}
