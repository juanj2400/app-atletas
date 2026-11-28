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
import { CAMPO, BOTON, BOTON_SEC, TARJETA } from '../lib/estilos'
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
      <main className={`${CONTENIDO_ADMIN} flex flex-col gap-4`}>
        <p className="text-sm text-suave">
          Tus alimentos con sus macros por 100 g, en crudo o cocido. El creador de dieta los usa para calcular los gramos.
        </p>

        {formAbierto === 'nuevo' ? (
          <FormAlimento
            alimento={null}
            onCancelar={() => setFormAbierto(null)}
            onGuardado={() => { setFormAbierto(null); setVersion((v) => v + 1) }}
          />
        ) : (
          <button type="button" onClick={() => setFormAbierto('nuevo')} className={BOTON}>Nuevo alimento</button>
        )}

        <input value={busqueda} onChange={(e) => filtrar(setBusqueda)(e.target.value)}
          placeholder="Buscar alimento..." aria-label="Buscar alimento" className={CAMPO} />
        <div className="grid grid-cols-2 gap-2">
          <select value={categoria} onChange={(e) => filtrar(setCategoria)(e.target.value)}
            aria-label="Categoría" className={CAMPO}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
          </select>
          <select value={estado} onChange={(e) => filtrar(setEstado)(e.target.value)}
            aria-label="Estado" className={CAMPO}>
            <option value="">Crudo y cocido</option>
            {ESTADOS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={verInactivos}
            onChange={(e) => filtrar(setVerInactivos)(e.target.checked)} />
          Mostrar también los desactivados
        </label>

        {cargando && <p role="status" className="text-suave">Cargando...</p>}
        {error && <p role="alert" className="text-alerta">{error}</p>}
        {errorAccion && <p role="alert" className="text-alerta">{errorAccion}</p>}
        {!cargando && !error && alimentos.length === 0 && (
          <p className="text-suave">No hay alimentos que coincidan.</p>
        )}

        <ul className="flex flex-col gap-3">
          {alimentos.map((a) => (
            <li key={a.id} className={`${TARJETA} ${a.activo ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{a.nombre}</p>
                  <p className="text-sm text-suave">
                    {textoCategoria(a.categoria)}
                    {a.macro_dominante && ` · domina ${TEXTO_MACRO[a.macro_dominante].toLowerCase()}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-hundido px-3 py-1 text-xs font-semibold">
                  {textoEstado(a.estado)}
                </span>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-bold">{numero(a.calorias)} kcal</span>
                <span className="text-suave"> · P {numero(a.proteina_g)} · C {numero(a.carbohidratos_g)} · G {numero(a.grasas_g)} (g por 100 g)</span>
              </p>
              {!a.activo && <p className="text-sm text-alerta">Desactivado: no aparece al armar dietas.</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                {formAbierto !== a.id && (
                  <button type="button" onClick={() => setFormAbierto(a.id)} className={BOTON_SEC}>Editar</button>
                )}
                <button type="button" onClick={() => cambiarActivo(a)} className={BOTON_SEC}>
                  {a.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              {formAbierto === a.id && (
                <div className="mt-3">
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
      </main>
    </MarcoAdmin>
  )
}
