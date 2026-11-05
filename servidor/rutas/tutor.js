import { Router } from 'express';
import { exigirRol } from '../auth.js';
import { consultarTutor } from '../tutor.js';

const router = Router();
router.use('/tutor', exigirRol('estudiante'), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
for (const metodo of ['get', 'delete']) {
  router[metodo]('/tutor/:asignaturaId', async (req, res, next) => {
    try { res.json(await consultarTutor(req.usuario, req.headers.authorization, req.params.asignaturaId, metodo === 'delete')); }
    catch (error) { next(error); }
  });
}
export default router;
