import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { conBloqueo } from '../bloqueos.js';
import { contactosDe, conversacionDe, buscarOCrear, mensajesDe, sinLeer, ordenarMensajes, resumirUsuario,
  errorMensaje, validarCuerpo, validarTexto, hayBloqueo, comprobarCupo, enviarMensaje, mensajeReferenciado, ocultarMensaje } from '../mensajes.js';

const router = Router();
router.use('/mensajes', exigirRol(), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const ruta = (metodo, direccion, operacion) => router[metodo](direccion, async (req, res, next) => {
  try {
    const resultado = metodo === 'get' ? await operacion(req) : await conBloqueo('mensajeria', () => operacion(req));
    res.status(metodo === 'post' ? 201 : 200).json(resultado);
  } catch (error) { next(error); }
});

async function resumenes(usuario) {
  const usuarios = await almacen.leer('usuarios');
  const bloqueos = await almacen.leer('bloqueos');
  const mias = (await almacen.leer('conversaciones')).filter((c) => c.participantes?.includes(usuario.id));
  const lista = await Promise.all(mias.map(async (conv) => {
    const mensajes = await mensajesDe(conv);
    const otro = usuarios.find((u) => conv.participantes.includes(u.id) && u.id !== usuario.id);
    const ultimo = mensajes.filter((m) => !m.oculto).at(-1);
    const bloqueoPropio = bloqueos.some((b) => b.usuarioId === usuario.id && b.bloqueadoId === otro?.id);
    const bloqueo = bloqueoPropio || bloqueos.some((b) => b.usuarioId === otro?.id && b.bloqueadoId === usuario.id);
    return { id: conv.id, participante: otro ? resumirUsuario(otro) : null, bloqueadoPorMi: bloqueoPropio, bloqueado: bloqueo,
      ultimo: ultimo ? { texto: ultimo.texto, fecha: ultimo.fecha, autorId: ultimo.autorId } : null,
      noLeidos: mensajes.filter((m) => sinLeer(m, conv, usuario.id)).length };
  }));
  return lista.sort((a, b) => (b.ultimo?.fecha || '').localeCompare(a.ultimo?.fecha || '') || a.id.localeCompare(b.id));
}

// Rutas fijas antes de las rutas con identificadores de conversación.
ruta('get', '/mensajes/contactos', (req) => contactosDe(req.usuario));
ruta('get', '/mensajes/conversaciones', (req) => resumenes(req.usuario));
ruta('post', '/mensajes/conversaciones', async (req) => {
  validarCuerpo(req.body, ['con']);
  if (!(await contactosDe(req.usuario)).some((u) => u.id === req.body.con)) throw errorMensaje(403, 'Este contacto no está disponible');
  return buscarOCrear(req.usuario.id, req.body.con);
});
ruta('get', '/mensajes/no-leidos', async (req) => ({ total: (await resumenes(req.usuario)).reduce((n, c) => n + c.noLeidos, 0) }));

ruta('post', '/mensajes/difusion', async (req) => {
  validarCuerpo(req.body, ['grupoId', 'texto']);
  const texto = validarTexto(req.body.texto);
  const grupo = (await almacen.leer('distributivo')).find((g) => g.id === req.body.grupoId && g.docenteId === req.usuario.id);
  if (req.usuario.rol !== 'docente' || !grupo) throw errorMensaje(403, 'Solo el docente del grupo puede enviar esta difusión');
  const contactos = await contactosDe(req.usuario);
  const estudiantes = [...new Set(grupo.estudiantes || [])];
  const destinos = contactos.filter((u) => u.rol === 'estudiante' && estudiantes.includes(u.id));
  await comprobarCupo(req.usuario.id, destinos.length);
  const conversaciones = [];
  for (const destino of destinos) {
    const conv = await buscarOCrear(req.usuario.id, destino.id);
    const mensaje = await enviarMensaje(conv, req.usuario.id, texto);
    conversaciones.push({ id: conv.id, con: destino.id, mensajeId: mensaje.id });
  }
  return { enviados: conversaciones.length, omitidos: estudiantes.length - destinos.length, conversaciones };
});

ruta('post', '/mensajes/bloquear', async (req) => {
  validarCuerpo(req.body, ['usuarioId']);
  if (req.body.usuarioId === req.usuario.id || !(await almacen.leer('usuarios')).some((u) => u.id === req.body.usuarioId)) throw errorMensaje(400, 'Selecciona otro usuario válido');
  const anterior = (await almacen.leer('bloqueos')).find((b) => b.usuarioId === req.usuario.id && b.bloqueadoId === req.body.usuarioId);
  return anterior || almacen.agregar('bloqueos', { usuarioId: req.usuario.id, bloqueadoId: req.body.usuarioId });
});
ruta('delete', '/mensajes/bloquear/:usuarioId', async (req) => {
  const bloqueos = (await almacen.leer('bloqueos')).filter((b) => b.usuarioId === req.usuario.id && b.bloqueadoId === req.params.usuarioId);
  for (const bloqueo of bloqueos) await almacen.eliminar('bloqueos', bloqueo.id);
  return { ok: true, bloqueado: await hayBloqueo(req.usuario.id, req.params.usuarioId) };
});

ruta('get', '/mensajes/reporte/:reporteId', async (req) => {
  if (req.usuario.rol !== 'admin') throw errorMensaje(403, 'Solo administración puede revisar reportes');
  const reporte = (await almacen.leer('reportes')).find((r) => r.id === req.params.reporteId && r.tipo === 'mensaje');
  if (!reporte) throw errorMensaje(404, 'Reporte de mensaje no encontrado');
  const { conversacion, mensajes, indice, mensaje } = await mensajeReferenciado(reporte.referenciaId, req.usuario, { moderacion: true });
  const anteriores = mensajes.slice(Math.max(0, indice - 5), indice);
  const autorIds = new Set([...anteriores, mensaje].map((m) => m.autorId));
  const autores = (await almacen.leer('usuarios')).filter((u) => autorIds.has(u.id)).map((u) => ({ ...resumirUsuario(u), activo: u.activo !== false }));
  return { reporteId: reporte.id, conversacionId: conversacion.id, mensaje, anteriores, autores };
});
ruta('post', '/mensajes/ocultar', async (req) => {
  validarCuerpo(req.body, ['referenciaId']);
  return ocultarMensaje(req.body.referenciaId, req.usuario);
});

ruta('get', '/mensajes/:convId', async (req) => {
  const conv = await conversacionDe(req.params.convId, req.usuario);
  if (Object.keys(req.query).some((k) => !['desde', 'antes'].includes(k))) throw errorMensaje(400, 'Filtro no válido');
  const todos = await mensajesDe(conv);
  const visibles = todos.filter((m) => !m.oculto);
  let lista = visibles;
  for (const campo of ['desde', 'antes']) {
    const cursor = req.query[campo];
    if (cursor === undefined) continue;
    if (typeof cursor !== 'string') throw errorMensaje(400, 'Cursor no válido');
    const mensaje = todos.find((m) => m.id === cursor);
    if (!mensaje && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(cursor) || !Number.isFinite(Date.parse(cursor)))) throw errorMensaje(400, 'Usa la fecha ISO o el identificador de un mensaje de esta conversación como cursor');
    lista = lista.filter((m) => {
      const comparacion = mensaje ? ordenarMensajes(m, mensaje) : Date.parse(m.fecha) - Date.parse(cursor);
      return campo === 'desde' ? comparacion > 0 : comparacion < 0;
    });
  }
  return req.query.desde ? lista.slice(0, 50) : lista.slice(-50);
});
ruta('post', '/mensajes/:convId', async (req) => {
  validarCuerpo(req.body, ['texto']);
  const texto = validarTexto(req.body.texto);
  const conv = await conversacionDe(req.params.convId, req.usuario);
  const otroId = conv.participantes.find((id) => id !== req.usuario.id);
  const otro = (await almacen.leer('usuarios')).find((u) => u.id === otroId && u.activo !== false);
  if (!otro || await hayBloqueo(req.usuario.id, otroId)) throw errorMensaje(403, 'No puedes enviar mensajes a este contacto');
  // Administración puede iniciar contacto; el participante conserva la opción de responder.
  if (otro.rol !== 'admin' && !(await contactosDe(req.usuario)).some((u) => u.id === otroId)) throw errorMensaje(403, 'Este contacto ya no está disponible');
  await comprobarCupo(req.usuario.id);
  return enviarMensaje(conv, req.usuario.id, texto);
});
ruta('post', '/mensajes/:convId/leido', async (req) => {
  validarCuerpo(req.body ?? {}, []);
  const conv = await conversacionDe(req.params.convId, req.usuario);
  const ultimo = (await mensajesDe(conv)).filter((m) => !m.oculto).at(-1);
  const fecha = ultimo?.fecha || new Date().toISOString();
  await almacen.actualizar('conversaciones', conv.id, {
    leidoHasta: { ...conv.leidoHasta, [req.usuario.id]: fecha },
    leidoHastaId: { ...conv.leidoHastaId, [req.usuario.id]: ultimo?.id || '' }
  });
  return { ok: true, leidoHasta: fecha };
});

export default router;
