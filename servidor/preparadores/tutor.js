import * as almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';
import { normalizar } from '../../publico/js/nucleo/util.js';

const vacias = new Set('QUE COMO PARA POR CON UNA UNO UNOS UNAS LOS LAS DEL SON ESTO ESTA ESTE ESTAS ESTOS SOBRE QUIERO PUEDO PUEDES AYUDA AYUDAME EXPLICA EXPLICAME DIME HOLA PERO PORQUE CUAL CUALES CUANDO DONDE TENGO NECESITO MAS MUY SER HACER TIENE TEMA TEMAS ASIGNATURA CONTENIDO'.split(' '));
const palabras = (texto) => [...new Set((normalizar(texto).match(/[\p{L}\p{N}]+/gu) || []).filter((palabra) => palabra.length >= 3 && !vacias.has(palabra)))];
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });

export async function cargarCurriculo(asignaturaId, usuario) {
  if (!usuario || usuario.rol !== 'estudiante') throw error(403, 'El tutor está disponible para estudiantes');
  if (typeof asignaturaId !== 'string' || !asignaturaId.trim()) throw error(400, 'Selecciona una asignatura');
  const asignaturas = await asignaturasDe(usuario);
  const asignatura = asignaturas.find((item) => item.id === asignaturaId);
  if (!asignatura) throw error(403, 'No tienes acceso al tutor de esta asignatura');
  const [listaUnidades, listaTemas, glosario] = await Promise.all([almacen.leer('unidades'), almacen.leer('temas'), almacen.leer('glosario')]);
  const unidades = listaUnidades.filter((item) => item.asignaturaId === asignaturaId && item.visible !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const unidadesPorId = new Map(unidades.map((item) => [item.id, item]));
  const temas = listaTemas.filter((item) => unidadesPorId.has(item.unidadId) && item.estado === 'publicado')
    .sort((a, b) => (unidadesPorId.get(a.unidadId).orden || 0) - (unidadesPorId.get(b.unidadId).orden || 0) || (a.orden || 0) - (b.orden || 0))
    .map((tema) => {
      const unidad = unidadesPorId.get(tema.unidadId).titulo;
      const texto = [tema.titulo, 'Objetivos:', ...(tema.objetivos || []), 'Resumen:', tema.resumen || '', 'Ejemplos:', ...(tema.ejemplos || []),
        'Errores frecuentes:', ...(tema.erroresFrecuentes || []), 'Preguntas guía:', ...(tema.preguntasGuia || []),
        'Glosario:', ...glosario.filter((item) => item.temaId === tema.id && item.estado === 'aprobado').slice(0, 30).map((item) => `${item.termino}: ${item.definicion}`)].join('\n');
      return { id: tema.id, titulo: tema.titulo, unidad, texto };
    });
  return { asignatura, temas };
}

export default async function preparar(cuerpo, usuario, conversacion = {}) {
  if (cuerpo && typeof cuerpo === 'object' && !Object.hasOwn(cuerpo, 'asignaturaId')) return prepararTema(cuerpo, usuario);
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((clave) => !['asignaturaId', 'temaId', 'mensaje', 'mensajeId'].includes(clave))) {
    throw error(400, 'Envía solo la asignatura, el tema opcional y tu mensaje');
  }
  if (typeof cuerpo.mensaje !== 'string' || !cuerpo.mensaje.trim() || cuerpo.mensaje.length > 1500) throw error(400, 'Escribe una consulta de hasta 1500 caracteres');
  if (typeof cuerpo.mensajeId !== 'string' || !/^[a-z0-9-]{16,80}$/.test(cuerpo.mensajeId)) throw error(400, 'El identificador del mensaje no es válido');
  const curriculo = await cargarCurriculo(cuerpo.asignaturaId, usuario);
  if (cuerpo.temaId !== undefined && typeof cuerpo.temaId !== 'string') throw error(400, 'Selecciona un tema válido');
  if (cuerpo.temaId && !curriculo.temas.some((item) => item.id === cuerpo.temaId)) throw error(403, 'El tema no pertenece al contenido disponible de esta asignatura');
  const consulta = palabras(cuerpo.mensaje);
  const anteriores = conversacion.mensajes || [];
  const ultimoEstudiante = [...anteriores].reverse().find((item) => item.rol === 'estudiante')?.texto || '';
  const consultaAnterior = palabras(ultimoEstudiante);
  const ordenados = curriculo.temas.map((tema) => {
    const texto = new Set(palabras(tema.texto));
    const titulo = new Set(palabras(tema.titulo));
    return { ...tema, coincidencias: consulta.filter((palabra) => texto.has(palabra)).length,
      puntuacion: consulta.reduce((total, palabra) => total + (titulo.has(palabra) ? 4 : texto.has(palabra) ? 1 : 0), 0) +
        consultaAnterior.filter((palabra) => texto.has(palabra)).length * 0.2 +
        (tema.id === cuerpo.temaId ? 8 : tema.id === conversacion.temaActivo ? 0.5 : 0) };
  }).sort((a, b) => b.puntuacion - a.puntuacion);
  const consultaLimpia = normalizar(cuerpo.mensaje).replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
  const aclaracion = Boolean(conversacion.temaActivo || cuerpo.temaId) && /^(?:y )?(?:por que|como asi|(?:puedes|podrias) explicarlo(?: (?:de otra (?:manera|forma)|mas (?:despacio|simple)))?|(?:un|otro) ejemplo|por ejemplo|otra explicacion|que significa eso|mas (?:despacio|simple|sencillo))[?!. ]*$/.test(consultaLimpia);
  const seguimiento = aclaracion || /^(hola\b|buen[oa]s?\b|no (se|entiendo|comprendo)\b|si\b|no\b|creo\b|pienso\b|porque\b|por que\b|entonces\b|me cuesta\b|dame una pista\b|puedo explicarlo\b|una pista\b|otra pista\b|y si\b)/.test(consultaLimpia);
  const fueraDeAmbito = ordenados.length > 0 && !ordenados.some((tema) => tema.coincidencias > 0) && !seguimiento;
  const solicitaSolucion = /(?:IGNORA|OLVIDA|REVELA).{0,50}(?:INSTRUCCIONES|REGLAS|PROMPT)|(?:DAME|MUESTRA|REVELA).{0,30}(?:CLAVE|RESPUESTA CORRECTA)|(?:RESUELVE|CONTESTA).{0,25}(?:EXAMEN|QUIZ)/.test(normalizar(cuerpo.mensaje));
  const fuentes = ordenados.slice(0, 3).map((tema) => {
    const textoNormalizado = normalizar(tema.texto);
    const posicion = consulta.map((palabra) => textoNormalizado.indexOf(palabra)).find((indice) => indice >= 0) ?? 0;
    const inicio = Math.max(0, posicion - 250);
    return { temaId: tema.id, titulo: tema.titulo, unidad: tema.unidad, texto: tema.texto.slice(inicio, inicio + 1450) };
  });
  while (fuentes.length && JSON.stringify(fuentes).length > 5700) {
    const ultima = fuentes.at(-1);
    if (ultima.texto.length > 300) ultima.texto = ultima.texto.slice(0, -150);
    else fuentes.pop();
  }
  return {
    asignatura: curriculo.asignatura.nombre, nivel: curriculo.asignatura.nivel,
    tema: fuentes.map((fuente) => fuente.titulo).join(' · ') || curriculo.asignatura.nombre,
    indiceCurricular: curriculo.temas.map((tema) => `${tema.unidad}: ${tema.titulo}`).join('\n').slice(0, 4500),
    contenido: JSON.stringify(fuentes),
    historial: JSON.stringify(anteriores.slice(-6).map((item) => ({ rol: item.rol, texto: item.texto.slice(0, 600) }))),
    pregunta: cuerpo.mensaje.trim(), mensaje: cuerpo.mensaje.trim(), comprension: conversacion.comprension || 'inicial',
    fuentes, fueraDeAmbito, solicitaSolucion, curriculo
  };
}

export async function prepararTema(cuerpo, usuario) {
  if (usuario?.rol !== 'estudiante') throw error(403, 'El tutor está disponible para estudiantes');
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) ||
      Object.keys(cuerpo).some((k) => !['temaId', 'historial'].includes(k)) ||
      typeof cuerpo.temaId !== 'string' || !cuerpo.temaId.trim() || !Array.isArray(cuerpo.historial)) {
    throw error(400, 'Envía el tema y el historial de la conversación');
  }
  const historial = cuerpo.historial.slice(-10).map((m) => {
    if (!m || typeof m !== 'object' || Array.isArray(m) || Object.keys(m).some((k) => !['rol', 'texto'].includes(k)) ||
        !['estudiante', 'tutor'].includes(m.rol) || typeof m.texto !== 'string' || !m.texto.trim()) throw error(400, 'Cada mensaje debe indicar un rol y un texto válidos');
    return { rol: m.rol, texto: m.texto.slice(0, 1000).trim() };
  });
  const pregunta = [...historial].reverse().find((m) => m.rol === 'estudiante')?.texto;
  if (!pregunta) throw error(400, 'Incluye una pregunta del estudiante en los últimos diez mensajes');
  const tema = (await almacen.leer('temas')).find((t) => t.id === cuerpo.temaId);
  const unidad = tema && (await almacen.leer('unidades')).find((u) => u.id === tema.unidadId);
  if (!tema || !unidad) throw error(404, 'Tema no encontrado');
  const curriculo = await cargarCurriculo(unidad.asignaturaId, usuario);
  const seleccionado = curriculo.temas.find((t) => t.id === tema.id);
  if (!seleccionado) throw error(403, 'El tema no está publicado o no está disponible');
  const glosario = (await almacen.leer('glosario')).filter((t) => t.temaId === tema.id && t.estado === 'aprobado').slice(0, 30);
  const partes = [
    ['Objetivos:', (tema.objetivos || []).join('\n'), 700], ['Resumen:', tema.resumen || '', 1500],
    ['Ejemplos:', (tema.ejemplos || []).join('\n'), 650], ['Errores frecuentes:', (tema.erroresFrecuentes || []).join('\n'), 650],
    ['Preguntas guía:', (tema.preguntasGuia || []).join('\n'), 650],
    ['Glosario:', glosario.map((t) => `${t.termino}: ${t.definicion}`).join('\n'), 1200]
  ].map(([titulo, texto, maximo]) => ({ titulo, texto: texto.slice(0, maximo) }));
  const fuente = { temaId: tema.id, titulo: tema.titulo.slice(0, 180), unidad: String(seleccionado.unidad || '').slice(0, 180), texto: '' };
  const contenido = () => { fuente.texto = [fuente.titulo, ...partes.flatMap((p) => [p.titulo, p.texto])].join('\n'); return JSON.stringify([fuente]); };
  let contexto = contenido();
  while (contexto.length > 5700) {
    const mayor = [...partes].sort((a, b) => b.texto.length - a.texto.length)[0];
    mayor.texto = mayor.texto.slice(0, Math.max(0, mayor.texto.length - 100));
    contexto = contenido();
  }
  // Mantiene los diez turnos dentro del máximo de 6.000 caracteres por variable de IA.
  const porMensaje = Math.min(1000, Math.floor(5800 / historial.length) - 15);
  return {
    asignatura: curriculo.asignatura.nombre, nivel: curriculo.asignatura.nivel, tema: tema.titulo,
    contenido: contexto, historial: historial.map((m) => `${m.rol === 'estudiante' ? 'Estudiante' : 'Tutor'}: ${m.texto.slice(0, porMensaje)}`).join('\n'),
    pregunta, mensaje: pregunta, fuentes: [fuente], indiceCurricular: `${fuente.unidad}: ${fuente.titulo}`, comprension: 'inicial',
    curriculo: { asignatura: curriculo.asignatura, temas: [seleccionado] }, temaId: tema.id
  };
}
