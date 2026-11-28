// =====================================================================
// vite.config.js — la "receta" de cómo Vite construye tu app.
//
// ¿Por qué Vite y no Create React App o Next.js?
//  - Create React App está abandonado (ya no recibe mantenimiento).
//  - Next.js es excelente, pero trae servidor, SSR y rutas propias: complejidad
//    que NO necesitas. Tu app es una "SPA" (Single Page Application): el
//    navegador descarga una sola vez el HTML + JS y luego todo ocurre en el
//    celular; los datos vienen de Supabase. Vite es el camino más simple.
//  - Vite arranca en milisegundos en desarrollo y genera una carpeta `dist/`
//    de archivos estáticos que cualquier hosting (Netlify/Vercel) sirve gratis.
// =====================================================================
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // Enseña a Vite a entender JSX (el HTML dentro de JavaScript de React).
    react(),

    // Tailwind v4 se integra como plugin de Vite: lee tus clases (bg-fondo,
    // p-4, etc.) y genera SOLO el CSS que realmente usas. No hay que
    // configurar nada más: la configuración vive en src/index.css.
    tailwindcss(),

    // Convierte la web en PWA: genera el "manifest" (nombre, íconos, colores
    // para instalarla en el celular) y un "service worker" (script que el
    // navegador guarda para abrir la app rápido y detectar versiones nuevas).
    VitePWA({
      // 'prompt': cuando subes una versión nueva, la app AVISA (componente
      // AvisoActualizacion) y el atleta decide cuándo actualizar, para no recargarle
      // la pantalla en medio de una serie.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MyProgress',
        short_name: 'MyProgress',
        description: 'Seguimiento privado de entrenamiento y nutrición',
        lang: 'es',
        display: 'standalone',        // se abre sin barra del navegador, como app nativa
        orientation: 'portrait',
        start_url: '/',
        theme_color: '#0F1115',       // color de la barra de estado del celular
        background_color: '#0F1115',  // color de la pantalla de carga al abrir
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Funcionamiento SIN INTERNET: el service worker guarda los archivos de la app (HTML, JS,
      // CSS, íconos, y también los gráficos de carga perezosa) y, para cualquier dirección de la
      // app (/atleta/entrenar...), entrega index.html: por eso la app abre aunque no haya señal.
      // Lo dejamos explícito aquí (son los valores por defecto) para que nadie lo cambie sin querer.
      workbox: {
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      // IMPORTANTE: el service worker NO guarda las respuestas de Supabase (los datos siempre
      // son frescos y nunca se mezclan entre usuarios). Los datos para usar sin señal (rutina,
      // plan, check-in del día y la cola de registros pendientes) viven en IndexedDB, separados
      // por usuario: ver src/lib/almacenLocal.js y docs/ARQUITECTURA.md.
    }),
  ],
})
