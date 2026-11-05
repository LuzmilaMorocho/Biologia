import * as almacen from '../almacen.js';
import { errorForo, validarCampos, textoValido, publicacionAccesible } from '../foros.js';
import { mensajeReferenciado } from '../mensajes.js';

export const filtrarLista = (lista, usuario) => usuario?.rol === 'admin' ? lista : [];

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario?.id) throw errorForo(401, 'Inicia sesión para reportar');
  if (anterior) {
    if (usuario.rol !== 'admin') throw errorForo(403, 'Solo administración puede resolver reportes');
    validarCampos(datos, ['estado']);
    if (datos.estado !== 'resuelto') throw errorForo(400, 'Selecciona una resolución válida');
    return { estado: 'resuelto' };
  }
  validarCampos(datos, ['tipo', 'coleccion', 'referenciaId', 'motivo', 'reportadoPor', 'estado']);
  let coleccion;
  if (datos.tipo === 'mensaje') {
    if (datos.coleccion !== undefined && datos.coleccion !== 'mensajes') throw errorForo(400, 'Colección de mensaje no válida');
    await mensajeReferenciado(datos.referenciaId, usuario);
    coleccion = 'mensajes';
  } else {
    if (datos.tipo !== 'foro' || !['foros-hilos', 'foros-respuestas'].includes(datos.coleccion)) throw errorForo(400, 'Selecciona una publicación para reportar');
    await publicacionAccesible(datos.coleccion, datos.referenciaId, usuario);
    coleccion = datos.coleccion;
  }
  const motivo = textoValido(datos.motivo, 'El motivo');
  const repetido = (await almacen.leer('reportes')).some((r) => r.reportadoPor === usuario.id && r.coleccion === coleccion && r.referenciaId === datos.referenciaId && r.estado === 'pendiente');
  if (repetido) throw errorForo(409, 'Ya tienes un reporte pendiente sobre esta publicación');
  return { tipo: datos.tipo, coleccion, referenciaId: datos.referenciaId, motivo, reportadoPor: usuario.id, estado: 'pendiente' };
}

export default { filtrarLista, antesDeGuardar };
