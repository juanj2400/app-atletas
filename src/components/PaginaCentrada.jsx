// Marco de las pantallas SIN sesión (login, recuperar, restablecer, avisos):
// marca arriba y contenido centrado, con un halo azul muy tenue de fondo.
import Logo from './Logo'

export default function PaginaCentrada({ children, separacion = 'gap-6' }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-primario/10 blur-3xl" />
      <div className={`relative flex w-full max-w-sm flex-col ${separacion}`}>
        <div className="flex justify-center"><Logo grande /></div>
        {children}
      </div>
    </main>
  )
}
