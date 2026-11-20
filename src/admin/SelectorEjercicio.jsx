// =====================================================================
// SelectorEjercicio — buscador sobre la biblioteca de ejercicios.
// Muestra advertencias si el ejercicio está en la lista negra (global o del atleta).
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CAMPO, BOTON_SEC, TARJETA } from '../lib/estilos'

// Quita tildes y mayúsculas para que "sentadilla" encuentre "Sentadilla" y "Bíceps" se halle con "biceps".
const normalizar = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function SelectorEjercicio({ listaNegra, onElegir, onCerrar }) {
  const [ejercicios, setEjercicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [grupo, setGrupo] = useState('')

  useEffect(() => {
    supabase
      .from('exercises')
      .select('id, nombre, grupo_muscular, restringido')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError('No se pudo cargar la biblioteca de ejercicios.')
        else setEjercicios(data)
        setCargando(false)
      })
  }, [])

  // Lista de grupos sin repetir: Set elimina duplicados; filter(Boolean) quita los vacíos.
  const grupos = [...new Set(ejercicios.map((e) => e.grupo_muscular).filter(Boolean))].sort()
  const texto = normalizar(busqueda)
  const resultados = ejercicios
    .filter((e) => (!grupo || e.grupo_muscular === grupo) && normalizar(e.nombre).includes(texto))
    .slice(0, 30) // mostramos máximo 30 para que la lista no sea eterna

  function elegir(ejercicio) {
    const aviso = ejercicio.restringido
      ? 'Este ejercicio está marcado como restringido.'
      : listaNegra.has(ejercicio.id)
        ? 'Este ejercicio está en la lista negra de este atleta.'
        : null
    if (aviso && !window.confirm(`${aviso} ¿Agregarlo de todos modos?`)) return
    onElegir(ejercicio)
  }

  return (
    <div className={`${TARJETA} flex flex-col gap-3 bg-hundido`}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Elegir ejercicio</h4>
        <button type="button" onClick={onCerrar} className={BOTON_SEC}>Cerrar</button>
      </div>

      <input
        value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre..." aria-label="Buscar ejercicio" className={CAMPO}
      />
      <select value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo muscular" className={CAMPO}>
        <option value="">Todos los grupos</option>
        {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      {cargando && <p className="text-suave">Cargando ejercicios...</p>}
      {error && <p role="alert" className="text-alerta">{error}</p>}
      {!cargando && !error && resultados.length === 0 && (
        <p className="text-suave">No hay ejercicios que coincidan.</p>
      )}

      <ul className="flex flex-col gap-2">
        {resultados.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie p-3">
            <div>
              <p className="font-semibold">{e.nombre}</p>
              <p className="text-sm text-suave">{e.grupo_muscular || 'Sin grupo'}</p>
              {e.restringido && <p className="text-sm text-alerta">Restringido</p>}
              {!e.restringido && listaNegra.has(e.id) && (
                <p className="text-sm text-alerta">En la lista negra de este atleta</p>
              )}
            </div>
            <button type="button" onClick={() => elegir(e)} className={BOTON_SEC}>Agregar</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
