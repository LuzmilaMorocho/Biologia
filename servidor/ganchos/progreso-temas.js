import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

// En progreso-temas el docente ve solo a sus estudiantes; admin ve todo; estudiante ve propio
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes.map((e) => e.id));
    return lista.filter((p) => idsEstudiantes.has(p.usuarioId));
  }

  // Estudiante ve solo su propio progreso
  return lista.filter((p) => p.usuarioId === usuario.id);
}

// Fija usuarioId = usuario.id y rechaza duplicados (usuarioId + temaId)
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Se requiere sesión');
    error.estado = 401;
    throw error;
  }

  // Asegurar usuarioId
  datos.usuarioId = usuario.id;

  if (!datos.temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Comprobar duplicados
  const existentes = await almacen.leer('progreso-temas');
  const esDuplicado = existentes.some((p) => {
    if (anterior && p.id === anterior.id) return false;
    return p.usuarioId === datos.usuarioId && p.temaId === datos.temaId;
  });

  if (esDuplicado) {
    const error = new Error('Ya existe un registro de progreso para este tema');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
