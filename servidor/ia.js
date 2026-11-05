import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import * as almacen from './almacen.js';
import { validarRespuesta } from './esquemas-ia.js';
import { obtenerConfiguracionIA, errorProveedorIA } from './configuracion-ia.js';

const colasPorUsuario = new Map();
const tareasSesion = new Set(['tutor', 'rol-simulacion', 'evaluar-rol']);

function error(estado, mensaje) {
  return Object.assign(new Error(mensaje), { estado });
}

function autorizar(tarea, usuario) {
  if (!usuario?.id) throw error(401, 'Inicia sesión para usar la IA');
  if (typeof tarea !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(tarea)) {
    throw error(400, 'Nombre de tarea no válido');
  }
  if (tarea === 'prueba') {
    if (usuario.rol !== 'admin') throw error(403, 'Esta prueba requiere un administrador');
  } else if (tarea === 'sopa-letras') {
    if (usuario.rol !== 'estudiante') throw error(403, 'Esta generación está disponible para estudiantes');
  } else if (tarea.startsWith('generar-')) {
    if (!['docente', 'admin'].includes(usuario.rol)) throw error(403, 'Solo docentes y administradores pueden generar contenido');
  } else if (!tareasSesion.has(tarea)) {
    throw error(404, 'Tarea de IA no disponible');
  }
}

function esTutor(tarea) {
  return tarea === 'tutor' || tarea === 'rol-simulacion';
}

async function comprobarLimite(tarea, usuario) {
  const ajustes = await almacen.leerConfig('ajustes');
  const limite = ajustes[esTutor(tarea) ? 'limiteTutorDiario' : 'limiteIADiario'];
  if (!Number.isInteger(limite) || limite < 0) throw error(503, 'El límite de IA no está configurado');
  // Día calendario de Ecuador, independiente de la zona horaria del servidor.
  const dia = (fecha) => new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  const hoy = dia(Date.now());
  const usos = await almacen.leerLineas('consumo-ia.jsonl');
  const total = usos.filter((uso) => uso.usuarioId === usuario.id &&
    dia(uso.fecha) === hoy && esTutor(uso.tarea) === esTutor(tarea)).length;
  if (total >= limite) throw error(429, 'Por hoy alcanzaste tu límite de IA. Puedes continuar mañana.');
}

function valorPlantilla(valor) {
  return (Array.isArray(valor) ? valor.join('\n') : String(valor ?? '')).slice(0, 6000);
}

async function mensajesDe(tarea, datos) {
  let plantilla;
  try {
    plantilla = await fs.readFile(path.resolve('servidor', 'prompts', `${tarea}.txt`), 'utf8');
  } catch (causa) {
    if (causa.code === 'ENOENT') throw error(404, 'La plantilla de esta tarea no está disponible');
    throw causa;
  }
  // Separar antes de sustituir evita que el contenido altere los roles.
  const separador = /^### USUARIO[ \t]*\r?$/m.exec(plantilla);
  if (!separador) throw error(500, 'La plantilla de IA no tiene separador de mensajes');
  const sustituir = (texto) => texto.replace(/\{\{(\w+)\}\}/g, (_, clave) =>
    valorPlantilla(Object.hasOwn(datos, clave) ? datos[clave] : ''));
  return [
    { role: 'system', content: sustituir(plantilla.slice(0, separador.index)).trim() },
    { role: 'user', content: sustituir(plantilla.slice(separador.index + separador[0].length)).trim() }
  ];
}

function extraerJson(texto) {
  const inicio = texto.search(/[\[{]/);
  if (inicio < 0) throw new Error('No hay JSON');
  const pila = [];
  let cadena = false;
  let escape = false;
  for (let i = inicio; i < texto.length; i++) {
    const caracter = texto[i];
    if (cadena) {
      if (escape) escape = false;
      else if (caracter === '\\') escape = true;
      else if (caracter === '"') cadena = false;
    } else if (caracter === '"') cadena = true;
    else if (caracter === '[' || caracter === '{') pila.push(caracter);
    else if (caracter === ']' || caracter === '}') {
      if (pila.pop() !== (caracter === ']' ? '[' : '{')) throw new Error('JSON incompleto');
      if (pila.length === 0) return JSON.parse(texto.slice(inicio, i + 1));
    }
  }
  throw new Error('JSON incompleto');
}

async function consultar(mensajes, temperatura, signal, configuracion, formato, registrarEnvio) {
  let respuesta;
  try {
    const gemini = configuracion.proveedor === 'gemini';
    const geminiReciente = gemini && Number(configuracion.modelo.match(/^gemini-(\d+)/)?.[1]) >= 3;
    const url = gemini
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(configuracion.modelo)}:generateContent`
      : 'https://api.openai.com/v1/chat/completions';
    const cuerpoPeticion = gemini ? {
      systemInstruction: { parts: [{ text: mensajes.filter((mensaje) => mensaje.role === 'system').map((mensaje) => mensaje.content).join('\n') }] },
      contents: [{ role: 'user', parts: [{ text: mensajes.filter((mensaje) => mensaje.role !== 'system').map((mensaje) => mensaje.content).join('\n\n') }] }],
      generationConfig: { ...(!geminiReciente ? { temperature: temperatura } : {}), ...(formato === 'json' ? { responseMimeType: 'application/json' } : {}) }
    } : {
      model: configuracion.modelo, messages: mensajes, temperature: temperatura, reasoning_effort: 'none', store: false
    };
    const opciones = {
      method: 'POST',
      headers: { ...(gemini ? { 'x-goog-api-key': configuracion.clave } : { Authorization: `Bearer ${configuracion.clave}` }), 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoPeticion), signal
    };
    // Reintentos de transporte limitados; mantienen el plazo total de 60 segundos.
    for (let intento = 0; intento < 3; intento++) {
      registrarEnvio();
      respuesta = await fetch(url, opciones);
      if (!gemini || ![408, 500, 502, 503, 504].includes(respuesta.status) || intento === 2) break;
      await respuesta.body?.cancel();
      await esperar(1000 * 2 ** intento + Math.floor(Math.random() * 250), undefined, { signal });
    }
    if (!respuesta.ok) throw errorProveedorIA(respuesta.status);
    const cuerpo = await respuesta.json();
    if (gemini) {
      const candidato = cuerpo.candidates?.[0];
      if (cuerpo.promptFeedback?.blockReason || (candidato?.finishReason && candidato.finishReason !== 'STOP')) {
        throw error(502, 'Gemini no completó la respuesta. Revisa el contenido o intenta nuevamente.');
      }
      return (candidato?.content?.parts || []).filter((parte) => !parte.thought && typeof parte.text === 'string').map((parte) => parte.text).join('');
    }
    const texto = cuerpo.choices?.[0]?.message?.content;
    return typeof texto === 'string' ? texto : '';
  } catch (causa) {
    if (signal.aborted) throw error(504, 'La IA tardó demasiado. Inténtalo nuevamente.');
    if (causa.estado) throw causa;
    throw error(502, 'No fue posible comunicarse con el proveedor de IA');
  }
}

export async function ejecutarTarea(tarea, datos, usuario, { formato = 'texto' } = {}) {
  autorizar(tarea, usuario);
  if (!['json', 'texto'].includes(formato)) throw error(400, 'Formato de IA no válido');
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw error(400, 'Datos de tarea no válidos');
  // Serializar por usuario evita superar el cupo con solicitudes simultáneas.
  const previa = colasPorUsuario.get(usuario.id) || Promise.resolve();
  const operacion = previa.catch(() => {}).then(async () => {
    const configuracion = await obtenerConfiguracionIA();
    if (!['openai', 'gemini'].includes(configuracion.proveedor)) throw error(503, 'El proveedor de IA no está configurado');
    if (!configuracion.clave?.trim() || !configuracion.modelo?.trim()) {
      throw error(503, 'La IA todavía no está configurada. Comunícate con el administrador.');
    }
    const mensajes = await mensajesDe(tarea, datos);
    await comprobarLimite(tarea, usuario);
    const signal = AbortSignal.timeout(60000);
    let entrada = 0;
    let salida = 0;
    let ok = false;
    try {
      for (let intento = 0; intento < (formato === 'json' ? 2 : 1); intento++) {
        const texto = await consultar(mensajes, esTutor(tarea) ? 0.7 : 0.4, signal, configuracion, formato, () => {
          entrada += mensajes.reduce((total, mensaje) => total + mensaje.content.length, 0);
        });
        salida += texto.length;
        if (formato === 'texto') {
          if (!texto.trim()) throw error(502, 'La IA devolvió una respuesta vacía');
          ok = true;
          return texto;
        }
        try {
          const resultado = validarRespuesta(tarea, extraerJson(texto), datos);
          ok = true;
          return resultado;
        } catch {
          if (intento === 1) throw error(502, 'La IA no devolvió un formato válido');
          mensajes.push({ role: 'user', content: 'Responde SOLO con JSON válido y con los campos y tipos solicitados.' });
        }
      }
    } finally {
      // Solo metadatos y conteos: no guardar prompts ni respuestas.
      await almacen.anexarLinea('consumo-ia.jsonl', {
        usuarioId: usuario.id, tarea, entrada, salida, ok, fecha: new Date().toISOString()
      });
    }
  });
  colasPorUsuario.set(usuario.id, operacion);
  try {
    return await operacion;
  } finally {
    if (colasPorUsuario.get(usuario.id) === operacion) colasPorUsuario.delete(usuario.id);
  }
}
