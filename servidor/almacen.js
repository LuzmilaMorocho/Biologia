import { promises as fs } from 'fs';
import path from 'path';
import { setTimeout as esperar } from 'node:timers/promises';

const DIR_DATOS = path.resolve('datos');
const DIR_RESPALDOS = path.join(DIR_DATOS, 'respaldos');
const DIR_CONFIG = path.join(DIR_DATOS, 'config');

const colasPorArchivo = new Map();
let fechaUltimoRespaldo = null;

// Valida nombres de colecciones con minúsculas, números y guiones, y subcarpeta opcional
function validarColeccion(col) {
  if (typeof col !== 'string') {
    throw new Error('El nombre de la colección debe ser una cadena');
  }
  const patron = /^[a-z0-9]+(-[a-z0-9]+)*(?:\/[a-z0-9]+([_-][a-z0-9]+)*)?$/;
  if (!patron.test(col)) {
    throw new Error(`Nombre de colección no válido: "${col}"`);
  }
}

function validarArchivo(archivo) {
  if (typeof archivo !== 'string') {
    throw new Error('El nombre de archivo debe ser una cadena');
  }
  const normalizado = path.normalize(archivo).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalizado.includes('..') || path.isAbsolute(archivo)) {
    throw new Error(`Ruta de archivo no permitida: "${archivo}"`);
  }
  return normalizado;
}

function rutaColeccion(col) {
  validarColeccion(col);
  return path.join(DIR_DATOS, `${col}.json`);
}

function rutaConfig(nombre) {
  const nombreLimpio = nombre.endsWith('.json') ? nombre.slice(0, -5) : nombre;
  return path.join(DIR_CONFIG, `${nombreLimpio}.json`);
}

// Respaldo diario en la primera escritura del día; conserva los 14 más recientes
async function verificarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (fechaUltimoRespaldo === hoy) return;

  try {
    await fs.mkdir(DIR_RESPALDOS, { recursive: true });
    const rutaHoy = path.join(DIR_RESPALDOS, hoy);

    let existeHoy = false;
    try {
      await fs.access(rutaHoy);
      existeHoy = true;
    } catch {
      existeHoy = false;
    }

    if (!existeHoy) {
      await fs.mkdir(rutaHoy, { recursive: true });
      const entradas = await fs.readdir(DIR_DATOS, { withFileTypes: true });
      for (const entrada of entradas) {
        if (entrada.name === 'respaldos') continue;
        const origen = path.join(DIR_DATOS, entrada.name);
        const destino = path.join(rutaHoy, entrada.name);
        await fs.cp(origen, destino, { recursive: true, force: true });
      }

      // Limpieza de respaldos antiguos: conservar los 14 más recientes
      const respaldos = await fs.readdir(DIR_RESPALDOS, { withFileTypes: true });
      const carpetasFecha = respaldos
        .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
        .map((e) => e.name)
        .sort();

      if (carpetasFecha.length > 14) {
        const aEliminar = carpetasFecha.slice(0, carpetasFecha.length - 14);
        for (const carpeta of aEliminar) {
          await fs.rm(path.join(DIR_RESPALDOS, carpeta), { recursive: true, force: true });
        }
      }
    }

    fechaUltimoRespaldo = hoy;
  } catch (error) {
    console.error('Error al realizar el respaldo diario:', error);
  }
}

// Encola operaciones de escritura por archivo y maneja escritura temporal con rename
function encolarEscritura(ruta, operacion) {
  const colaPrevia = colasPorArchivo.get(ruta) || Promise.resolve();
  const siguiente = colaPrevia
    .catch(() => {})
    .then(async () => {
      await verificarRespaldoDiario();
      return await operacion();
    });
  colasPorArchivo.set(ruta, siguiente);
  return siguiente;
}

async function escribirConTmp(ruta, datosTexto) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  const rutaTmp = `${ruta}.tmp`;
  await fs.writeFile(rutaTmp, datosTexto, 'utf-8');
  // Windows/OneDrive puede bloquear brevemente el archivo durante su reemplazo.
  for (let intento = 0; ; intento++) {
    try {
      await fs.rename(rutaTmp, ruta);
      break;
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || intento >= 4) throw error;
      await esperar(25 * 2 ** intento);
    }
  }
}

// Genera ID: 3 primeras letras de la colección + "_" + número de 6 dígitos
function generarSiguienteId(col, lista) {
  const base = col.split('/')[0].replace(/[^a-z0-9]/g, '');
  const prefijo = (base.slice(0, 3) || 'rec').padEnd(3, 'x');
  const patron = new RegExp(`^${prefijo}_(\\d+)$`);

  let maximo = 0;
  for (const item of lista) {
    if (item && item.id) {
      const match = String(item.id).match(patron);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maximo) {
          maximo = num;
        }
      }
    }
  }

  const siguiente = maximo + 1;
  return `${prefijo}_${String(siguiente).padStart(6, '0')}`;
}

async function leerDirecto(ruta) {
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    if (!contenido.trim()) return [];
    return JSON.parse(contenido);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function leer(col) {
  const ruta = rutaColeccion(col);
  return await leerDirecto(ruta);
}

export async function escribir(col, lista) {
  const ruta = rutaColeccion(col);
  return await encolarEscritura(ruta, async () => {
    await escribirConTmp(ruta, JSON.stringify(lista, null, 2));
    return lista;
  });
}

export async function agregar(col, reg) {
  const ruta = rutaColeccion(col);
  return await encolarEscritura(ruta, async () => {
    const lista = await leerDirecto(ruta);
    const nuevo = {
      ...reg,
      id: generarSiguienteId(col, lista),
      fecha: new Date().toISOString()
    };
    lista.push(nuevo);
    await escribirConTmp(ruta, JSON.stringify(lista, null, 2));
    return nuevo;
  });
}

export async function actualizar(col, id, cambios) {
  const ruta = rutaColeccion(col);
  return await encolarEscritura(ruta, async () => {
    const lista = await leerDirecto(ruta);
    const indice = lista.findIndex((item) => item.id === id);
    if (indice === -1) {
      const error = new Error('Registro no encontrado');
      error.estado = 404;
      throw error;
    }
    const existente = lista[indice];
    const fusionado = {
      ...existente,
      ...cambios,
      id: existente.id,
      fecha: existente.fecha
    };
    lista[indice] = fusionado;
    await escribirConTmp(ruta, JSON.stringify(lista, null, 2));
    return fusionado;
  });
}

export async function eliminar(col, id) {
  const ruta = rutaColeccion(col);
  return await encolarEscritura(ruta, async () => {
    const lista = await leerDirecto(ruta);
    const indice = lista.findIndex((item) => item.id === id);
    if (indice === -1) {
      const error = new Error('Registro no encontrado');
      error.estado = 404;
      throw error;
    }
    const [eliminado] = lista.splice(indice, 1);
    await escribirConTmp(ruta, JSON.stringify(lista, null, 2));
    return eliminado;
  });
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  if (!filtro || Object.keys(filtro).length === 0) {
    return lista;
  }
  return lista.filter((item) => {
    return Object.entries(filtro).every(([clave, valor]) => {
      return String(item[clave]) === String(valor);
    });
  });
}

export async function anexarLinea(archivo, obj) {
  const archivoSeguro = validarArchivo(archivo);
  const ruta = path.join(DIR_DATOS, archivoSeguro);
  return await encolarEscritura(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const linea = JSON.stringify(obj) + '\n';
    await fs.appendFile(ruta, linea, 'utf-8');
    return obj;
  });
}

export async function leerLineas(archivo) {
  const archivoSeguro = validarArchivo(archivo);
  const ruta = path.join(DIR_DATOS, archivoSeguro);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    const lineas = contenido.split('\n');
    const resultado = [];
    for (const linea of lineas) {
      const recortada = linea.trim();
      if (recortada) {
        resultado.push(JSON.parse(recortada));
      }
    }
    return resultado;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function escribirConfig(nombre, datos) {
  if (typeof nombre !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(nombre)) {
    throw new Error('Nombre de configuración no válido');
  }
  const ruta = rutaConfig(nombre);
  return await encolarEscritura(ruta, async () => {
    await escribirConTmp(ruta, JSON.stringify(datos, null, 2));
    return datos;
  });
}

export async function leerConfig(nombre) {
  const ruta = rutaConfig(nombre);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    if (!contenido.trim()) return {};
    return JSON.parse(contenido);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}
