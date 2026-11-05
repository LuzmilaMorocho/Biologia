import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

// Cada usuario ve solo términos de sus asignaturas; estudiante solo términos aprobados
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  let filtradas = lista;
  if (usuario.rol !== 'admin') {
    const misAsignaturas = await asignaturasDe(usuario);
    const misIds = new Set(misAsignaturas.map((a) => a.id));

    const resultados = [];
    for (const g of filtradas) {
      const asig = await asignaturaDeTema(g.temaId);
      if (asig && misIds.has(asig.id)) {
        resultados.push(g);
      }
    }
    filtradas = resultados;
  }

  if (usuario.rol === 'estudiante') {
    filtradas = filtradas.filter((g) => g.estado === 'aprobado');
  }

  return filtradas;
}

// 403 si el usuario no tiene permisos para editar la asignatura correspondiente al tema
export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || anterior?.temaId;
  const asig = await asignaturaDeTema(temaId);
  const permitido = await puedeEditarAsignatura(usuario, asig?.id);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar términos en esta asignatura');
    error.estado = 403;
    throw error;
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
