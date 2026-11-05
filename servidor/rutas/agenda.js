import { Router } from 'express';
import { createHash } from 'node:crypto';
import { notificar } from '../notificar.js';
import { instanteAgenda } from '../fechas-agenda.js';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { puede } from '../permisos.js';
import { conBloqueo } from '../bloqueos.js';
import { gruposDe } from '../acceso.js';
import { filtrarLista, antesDeGuardar, exigirPropietario } from '../ganchos/agenda.js';
import { actividadDelIntento } from '../../publico/js/nucleo/catalogo-actividades.js';

const router = Router();
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
router.use((req, res, next) => {
  try {
    const segmento = req.path.split('/')[1] || '';
    const col = decodeURIComponent(segmento);
    if (col.split('/')[0] === 'agenda' && col !== segmento) return res.status(400).json({ error: 'Ruta de agenda no válida' });
    next();
  } catch { res.status(400).json({ error: 'Ruta no válida' }); }
});
router.use('/agenda', exigirRol(), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const ruta = (metodo, direccion, operacion) => router[metodo](direccion, async (req, res, next) => {
  try {
    if (!await puede(req.usuario, metodo === 'get' ? 'leer' : 'escribir', 'agenda')) throw error(403, 'No tienes acceso a la agenda');
    const resultado = metodo === 'get' ? await operacion(req) : await conBloqueo('agenda', () => operacion(req));
    res.status(metodo === 'post' ? 201 : 200).json(resultado);
  } catch (causa) { next(causa); }
});

async function eventoDe(id) {
  const evento = (await almacen.leer('agenda')).find((e) => e.id === id);
  if (!evento) throw error(404, 'Evento no encontrado');
  return evento;
}

async function presentar(lista, usuario) {
  const intentos = usuario.rol === 'estudiante' ? (await almacen.leer('intentos')).filter((i) => i.usuarioId === usuario.id) : [];
  const grupos = await gruposDe(usuario);
  const asignaturas = await almacen.leer('asignaturas');
  const temas = await almacen.leer('temas');
  return lista.map(({ avisados, ...evento }) => ({ ...evento, puedeEditar: evento.propietarioId === usuario.id,
    grupoNombre: grupos.filter((g) => g.id === evento.grupoId).map((g) => [asignaturas.find((a) => a.id === g.asignaturaId)?.nombre, g.paralelo, g.periodo].filter(Boolean).join(' · '))[0] || '',
    temaNombre: temas.find((t) => t.id === evento.temaId)?.titulo || '',
    completado: evento.tipo === 'fecha-limite' && Boolean(evento.actividad && evento.temaId) && intentos.some((i) =>
      i.actividad === actividadDelIntento(evento.actividad) && i.temaId === evento.temaId && Date.parse(i.fecha) > Date.parse(evento.fecha)) }));
}

ruta('get', '/agenda', async (req) => {
  if (Object.keys(req.query).length) throw error(400, 'La agenda se consulta sin filtros de otros usuarios');
  const eventos = await filtrarLista(await almacen.leer('agenda'), req.usuario);
  eventos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return presentar(eventos, req.usuario);
});
ruta('get', '/agenda/recordatorios', (req) => conBloqueo('agenda', async () => {
  const eventos = await filtrarLista(await almacen.leer('agenda'), req.usuario);
  const ahora = Date.now();
  const lista = [];
  for (const evento of eventos) {
    const inicio = instanteAgenda(evento, 'inicio');
    if (!Number.isFinite(inicio)) continue;
    const avisados = { ...evento.avisados };
    const minutosAvisados = new Set(Array.isArray(avisados[req.usuario.id]) ? avisados[req.usuario.id] : []);
    const revision = createHash('sha256').update(JSON.stringify([
      evento.id, evento.fecha, evento.inicio, evento.fin, evento.todoElDia, evento.grupoId, evento.recordatorios
    ])).digest('hex');
    for (const minutos of new Set(evento.recordatorios || [])) {
      if (![60, 1440].includes(minutos) || minutosAvisados.has(minutos) || ahora < inicio - minutos * 60000) continue;
      const aviso = await notificar(req.usuario.id, {
        tipo: 'agenda',
        mensaje: `Recordatorio (${minutos === 1440 ? '1 día' : '1 hora'} antes): ${evento.titulo}. Inicio: ${new Date(inicio).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}.`,
        enlace: '/paginas/agenda.html',
        clave: `agenda:${revision}:${minutos}`
      });
      minutosAvisados.add(minutos);
      avisados[req.usuario.id] = [...minutosAvisados];
      await almacen.actualizar('agenda', evento.id, { avisados });
      lista.push(aviso);
    }
  }
  return lista;
}));

ruta('get', '/agenda/:id', async (req) => {
  const evento = (await filtrarLista(await almacen.leer('agenda'), req.usuario)).find((e) => e.id === req.params.id);
  if (!evento) throw error(404, 'Evento no encontrado o no disponible');
  return (await presentar([evento], req.usuario))[0];
});
ruta('post', '/agenda', async (req) => {
  const reg = await almacen.agregar('agenda', await antesDeGuardar(req.body, req.usuario, null));
  return (await presentar([reg], req.usuario))[0];
});
ruta('put', '/agenda/:id', async (req) => {
  const anterior = await eventoDe(req.params.id);
  const reg = await almacen.actualizar('agenda', anterior.id, await antesDeGuardar(req.body, req.usuario, anterior));
  return (await presentar([reg], req.usuario))[0];
});
ruta('delete', '/agenda/:id', async (req) => {
  const evento = await eventoDe(req.params.id);
  exigirPropietario(evento, req.usuario);
  await almacen.eliminar('agenda', evento.id);
  return { ok: true, id: evento.id };
});

export default router;
