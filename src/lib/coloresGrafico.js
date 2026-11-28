// =====================================================================
// Colores de los gráficos. Recharts dibuja en SVG y recibe los colores como
// TEXTO (no como clases de Tailwind). En vez de repetir códigos hex, apuntan
// a las variables que Tailwind crea desde @theme (index.css): si cambias la
// paleta allí, las gráficas la heredan solas.
// =====================================================================
export const COLOR = {
  titulo: 'var(--color-texto)',    // texto principal / línea de peso
  texto: 'var(--color-suave)',     // ejes
  rejilla: 'var(--color-borde)',   // líneas de la cuadrícula y bordes
  fondo: 'var(--color-superficie)',// fondo de las cajas de ayuda (tooltips)
  peso: 'var(--color-texto)',      // peso corporal
  kcal: 'var(--color-primario)',   // calorías y barras
  linea: 'var(--color-enlace)',    // líneas de progreso (azul de enlace)
  alerta: 'var(--color-alerta)',   // línea de referencia del récord
}
