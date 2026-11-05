// Servidor: rutas de gamificación (§C contratos.md)
import { Router } from 'express';
import { procesarIntento } from '../gamificacion.js';
import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';
import { filtrarLista as simulacionesVisibles } from '../ganchos/simulaciones.js';
import { PartidaEscenario } from '../../publico/js/nucleo/simulaciones.js';
import { datosIntentoRol } from '../rol-simulacion.js';

const router = Router();

// POST /api/intentos -> Registra un intento y calcula puntos e insignias
router.post('/intentos', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    if (req.body?.actividad === 'quiz') {
      return res.status(403).json({ error: 'Los resultados del quiz solo se registran al finalizar su sesión' });
    }
    if (req.body?.actividad === 'foro') {
      return res.status(403).json({ error: 'La participación en foros solo se registra al publicar una respuesta' });
    }
    let datos = req.body;
    if (datos?.actividad === 'simulacion') {
      const simulacion = (await almacen.leer('simulaciones')).find((s) => s.id === datos.detalle?.simulacionId);
      if (!simulacion || !(await simulacionesVisibles([simulacion], req.usuario)).length) {
        return res.status(403).json({ error: 'No tienes acceso a esta simulación' });
      }
      if (simulacion.modo === 'rol') {
        if (datos.temaId !== simulacion.temaId || datos.detalle?.modo !== 'rol') return res.status(400).json({ error: 'El tema o modo de la evaluación no corresponde a la práctica' });
        datos = await datosIntentoRol(datos, simulacion, req.usuario);
        return res.json(await procesarIntento(req.usuario, datos));
      }
      if (simulacion.modo !== 'escenarios') return res.status(400).json({ error: 'Modo de simulación no válido' });
      if (datos.temaId !== simulacion.temaId || !Array.isArray(datos.detalle?.recorrido) || datos.detalle.recorrido.length > 100) {
        return res.status(400).json({ error: 'El recorrido de la simulación no es válido' });
      }
      const partida = new PartidaEscenario(simulacion);
      for (const paso of datos.detalle.recorrido) {
        if (!paso || paso.escenaId !== partida.actual) return res.status(400).json({ error: 'El recorrido no corresponde a las escenas' });
        partida.elegir(paso.opcion); partida.continuar();
      }
      const informe = partida.informe();
      datos = { ...datos, puntaje: informe.puntaje, maximo: informe.maximo,
        errores: informe.recorrido.filter((p) => p.puntos <= 0).length,
        detalle: { simulacionId: simulacion.id, recorrido: informe.recorrido } };
    }
    const resultado = await procesarIntento(req.usuario, datos);
    res.json(resultado);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al procesar intento' });
  }
});

// GET /api/logros/:usuarioId -> Consulta logros ("yo", propio, docente de sus grupos o admin)
router.get('/logros/:usuarioId', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const targetId = req.params.usuarioId === 'yo' ? req.usuario.id : req.params.usuarioId;

    let permitido = false;
    if (req.usuario.id === targetId) {
      permitido = true;
    } else if (req.usuario.rol === 'admin') {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const misEstudiantes = await estudiantesDe(req.usuario.id);
      permitido = misEstudiantes.some((e) => e.id === targetId);
    }

    if (!permitido) {
      return res.status(403).json({ error: 'Acceso denegado a los logros del usuario' });
    }

    const todosLogros = await almacen.leer('logros');
    let registro = todosLogros.find((l) => l.usuarioId === targetId);

    if (!registro) {
      registro = {
        usuarioId: targetId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      };
    }

    res.json(registro);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al consultar logros' });
  }
});

export default router;

