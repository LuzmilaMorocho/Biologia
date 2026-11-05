// Servidor: rutas de alertas tempranas (§C contratos.md)
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

// GET /alertas?grupoId= (docente del grupo o admin) → { alertas, mensajesApoyo }
router.get('/alertas', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    if (req.usuario.rol !== 'docente' && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { grupoId } = req.query;
    const todasAlertas = await almacen.leer('alertas');
    let alertasFiltradas = [];

    if (grupoId) {
      if (req.usuario.rol === 'docente') {
        const grupos = await acceso.gruposDe(req.usuario);
        const tieneAcceso = grupos.some((g) => g.id === grupoId);
        if (!tieneAcceso) {
          return res.status(403).json({ error: 'No tiene acceso al grupo especificado' });
        }
      }
      alertasFiltradas = todasAlertas.filter((a) => a.grupoId === grupoId);
    } else {
      if (req.usuario.rol === 'admin') {
        alertasFiltradas = todasAlertas;
      } else {
        const grupos = await acceso.gruposDe(req.usuario);
        const idsGrupos = new Set(grupos.map((g) => g.id));
        alertasFiltradas = todasAlertas.filter(
          (a) => idsGrupos.has(a.grupoId) || a.docenteId === req.usuario.id
        );
      }
    }

    // Ordenar alertas: activas primero, luego por fecha descendente
    alertasFiltradas.sort((a, b) => {
      if (a.estado === 'activa' && b.estado !== 'activa') return -1;
      if (a.estado !== 'activa' && b.estado === 'activa') return 1;
      return new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime();
    });

    const reglas = await almacen.leerConfig('reglas-alertas');
    const mensajesApoyo = Array.isArray(reglas?.mensajesApoyo) ? reglas.mensajesApoyo : [];

    res.json({
      alertas: alertasFiltradas,
      mensajesApoyo
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

export default router;

