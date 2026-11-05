import * as almacen from './almacen.js';
import { asignaturasDe } from './acceso.js';

export const errorForo = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
export const moderador = (usuario) => ['docente', 'admin'].includes(usuario?.rol);
export const puedeEditar = (reg, usuario) => moderador(usuario) || reg.autorId === usuario?.id &&
  Date.now() - Date.parse(reg.fecha) >= 0 && Date.now() - Date.parse(reg.fecha) <= 15 * 60000;

export function validarCampos(datos, campos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).some((campo) => !campos.includes(campo))) {
    throw errorForo(400, 'Los campos de la publicación no son válidos');
  }
}

export function textoValido(valor, nombre = 'El texto', maximo = 5000) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > maximo) throw errorForo(400, `${nombre} debe tener entre 1 y ${maximo} caracteres`);
  return valor.trim();
}

export async function exigirAsignatura(asignaturaId, usuario) {
  if (!usuario?.id) throw errorForo(401, 'Inicia sesión para participar');
  if (typeof asignaturaId !== 'string' || !(await asignaturasDe(usuario)).some((a) => a.id === asignaturaId)) {
    throw errorForo(403, 'No tienes acceso al foro de esta asignatura');
  }
}

export async function hiloAccesible(id, usuario) {
  const hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === id);
  if (!hilo) throw errorForo(404, 'Hilo no encontrado');
  await exigirAsignatura(hilo.asignaturaId, usuario);
  if (hilo.oculto && !moderador(usuario)) throw errorForo(403, 'Esta publicación no está disponible');
  return hilo;
}

export async function publicacionAccesible(coleccion, id, usuario) {
  if (coleccion === 'foros-hilos') return hiloAccesible(id, usuario);
  if (coleccion !== 'foros-respuestas') throw errorForo(400, 'Selecciona una publicación de foro válida');
  const respuesta = (await almacen.leer(coleccion)).find((r) => r.id === id);
  if (!respuesta) throw errorForo(404, 'Respuesta no encontrada');
  await hiloAccesible(respuesta.hiloId, usuario);
  if (respuesta.oculta && !moderador(usuario)) throw errorForo(403, 'Esta publicación no está disponible');
  return respuesta;
}

export function exigirEdicion(reg, usuario) {
  if (!puedeEditar(reg, usuario)) throw errorForo(403, 'Solo puedes editar tu publicación durante los primeros 15 minutos');
}

export function validarBanderas(datos, campos, usuario) {
  for (const campo of campos) if (Object.hasOwn(datos, campo)) {
    if (!moderador(usuario)) throw errorForo(403, 'Solo docentes y administradores pueden moderar publicaciones');
    if (typeof datos[campo] !== 'boolean') throw errorForo(400, 'Las opciones de moderación deben ser verdaderas o falsas');
  }
}

export async function enriquecer(coleccion, lista, usuario) {
  const usuarios = await almacen.leer('usuarios');
  const nombres = new Map(usuarios.map((u) => [u.id, [u.nombre, u.apellido].filter(Boolean).join(' ') || 'Participante']));
  let respuestas = [];
  if (coleccion === 'foros-hilos') respuestas = (await almacen.leer('foros-respuestas')).filter((r) => moderador(usuario) || !r.oculta);
  return lista.map((reg) => ({ ...reg, autorNombre: nombres.get(reg.autorId) || 'Participante',
    puedeEditar: puedeEditar(reg, usuario), puedeModerar: moderador(usuario),
    ...(coleccion === 'foros-hilos' ? { numeroRespuestas: respuestas.filter((r) => r.hiloId === reg.id).length } : {}) }));
}
