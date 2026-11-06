// Zona del atleta (por ahora un marcador de posición; aquí irá el check-in).
import Encabezado from '../components/Encabezado'

export default function PantallaAtleta() {
  return (
    <>
      <Encabezado titulo="Mi entrenamiento" />
      <main className="p-4">
        <div className="rounded-2xl border border-borde bg-superficie p-4">
          <h2 className="font-semibold">Check-in de hoy</h2>
          <p className="mt-1 text-sm text-suave">
            Aquí construiremos el formulario del check-in diario (siguiente paso).
          </p>
        </div>
      </main>
    </>
  )
}
