import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as ganchos from '../ganchos.js';
import { puede } from '../permisos.js';
import { exigirRol } from '../auth.js';
import { conBloqueo } from '../bloqueos.js';
import { errorForo, validarCampos, hiloAccesible, publicacionAccesible, enriquecer } from '../foros.js';
import { mensajeReferenciado, ocultarMensaje } from '../mensajes.js';

const router = Router();
// Impide que nombres de colección codificados eludan estas rutas y lleguen a la API genérica.
router.use((req, res, next) => {
  try {
    const segmento = req.path.split('/')[1] || '';
    const decodificado = decodeURIComponent(segmento);
    if (['foros-hilos', 'foros-respuestas', 'reportes'].includes(decodificado.split('/')[0]) && segmento !== decodificado) {
      return res.status(400).json({ error: 'Usa una ruta de foro válida' });
    }
    next();
  } catch { res.status(400).json({ error: 'Ruta no válida' }); }
});
const envolver = (operacion) => async (req, res, next) => { try { await operacion(req, res); } catch (error) { next(error); } };

async function permiso(req, accion, col, reg) {
  if (!await puede(req.usuario, accion, col, reg)) throw errorForo(403, 'No tienes permiso para realizar esta acción');
}

async function decorar(col, lista, usuario) {
  if (col !== 'reportes') return enriquecer(col, lista, usuario);
  return Promise.all(lista.map(async (reg) => {
    let publicacion = null;
    try {
      publicacion = reg.tipo === 'mensaje'
        ? (await mensajeReferenciado(reg.referenciaId, usuario, { moderacion: true })).mensaje
        : (await enriquecer(reg.coleccion, [await publicacionAccesible(reg.coleccion, reg.referenciaId, usuario)], usuario))[0];
    }
    catch (error) { if (![400, 403, 404].includes(error.estado)) throw error; }
    return { ...reg, publicacion };
  }));
}

router.get('/foros-hilos/:id/respuestas', exigirRol(), envolver(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  await permiso(req, 'leer', 'foros-respuestas');
  await hiloAccesible(req.params.id, req.usuario);
  const pagina = Number(req.query.pagina || 1);
  if (!Number.isSafeInteger(pagina) || pagina < 1) throw errorForo(400, 'Página no válida');
  const visibles = await ganchos.aplicar('foros-respuestas', 'filtrarLista', await almacen.buscar('foros-respuestas', { hiloId: req.params.id }), req.usuario);
  visibles.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  res.json({ items: await enriquecer('foros-respuestas', visibles.slice((pagina - 1) * 20, pagina * 20), req.usuario), pagina,
    total: visibles.length, paginas: Math.max(1, Math.ceil(visibles.length / 20)), tamano: 20 });
}));

router.post('/reportes/:id/resolver', exigirRol('admin'), envolver(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await conBloqueo('foros', async () => {
    validarCampos(req.body, ['accion']);
    if (!['ocultar', 'descartar'].includes(req.body.accion)) throw errorForo(400, 'Acción no válida');
    const reporte = (await almacen.leer('reportes')).find((r) => r.id === req.params.id);
    if (!reporte) throw errorForo(404, 'Reporte no encontrado');
    await permiso(req, 'escribir', 'reportes', reporte);
    if (reporte.estado === 'resuelto') return reporte;
    if (req.body.accion === 'ocultar') {
      if (reporte.tipo === 'mensaje') {
        await conBloqueo('mensajeria', () => ocultarMensaje(reporte.referenciaId, req.usuario));
      } else {
        const reg = await publicacionAccesible(reporte.coleccion, reporte.referenciaId, req.usuario);
        const campo = reporte.coleccion === 'foros-hilos' ? 'oculto' : 'oculta';
        const cambios = await ganchos.aplicar(reporte.coleccion, 'antesDeGuardar', { [campo]: true }, req.usuario, reg);
        await almacen.actualizar(reporte.coleccion, reg.id, cambios);
      }
    }
    const cambios = await ganchos.aplicar('reportes', 'antesDeGuardar', { estado: 'resuelto' }, req.usuario, reporte);
    return almacen.actualizar('reportes', reporte.id, { ...cambios, resolucion: req.body.accion, resueltoPor: req.usuario.id, resueltoEn: new Date().toISOString() });
  }));
}));

for (const col of ['foros-hilos', 'foros-respuestas', 'reportes']) {
  router.use(`/${col}`, exigirRol(), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get(`/${col}`, envolver(async (req, res) => {
    await permiso(req, 'leer', col);
    const campos = col === 'foros-hilos' ? ['asignaturaId', 'temaId'] : col === 'foros-respuestas' ? ['hiloId'] : ['estado'];
    if (Object.keys(req.query).some((c) => !campos.includes(c))) throw errorForo(400, 'Filtro no válido');
    let lista = await ganchos.aplicar(col, 'filtrarLista', await almacen.buscar(col, req.query), req.usuario);
    lista.sort(col === 'foros-hilos' ? (a, b) => Number(b.fijado) - Number(a.fijado) || (b.ultimoMovimiento || b.fecha).localeCompare(a.ultimoMovimiento || a.fecha)
      : (a, b) => b.fecha.localeCompare(a.fecha));
    res.json(await decorar(col, lista, req.usuario));
  }));
  router.get(`/${col}/:id`, envolver(async (req, res) => {
    await permiso(req, 'leer', col);
    const lista = await ganchos.aplicar(col, 'filtrarLista', await almacen.leer(col), req.usuario);
    const reg = lista.find((r) => r.id === req.params.id);
    if (!reg) throw errorForo(404, 'Publicación no encontrada o no disponible');
    res.json((await decorar(col, [reg], req.usuario))[0]);
  }));
  for (const metodo of ['post', 'put']) router[metodo](metodo === 'post' ? `/${col}` : `/${col}/:id`, envolver(async (req, res) => {
    const resultado = await conBloqueo('foros', async () => {
      const anterior = metodo === 'put' ? (await almacen.leer(col)).find((r) => r.id === req.params.id) : null;
      if (metodo === 'put' && !anterior) throw errorForo(404, 'Publicación no encontrada');
      await permiso(req, 'escribir', col, anterior || req.body);
      const datos = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);
      const reg = anterior ? await almacen.actualizar(col, anterior.id, datos) : await almacen.agregar(col, datos);
      return ganchos.aplicar(col, 'despuesDeGuardar', reg, req.usuario, anterior);
    });
    // Crear un reporte no concede acceso a los reportes de otras personas.
    res.status(metodo === 'post' ? 201 : 200).json(resultado);
  }));
  router.delete(`/${col}/:id`, (req, res) => res.status(405).json({ error: 'Las publicaciones se moderan ocultándolas; no se eliminan' }));
}

export default router;
