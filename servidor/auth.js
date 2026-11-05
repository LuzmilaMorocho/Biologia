import * as almacen from './almacen.js';

// Limpieza de sesiones vencidas al iniciar el módulo
export async function limpiarSesionesVencidas() {
  try {
    const ahora = new Date();
    const sesiones = await almacen.leer('sesiones');
    const vigentes = sesiones.filter((s) => s.expira && new Date(s.expira) > ahora);
    if (vigentes.length !== sesiones.length) {
      await almacen.escribir('sesiones', vigentes);
    }
  } catch (error) {
    console.error('Error al limpiar sesiones vencidas:', error);
  }
}

await limpiarSesionesVencidas();

// Middleware para cargar el usuario desde el token Bearer en Authorization
export async function cargarUsuario(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      req.usuario = null;
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      req.usuario = null;
      return next();
    }

    const sesiones = await almacen.leer('sesiones');
    const sesion = sesiones.find((s) => s.token === token);

    if (!sesion || !sesion.expira || new Date(sesion.expira) <= new Date()) {
      req.usuario = null;
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === sesion.usuarioId);

    if (!usuario || usuario.activo === false) {
      req.usuario = null;
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };

    next();
  } catch (error) {
    req.usuario = null;
    next();
  }
}

// Middleware para exigir rol de usuario o simplemente sesión activa
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    next();
  };
}
