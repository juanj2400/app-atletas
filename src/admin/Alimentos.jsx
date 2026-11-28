// =====================================================================
// Alimentos — catálogo propio de alimentos del entrenador (/admin/alimentos).
//
// Cada alimento guarda sus macros por 100 g y su estado (crudo, cocido o no aplica); de ahí
// sale el autocálculo de gramos del creador de dieta. Aquí el entrenador busca, agrega, edita
// y desactiva alimentos sin usar IA.
//
// Carga LIGERA: nunca baja todo el catálogo. Pide 30 alimentos por vez (los que coinciden con
// la búsqueda y los filtros) y "Ver más" pide 30 más. Los alimentos NO se borran: se desactivan,
// para que los menús ya guardados sigan coherentes.
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Encabezado from '../components/Encabezado'
import { MarcoAdmin } from '../components/MarcoApp'
import { CATEGORIAS, ESTADOS, TEXTO_MACRO, textoCategoria, textoEstado } from '../lib/alimentos'
import { useBusquedaAlimentos } from '../lib/useBusquedaAlimentos'
import { CAMPO, BOTON, BOTON_SEC, TARJETA, CONTENIDO_ADMIN } from '../lib/estilos'
import FormAlimento from './FormAlimento'

const PAGINA = 30
const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

export default function Alimentos() {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [limite, setLimite] = useState(PAGINA)
  const [version, setVersion] = useState(0)
  const [formAbierto, setFormAbierto] = useState(null) // null | 'nuevo' | id del alimento que se edita
  const [errorAccion, setErrorAccion] = useState('')
  const [claveNuevo, setClaveNuevo] = useState(0) // al cambiar, el formulario de «Nuevo» se vacía

  const { alimentos, cargando, error, hayMas } = useBusquedaAlimentos({
    texto: busqueda, categoria, estado, limite, soloActivos: !verInactivos, version,
  })

  // Al cambiar un filtro se vuelve a la primera página
  const filtrar = (poner) => (valor) => { poner(valor); setLimite(PAGINA) }

  async function cambiarActivo(a) {
    setErrorAccion('')
    const { data, error: errorBD } = await supabase
      .from('foods').update({ activo: !a.activo }).eq('id', a.id).select('id')
    if (errorBD || !data || data.length === 0) return setErrorAccion('No se pudo cambiar el estado del alimento.')
    setVersion((v) => v + 1)
  }

  return (
    <MarcoAdmin>
      <Encabezado titulo="Catálogo de alimentos" volverA="/admin" textoVolver="Atletas" />
      <main className={`${CONTENIDO_ADMIN} flex flex-col gap-3`}>
        <p className="text-sm text-suave">
          Tus alimentos con sus macros por 100 g, en crudo o cocido. El creador de dieta los usa para calcular los gramos.
        </p>

        {/* Escritorio: el formulario de «Nuevo alimento» queda SIEMPRE a la izquierda (fijo al hacer scroll)
            y la lista a la derecha, así puedes crear uno tras otro sin bajar. En celular se abre con el botón. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside aria-label="Nuevo alimento" className="lg:sticky lg:top-4">
            {formAbierto !== 'nuevo' && (
              <button type="button" onClick={() => setFormAbierto('nuevo')} className={`${BOTON} w-full lg:hidden`}>Nuevo alimento</button>
            )}
            <div className={formAbierto === 'nuevo' ? '' : 'hidden lg:block'}>
              <FormAlimento
                key={claveNuevo}
                alimento={null}
                onCancelar={() => { setFormAbierto(null); setClaveNuevo((k) => k + 1) }}
                onGuardado={() => { setFormAbierto(null); setClaveNuevo((k) => k + 1); setVersion((v) => v + 1) }}
              />
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-3" aria-label="Lista de alimentos">
            <div className="flex flex-wrap items-center gap-2">
              <input value={busqueda} onChange={(e) => filtrar(setBusqueda)(e.target.value)}
                placeholder="Buscar alimento..." aria-label="Buscar alimento" className={`${CAMPO} md:min-w-48 md:flex-1`} />
              <select value={categoria} onChange={(e) => filtrar(setCategoria)(e.target.value)}
                aria-label="Categoría" className={`${CAMPO} min-w-0 flex-1 md:w-auto md:flex-none`}>
                <option value="">Todas las categorías</option>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
              </select>
              <select value={estado} onChange={(e) => filtrar(setEstado)(e.target.value)}
                aria-label="Estado" className={`${CAMPO} min-w-0 flex-1 md:w-auto md:flex-none`}>
                <option value="">Crudo y cocido</option>
                {ESTADOS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
              </select>
              <label className="flex min-h-11 items-center gap-2 text-sm text-suave">
                <input type="checkbox" checked={verInactivos}
                  onChange={(e) => filtrar(setVerInactivos)(e.target.checked)} />
                Ver desactivados
              </label>
            </div>

            {cargando && <p role="status" className="text-suave">Cargando...</p>}
            {error && <p role="alert" className="text-alerta">{error}</p>}
            {errorAccion && <p role="alert" className="text-alerta">{errorAccion}</p>}
            {!cargando && !error && alimentos.length === 0 && (
              <p className="text-suave">No hay alimentos que coincidan.</p>
            )}

            {alimentos.length > 0 && <p className="text-xs text-suave">Calorías y gramos por cada 100 g.</p>}
            <ul className="divide-y divide-borde-suave overflow-hidden rounded-2xl border border-borde bg-superficie">
              {alimentos.map((a) => (
                <li key={a.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 ${a.activo ? '' : 'opacity-70'}`}>
                  <div className="min-w-0 flex-1 basis-44">
                    <p className="truncate font-semibold">{a.nombre}</p>
                    <p className="truncate text-xs text-suave">
                      {textoCategoria(a.categoria)}
                      {a.macro_dominante && ` · domina ${TEXTO_MACRO[a.macro_dominante].toLowerCase()}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-hundido px-2.5 py-0.5 text-xs font-semibold">
                    {textoEstado(a.estado)}
                  </span>
                  <p className="text-sm md:w-56">
                    <span className="font-bold">{numero(a.calorias)} kcal</span>
                    <span className="text-suave"> · P {numero(a.proteina_g)} · C {numero(a.carbohidratos_g)} · G {numero(a.grasas_g)}</span>
                  </p>
                  <div className="flex gap-2">
                    {formAbierto !== a.id && (
                      <button type="button" onClick={() => setFormAbierto(a.id)} className={`${BOTON_SEC} md:min-h-9`}>Editar</button>
                    )}
                    <button type="button" onClick={() => cambiarActivo(a)} className={`${BOTON_SEC} md:min-h-9`}>
                      {a.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                  {!a.activo && <p className="basis-full text-xs text-alerta">Desactivado: no aparece al armar dietas.</p>}
                  {formAbierto === a.id && (
                    <div className="basis-full pt-2">
                      <FormAlimento
                        alimento={a}
                        onCancelar={() => setFormAbierto(null)}
                        onGuardado={() => { setFormAbierto(null); setVersion((v) => v + 1) }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {hayMas && !cargando && (
              <button type="button" onClick={() => setLimite((l) => l + PAGINA)} className={BOTON_SEC}>Ver más alimentos</button>
            )}
          </section>
        </div>
      </main>
    </MarcoAdmin>
  )
}
