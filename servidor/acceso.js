import * as almacen from './almacen.js';

// Retorna los grupos (distributivo) accesibles para el usuario
export async function gruposDe(usuario) {
  if (!usuario) return [];
  const distributivo = await almacen.leer('distributivo');
  if (usuario.rol === 'admin') return distributivo;
  if (usuario.rol === 'docente') {
    return distributivo.filter((g) => g.docenteId === usuario.id);
  }
  if (usuario.rol === 'estudiante') {
    return distributivo.filter(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
    );
  }
  return [];
}

// Retorna las asignaturas accesibles para el usuario
export async function asignaturasDe(usuario) {
  if (!usuario) return [];
  const asignaturas = await almacen.leer('asignaturas');
  if (usuario.rol === 'admin') return asignaturas;

  const grupos = await gruposDe(usuario);
  const idsAsignaturas = new Set(grupos.map((g) => g.asignaturaId));
  return asignaturas.filter((a) => idsAsignaturas.has(a.id));
}

// Resuelve tema -> unidad -> asignatura y retorna la asignatura o null
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;
  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find((u) => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  const asignaturas = await almacen.leer('asignaturas');
  return asignaturas.find((a) => a.id === unidad.asignaturaId) || null;
}

// Verifica si el usuario tiene permiso para editar contenidos de una asignatura
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;
  if (usuario.rol === 'admin') return true;
  if (usuario.rol !== 'docente') return false;

  const distributivo = await almacen.leer('distributivo');
  return distributivo.some(
    (g) => g.docenteId === usuario.id && g.asignaturaId === asignaturaId
  );
}

// Retorna los estudiantes asignados a los grupos del docente
export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];
  const distributivo = await almacen.leer('distributivo');
  const gruposDocente = distributivo.filter((g) => g.docenteId === docenteId);
  const ids = new Set();
  for (const g of gruposDocente) {
    if (Array.isArray(g.estudiantes)) {
      g.estudiantes.forEach((id) => ids.add(id));
    }
  }
  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter((u) => ids.has(u.id));
}

// Retorna los docentes asignados a los grupos del estudiante
export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];
  const distributivo = await almacen.leer('distributivo');
  const gruposEstudiante = distributivo.filter(
    (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
  );
  const ids = new Set(gruposEstudiante.map((g) => g.docenteId).filter(Boolean));
  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter((u) => ids.has(u.id));
}
