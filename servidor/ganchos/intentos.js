// Gancho para la colección "intentos": filtro de visualización según rol
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes.map((e) => e.id));
    return lista.filter((item) => idsEstudiantes.has(item.usuarioId));
  }

  // Estudiante solo ve sus propios intentos
  return lista.filter((item) => item.usuarioId === usuario.id);
}

export default {
  filtrarLista
};

