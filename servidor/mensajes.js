import * as almacen from './almacen.js';
import { gruposDe, docentesDe, estudiantesDe } from './acceso.js';

export const errorMensaje = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
export const resumirUsuario = ({ id, nombre, apellido, rol }) => ({ id, nombre, apellido, rol });
export const ordenarMensajes = (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id);

export function validarCuerpo(datos, campos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).some((c) => !campos.includes(c))) {
    throw errorMensaje(400, 'Los datos de la solicitud no son válidos');
  }
}

export function validarTexto(texto) {
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 2000) throw errorMensaje(400, 'Escribe un mensaje de hasta 2.000 caracteres');
  return texto.trim();
}

export async function hayBloqueo(yo, otro) {
  return (await almacen.leer('bloqueos')).some((b) =>
    b.usuarioId === yo && b.bloqueadoId === otro || b.usuarioId === otro && b.bloqueadoId === yo);
}

export async function contactosDe(usuario) {
  const usuarios = (await almacen.leer('usuarios')).filter((u) => u.activo !== false && u.id !== usuario.id);
  const ids = new Set();
  if (usuario.rol === 'admin') usuarios.forEach((u) => ids.add(u.id));
  if (usuario.rol === 'docente') {
    (await estudiantesDe(usuario.id)).filter((u) => u.rol === 'estudiante').forEach((u) => ids.add(u.id));
    usuarios.filter((u) => u.rol === 'docente').forEach((u) => ids.add(u.id));
  }
  if (usuario.rol === 'estudiante') {
    (await docentesDe(usuario.id)).filter((u) => u.rol === 'docente').forEach((u) => ids.add(u.id));
    if ((await almacen.leerConfig('ajustes'))?.chatEntreEstudiantes === true) {
      for (const grupo of await gruposDe(usuario)) for (const id of grupo.estudiantes || []) ids.add(id);
    }
  }
  const bloqueos = await almacen.leer('bloqueos');
  return usuarios.filter((u) => ids.has(u.id) && !bloqueos.some((b) =>
    b.usuarioId === usuario.id && b.bloqueadoId === u.id || b.usuarioId === u.id && b.bloqueadoId === usuario.id
  )).map(resumirUsuario).sort((a, b) => `${a.nombre || ''} ${a.apellido || ''}`.localeCompare(`${b.nombre || ''} ${b.apellido || ''}`, 'es'));
}

export async function conversacionDe(id, usuario) {
  if (!/^con_\d{6,}$/.test(id || '')) throw errorMensaje(400, 'Conversación no válida');
  const conversacion = (await almacen.leer('conversaciones')).find((c) => c.id === id && c.participantes?.includes(usuario.id));
  if (!conversacion) throw errorMensaje(404, 'Conversación no encontrada');
  return conversacion;
}

// Solo se llama dentro de la cola de mensajería.
export async function buscarOCrear(yo, otro) {
  const existente = (await almacen.leer('conversaciones')).find((c) => c.participantes?.length === 2 && c.participantes.includes(yo) && c.participantes.includes(otro));
  return existente || almacen.agregar('conversaciones', { participantes: [yo, otro], ultimo: null, leidoHasta: {}, leidoHastaId: {} });
}

export async function mensajesDe(conversacion) {
  return (await almacen.leer(`mensajes/${conversacion.id}`)).sort(ordenarMensajes);
}

export function sinLeer(mensaje, conversacion, usuarioId) {
  if (mensaje.oculto || mensaje.autorId === usuarioId) return false;
  const hasta = conversacion.leidoHasta?.[usuarioId];
  return !hasta || mensaje.fecha > hasta || mensaje.fecha === hasta &&
    mensaje.id > (conversacion.leidoHastaId?.[usuarioId] ?? '\uffff');
}

export async function comprobarCupo(usuarioId, cantidad = 1) {
  const limite = Date.now() - 60000;
  let total = 0;
  for (const conv of (await almacen.leer('conversaciones')).filter((c) => c.participantes?.includes(usuarioId))) {
    total += (await mensajesDe(conv)).filter((m) => m.autorId === usuarioId && Date.parse(m.fecha) > limite).length;
  }
  if (total + cantidad > 30) throw errorMensaje(429, 'Has enviado muchos mensajes. Espera un momento antes de continuar.');
}

export async function enviarMensaje(conv, autorId, texto) {
  const mensaje = await almacen.agregar(`mensajes/${conv.id}`, { autorId, texto, oculto: false });
  await almacen.actualizar('conversaciones', conv.id, { ultimo: { texto: mensaje.texto, fecha: mensaje.fecha, autorId } });
  return mensaje;
}

export async function mensajeReferenciado(referenciaId, usuario, { moderacion = false } = {}) {
  const partes = typeof referenciaId === 'string' && /^(con_\d{6,})\/(men_\d{6,})$/.exec(referenciaId);
  if (!partes) throw errorMensaje(400, 'La referencia del mensaje no es válida');
  const [, convId, mensajeId] = partes;
  let conversacion;
  if (moderacion && usuario?.rol === 'admin') conversacion = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
  else conversacion = await conversacionDe(convId, usuario);
  if (!conversacion) throw errorMensaje(404, 'Conversación no encontrada');
  const mensajes = await mensajesDe(conversacion);
  const indice = mensajes.findIndex((m) => m.id === mensajeId && (moderacion || !m.oculto));
  if (indice < 0) throw errorMensaje(404, 'Mensaje no encontrado');
  return { conversacion, mensajes, indice, mensaje: mensajes[indice] };
}

export async function ocultarMensaje(referenciaId, usuario) {
  if (usuario?.rol !== 'admin') throw errorMensaje(403, 'Solo administración puede ocultar mensajes');
  const { conversacion, mensaje } = await mensajeReferenciado(referenciaId, usuario, { moderacion: true });
  const oculto = await almacen.actualizar(`mensajes/${conversacion.id}`, mensaje.id, { oculto: true });
  const ultimo = (await mensajesDe(conversacion)).filter((m) => !m.oculto).at(-1);
  await almacen.actualizar('conversaciones', conversacion.id, { ultimo: ultimo ? { texto: ultimo.texto, fecha: ultimo.fecha, autorId: ultimo.autorId } : null });
  return oculto;
}
