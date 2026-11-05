import { Router } from 'express';
import { exigirRol } from '../auth.js';
import { obtenerConfiguracionIA, configuracionPublica, guardarConfiguracionIA, listarModelosGemini } from '../configuracion-ia.js';

const router = Router();
router.use('/admin/ia', exigirRol('admin'), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/admin/ia', async (req, res, next) => {
  try { res.json(configuracionPublica(await obtenerConfiguracionIA())); } catch (error) { next(error); }
});
router.put('/admin/ia', async (req, res, next) => {
  try { res.json(await guardarConfiguracionIA(req.body)); } catch (error) { next(error); }
});
router.get('/admin/ia/modelos', async (req, res, next) => {
  try { res.json(await listarModelosGemini()); } catch (error) { next(error); }
});
export default router;
