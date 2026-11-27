// =====================================================================
// PlanComidas — el entrenador arma las COMIDAS DEL DÍA de UN atleta (menú manual).
//
// Cada comida (desayuno, almuerzo, cena, snacks...) lleva sus alimentos con la cantidad
// exacta (gramos, mililitros, unidades o porciones). El atleta lo ve en su pestaña Nutrición.
//
// Cómo funciona el guardado:
//   - Se EDITA un borrador en pantalla (estado local) y se guarda TODO junto con el botón
//     "Guardar comidas": la función de la base de datos `set_meal_plan` (migración 23)
//     reemplaza el menú completo en una sola operación (todo o nada).
//   - El menú es del atleta, no del plan de calorías: cambiar calorías o macros no lo toca.
//   - Antes de enviar se valida en la pantalla (lib/comidas.js); la base de datos valida otra vez.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cargarComidas } from '../lib/cargarComidas'
import {
  COMIDAS_SUGERIDAS, MAX_ALIMENTOS, MAX_COMIDAS, UNIDADES,
  aBorrador, aPayload, alimentoNuevo, comidaNueva, huellaBorrador, moverComida,
  resumenComidas, ultimaActualizacion, validarComidas,
} from '../lib/comidas'
import { fechaCortaDeTimestamp } from '../lib/records'
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'

// Un alimento dentro de una comida: nombre, cantidad + unidad y una nota opcional.
function FilaAlimento({ alimento: a, numero, nombreComida, onCambiar, onQuitar }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-hundido p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Alimento {numero}</span>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar el alimento ${numero} de ${nombreComida || 'la comida'}`}
          className="min-h-11 px-2 text-sm font-semibold text-alerta"
        >
          Quitar
        </button>
      </div>

      <div>
        <label htmlFor={`${a.clave}-alimento`} className="text-xs text-suave">Alimento</label>
        <input id={`${a.clave}-alimento`} value={a.alimento} maxLength={80}
          onChange={(e) => onCambiar('alimento', e.target.value)}
          placeholder="Ej: Arroz blanco cocido" className={CAMPO} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${a.clave}-cantidad`} className="text-xs text-suave">Cantidad</label>
          <input id={`${a.clave}-cantidad`} inputMode="decimal" value={a.cantidad}
            onChange={(e) => onCambiar('cantidad', e.target.value)}
            placeholder="Ej: 150" className={CAMPO} />
        </div>
        <div>
          <label htmlFor={`${a.clave}-unidad`} className="text-xs text-suave">Unidad</label>
          <select id={`${a.clave}-unidad`} value={a.unidad}
            onChange={(e) => onCambiar('unidad', e.target.value)} className={CAMPO}>
            {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.etiqueta}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${a.clave}-nota`} className="text-xs text-suave">Nota (opcional)</label>
        <input id={`${a.clave}-nota`} value={a.nota} maxLength={120}
          onChange={(e) => onCambiar('nota', e.target.value)}
          placeholder="Ej: cocido, sin sal" className={CAMPO} />
      </div>
    </div>
  )
}

// Una comida: nombre, orden (subir/bajar), sus alimentos y acciones.
function TarjetaComida({
  comida, indice, total, onCambiar, onMover, onQuitar,
  onAgregarAlimento, onCambiarAlimento, onQuitarAlimento,
}) {
  const nombre = comida.nombre.trim()
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
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onAgregarAlimento}
          disabled={comida.alimentos.length >= MAX_ALIMENTOS} className={BOTON_SEC}>
          + Agregar alimento
        </button>
        <button type="button" onClick={onQuitar} className={`${BOTON_SEC} text-alerta`}>
          Quitar comida
        </button>
      </div>
    </div>
  )
}

export default function PlanComidas({ atletaId, onCambiosSinGuardar }) {
  const [borrador, setBorrador] = useState([])
  const [huellaGuardada, setHuellaGuardada] = useState(huellaBorrador([]))
  const [actualizado, setActualizado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

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

  // Todo cambio al borrador pasa por aquí: se copia (nunca se muta) y se borra el mensaje anterior.
  const cambiar = (transformar) => { setBorrador((b) => transformar(b)); setMensaje(null) }

  const agregarComida = (nombre) =>
    // Empieza con una fila de alimento vacía para que escribir sea inmediato.
    cambiar((b) => [...b, { ...comidaNueva(nombre), alimentos: [alimentoNuevo()] }])

  const cambiarComida = (clave, campo, valor) =>
    cambiar((b) => b.map((c) => (c.clave === clave ? { ...c, [campo]: valor } : c)))

  const quitarComida = (comida) => {
    if (comida.alimentos.length > 0 && !window.confirm(`¿Quitar «${comida.nombre.trim() || 'esta comida'}» con sus alimentos? (Se aplica al guardar.)`)) return
    cambiar((b) => b.filter((c) => c.clave !== comida.clave))
  }

  const agregarAlimento = (clave) =>
    cambiar((b) => b.map((c) => {
      if (c.clave !== clave || c.alimentos.length >= MAX_ALIMENTOS) return c
      // La unidad del alimento anterior se repite: suele ser la misma (gramos, gramos...).
      return { ...c, alimentos: [...c.alimentos, alimentoNuevo(c.alimentos.at(-1)?.unidad)] }
    }))

  const cambiarAlimento = (claveComida, claveAlimento, campo, valor) =>
    cambiar((b) => b.map((c) => (c.clave !== claveComida ? c : {
      ...c,
      alimentos: c.alimentos.map((a) => (a.clave === claveAlimento ? { ...a, [campo]: valor } : a)),
    })))

  const quitarAlimento = (claveComida, claveAlimento) =>
    cambiar((b) => b.map((c) => (c.clave !== claveComida ? c : {
      ...c, alimentos: c.alimentos.filter((a) => a.clave !== claveAlimento),
    })))

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
          Arma el menú del atleta: cada comida con sus alimentos y cantidades exactas. Él lo consulta en su sección Nutrición.
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
              onMover={(delta) => cambiar((b) => moverComida(b, i, delta))}
              onQuitar={() => quitarComida(comida)}
              onAgregarAlimento={() => agregarAlimento(comida.clave)}
              onCambiarAlimento={(claveAlimento, campo, valor) => cambiarAlimento(comida.clave, claveAlimento, campo, valor)}
              onQuitarAlimento={(claveAlimento) => quitarAlimento(comida.clave, claveAlimento)}
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
            Al guardar, el menú anterior se reemplaza por este y el atleta ve el nuevo al instante.
          </p>
        </>
      )}
    </section>
  )
}
