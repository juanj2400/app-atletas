// =====================================================================
// src/lib/usuarios.js — reglas puras para crear y editar atletas (sin Supabase ni React).
//
// Cada validar* devuelve un texto de error en español o '' si todo está bien. Es comodidad
// para la pantalla; la barrera real está en la Edge Function admin-usuarios y en la base de
// datos (misma regla en los tres sitios: si cambias una, revisa las otras).
// =====================================================================
export const NOMBRE_MIN = 2
export const NOMBRE_MAX = 80
export const PASSWORD_MIN = 8
export const PASSWORD_MAX_BYTES = 72 // límite de bcrypt, el algoritmo que usa Supabase Auth

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarNombre(texto) {
  const t = String(texto ?? '').trim()
  if (t.length < NOMBRE_MIN) return `Escribe el nombre del atleta (mínimo ${NOMBRE_MIN} letras).`
  if (t.length > NOMBRE_MAX) return `El nombre es demasiado largo (máximo ${NOMBRE_MAX} caracteres).`
  return ''
}

export function validarEmail(texto) {
  const t = String(texto ?? '').trim()
  if (t === '' || t.length > 254 || !EMAIL_RE.test(t)) return 'Escribe un correo válido.'
  return ''
}

export function validarContrasena(texto) {
  const t = typeof texto === 'string' ? texto : ''
  if (t.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  if (new TextEncoder().encode(t).length > PASSWORD_MAX_BYTES) return `La contraseña es demasiado larga (máximo ${PASSWORD_MAX_BYTES}).`
  return ''
}

// Sin 0/O, 1/l/I: se confunden al dictarlas por WhatsApp o leerlas en el celular.
const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITOS = '23456789'
const ALFABETO = LETRAS + DIGITOS

// Contraseña temporal aleatoria. `aleatorio(n)` entrega n enteros sin signo de 32 bits; por
// defecto usa el generador seguro del navegador (no Math.random). Exige al menos una letra y
// un número (se repite el sorteo hasta cumplirlo). Hay un sesgo mínimo por el módulo
// (54 símbolos sobre 2^32): irrelevante para una contraseña temporal de 12 caracteres.
export function generarContrasena(longitud = 12, aleatorio = (n) => crypto.getRandomValues(new Uint32Array(n))) {
  for (;;) {
    const sorteo = aleatorio(longitud)
    const texto = Array.from(sorteo, (x) => ALFABETO[x % ALFABETO.length]).join('')
    if (/[a-zA-Z]/.test(texto) && /[0-9]/.test(texto)) return texto
  }
}

// Mensaje listo para pegar en WhatsApp con los datos de acceso.
export function textoAcceso({ nombre, email, password, url }) {
  return [
    `Hola${nombre ? ` ${String(nombre).trim().split(/\s+/)[0]}` : ''}, este es tu acceso a MyProgress:`,
    `Entra en: ${url}`,
    `Correo: ${email}`,
    `Contraseña: ${password}`,
  ].join('\n')
}
