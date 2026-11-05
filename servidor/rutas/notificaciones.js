// Rutas especiales de notificaciones (§C contratos.md)
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

const router = Router();

// GET /notificaciones
// Retorna las 30 notificaciones más recientes del usuario autenticado y el total sin leer
router.get('/notificaciones', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const todas = await almacen.leer('notificaciones');
    const mias = todas.filter((n) => n.usuarioId === req.usuario.id);

    const totalSinLeer = mias.filter((n) => !n.leida).length;

    mias.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
    const recientes = mias.slice(0, 30);

    res.json({
      notificaciones: recientes,
      totalSinLeer,
      sinLeer: totalSinLeer
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

// POST /notificaciones { usuarioId, mensaje, enlace }
// Docente a sus estudiantes; admin a cualquiera; tipo "mensaje-docente"
router.post('/notificaciones', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    if (req.usuario.rol !== 'docente' && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo docentes y administradores pueden enviar notificaciones' });
    }

    const { usuarioId, mensaje, enlace } = req.body || {};
    if (!usuarioId || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: usuarioId y mensaje' });
    }

    if (req.usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(req.usuario.id);
      const pertenece = estudiantes.some((e) => e.id === usuarioId);
      if (!pertenece) {
        return res.status(403).json({ error: 'El estudiante no pertenece a sus grupos' });
      }
    }

    const reg = await notificar(usuarioId, {
      tipo: 'mensaje-docente',
      mensaje,
      enlace: enlace || ''
    });

    res.status(201).json(reg);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

// POST /notificaciones/leidas
// Marca todas las notificaciones del usuario como leídas
router.post('/notificaciones/leidas', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const todas = await almacen.leer('notificaciones');
    let actualizadas = 0;

    for (const n of todas) {
      if (n.usuarioId === req.usuario.id && !n.leida) {
        n.leida = true;
        actualizadas++;
      }
    }

    if (actualizadas > 0) {
      await almacen.escribir('notificaciones', todas);
    }

    res.json({ ok: true, actualizadas });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

// POST /notificaciones/:id/leida
// Marca una notificación individual como leída
router.post('/notificaciones/:id/leida', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const { id } = req.params;
    const todas = await almacen.leer('notificaciones');
    const actual = todas.find((n) => n.id === id);

    if (!actual) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (actual.usuarioId !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No puede modificar notificaciones de otro usuario' });
    }

    const actualizado = await almacen.actualizar('notificaciones', id, { leida: true });
    res.json(actualizado);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

export default router;

