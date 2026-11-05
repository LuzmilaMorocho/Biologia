// Servidor: rutas de certificados y verificación (§C, §D, §E contratos.md)
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

// Evalúa las condiciones para el certificado de cumplimiento según reglas-gamificacion.json
async function evaluarCondicionesCumplimiento(usuario) {
  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const configCert = reglas.certificado || {
    nivelQuizRequerido: 5,
    temasConNivelRequerido: 1,
    puntosMinimos: 400,
    temasRevisadosPct: 80
  };

  // 1. Logros del usuario
  const todosLogros = await almacen.leer('logros');
  const logro = todosLogros.find((l) => l.usuarioId === usuario.id) || {
    puntos: 0,
    nivelQuiz: {}
  };

  // Condición 1: Temas con nivel de quiz >= nivelQuizRequerido
  const nivelesQuiz = logro.nivelQuiz || {};
  let conteoTemasNivelReq = 0;
  for (const temaId of Object.keys(nivelesQuiz)) {
    if (Number(nivelesQuiz[temaId] || 0) >= configCert.nivelQuizRequerido) {
      conteoTemasNivelReq++;
    }
  }
  const cumpleQuiz = conteoTemasNivelReq >= configCert.temasConNivelRequerido;

  // Condición 2: Puntos mínimos
  const puntosActuales = Number(logro.puntos || 0);
  const cumplePuntos = puntosActuales >= configCert.puntosMinimos;

  // Condición 3: Porcentaje de temas revisados (sobre los temas publicados de sus asignaturas)
  const misAsignaturas = await acceso.asignaturasDe(usuario);
  const idsAsignaturas = new Set(misAsignaturas.map((a) => a.id));

  const todasUnidades = await almacen.leer('unidades');
  const unidadesVisibles = todasUnidades.filter(
    (u) => idsAsignaturas.has(u.asignaturaId) && u.visible !== false
  );
  const idsUnidades = new Set(unidadesVisibles.map((u) => u.id));

  const todosTemas = await almacen.leer('temas');
  const temasPublicados = todosTemas.filter(
    (t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado'
  );
  const totalTemas = temasPublicados.length;

  const todosProgresos = await almacen.leer('progreso-temas');
  const misProgresos = todosProgresos.filter((p) => p.usuarioId === usuario.id);
  const idsTemasRevisados = new Set(misProgresos.map((p) => p.temaId));

  const revisadosCount = temasPublicados.filter((t) => idsTemasRevisados.has(t.id)).length;
  const pctRevisados = totalTemas > 0 ? Math.round((revisadosCount / totalTemas) * 100) : 0;
  const cumplePct = pctRevisados >= configCert.temasRevisadosPct;

  const condiciones = [
    {
      nombre: `Temas con Quiz nivel ≥ ${configCert.nivelQuizRequerido}`,
      actual: conteoTemasNivelReq,
      requerido: configCert.temasConNivelRequerido,
      cumple: cumpleQuiz
    },
    {
      nombre: 'Puntos acumulados',
      actual: puntosActuales,
      requerido: configCert.puntosMinimos,
      cumple: cumplePuntos
    },
    {
      nombre: 'Temas revisados (%)',
      actual: pctRevisados,
      requerido: configCert.temasRevisadosPct,
      cumple: cumplePct
    }
  ];

  const cumple = condiciones.every((c) => c.cumple);

  return { condiciones, cumple };
}

// Genera un código único en formato EE-YYYY-XXXXXX
function generarCodigoUnico(existentes) {
  const anio = new Date().getFullYear();
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigos = new Set(existentes.map((c) => c.codigo));

  let codigo = '';
  do {
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    codigo = `EE-${anio}-${rand}`;
  } while (codigos.has(codigo));

  return codigo;
}

// GET /api/certificados/estado -> Estado de requisitos de certificación
router.get('/certificados/estado', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const resultado = await evaluarCondicionesCumplimiento(req.usuario);
    res.json(resultado);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al consultar estado de certificados' });
  }
});

// POST /api/certificados -> Emite o recupera un certificado si cumple requisitos
router.post('/certificados', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const { tipo, temaId, nivel } = req.body || {};
    if (tipo !== 'cumplimiento' && tipo !== 'nivel-quiz') {
      return res.status(400).json({ error: 'Tipo de certificado no válido (debe ser "cumplimiento" o "nivel-quiz")' });
    }

    const todosCert = await almacen.leer('certificados');
    let textoDetalle = '';

    if (tipo === 'cumplimiento') {
      const estado = await evaluarCondicionesCumplimiento(req.usuario);
      if (!estado.cumple) {
        return res.status(400).json({
          error: 'Aún no cumples con todos los requisitos para obtener el certificado de cumplimiento general'
        });
      }
      textoDetalle = 'Certificado de cumplimiento general del Ecosistema Educativo Digital';

      // Si ya existe uno previo de cumplimiento, devolverlo
      const existente = todosCert.find(
        (c) => c.usuarioId === req.usuario.id && c.tipo === 'cumplimiento'
      );
      if (existente) {
        return res.json(existente);
      }
    } else if (tipo === 'nivel-quiz') {
      if (typeof temaId !== 'string' || !temaId.trim() || !Number.isInteger(nivel) || nivel < 1 || nivel > 5) {
        return res.status(400).json({ error: 'Indica un tema y un nivel entero de 1 a 5 para el diploma del quiz' });
      }

      const todosLogros = await almacen.leer('logros');
      const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
      const nivelAlcanzado = Number(logro?.nivelQuiz?.[temaId] || 0);

      if (nivelAlcanzado < Number(nivel)) {
        return res.status(400).json({
          error: `No has alcanzado el nivel ${nivel} de quiz en este tema (actual: nivel ${nivelAlcanzado})`
        });
      }

      const todosTemas = await almacen.leer('temas');
      const temaObj = todosTemas.find((t) => t.id === temaId);
      const tituloTema = temaObj ? temaObj.titulo : 'Tema';

      textoDetalle = `Aprobación del Nivel ${nivel} de Quiz en el tema: ${tituloTema}`;

      // Si ya existe uno previo para este tema y nivel, devolverlo
      const existente = todosCert.find(
        (c) =>
          c.usuarioId === req.usuario.id &&
          c.tipo === 'nivel-quiz' &&
          c.temaId === temaId &&
          Number(c.nivel) === Number(nivel)
      );
      if (existente) {
        return res.json(existente);
      }
    }

    // Crear nuevo certificado
    const codigo = generarCodigoUnico(todosCert);
    const nombreCompleto = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim() || 'Estudiante';

    const nuevoCertificado = {
      codigo,
      usuarioId: req.usuario.id,
      tipo,
      temaId: temaId || null,
      nivel: nivel !== undefined ? Number(nivel) : null,
      detalle: textoDetalle,
      nombreCompleto
    };

    const guardado = await almacen.agregar('certificados', nuevoCertificado);
    res.json(guardado);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al emitir certificado' });
  }
});

// GET /api/certificados/verificar/:codigo -> Verificación pública (sin sesión)
router.get('/certificados/verificar/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.json({ valido: false });
    }

    const todosCert = await almacen.leer('certificados');
    const codigoBuscado = String(codigo).trim().toUpperCase();
    const cert = todosCert.find((c) => String(c.codigo).toUpperCase() === codigoBuscado);

    if (!cert) {
      return res.json({ valido: false });
    }

    res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto,
      detalle: cert.detalle,
      fecha: cert.fecha
    });
  } catch (error) {
    res.status(500).json({ valido: false, error: error.message });
  }
});

export default router;

