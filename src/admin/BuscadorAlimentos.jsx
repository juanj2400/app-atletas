// =====================================================================
// BuscadorAlimentos — el entrenador elige un alimento del catálogo (con su estado crudo/cocido).
//
// Lo usa el creador de dieta tanto para AGREGAR un alimento a una comida como para INTERCAMBIAR
// uno ya puesto. Es ligero: no consulta hasta que escribas 2 letras o elijas un filtro, espera
// 300 ms tras la última tecla y trae como máximo 15 alimentos por búsqueda.
// =====================================================================
import { useState } from 'react'
import { CATEGORIAS, ESTADOS, textoEstado } from '../lib/alimentos'
import { useBusquedaAlimentos } from '../lib/useBusquedaAlimentos'
import { CAMPO, BOTON_SEC, TARJETA } from '../lib/estilos'

const LIMITE = 15
const numero = (n) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })

export default function BuscadorAlimentos({ titulo = 'Elegir alimento', textoBoton = 'Elegir', onElegir, onCerrar }) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('')

  const { alimentos, cargando, error, consultando, hayMas } = useBusquedaAlimentos({
    texto: busqueda, categoria, estado, limite: LIMITE, soloActivos: true, exigirFiltro: true,
  })

  return (
    <div className={`${TARJETA} flex flex-col gap-3 bg-hundido`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">{titulo}</h4>
        <button type="button" onClick={onCerrar} className={BOTON_SEC}>Cerrar</button>
      </div>

      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar alimento (ej: arroz, pollo)..." aria-label="Buscar alimento en el catálogo"
        className={CAMPO} />
      <div className="grid grid-cols-2 gap-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className={CAMPO}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado" className={CAMPO}>
          <option value="">Crudo y cocido</option>
          {ESTADOS.map((s) => <option key={s.valor} value={s.valor}>{s.etiqueta}</option>)}
        </select>
      </div>

      {!consultando && (
        <p className="text-sm text-suave">Escribe al menos 2 letras o elige una categoría o un estado para buscar.</p>
      )}
      {consultando && cargando && <p role="status" className="text-sm text-suave">Buscando...</p>}
      {error && <p role="alert" className="text-sm text-alerta">{error}</p>}
      {consultando && !cargando && !error && alimentos.length === 0 && (
        <p className="text-sm text-suave">
          No hay alimentos que coincidan. Puedes agregarlo en el catálogo (Atletas › Catálogo de alimentos).
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {alimentos.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie p-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {a.nombre} <span className="text-sm font-normal text-enlace">· {textoEstado(a.estado)}</span>
              </p>
              <p className="text-xs text-suave">
                {numero(a.calorias)} kcal · P {numero(a.proteina_g)} · C {numero(a.carbohidratos_g)} · G {numero(a.grasas_g)} (por 100 g)
              </p>
            </div>
            <button type="button" onClick={() => onElegir(a)} className={BOTON_SEC}>{textoBoton}</button>
          </li>
        ))}
      </ul>
      {hayMas && <p className="text-xs text-suave">Mostrando los primeros {LIMITE}. Escribe más letras para afinar.</p>}
    </div>
  )
}
