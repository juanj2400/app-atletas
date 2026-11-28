// =====================================================================
// src/lib/useBusquedaAlimentos.js — hook: busca alimentos mientras el entrenador escribe.
//
// Espera 300 ms después de la última tecla (debounce) para no consultar por cada letra, y
// descarta las respuestas viejas (bandera `cancelado`). Con `exigirFiltro`, no consulta hasta
// que haya al menos 2 letras o un filtro elegido: el selector del creador de dieta arranca
// vacío en vez de bajar alimentos que nadie pidió.
//
// Devuelve { alimentos, cargando, error, hayMas }. `hayMas` = llegó al límite, puede haber más.
// =====================================================================
import { useEffect, useState } from 'react'
import { buscarAlimentos } from './buscarAlimentos'
import { terminosBusqueda } from './alimentos'

const ESPERA_MS = 300

export function useBusquedaAlimentos({
  texto, categoria = '', estado = '', limite = 20, soloActivos = true,
  exigirFiltro = false, version = 0,
}) {
  const [textoEstable, setTextoEstable] = useState(texto)
  const [resultado, setResultado] = useState({ alimentos: [], cargando: !exigirFiltro, error: '' })

  useEffect(() => {
    const t = setTimeout(() => setTextoEstable(texto), ESPERA_MS)
    return () => clearTimeout(t)
  }, [texto])

  const hayFiltro = terminosBusqueda(textoEstable).join('').length >= 2 || Boolean(categoria) || Boolean(estado)
  const consultar = !exigirFiltro || hayFiltro

  useEffect(() => {
    if (!consultar) { setResultado({ alimentos: [], cargando: false, error: '' }); return }
    let cancelado = false
    setResultado((r) => ({ ...r, cargando: true, error: '' }))
    buscarAlimentos({ texto: textoEstable, categoria, estado, limite, soloActivos }).then(({ alimentos, error }) => {
      if (cancelado) return
      if (error) setResultado({ alimentos: [], cargando: false, error })
      else setResultado({ alimentos, cargando: false, error: '' })
    })
    return () => { cancelado = true }
  }, [consultar, textoEstable, categoria, estado, limite, soloActivos, version])

  return { ...resultado, hayMas: resultado.alimentos.length >= limite, consultando: consultar }
}
