import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

// Cada usuario ve solo las unidades de sus asignaturas; estudiante no ve visible = false
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  let filtradas = lista;
  if (usuario.rol !== 'admin') {
    const misAsignaturas = await asignaturasDe(usuario);
    const misIds = new Set(misAsignaturas.map((a) => a.id));
    filtradas = filtradas.filter((u) => misIds.has(u.asignaturaId));
  }

  if (usuario.rol === 'estudiante') {
    filtradas = filtradas.filter((u) => u.visible !== false);
  }

  return filtradas;
}

// 403 si el usuario no tiene permisos para editar la asignatura
export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = datos.asignaturaId || anterior?.asignaturaId;
  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar contenidos de esta asignatura');
    error.estado = 403;
    throw error;
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
