import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export default async function preparar(cuerpo, usuario) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((clave) => !['temaId', 'cantidad'].includes(clave))) {
    throw Object.assign(new Error('Envía únicamente temaId y cantidad'), { estado: 400 });
  }
  const { temaId, cantidad } = cuerpo;
  if (typeof temaId !== 'string' || !temaId.trim() || !Number.isInteger(cantidad) || cantidad < 5 || cantidad > 20) {
    throw Object.assign(new Error('Selecciona un tema y una cantidad entera entre 5 y 20'), { estado: 400 });
  }
  const temas = await almacen.leer('temas');
  const tema = temas.find((item) => item.id === temaId);
  if (!tema) throw Object.assign(new Error('Tema no encontrado'), { estado: 404 });
  const asignatura = await asignaturaDeTema(temaId);
  if (!await puedeEditarAsignatura(usuario, asignatura?.id)) {
    throw Object.assign(new Error('No tienes permiso para editar este tema'), { estado: 403 });
  }
  const existentes = await almacen.buscar('glosario', { temaId });
  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel,
    tema: tema.titulo,
    contenido: [
      'Objetivos:', ...(tema.objetivos || []),
      'Resumen:', tema.resumen || '',
      'Ejemplos:', ...(tema.ejemplos || [])
    ],
    existentes: existentes.map((item) => item.termino),
    cantidad,
    minimoSeisLetras: 3
  };
}
