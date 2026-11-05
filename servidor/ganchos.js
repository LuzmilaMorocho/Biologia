import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const DIR_GANCHOS = path.resolve('servidor', 'ganchos');
const ganchosPorColeccion = new Map();

// Carga dinámica de los módulos de ganchos en servidor/ganchos/<col>.js
export async function cargarGanchos() {
  ganchosPorColeccion.clear();
  try {
    await fs.mkdir(DIR_GANCHOS, { recursive: true });
    const archivos = await fs.readdir(DIR_GANCHOS);

    for (const archivo of archivos) {
      if (archivo.endsWith('.js') && !archivo.startsWith('.')) {
        const rutaCompleta = path.join(DIR_GANCHOS, archivo);
        const urlModulo = pathToFileURL(rutaCompleta).href;
        const modulo = await import(urlModulo);
        const nombreCol = archivo.replace(/\.js$/, '');
        ganchosPorColeccion.set(nombreCol, modulo.default || modulo);
      }
    }
  } catch (error) {
    console.error('Error al cargar ganchos:', error);
  }
}

// Ejecuta un gancho si existe; si no existe devuelve el primer argumento sin alterarlo
export async function aplicar(col, nombre, ...args) {
  const clave = typeof col === 'string' ? col : '';
  const gancho = ganchosPorColeccion.get(clave) || ganchosPorColeccion.get(clave.split('/')[0]);

  if (!gancho || typeof gancho[nombre] !== 'function') {
    return args[0];
  }

  const resultado = await gancho[nombre](...args);
  return resultado !== undefined ? resultado : args[0];
}

// Carga inicial al importar el módulo
await cargarGanchos();
