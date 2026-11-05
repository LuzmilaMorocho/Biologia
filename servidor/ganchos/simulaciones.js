import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';
import { erroresEscenario, erroresRol } from '../../publico/js/nucleo/simulaciones.js';

const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });

export async function exigirEdicionSimulacion(temaId, usuario) {
  const asignatura = await asignaturaDeTema(temaId);
  if (!asignatura || !await puedeEditarAsignatura(usuario, asignatura.id)) throw error(403, 'No tienes permiso para gestionar simulaciones de este tema');
}

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (!['estudiante', 'docente'].includes(usuario.rol)) return [];
  const [asignaturas, unidades, temas] = await Promise.all([asignaturasDe(usuario), almacen.leer('unidades'), almacen.leer('temas')]);
  const ids = new Set(asignaturas.map((a) => a.id));
  const estudiante = usuario.rol === 'estudiante';
  const unidadesId = new Set(unidades.filter((u) => ids.has(u.asignaturaId) && (!estudiante || u.visible !== false)).map((u) => u.id));
  const temasId = new Set(temas.filter((t) => unidadesId.has(t.unidadId) && (!estudiante || t.estado === 'publicado')).map((t) => t.id));
  return lista.filter((s) => temasId.has(s.temaId) && (!estudiante || s.estado === 'publicado'));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const campos = ['temaId', 'titulo', 'modo', 'estado', 'escenaInicial', 'escenas', 'personaje', 'rubrica', 'maxTurnos'];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).some((c) => !campos.includes(c))) throw error(400, 'Datos de simulación no válidos');
  if (anterior) await exigirEdicionSimulacion(anterior.temaId, usuario);
  const simulacion = { ...anterior, ...datos };
  await exigirEdicionSimulacion(simulacion.temaId, usuario);
  if (typeof simulacion.titulo !== 'string' || !simulacion.titulo.trim() || simulacion.titulo.length > 200) throw error(400, 'Escribe un título de hasta 200 caracteres');
  if (!['escenarios', 'rol'].includes(simulacion.modo) || !['borrador', 'publicado'].includes(simulacion.estado)) throw error(400, 'Modo o estado no válido');
  if (simulacion.modo === 'escenarios') {
    const errores = erroresEscenario(simulacion, { publicar: simulacion.estado === 'publicado' });
    if (errores.length) throw error(400, errores.map((e) => `${e.escenaId ? e.escenaId + ': ' : ''}${e.mensaje}`).join('; '));
  } else {
    const errores = erroresRol(simulacion, { publicar: simulacion.estado === 'publicado' });
    if (errores.length) throw error(400, errores.map((e) => e.mensaje).join('; '));
  }
  return { ...datos, ...(Object.hasOwn(datos, 'titulo') ? { titulo: datos.titulo.trim() } : {}) };
}

export default { filtrarLista, antesDeGuardar };
