import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';
import { errorPregunta } from '../../publico/js/nucleo/preguntas.js';

const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });

export async function exigirEdicionTema(temaId, usuario) {
  if (!usuario || !['docente', 'admin'].includes(usuario.rol)) throw error(403, 'No tienes acceso al banco de preguntas');
  const asignatura = await asignaturaDeTema(temaId);
  if (!asignatura || !await puedeEditarAsignatura(usuario, asignatura.id)) throw error(403, 'No tienes permiso para editar preguntas de este tema');
}

export async function filtrarLista(lista, usuario) {
  if (!usuario || !['docente', 'admin'].includes(usuario.rol)) return [];
  if (usuario.rol === 'admin') return lista;
  const [asignaturas, unidades, temas] = await Promise.all([
    asignaturasDe(usuario), almacen.leer('unidades'), almacen.leer('temas')
  ]);
  const asignaturasIds = new Set(asignaturas.map((item) => item.id));
  const unidadesIds = new Set(unidades.filter((item) => asignaturasIds.has(item.asignaturaId)).map((item) => item.id));
  const temasIds = new Set(temas.filter((item) => unidadesIds.has(item.unidadId)).map((item) => item.id));
  return lista.filter((item) => temasIds.has(item.temaId));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) ||
      Object.keys(datos).some((clave) => !['temaId', 'nivel', 'tipo', 'enunciado', 'opciones', 'correcta', 'retroalimentacion', 'origen', 'estado'].includes(clave))) {
    throw error(400, 'Los datos de la pregunta no son válidos');
  }
  if (anterior) await exigirEdicionTema(anterior.temaId, usuario);
  const pregunta = { ...anterior, ...datos };
  await exigirEdicionTema(pregunta.temaId, usuario);
  if (!Number.isInteger(pregunta.nivel) || pregunta.nivel < 1 || pregunta.nivel > 5) throw error(400, 'El nivel debe estar entre 1 y 5');
  if (!['docente', 'ia'].includes(pregunta.origen) || !['borrador', 'aprobado'].includes(pregunta.estado)) throw error(400, 'Origen o estado de pregunta no válido');
  const mensaje = errorPregunta(pregunta);
  if (mensaje) throw error(400, mensaje);
  return datos;
}

export default { filtrarLista, antesDeGuardar };
