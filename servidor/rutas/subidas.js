import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'node:crypto';
import fs from 'fs';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = Router();
const DIR_SUBIDAS = path.resolve('publico', 'recursos', 'subidas');

// Asegurar que el directorio de subidas exista
if (!fs.existsSync(DIR_SUBIDAS)) {
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
}

// Configurar almacenamiento en disco con nombre aleatorio y extensión original
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DIR_SUBIDAS);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString('hex');
    cb(null, `${aleatorio}${ext}`);
  }
});

// Filtro de validación según el rol del usuario
const fileFilter = (req, file, cb) => {
  const rol = req.usuario?.rol;
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype.toLowerCase();

  const imagenesExt = ['.jpg', '.jpeg', '.png', '.webp'];
  const imagenesMime = ['image/jpeg', 'image/png', 'image/webp'];

  if (rol === 'admin' || rol === 'docente') {
    const extensionesPermitidas = [...imagenesExt, '.pdf', '.mp3'];
    const mimetypesPermitidos = [
      ...imagenesMime,
      'application/pdf',
      'audio/mpeg',
      'audio/mp3'
    ];

    if (extensionesPermitidas.includes(ext) && mimetypesPermitidos.includes(mimetype)) {
      return cb(null, true);
    }
    const error = new Error('Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3');
    error.codigo = 'TIPO_INVALIDO';
    return cb(error, false);
  }

  // Estudiantes: solo imágenes
  if (imagenesExt.includes(ext) && imagenesMime.includes(mimetype)) {
    return cb(null, true);
  }
  const error = new Error('Solo se permiten imágenes JPG, PNG o WEBP');
  error.codigo = 'TIPO_INVALIDO';
  return cb(error, false);
};

// POST /api/subidas
router.post('/subidas', exigirRol(), async (req, res) => {
  try {
    const rol = req.usuario?.rol;
    let limiteBytes = 2 * 1024 * 1024; // 2 MB por defecto (estudiante)

    if (rol === 'admin' || rol === 'docente') {
      const ajustes = await almacen.leerConfig('ajustes');
      const maxSubidaMB = ajustes?.maxSubidaMB || 10;
      limiteBytes = maxSubidaMB * 1024 * 1024;
    }

    const upload = multer({
      storage,
      limits: {
        fileSize: limiteBytes
      },
      fileFilter
    }).single('archivo');

    upload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const limiteMB = Math.round(limiteBytes / (1024 * 1024));
          return res.status(400).json({ error: `El archivo excede el límite máximo de ${limiteMB} MB` });
        }
        return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo en el campo "archivo"' });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.json({ url });
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al procesar la subida' });
  }
});

export default router;
