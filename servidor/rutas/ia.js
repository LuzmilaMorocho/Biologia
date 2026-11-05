import { Router } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exigirRol } from '../auth.js';
import { ejecutarTarea } from '../ia.js';
import { responderTutor, responderTutorTema } from '../tutor.js';
import prepararSopa from '../preparadores/sopa-letras.js';
import prepararRol from '../preparadores/rol-simulacion.js';
import prepararEvaluacionRol from '../preparadores/evaluar-rol.js';
import { evaluarRolConIA } from '../rol-simulacion.js';

const router = Router();
const tareasSesion = new Set(['tutor', 'rol-simulacion', 'evaluar-rol']);

async function responderRol(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try {
    const datos = await prepararRol(req.body, req.usuario);
    const respuesta = await ejecutarTarea('rol-simulacion', datos, req.usuario, { formato: 'texto' });
    res.json({ respuesta: respuesta.trim().slice(0, 1000) });
  } catch (error) { next(error); }
}
router.post('/ia/rol-simulacion', exigirRol(), responderRol);

async function evaluarRol(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try { res.json(await evaluarRolConIA(await prepararEvaluacionRol(req.body, req.usuario), req.usuario)); }
  catch (error) { next(error); }
}
router.post('/ia/evaluar-rol', exigirRol(), evaluarRol);

router.get('/ia/prueba', exigirRol('admin'), async (req, res, next) => {
  try {
    const resultado = await ejecutarTarea('prueba', {}, req.usuario, { formato: 'texto' });
    res.json({ resultado });
  } catch (error) {
    next(error);
  }
});

router.post('/ia/tutor', exigirRol('estudiante'), async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (req.body && Object.hasOwn(req.body, 'asignaturaId')) {
      const resultado = await responderTutor(req.body, req.usuario, req.headers.authorization);
      res.json({ ...resultado, respuesta: (resultado.mensajes.at(-1)?.texto || '').slice(0, 700) });
    } else res.json(await responderTutorTema(req.body, req.usuario));
  }
  catch (error) { next(error); }
});

router.post('/ia/sopa-letras', exigirRol('estudiante'), async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const datos = await prepararSopa(req.body, req.usuario);
    const resultado = await ejecutarTarea('sopa-letras', datos, req.usuario, { formato: 'json' });
    if (!resultado.length) throw Object.assign(new Error('No quedan suficientes palabras nuevas en este contenido para esta dificultad. Prueba otra dificultad o cambia de tema.'), { estado: 409 });
    // Práctica temporal: no crea ni aprueba términos en el glosario compartido.
    res.json(resultado.map(({ termino, definicion, pista, retroalimentacion }) => ({ termino, definicion, pista, retroalimentacion })));
  } catch (error) { next(error); }
});

router.post('/ia/:tarea', exigirRol(), async (req, res, next) => {
  try {
    const { tarea } = req.params;
    if (tarea === 'rol-simulacion') return responderRol(req, res, next);
    if (tarea === 'evaluar-rol') return evaluarRol(req, res, next);
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(tarea)) {
      throw Object.assign(new Error('Nombre de tarea no válido'), { estado: 400 });
    }
    if (!tarea.startsWith('generar-') && !tareasSesion.has(tarea)) {
      throw Object.assign(new Error('Tarea de IA no disponible'), { estado: 404 });
    }
    if (tarea.startsWith('generar-') && !['docente', 'admin'].includes(req.usuario.rol)) {
      throw Object.assign(new Error('Solo docentes y administradores pueden generar contenido'), { estado: 403 });
    }
    const archivo = path.resolve('servidor', 'preparadores', `${tarea}.js`);
    try {
      await fs.access(archivo);
    } catch (error) {
      if (error.code === 'ENOENT') throw Object.assign(new Error('Tarea de IA no disponible'), { estado: 404 });
      throw error;
    }
    const { default: preparar } = await import(pathToFileURL(archivo).href);
    const datos = await preparar(req.body, req.usuario);
    const formato = tarea.startsWith('generar-') || tarea === 'evaluar-rol' ? 'json' : 'texto';
    res.json(await ejecutarTarea(tarea, datos, req.usuario, { formato }));
  } catch (error) {
    next(error);
  }
});

export default router;
