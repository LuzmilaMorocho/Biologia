import { leerConfig } from './almacen.js';

// Evalúa si un usuario puede realizar una acción ("leer" | "escribir") sobre una colección
export async function puede(usuario, accion, col, registro = null) {
  if (!col || (accion !== 'leer' && accion !== 'escribir')) {
    return false;
  }

  const permisos = await leerConfig('permisos');
  if (!permisos || typeof permisos !== 'object') {
    return false;
  }

  // Colección no listada → false (admite también coincidencia por colección base con subcarpetas)
  const clave = typeof col === 'string' ? col : '';
  const configCol = permisos[clave] || permisos[clave.split('/')[0]];
  if (!configCol || !Array.isArray(configCol[accion])) {
    return false;
  }

  const reglas = configCol[accion];

  for (const regla of reglas) {
    // "servidor" nunca se permite desde la API
    if (regla === 'servidor') {
      continue;
    }

    if (regla === 'publico') {
      return true;
    }

    if (regla === 'sesion' && usuario) {
      return true;
    }

    if ((regla === 'estudiante' || regla === 'docente' || regla === 'admin') && usuario?.rol === regla) {
      return true;
    }

    if (regla === 'propio') {
      if (!usuario) continue;
      if (!registro) {
        if (accion === 'leer') return true;
        continue;
      }
      if (
        (registro.usuarioId && registro.usuarioId === usuario.id) ||
        (clave === 'usuarios' && registro.id === usuario.id)
      ) {
        return true;
      }
    }
  }

  return false;
}
