# App de atletas (React + Vite + Tailwind + PWA + Supabase)

## Arrancar en tu computador
1. `npm install`            (descarga las librerías según package-lock.json)
2. Copia `.env.example` a `.env` y pon tu URL y clave pública de Supabase
3. `npm run dev`            (abre http://localhost:5173)

## Comandos
- `npm run dev`      servidor de desarrollo con recarga instantánea
- `npm run build`    genera la carpeta `dist/` lista para publicar
- `npm run preview`  sirve `dist/` localmente (aquí SÍ funciona la PWA/instalación)

## Estructura
- `src/lib/`        conexión a Supabase
- `src/auth/`       sesión, rol y protección de rutas
- `src/pages/`      pantallas generales (login, redirección)
- `src/atleta/`     pantallas del atleta
- `src/admin/`      pantallas del administrador
- `src/components/` piezas reutilizables
- `supabase/functions/generate-weekly-proposals/`  (Edge Function de IA, paso posterior)

## Publicar (Netlify)
Build command: `npm run build` · Publish directory: `dist`
Variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_KEY
