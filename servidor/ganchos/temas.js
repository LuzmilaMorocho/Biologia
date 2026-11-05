import * as almacen from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

// Cada usuario ve solo los temas de sus asignaturas; estudiante solo "publicado"
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  let filtradas = lista;
  if (usuario.rol !== 'admin') {
    const misAsignaturas = await asignaturasDe(usuario);
    const misIds = new Set(misAsignaturas.map((a) => a.id));

    const unidades = await almacen.leer('unidades');
    const unidadesPermitidas = new Set(
      unidades.filter((u) => misIds.has(u.asignaturaId)).map((u) => u.id)
    );

    filtradas = filtradas.filter((t) => unidadesPermitidas.has(t.unidadId));
  }

  if (usuario.rol === 'estudiante') {
    filtradas = filtradas.filter((t) => t.estado === 'publicado');
  }

  return filtradas;
}

// 403 si el usuario no tiene permisos para editar la asignatura
export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = datos.unidadId || anterior?.unidadId;
  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find((u) => u.id === unidadId);

  const asignaturaId = unidad?.asignaturaId;
  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar temas en esta asignatura');
    error.estado = 403;
    throw error;
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
