import { asignaturasDe } from '../acceso.js';

// Cada usuario ve solo sus asignaturas asignadas (admin ve todo)
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map((a) => a.id));
  return lista.filter((a) => misIds.has(a.id));
}

export default {
  filtrarLista
};
