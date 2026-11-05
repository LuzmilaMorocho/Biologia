import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema } from '../acceso.js';
import { normalizar } from '../../publico/js/nucleo/util.js';

const dificultades = { facil: [10, 8], media: [12, 10], dificil: [15, 12] };
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });

export default async function preparar(cuerpo, usuario) {
  if (usuario?.rol !== 'estudiante') throw error(403, 'Esta generación está disponible para estudiantes');
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((clave) => !['temaId', 'dificultad', 'excluir'].includes(clave))) {
    throw error(400, 'Envía solo el tema, la dificultad y las palabras ya utilizadas');
  }
  const { temaId, dificultad, excluir = [] } = cuerpo;
  if (typeof temaId !== 'string' || !temaId.trim() || typeof dificultad !== 'string' || !Object.hasOwn(dificultades, dificultad) ||
      !Array.isArray(excluir) || excluir.length > 200 ||
      excluir.some((palabra) => typeof palabra !== 'string' || !/^[a-záéíóúüñ]{3,15}$/i.test(palabra))) {
    throw error(400, 'Selecciona un tema y una dificultad válidos');
  }
  const tema = (await almacen.leer('temas')).find((item) => item.id === temaId);
  const asignatura = tema ? await asignaturaDeTema(temaId) : null;
  if (!tema || !asignatura) throw error(404, 'Tema no encontrado');
  const unidad = (await almacen.leer('unidades')).find((item) => item.id === tema.unidadId);
  const permitidas = await asignaturasDe(usuario);
  if (tema.estado !== 'publicado' || unidad?.visible === false || !permitidas.some((item) => item.id === asignatura.id)) {
    throw error(403, 'No tienes acceso a la sopa de letras de este tema');
  }
  const glosario = (await almacen.buscar('glosario', { temaId })).filter((item) => item.estado === 'aprobado');
  const contenido = [
    `Tema: ${tema.titulo}`, 'Objetivos:', ...(tema.objetivos || []),
    'Resumen y subtemas:', tema.resumen || '', 'Ejemplos:', ...(tema.ejemplos || []),
    'Palabras clave:', ...(tema.palabrasClave || []),
    'Glosario aprobado:', ...glosario.map((item) => `${item.termino}: ${item.definicion}`)
  ].join('\n').slice(0, 5700);
  const [longitudMaxima, cantidad] = dificultades[dificultad];
  return {
    asignatura: asignatura.nombre, nivel: asignatura.nivel, tema: tema.titulo,
    contenido, longitudMaxima, cantidad, excluidas: [...new Set(excluir.map(normalizar))]
  };
}
