import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { filtrarLista, exigirEdicionSimulacion } from '../ganchos/simulaciones.js';

const router = Router();
// Protege también las variantes codificadas que podrían llegar a la API genérica.
router.use((req, res, next) => {
  try {
    const segmento = req.path.split('/')[1] || '', decodificado = decodeURIComponent(segmento);
    if (decodificado.split('/')[0] === 'simulaciones' && segmento !== decodificado) return res.status(400).json({ error: 'Usa una ruta de simulación válida' });
    next();
  } catch { res.status(400).json({ error: 'Ruta no válida' }); }
});

// La API genérica no filtra la lectura por ID ni valida el gancho al eliminar.
router.use('/simulaciones/:id', exigirRol(), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const simulacion = (await almacen.leer('simulaciones')).find((s) => s.id === req.params.id);
    if (!simulacion) return res.status(404).json({ error: 'Simulación no encontrada' });
    if (['GET', 'HEAD'].includes(req.method)) {
      if (!(await filtrarLista([simulacion], req.usuario)).length) return res.status(403).json({ error: 'No tienes acceso a esta simulación' });
    } else await exigirEdicionSimulacion(simulacion.temaId, req.usuario);
    next();
  } catch (error) { next(error); }
});

export default router;
