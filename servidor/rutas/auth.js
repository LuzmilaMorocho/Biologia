import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Control de intentos fallidos en memoria (máximo 5 fallos en 15 minutos por correo)
const intentosFallidos = new Map();
const LIMITE_FALLOS = 5;
const VENTANA_FALLOS_MS = 15 * 60 * 1000;

function verificarTasaIntentos(correoNorm) {
  const ahora = Date.now();
  const registro = intentosFallidos.get(correoNorm);
  if (!registro) return false;

  if (ahora - registro.primerFallo > VENTANA_FALLOS_MS) {
    intentosFallidos.delete(correoNorm);
    return false;
  }

  return registro.fallos >= LIMITE_FALLOS;
}

function registrarFalloLogin(correoNorm) {
  const ahora = Date.now();
  const registro = intentosFallidos.get(correoNorm);
  if (!registro || ahora - registro.primerFallo > VENTANA_FALLOS_MS) {
    intentosFallidos.set(correoNorm, { fallos: 1, primerFallo: ahora });
  } else {
    registro.fallos += 1;
    intentosFallidos.set(correoNorm, registro);
  }
}

function limpiarFallosLogin(correoNorm) {
  intentosFallidos.delete(correoNorm);
}

// POST /api/auth/registro
router.post('/auth/registro', async (req, res) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body;

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }
    if (!correo || typeof correo !== 'string') {
      return res.status(400).json({ error: 'El correo es obligatorio' });
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const correoNorm = correo.trim().toLowerCase();
    if (!regexCorreo.test(correoNorm)) {
      return res.status(400).json({ error: 'Formato de correo no válido' });
    }

    const regexClave = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!clave || !regexClave.test(clave)) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres y contener letras y números'
      });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar el consentimiento informado' });
    }

    const usuarios = await almacen.leer('usuarios');
    if (usuarios.some((u) => u.correo && u.correo.toLowerCase() === correoNorm)) {
      return res.status(400).json({ error: 'El correo ya se encuentra registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoUsuario = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoUsuario);

    res.status(201).json({
      id: creado.id,
      nombre: creado.nombre,
      apellido: creado.apellido,
      correo: creado.correo,
      rol: creado.rol
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error en el registro' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { correo, clave } = req.body;
    if (!correo || !clave) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const correoNorm = String(correo).trim().toLowerCase();

    if (verificarTasaIntentos(correoNorm)) {
      return res.status(429).json({
        error: 'Demasiados intentos fallidos. Intenta más tarde (máximo 5 fallos en 15 minutos).'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.correo && u.correo.toLowerCase() === correoNorm);

    if (!usuario || usuario.activo === false) {
      registrarFalloLogin(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const claveValida = await bcrypt.compare(clave, usuario.claveHash);
    if (!claveValida) {
      registrarFalloLogin(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    limpiarFallosLogin(correoNorm);

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al iniciar sesión' });
  }
});

// POST /api/auth/logout
router.post('/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const sesiones = await almacen.leer('sesiones');
      const sesion = sesiones.find((s) => s.token === token);
      if (sesion) {
        await almacen.eliminar('sesiones', sesion.id);
      }
    }

    if (req.usuario) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al cerrar sesión' });
  }
});

// GET /api/auth/yo
router.get('/auth/yo', exigirRol(), async (req, res) => {
  try {
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      foto: usuario.foto || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener usuario' });
  }
});

// PUT /api/auth/perfil
router.put('/auth/perfil', exigirRol(), async (req, res) => {
  try {
    const { nombre, apellido, foto } = req.body;
    const cambios = {};

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'Nombre no válido' });
      }
      cambios.nombre = nombre.trim();
    }

    if (apellido !== undefined) {
      if (typeof apellido !== 'string' || !apellido.trim()) {
        return res.status(400).json({ error: 'Apellido no válido' });
      }
      cambios.apellido = apellido.trim();
    }

    if (foto !== undefined) {
      cambios.foto = foto;
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);

    res.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      correo: actualizado.correo,
      rol: actualizado.rol,
      foto: actualizado.foto || null
    });
  } catch (error) {
    res.status(error.estado || 500).json({ error: error.message || 'Error al actualizar perfil' });
  }
});

// POST /api/auth/clave
router.post('/auth/clave', exigirRol(), async (req, res) => {
  try {
    const { actual, nueva } = req.body;
    if (!actual || !nueva) {
      return res.status(400).json({ error: 'Debes proporcionar la contraseña actual y la nueva' });
    }

    const regexClave = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!regexClave.test(nueva)) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 8 caracteres y contener letras y números'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const claveValida = await bcrypt.compare(actual, usuario.claveHash);
    if (!claveValida) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', req.usuario.id, { claveHash });

    res.json({ ok: true });
  } catch (error) {
    res.status(error.estado || 500).json({ error: error.message || 'Error al cambiar contraseña' });
  }
});

// POST /api/admin/usuarios/:id/restablecer
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar clave temporal de 10 caracteres con letras y números
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let claveTemporal = '';
    for (let i = 0; i < 10; i++) {
      claveTemporal += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', id, { claveHash });

    res.json({ claveTemporal });
  } catch (error) {
    res.status(error.estado || 500).json({ error: error.message || 'Error al restablecer contraseña' });
  }
});

// POST /api/eventos
router.post('/eventos', async (req, res) => {
  try {
    const { tipo, recurso } = req.body;
    if (!tipo || !recurso) {
      return res.status(400).json({ error: 'tipo y recurso son obligatorios' });
    }

    const evento = {
      usuarioId: req.usuario?.id || null,
      tipo: String(tipo),
      recurso: String(recurso),
      fecha: new Date().toISOString()
    };

    await almacen.anexarLinea('bitacora.jsonl', evento);

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al registrar evento' });
  }
});

export default router;
