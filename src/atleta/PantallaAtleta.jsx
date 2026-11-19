// Zona del atleta. Ahora muestra el formulario real del check-in.
import Encabezado from '../components/Encabezado'
import CheckIn from './CheckIn'

export default function PantallaAtleta() {
  return (
    <>
      <Encabezado titulo="Mi entrenamiento" />
      <main className="mx-auto max-w-md p-4">
        <CheckIn />
      </main>
    </>
  )
}
