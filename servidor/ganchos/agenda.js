import { gruposDe, asignaturasDe, asignaturaDeTema } from '../acceso.js';
import * as almacen from '../almacen.js';
import { ACTIVIDADES } from '../../publico/js/nucleo/catalogo-actividades.js';

const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
const tipos = ['tarea', 'reunion', 'fecha-limite', 'recordatorio'];

export function exigirPropietario(evento, usuario) {
  if (!usuario?.id || evento.propietarioId !== usuario.id) throw error(403, 'Solo el propietario puede editar o eliminar este evento');
}

export async function filtrarLista(lista, usuario) {
  if (!usuario?.id) return [];
  const grupos = new Set((await gruposDe(usuario)).map((g) => g.id));
  return lista.filter((e) => e.propietarioId === usuario.id || e.grupoId && grupos.has(e.grupoId));
}

function fechaValida(valor, todoElDia) {
  if (typeof valor !== 'string') return false;
  const dia = valor.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const fecha = new Date(dia + 'T00:00:00Z');
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== dia) return false;
  if (todoElDia) return valor === dia;
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(valor) && Number.isFinite(Date.parse(valor));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario?.id) throw error(401, 'Inicia sesión para usar la agenda');
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).some((c) =>
    !['titulo', 'tipo', 'inicio', 'fin', 'todoElDia', 'propietarioId', 'grupoId', 'actividad', 'temaId', 'recordatorios'].includes(c))) throw error(400, 'Campos de agenda no válidos');
  if (anterior) {
    exigirPropietario(anterior, usuario);
    if (datos.propietarioId !== undefined && datos.propietarioId !== anterior.propietarioId) throw error(400, 'El propietario no puede cambiarse');
  }
  const valor = { ...anterior, ...datos };
  for (const campo of ['grupoId', 'actividad', 'temaId']) if (valor[campo] !== undefined && valor[campo] !== null && typeof valor[campo] !== 'string') throw error(400, 'El grupo, la actividad y el tema deben ser identificadores válidos');
  if (typeof valor.titulo !== 'string' || !valor.titulo.trim() || valor.titulo.length > 200) throw error(400, 'Escribe un título de hasta 200 caracteres');
  if (!tipos.includes(valor.tipo) || typeof valor.todoElDia !== 'boolean') throw error(400, 'Selecciona un tipo y la modalidad de fecha');
  if (!fechaValida(valor.inicio, valor.todoElDia) || !fechaValida(valor.fin, valor.todoElDia) || Date.parse(valor.fin) <= Date.parse(valor.inicio)) {
    throw error(400, 'El inicio y el fin deben ser fechas válidas; el fin debe ser posterior al inicio');
  }
  const grupoId = valor.grupoId || null;
  const actividad = valor.actividad || null;
  const temaId = valor.temaId || null;
  if (grupoId || actividad || temaId) {
    if (!['docente', 'admin'].includes(usuario.rol)) throw error(403, 'Solo docentes y administradores pueden vincular grupos y actividades');
    if (grupoId && !(await gruposDe(usuario)).some((g) => g.id === grupoId)) throw error(403, 'Selecciona uno de tus grupos');
  }
  if (Boolean(actividad) !== Boolean(temaId)) throw error(400, 'Selecciona una actividad y su tema, o deja ambos vacíos');
  if (actividad) {
    if (!ACTIVIDADES.some((a) => a.id === actividad)) throw error(400, 'La actividad no está en el catálogo');
    const asignatura = await asignaturaDeTema(temaId);
    const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
    const unidad = tema && (await almacen.leer('unidades')).find((u) => u.id === tema.unidadId);
    if (!asignatura || !(await asignaturasDe(usuario)).some((a) => a.id === asignatura.id) || tema.estado !== 'publicado' || unidad?.visible === false) throw error(403, 'El tema no está disponible para esta actividad');
    if (grupoId && !(await gruposDe(usuario)).some((g) => g.id === grupoId && g.asignaturaId === asignatura.id)) throw error(400, 'El tema debe pertenecer a la asignatura del grupo');
  }
  const recordatorios = valor.recordatorios ?? [];
  if (!Array.isArray(recordatorios) || recordatorios.length > 2 || recordatorios.some((m) => ![60, 1440].includes(m)) || new Set(recordatorios).size !== recordatorios.length) {
    throw error(400, 'Los recordatorios disponibles son un día y una hora antes');
  }
  const ordenados = [...recordatorios].sort((a, b) => b - a);
  const cambioHorario = !anterior || ['inicio', 'fin', 'todoElDia', 'grupoId'].some((c) => (valor[c] || null) !== (anterior[c] || null)) || JSON.stringify(ordenados) !== JSON.stringify(anterior.recordatorios);
  return { titulo: valor.titulo.trim(), tipo: valor.tipo, inicio: valor.inicio, fin: valor.fin, todoElDia: valor.todoElDia,
    propietarioId: anterior?.propietarioId || usuario.id, grupoId, actividad, temaId, recordatorios: ordenados,
    avisados: cambioHorario ? {} : anterior.avisados || {} };
}

export default { filtrarLista, antesDeGuardar };
