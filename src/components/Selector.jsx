// =====================================================================
// Selector — fila de botones "elige una opción" (Sí/No, ánimo, etc.)
//
// Es un componente REUTILIZABLE y "controlado": no guarda nada por sí mismo.
// El componente padre le dice qué opción está elegida (prop `valor`) y le
// pasa una función (prop `onChange`) que el Selector llama cuando el usuario
// toca una opción. Así el padre siempre es dueño de los datos.
//
// Uso:
//   <Selector
//     opciones={[{ valor: true, etiqueta: 'Sí' }, { valor: false, etiqueta: 'No' }]}
//     valor={form.recuperado}
//     onChange={(v) => actualizar('recuperado', v)}
//   />
// =====================================================================
export default function Selector({ opciones, valor, onChange }) {
  return (
    <div className="mt-3 flex gap-2">
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor
        return (
          <button
            key={String(opcion.valor)}
            // IMPORTANTE: dentro de un <form>, un botón es "submit" por defecto
            // y enviaría el formulario al tocarlo. type="button" lo evita.
            type="button"
            // aria-pressed: avisa a lectores de pantalla si está seleccionado.
            aria-pressed={activo}
            onClick={() => onChange(opcion.valor)}
            className={`min-h-11 flex-1 rounded-xl border px-3 font-semibold ${
              activo
                ? 'border-primario bg-primario text-white'
                : 'border-[#5B6372] bg-superficie text-texto'
            }`}
          >
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
