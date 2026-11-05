import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import * as ganchos from './ganchos.js';
import { cargarUsuario } from './auth.js';
import { DIR_SUBIDAS } from './rutas-almacenamiento.js';

const app = express();
const PUERTO = process.env.PUERTO || 3000;
const DIR_RUTAS = path.resolve('servidor', 'rutas');

// Middlewares base
app.use(express.json({ limit: '1mb' }));
app.use('/recursos/subidas', express.static(DIR_SUBIDAS, { fallthrough: false }));
app.use(express.static('publico'));
app.use(cargarUsuario);

// Monta automáticamente los módulos de servidor/rutas/*.js en /api en orden alfabético
async function montarRutasEspeciales() {
  try {
    await fs.mkdir(DIR_RUTAS, { recursive: true });
    const entradas = await fs.readdir(DIR_RUTAS);
    const archivos = entradas
      .filter((archivo) => archivo.endsWith('.js') && !archivo.startsWith('.'))
      .sort();

    for (const archivo of archivos) {
      const rutaArchivo = path.join(DIR_RUTAS, archivo);
      const urlModulo = pathToFileURL(rutaArchivo).href;
      const modulo = await import(urlModulo);
      if (modulo.default) {
        app.use('/api', modulo.default);
      }
    }
  } catch (error) {
    console.error('Error al montar rutas especiales:', error);
  }
}

await montarRutasEspeciales();

// API Genérica
app.get('/api/:col', async (req, res) => {
  try {
    const { col } = req.params;
    const permitido = await puede(req.usuario, 'leer', col);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso denegado' });
    }

    let lista = await almacen.buscar(col, req.query);
    lista = await ganchos.aplicar(col, 'filtrarLista', lista, req.usuario);
    res.json(lista);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

app.get('/api/:col/:id', async (req, res) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const registro = lista.find((item) => item.id === id);

    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'leer', col, registro);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso denegado' });
    }

    res.json(registro);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

app.post('/api/:col', async (req, res) => {
  try {
    const { col } = req.params;
    const permitido = await puede(req.usuario, 'escribir', col, req.body);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso denegado' });
    }

    const datosProcesados = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, null);
    const nuevo = await almacen.agregar(col, datosProcesados);
    await ganchos.aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(nuevo);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

app.put('/api/:col/:id', async (req, res) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso denegado' });
    }

    const cambios = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await ganchos.aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(actualizado);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

app.delete('/api/:col/:id', async (req, res) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso denegado' });
    }

    await almacen.eliminar(col, id);
    await ganchos.aplicar(col, 'despuesDeGuardar', null, req.usuario, anterior);

    res.json({ ok: true, id });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error en el servidor' });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  const estado = err.estado || (err.status >= 400 && err.status < 600 ? err.status : 500);
  res.status(estado).json({ error: err.message || 'Error interno del servidor' });
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PUERTO, () => {
    console.log(`Servidor activo en http://localhost:${PUERTO}`);
  });
}
