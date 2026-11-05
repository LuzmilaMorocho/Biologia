// Gancho para la colección alertas (§B contratos.md)
import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'docente') {
    const grupos = await acceso.gruposDe(usuario);
    const idsGrupos = new Set(grupos.map((g) => g.id));
    return lista.filter((a) => idsGrupos.has(a.grupoId) || a.docenteId === usuario.id);
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Se requiere sesión');
    error.estado = 401;
    throw error;
  }

  // La creación de alertas es exclusiva del servidor interno
  if (!anterior) {
    const error = new Error('Las alertas solo se generan automáticamente por el sistema');
    error.estado = 403;
    throw error;
  }

  // Solo docentes del grupo o administradores pueden editar la alerta
  if (usuario.rol !== 'admin') {
    if (usuario.rol !== 'docente') {
      const error = new Error('Acceso denegado');
      error.estado = 403;
      throw error;
    }

    const grupos = await acceso.gruposDe(usuario);
    const tieneAcceso =
      grupos.some((g) => g.id === anterior.grupoId) || anterior.docenteId === usuario.id;

    if (!tieneAcceso) {
      const error = new Error('No tiene permiso para modificar alertas de este grupo');
      error.estado = 403;
      throw error;
    }
  }

  // Solo se permite cambiar el campo "estado" (activa | atendida)
  const nuevoEstado = datos.estado || anterior.estado;
  if (nuevoEstado !== 'activa' && nuevoEstado !== 'atendida') {
    const error = new Error('El estado de la alerta debe ser "activa" o "atendida"');
    error.estado = 400;
    throw error;
  }

  return {
    ...anterior,
    estado: nuevoEstado
  };
}

export default {
  filtrarLista,
  antesDeGuardar
};

