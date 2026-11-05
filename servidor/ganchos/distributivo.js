import { gruposDe } from '../acceso.js';

// Cada usuario ve solo sus grupos en distributivo (admin ve todo)
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  return await gruposDe(usuario);
}

export default {
  filtrarLista
};
