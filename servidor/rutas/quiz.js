import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { asignaturaDeTema, asignaturasDe, gruposDe } from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';
import { conBloqueo } from '../bloqueos.js';
import { normalizar, barajar } from '../../publico/js/nucleo/util.js';
import { errorPregunta } from '../../publico/js/nucleo/preguntas.js';

const router = Router();
const nombres = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
const esId = (valor) => typeof valor === 'string' && valor.trim().length > 0;
const porcentajeDe = (aciertos, total) => Math.round(aciertos * 10000 / total) / 100;

router.use('/quiz', exigirRol('estudiante'), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function cuerpoValido(cuerpo, campos) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((campo) => !campos.includes(campo))) throw error(400, 'Datos de quiz no válidos');
  return cuerpo;
}

async function accesoTema(temaId, usuario) {
  if (!esId(temaId)) throw error(400, 'Selecciona un tema');
  const tema = (await almacen.leer('temas')).find((item) => item.id === temaId);
  const asignatura = tema ? await asignaturaDeTema(temaId) : null;
  if (!tema || !asignatura) throw error(404, 'Tema no encontrado');
  const unidad = (await almacen.leer('unidades')).find((item) => item.id === tema.unidadId);
  const asignaturas = await asignaturasDe(usuario);
  if (tema.estado !== 'publicado' || unidad?.visible === false || !asignaturas.some((item) => item.id === asignatura.id)) {
    throw error(403, 'No tienes acceso al quiz de este tema');
  }
  return { tema, asignatura };
}

async function reglasQuiz() {
  const reglas = (await almacen.leerConfig('reglas-gamificacion')).quiz;
  if (!Number.isInteger(reglas?.preguntasPorNivel) || reglas.preguntasPorNivel < 1 ||
      !Number.isFinite(reglas.porcentajeAprobacion) || reglas.porcentajeAprobacion < 0 || reglas.porcentajeAprobacion > 100) {
    throw error(503, 'Las reglas del quiz no están configuradas correctamente');
  }
  return reglas;
}

async function logroDe(usuario) {
  return (await almacen.leer('logros')).find((item) => item.usuarioId === usuario.id);
}

function nivelAlcanzado(logro, temaId) {
  const valor = Number(logro?.nivelQuiz?.[temaId] || 0);
  return Number.isInteger(valor) ? Math.max(0, Math.min(5, valor)) : 0;
}

async function avisarBanco(usuario, tema, asignatura, nivel) {
  // Compartido entre estudiantes y persistente mediante las notificaciones del día.
  await conBloqueo(`quiz-aviso:${tema.id}:${nivel}`, async () => {
    const docentes = [...new Set((await gruposDe(usuario)).filter((grupo) => grupo.asignaturaId === asignatura.id).map((grupo) => grupo.docenteId).filter(Boolean))];
    const enlace = `/paginas/banco-preguntas.html?temaId=${encodeURIComponent(tema.id)}&nivel=${nivel}`;
    const dia = (fecha) => new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
    const hoy = dia(Date.now());
    const notificaciones = await almacen.leer('notificaciones');
    for (const docenteId of docentes) {
      const avisado = notificaciones.some((item) => item.usuarioId === docenteId && item.tipo === 'quiz-banco-insuficiente' && item.enlace === enlace && dia(item.fecha) === hoy);
      if (!avisado) await notificar(docenteId, { tipo: 'quiz-banco-insuficiente', enlace,
        mensaje: `Amplía el banco aprobado de «${tema.titulo}», nivel ${nivel}: no hay suficientes preguntas no vistas para un nuevo quiz.` });
    }
  });
}

function ruta(metodo, direccion, operacion) {
  router[metodo](direccion, async (req, res, next) => {
    try {
      const resultado = await conBloqueo(`quiz:${req.usuario.id}`, () => operacion(req));
      res.json(resultado);
    } catch (causa) { next(causa); }
  });
}

async function sesionDe(sesionId, usuario) {
  if (!esId(sesionId)) throw error(400, 'Indica una sesión de quiz válida');
  const sesion = (await almacen.leer('quiz-sesiones')).find((item) => item.id === sesionId);
  if (!sesion) throw error(404, 'Sesión de quiz no encontrada');
  if (sesion.usuarioId !== usuario.id) throw error(403, 'Esta sesión de quiz pertenece a otro estudiante');
  await accesoTema(sesion.temaId, usuario);
  return sesion;
}

ruta('get', '/quiz/estado', async (req) => {
  const { temaId } = req.query;
  await accesoTema(temaId, req.usuario);
  const maximo = nivelAlcanzado(await logroDe(req.usuario), temaId);
  const [intentos, sesiones] = await Promise.all([almacen.leer('intentos'), almacen.leer('quiz-sesiones')]);
  return { niveles: nombres.map((nombre, indice) => {
    const nivel = indice + 1;
    const porcentajes = intentos.filter((item) => item.usuarioId === req.usuario.id && item.actividad === 'quiz' && item.temaId === temaId && Number(item.nivel) === nivel && item.maximo > 0)
      .map((item) => porcentajeDe(item.puntaje, item.maximo));
    porcentajes.push(...sesiones.filter((item) => item.usuarioId === req.usuario.id && item.temaId === temaId && item.nivel === nivel && item.finalizada && item.resultado)
      .map((item) => item.resultado.porcentaje));
    return { nivel, nombre, estado: nivel <= maximo ? 'aprobado' : nivel === 1 || nivel <= maximo + 1 ? 'disponible' : 'bloqueado', mejorPorcentaje: Math.max(0, ...porcentajes) };
  }) };
});

ruta('post', '/quiz/iniciar', async (req) => {
  const { temaId, nivel } = cuerpoValido(req.body, ['temaId', 'nivel']);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) throw error(400, 'El nivel debe ser un entero de 1 a 5');
  const { tema, asignatura } = await accesoTema(temaId, req.usuario);
  if (nivel > nivelAlcanzado(await logroDe(req.usuario), temaId) + 1) throw error(403, 'Aprueba el nivel anterior para continuar');
  const reglas = await reglasQuiz();
  const banco = (await almacen.buscar('preguntas', { temaId, nivel, estado: 'aprobado' })).filter((item) => !errorPregunta(item));
  const anteriores = (await almacen.leer('quiz-sesiones')).filter((item) => item.usuarioId === req.usuario.id);
  const vistas = new Map();
  for (const sesion of anteriores) {
    const fecha = Date.parse(sesion.inicio || sesion.fecha) || 0;
    for (const id of sesion.preguntasIds || []) vistas.set(id, Math.max(vistas.get(id) || 0, fecha));
  }
  const nuevas = barajar(banco.filter((item) => !vistas.has(item.id)));
  if (nuevas.length < reglas.preguntasPorNivel) await avisarBanco(req.usuario, tema, asignatura, nivel);
  if (banco.length < reglas.preguntasPorNivel) throw error(409, 'Aún no hay suficientes preguntas aprobadas para iniciar este nivel. Espera a que el docente amplíe el banco.');
  const repetidas = banco.filter((item) => vistas.has(item.id)).sort((a, b) => vistas.get(a.id) - vistas.get(b.id) || a.id.localeCompare(b.id));
  const elegidas = [...nuevas, ...repetidas].slice(0, reglas.preguntasPorNivel);
  const sesion = await almacen.agregar('quiz-sesiones', {
    usuarioId: req.usuario.id, temaId, nivel, preguntasIds: elegidas.map((item) => item.id), respuestas: {}, inicio: new Date().toISOString(), finalizada: false,
    porcentajeAprobacion: reglas.porcentajeAprobacion,
    // Copia privada para mantener la corrección aunque el banco se edite.
    preguntas: elegidas.map(({ id, tipo, enunciado, opciones, correcta, retroalimentacion }) => ({ id, tipo, enunciado, opciones, correcta, retroalimentacion }))
  });
  return { sesionId: sesion.id, preguntas: sesion.preguntas.map(({ id, tipo, enunciado, opciones }) => ({ id, tipo, enunciado, opciones })) };
});

ruta('post', '/quiz/responder', async (req) => {
  const { sesionId, preguntaId, respuesta } = cuerpoValido(req.body, ['sesionId', 'preguntaId', 'respuesta']);
  const sesion = await sesionDe(sesionId, req.usuario);
  if (sesion.finalizada) throw error(409, 'Este quiz ya finalizó');
  if (sesion.cerrando) throw error(409, 'Este quiz ya inició su cierre; no admite más respuestas');
  const pregunta = sesion.preguntas?.find((item) => item.id === preguntaId);
  if (!pregunta || !sesion.preguntasIds.includes(preguntaId)) throw error(400, 'La pregunta no pertenece a esta sesión');
  if (Object.hasOwn(sesion.respuestas, preguntaId)) throw error(409, 'Esta pregunta ya fue respondida');
  const valida = pregunta.tipo === 'opcion' ? Number.isInteger(respuesta) && respuesta >= 0 && respuesta < 4
    : pregunta.tipo === 'vf' ? typeof respuesta === 'boolean' : typeof respuesta === 'string' && respuesta.trim().length > 0 && respuesta.length <= 1000;
  if (!valida) throw error(400, 'La respuesta no tiene el formato esperado');
  const correcto = pregunta.tipo === 'completar' ? normalizar(respuesta) === normalizar(pregunta.correcta) : respuesta === pregunta.correcta;
  const correcta = pregunta.tipo === 'opcion' ? pregunta.opciones[pregunta.correcta] : pregunta.tipo === 'vf' ? pregunta.correcta ? 'Verdadero' : 'Falso' : pregunta.correcta;
  const resultado = { correcto, retroalimentacion: pregunta.retroalimentacion, correcta };
  await almacen.actualizar('quiz-sesiones', sesion.id, { respuestas: { ...sesion.respuestas, [preguntaId]: { respuesta, ...resultado, fecha: new Date().toISOString() } } });
  return resultado;
});

ruta('post', '/quiz/finalizar', async (req) => {
  const { sesionId } = cuerpoValido(req.body, ['sesionId']);
  const sesion = await sesionDe(sesionId, req.usuario);
  if (sesion.finalizada && sesion.resultado) return sesion.resultado;
  if (sesion.finalizada) throw error(409, 'Este quiz ya finalizó');
  const total = sesion.preguntasIds.length;
  if (!total || !Array.isArray(sesion.preguntas)) throw error(409, 'La sesión de quiz no contiene preguntas válidas');
  const aciertos = sesion.preguntasIds.filter((id) => sesion.respuestas[id]?.correcto === true).length;
  const aprobado = aciertos * 100 / total >= sesion.porcentajeAprobacion;
  const base = { porcentaje: porcentajeDe(aciertos, total), aprobado, aciertos, total,
    repasar: sesion.preguntas.filter((pregunta) => sesion.respuestas[pregunta.id]?.correcto !== true).map((pregunta) => pregunta.retroalimentacion) };
  if (!sesion.cerrando) await almacen.actualizar('quiz-sesiones', sesion.id, { cerrando: true });
  if (aprobado) {
    // Actualizar antes del intento para que la evaluación de insignias vea el nivel.
    await conBloqueo(`gamificacion:${req.usuario.id}`, async () => {
      const logro = await logroDe(req.usuario);
      const nivelQuiz = { ...(logro?.nivelQuiz || {}), [sesion.temaId]: Math.max(nivelAlcanzado(logro, sesion.temaId), sesion.nivel) };
      if (logro) await almacen.actualizar('logros', logro.id, { nivelQuiz });
      else await almacen.agregar('logros', { usuarioId: req.usuario.id, puntos: 0, insignias: [], nivelQuiz });
    });
  }
  const gamificacion = await procesarIntento(req.usuario, {
    actividad: 'quiz', temaId: sesion.temaId, nivel: sesion.nivel, puntaje: aciertos, maximo: total, errores: total - aciertos,
    duracionSeg: Math.max(0, Math.round((Date.now() - Date.parse(sesion.inicio)) / 1000)),
    detalle: { aprobado, quizSesionId: sesion.id }
  });
  const resultado = { ...base, puntosGanados: gamificacion.puntosGanados, insigniasNuevas: gamificacion.insigniasNuevas };
  await almacen.actualizar('quiz-sesiones', sesion.id, { finalizada: true, resultado });
  return resultado;
});

export default router;
