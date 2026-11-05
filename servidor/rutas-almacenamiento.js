import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.env.RAIZ_PERSISTENTE?.trim();
const datosOriginales = path.resolve('datos');
const subidasOriginales = path.resolve('publico', 'recursos', 'subidas');

export const DIR_DATOS = raiz ? path.join(path.resolve(raiz), 'datos') : datosOriginales;
export const DIR_SUBIDAS = raiz ? path.join(path.resolve(raiz), 'subidas') : subidasOriginales;

// El disco debe estar montado antes del arranque; no crearlo sobre almacenamiento efimero.
if (raiz) {
  if (!path.isAbsolute(raiz) || !fs.statSync(raiz).isDirectory()) {
    throw new Error('RAIZ_PERSISTENTE debe ser una carpeta absoluta del disco montado');
  }
  for (const [origen, destino] of [[datosOriginales, DIR_DATOS], [subidasOriginales, DIR_SUBIDAS]]) {
    const relativa = path.relative(origen, destino);
    if (!relativa || (!relativa.startsWith('..' + path.sep) && relativa !== '..' && !path.isAbsolute(relativa))) {
      throw new Error('El almacenamiento persistente debe estar fuera de las carpetas originales');
    }
  }
  const marca = path.join(raiz, '.ecosistema-inicializado');
  if (!fs.existsSync(marca)) {
    for (const [origen, destino] of [[datosOriginales, DIR_DATOS], [subidasOriginales, DIR_SUBIDAS]]) {
      fs.mkdirSync(destino, { recursive: true });
      if (fs.existsSync(origen)) {
        fs.cpSync(origen, destino, { recursive: true, force: false, errorOnExist: false });
      }
    }
    fs.writeFileSync(marca, 'Inicializacion completada\n', { flag: 'wx' });
  }
}
