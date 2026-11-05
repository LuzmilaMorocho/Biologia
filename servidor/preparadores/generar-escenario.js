import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });

export default async function preparar(cuerpo, usuario) {
  if (!usuario) throw error(401, 'Inicia sesión para generar un escenario');
  if (!['docente', 'admin'].includes(usuario.rol)) throw error(403, 'Solo docentes y administradores pueden generar escenarios');
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((clave) => !['temaId', 'situacion', 'escenas'].includes(clave))) {
    throw error(400, 'Envía únicamente temaId, situacion y escenas');
  }
  const { temaId, situacion, escenas } = cuerpo;
  if (typeof temaId !== 'string' || !temaId.trim() || typeof situacion !== 'string' || !situacion.trim() || situacion.length > 800 ||
      !Number.isInteger(escenas) || escenas < 5 || escenas > 10) {
    throw error(400, 'Selecciona un tema, describe la situación en hasta 800 caracteres y elige de 5 a 10 escenas');
  }
  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema) throw error(404, 'Tema no encontrado');
  const asignatura = await asignaturaDeTema(temaId);
  if (!await puedeEditarAsignatura(usuario, asignatura?.id)) throw error(403, 'No tienes permiso para editar este tema');
  const lineas = (valor) => Array.isArray(valor) ? valor : typeof valor === 'string' ? [valor] : [];
  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel,
    tema: tema.titulo,
    contenido: ['Objetivos:', ...lineas(tema.objetivos), 'Resumen:', tema.resumen || '', 'Ejemplos:', ...lineas(tema.ejemplos)],
    situacion: situacion.trim(),
    escenas
  };
}
