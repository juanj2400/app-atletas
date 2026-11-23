// Muestra al atleta en qué fase de su entrenamiento va (si el entrenador definió ciclos).
// Si no hay ciclo en curso no muestra nada. La fecha de hoy llega desde PantallaAtleta.
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import CicloVigenteCard from '../components/CicloVigenteCard'

export default function CicloActual() {
  const { perfil } = useAuth()
  const { hoy } = useOutletContext()
  const [ciclos, setCiclos] = useState([])

  useEffect(() => {
    let cancelado = false
    supabase
      .from('training_cycles')
      .select('id, parent_id, nivel, nombre, fase, objetivo, fecha_inicio, fecha_fin')
      .eq('user_id', perfil.id)
      .in('nivel', ['macrociclo', 'mesociclo'])
      // Si falla no es grave: simplemente no se muestra la tarjeta.
      .then(({ data }) => { if (!cancelado && data) setCiclos(data) })
    return () => { cancelado = true }
  }, [perfil.id])

  return <CicloVigenteCard ciclos={ciclos} hoy={hoy} />
}
