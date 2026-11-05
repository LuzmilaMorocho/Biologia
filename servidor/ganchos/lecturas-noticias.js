import * as almacen from '../almacen.js';

// Gancho para lecturas-noticias: fija usuarioId y evita duplicados

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  // Permiso propio: cada usuario ve solo sus lecturas
  return lista.filter((l) => l.usuarioId === usuario.id);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Se requiere sesión');
    error.estado = 401;
    throw error;
  }

  // Fija usuarioId
  datos.usuarioId = usuario.id;

  if (!datos.noticiaId) {
    const error = new Error('El campo noticiaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Evitar duplicados (usuarioId + noticiaId)
  const existentes = await almacen.leer('lecturas-noticias');
  const esDuplicado = existentes.some((l) => {
    if (anterior && l.id === anterior.id) return false;
    return l.usuarioId === datos.usuarioId && l.noticiaId === datos.noticiaId;
  });

  if (esDuplicado) {
    const error = new Error('Esta noticia ya fue registrada como leída');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};

