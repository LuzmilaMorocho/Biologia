import { createHash } from 'node:crypto';
import * as almacen from './almacen.js';
import { filtrarLista } from './ganchos/simulaciones.js';
import { erroresRol, normalizarEvaluacionRol } from '../publico/js/nucleo/simulaciones.js';
import { ejecutarTarea } from './ia.js';

const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
const huella = (valor) => createHash('sha256').update(JSON.stringify(valor)).digest('hex');
const evaluaciones = new Map();
export const huellaConfiguracionRol = (s) => huella([s.temaId, s.personaje, s.rubrica, s.maxTurnos]);

export async function datosConversacionRol(cuerpo, usuario, evaluar = false) {
  if (!usuario?.id) throw error(401, 'Inicia sesión para practicar el rol');
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) || Object.keys(cuerpo).some((c) => !['simulacionId', 'historial'].includes(c)) ||
      typeof cuerpo.simulacionId !== 'string' || !cuerpo.simulacionId.trim() || !Array.isArray(cuerpo.historial)) throw error(400, 'Envía la simulación y el historial');
  const simulacion = (await almacen.leer('simulaciones')).find((s) => s.id === cuerpo.simulacionId);
  if (!simulacion) throw error(404, 'Simulación no encontrada');
  if (!(await filtrarLista([simulacion], usuario)).length) throw error(403, 'No tienes acceso a esta simulación');
  if (simulacion.modo !== 'rol' || erroresRol(simulacion).length) throw error(400, 'La práctica de rol no está configurada correctamente');
  if (!evaluar && cuerpo.historial.length > simulacion.maxTurnos * 2 - 1) throw error(409, 'Ya completaste los turnos. Termina la práctica para recibir tu informe.');
  const historial = cuerpo.historial.slice(0, simulacion.maxTurnos * 2).map((m, i) => {
    const esperado = i % 2 === 0 ? 'estudiante' : 'personaje';
    if (!m || typeof m !== 'object' || Array.isArray(m) || Object.keys(m).some((c) => !['rol', 'texto'].includes(c)) || m.rol !== esperado || typeof m.texto !== 'string' || !m.texto.trim() || m.texto.length > 1000) {
      throw error(400, 'El historial debe alternar estudiante y personaje, con textos de hasta 1.000 caracteres');
    }
    return { rol: m.rol, texto: m.texto.trim() };
  });
  if (!historial.length || (!evaluar && historial.at(-1).rol !== 'estudiante')) throw error(400, 'Incluye el mensaje del estudiante');
  return { simulacion, historial };
}

export function textoHistorialRol(historial, nombre) {
  if (!historial.length) return '';
  const etiquetas = historial.map((m) => m.rol === 'estudiante' ? 'Estudiante' : nombre);
  const disponible = Math.max(60, Math.floor((5900 - etiquetas.reduce((n, s) => n + s.length + 3, 0)) / historial.length));
  return historial.map((m, i) => {
    const texto = m.texto.length <= disponible ? m.texto : m.texto.slice(0, Math.floor(disponible * 0.6)) + '…' + m.texto.slice(-Math.floor(disponible * 0.4) + 1);
    return `${etiquetas[i]}: ${texto}`;
  }).join('\n');
}

export async function evaluarRolConIA(datos, usuario) {
  const clave = `${usuario.id}:${datos.simulacionId}:${datos.huellaConfiguracion}:${datos.huellaHistorial}`;
  for (const [k, v] of evaluaciones) if (v.expira < Date.now()) evaluaciones.delete(k);
  if (evaluaciones.has(clave)) return evaluaciones.get(clave).promesa;
  const promesa = (async () => {
    const respuesta = await ejecutarTarea('evaluar-rol', datos, usuario, { formato: 'json' });
    const informe = normalizarEvaluacionRol(respuesta, datos.rubricaCriterios);
    const comprobante = await almacen.agregar('evaluaciones-rol', { usuarioId: usuario.id, simulacionId: datos.simulacionId,
      huellaConfiguracion: datos.huellaConfiguracion, puntaje: informe.puntaje, maximo: informe.maximo });
    return { ...informe, evaluacionId: comprobante.id };
  })();
  evaluaciones.set(clave, { promesa, expira: Date.now() + 2 * 3600000 });
  try { return await promesa; } catch (causa) { evaluaciones.delete(clave); throw causa; }
}

export async function datosIntentoRol(datos, simulacion, usuario) {
  const comprobante = (await almacen.leer('evaluaciones-rol')).find((e) => e.id === datos.detalle?.evaluacionId && e.usuarioId === usuario.id && e.simulacionId === simulacion.id);
  if (!comprobante) throw error(403, 'Primero termina la práctica y solicita su evaluación');
  if (comprobante.huellaConfiguracion !== huellaConfiguracionRol(simulacion)) throw error(409, 'La práctica cambió. Vuelve a evaluar antes de guardar el intento.');
  return { ...datos, puntaje: comprobante.puntaje, maximo: comprobante.maximo, errores: comprobante.puntaje === comprobante.maximo ? 0 : 1,
    detalle: { simulacionId: simulacion.id, modo: 'rol', evaluacionId: comprobante.id } };
}

export const huellaHistorialRol = huella;
