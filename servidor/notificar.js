// Módulo servidor para emisión de notificaciones (§B contratos.md)
import * as almacen from './almacen.js';
import { conBloqueo } from './bloqueos.js';

/**
 * Crea una notificación para un usuario con estado leida: false.
 * @param {string} usuarioId
 * @param {{ tipo?: string, mensaje: string, enlace?: string, clave?: string }} opciones
 * @returns {Promise<Object|null>} Registro de notificación creado o null si faltan datos
 */
export async function notificar(usuarioId, { tipo = 'general', mensaje, enlace = '', clave } = {}) {
  if (!usuarioId || !mensaje) {
    return null;
  }

  const registro = {
    usuarioId,
    tipo,
    mensaje,
    enlace: enlace || '',
    leida: false,
    ...(clave ? { clave } : {})
  };

  if (!clave) return almacen.agregar('notificaciones', registro);
  // Recupera el aviso si una consulta anterior falló al guardar avisados.
  return conBloqueo(`notificacion:${usuarioId}:${clave}`, async () => {
    const existente = (await almacen.leer('notificaciones')).find((n) => n.usuarioId === usuarioId && n.clave === clave);
    return existente || almacen.agregar('notificaciones', registro);
  });
}

export default notificar;

