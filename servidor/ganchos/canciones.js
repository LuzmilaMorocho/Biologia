import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

// Cada usuario ve solo las canciones de sus asignaturas (a través del tema vinculado)
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map((a) => a.id));

  const resultados = [];
  for (const c of lista) {
    if (!c.temaId) continue;
    const asig = await asignaturaDeTema(c.temaId);
    if (asig && misIds.has(asig.id)) {
      resultados.push(c);
    }
  }

  return resultados;
}

// 403 si el usuario no tiene permisos para editar la asignatura correspondiente al tema
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Se requiere sesión');
    error.estado = 401;
    throw error;
  }

  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const asig = await asignaturaDeTema(temaId);
  const permitido = await puedeEditarAsignatura(usuario, asig?.id);
  if (!permitido) {
    const error = new Error('No tienes permiso para gestionar canciones en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};

