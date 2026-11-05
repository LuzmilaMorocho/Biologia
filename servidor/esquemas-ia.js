import { errorPregunta } from '../publico/js/nucleo/preguntas.js';
import { normalizar } from '../publico/js/nucleo/util.js';
import { erroresEscenario, normalizarEvaluacionRol } from '../publico/js/nucleo/simulaciones.js';

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esTexto = (valor) => typeof valor === 'string' && valor.trim().length > 0;
const textos = (valor, campos) => esObjeto(valor) && campos.every((campo) => esTexto(valor[campo]));
const lista = (valor, validar) => Array.isArray(valor) && valor.length > 0 && valor.every(validar);

function validarSopa(valor, datos) {
  if (!Array.isArray(valor) || (valor.length > 0 && valor.length < 3) || valor.length > datos.cantidad || typeof datos.contenido !== 'string') return false;
  const utilizadas = new Set(datos.excluidas || []);
  const palabrasDe = (texto) => normalizar(texto).match(/[A-ZÑ]+/g) || [];
  return valor.every((item) => {
    if (!textos(item, ['termino', 'definicion', 'pista', 'retroalimentacion', 'cita'])) return false;
    const palabra = normalizar(item.termino);
    if (!/^[A-ZÑ]{3,15}$/.test(palabra) || palabra.length > datos.longitudMaxima || utilizadas.has(palabra) ||
        item.definicion.length > 300 || item.definicion.trim().split(/\s+/).length > 25 ||
        item.pista.length > 150 || item.pista.trim().split(/\s+/).length > 10 || palabrasDe(item.pista).includes(palabra) ||
        item.retroalimentacion.length > 400 || item.cita.length < 12 || item.cita.length > 300 ||
        !datos.contenido.includes(item.cita) || !palabrasDe(item.cita).includes(palabra)) return false;
    utilizadas.add(palabra);
    return true;
  });
}

const esquemas = {
  'sopa-letras': validarSopa,
  tutor: (valor) => esObjeto(valor) && typeof valor.enAmbito === 'boolean' && esTexto(valor.respuesta) &&
    valor.respuesta.length <= 1600 && valor.respuesta.trim().split(/\s+/).length <= 120 &&
    ['inicial', 'en-desarrollo', 'consolidada'].includes(valor.comprension) &&
    Array.isArray(valor.referencias) && valor.referencias.length <= 3 &&
    valor.referencias.every((item) => textos(item, ['temaId', 'cita']) && item.cita.trim().length >= 12 && item.cita.length <= 240),
  'generar-glosario': (valor) => lista(valor, (item) =>
    textos(item, ['termino', 'definicion', 'pista', 'retroalimentacion'])),
  'generar-preguntas': (valor) => lista(valor, (item) => !errorPregunta(item)),
  'generar-escenario': (valor, datos) => textos(valor, ['titulo', 'escenaInicial']) &&
    valor.titulo.length <= 200 && valor.escenaInicial.length <= 50 && Array.isArray(valor.escenas) &&
    valor.escenas.length >= 5 && valor.escenas.length <= 10 &&
    (!Number.isInteger(datos.escenas) || valor.escenas.length === datos.escenas) &&
    erroresEscenario(valor, { publicar: false }).length === 0,
  'evaluar-rol': (valor, datos) => {
    try { normalizarEvaluacionRol(valor, datos.rubricaCriterios); return true; } catch { return false; }
  }
};

export function validarRespuesta(tarea, resultado, datos = {}) {
  if (!Object.hasOwn(esquemas, tarea) || !esquemas[tarea](resultado, datos)) {
    throw new Error('La respuesta no cumple el esquema de la tarea');
  }
  return resultado;
}
