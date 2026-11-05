import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import { exigirEdicionTema } from '../ganchos/preguntas.js';

const router = Router();

// La API genérica no ejecuta filtrarLista al consultar o eliminar por ID.
router.use('/preguntas/:id', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const pregunta = (await almacen.leer('preguntas')).find((item) => item.id === req.params.id);
    if (!pregunta) return res.status(404).json({ error: 'Pregunta no encontrada' });
    await exigirEdicionTema(pregunta.temaId, req.usuario);
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
