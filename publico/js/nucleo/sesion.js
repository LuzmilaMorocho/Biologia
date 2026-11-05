import { llamar } from './api.js';

// Retorna el token de autenticación almacenado
export function token() {
  try {
    return sessionStorage.getItem('token');
  } catch {
    return null;
  }
}

// Retorna el usuario activo en sesión o null
export function usuarioActual() {
  try {
    const raw = sessionStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Registra un nuevo usuario e inicia sesión automáticamente
export async function registrar(datos) {
  await llamar('POST', '/api/auth/registro', datos);
  return await iniciar(datos.correo, datos.clave);
}

// Inicia sesión y almacena credenciales en sessionStorage
export async function iniciar(correo, clave) {
  const respuesta = await llamar('POST', '/api/auth/login', { correo, clave });

  sessionStorage.setItem('token', respuesta.token);
  sessionStorage.setItem('usuario', JSON.stringify(respuesta.usuario));

  return respuesta.usuario;
}

// Cierra la sesión activa en el servidor y limpia el almacenamiento
export async function cerrar() {
  try {
    await llamar('POST', '/api/auth/logout');
  } catch {
    // Si la llamada falla, continuamos con la limpieza local
  } finally {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/index.html';
    }
  }
}

// Control de acceso por roles en el navegador
export function exigirRol(roles = []) {
  if (!roles || roles.length === 0 || roles.includes('publico')) {
    return true;
  }

  const usuario = usuarioActual();

  // Sin sesión → redirigir a ingreso
  if (!usuario) {
    if (typeof window !== 'undefined' && window.location) {
      const ruta = window.location.pathname || '';
      if (!ruta.endsWith('ingreso.html') && !ruta.endsWith('registro.html')) {
        window.location.href = '/paginas/ingreso.html';
      }
    }
    return false;
  }

  // Con sesión pero verificación de roles específicos
  const permitido =
    roles.includes('sesion') ||
    (usuario.rol && roles.includes(usuario.rol));

  if (!permitido) {
    sessionStorage.setItem(
      'aviso_pendiente',
      JSON.stringify({
        texto: 'No tienes permisos para acceder a esta página.',
        tipo: 'error'
      })
    );
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/index.html';
    }
    return false;
  }

  return true;
}
