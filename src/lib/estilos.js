// Clases de Tailwind que se repiten en muchas pantallas. Se definen una sola vez
// aquí para que todos los botones y campos se vean igual (y cambiarlos sea fácil).
// El borde de los campos (borde-campo) tiene contraste a propósito: no lo bajes.
export const CAMPO = 'min-h-11 w-full rounded-xl border border-borde-campo bg-fondo px-3 focus:border-enlace focus:outline-none focus:ring-2 focus:ring-enlace/40'
export const BOTON = 'min-h-11 rounded-xl bg-primario px-4 font-semibold text-white transition-colors hover:bg-primario-fuerte disabled:opacity-60 disabled:hover:bg-primario'
export const BOTON_SEC = 'min-h-11 rounded-xl border border-borde px-4 text-sm font-semibold transition-colors hover:bg-elevada disabled:opacity-60'
export const TARJETA = 'rounded-2xl border border-borde bg-superficie p-4'
// Etiquetas de disciplina de la rutina híbrida (suaves, para no competir con los botones azules).
export const ETIQUETA_HALTEROFILIA = 'bg-halterofilia/15 text-halterofilia'
export const ETIQUETA_MUSCULACION = 'bg-musculacion/15 text-musculacion'
// Anchos del contenido en escritorio (el celular sigue a todo el ancho de su columna).
export const CONTENIDO_ATLETA = 'mx-auto w-full max-w-md p-4 md:max-w-3xl md:p-6 lg:p-8'
export const CONTENIDO_ADMIN = 'mx-auto w-full max-w-3xl p-4 md:max-w-5xl md:p-6 lg:p-8'
