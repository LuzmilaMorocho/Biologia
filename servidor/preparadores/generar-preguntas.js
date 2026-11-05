import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const nivelesBloom = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];

export default async function preparar(cuerpo, usuario) {
  const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((clave) => !['temaId', 'nivel', 'cantidad'].includes(clave))) {
    throw error(400, 'Envía únicamente temaId, nivel y cantidad');
  }
  const { temaId, nivel, cantidad } = cuerpo;
  if (typeof temaId !== 'string' || !temaId.trim() || !Number.isInteger(nivel) || nivel < 1 || nivel > 5 ||
      !Number.isInteger(cantidad) || cantidad < 5 || cantidad > 15) {
    throw error(400, 'Selecciona un tema, un nivel de 1 a 5 y una cantidad entera de 5 a 15');
  }
  const tema = (await almacen.leer('temas')).find((item) => item.id === temaId);
  if (!tema) throw error(404, 'Tema no encontrado');
  const asignatura = await asignaturaDeTema(temaId);
  if (!await puedeEditarAsignatura(usuario, asignatura?.id)) throw error(403, 'No tienes permiso para editar este tema');
  const [glosario, preguntas] = await Promise.all([
    almacen.buscar('glosario', { temaId }), almacen.buscar('preguntas', { temaId, nivel })
  ]);
  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel,
    tema: tema.titulo,
    contenido: ['Objetivos:', ...(tema.objetivos || []), 'Resumen:', tema.resumen || '', 'Ejemplos:', ...(tema.ejemplos || [])],
    glosario: glosario.map((item) => `${item.termino}: ${item.definicion}`),
    nivelBloom: `${nivel} ${nivelesBloom[nivel - 1]}`,
    cantidad,
    existentes: preguntas.map((item) => item.enunciado)
  };
}
