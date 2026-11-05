import { createHash } from 'node:crypto';
import preparar, { cargarCurriculo } from './preparadores/tutor.js';
import { ejecutarTarea } from './ia.js';
import { conBloqueo } from './bloqueos.js';
import { registrarConsultaTutor } from './consultas-tutor.js';

const conversaciones = new Map();
const DURACION = 8 * 60 * 60 * 1000;
const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
const normalizarCita = (texto) => texto.replace(/\s+/g, ' ').trim();

function validarOrientacion(respuesta, datos, actual) {
  const fuentes = respuesta.referencias.map((referencia) => {
    const fuente = datos.fuentes.find((item) => item.temaId === referencia.temaId);
    const vigente = actual.temas.find((item) => item.id === referencia.temaId);
    const cita = normalizarCita(referencia.cita);
    if (!fuente || !vigente || !normalizarCita(fuente.texto).includes(cita) || !normalizarCita(vigente.texto).includes(cita)) return null;
    return { temaId: fuente.temaId, titulo: fuente.titulo, extracto: referencia.cita, enlace: `/paginas/tema.html?id=${encodeURIComponent(fuente.temaId)}` };
  });
  if (!respuesta.enAmbito || !fuentes.length || fuentes.some((fuente) => !fuente) || !respuesta.respuesta.trim().endsWith('?')) {
    return { texto: `Con los contenidos publicados no puedo fundamentar esa consulta. Podemos trabajar una idea de ${datos.fuentes[0]?.titulo || datos.asignatura}. ¿Qué has entendido hasta ahora sobre ese tema?`, fuentes: [] };
  }
  return { texto: respuesta.respuesta, fuentes, comprension: respuesta.comprension };
}

export async function responderTutorTema(cuerpo, usuario) {
  const fecha = Date.now();
  const datos = await preparar(cuerpo, usuario);
  const respuesta = await ejecutarTarea('tutor', datos, usuario, { formato: 'json' });
  const actual = await cargarCurriculo(datos.curriculo.asignatura.id, usuario);
  if (!actual.temas.some((t) => t.id === datos.temaId)) throw error(403, 'El tema ya no está disponible');
  const orientacion = validarOrientacion(respuesta, datos, actual);
  await registrarConsultaTutor(usuario.id, datos.temaId, fecha);
  return { respuesta: orientacion.texto.slice(0, 700) };
}

function claveDe(usuario, autorizacion, asignaturaId) {
  if (!usuario || usuario.rol !== 'estudiante') throw error(403, 'El tutor está disponible para estudiantes');
  if (typeof autorizacion !== 'string' || !autorizacion.startsWith('Bearer ')) throw error(401, 'Inicia sesión para conversar con el tutor');
  if (typeof asignaturaId !== 'string' || !asignaturaId.trim() || asignaturaId.length > 150) throw error(400, 'Selecciona una asignatura válida');
  return `${usuario.id}:${createHash('sha256').update(autorizacion).digest('hex')}:${asignaturaId}`;
}

function conversacionDe(clave) {
  const ahora = Date.now();
  for (const [id, estado] of conversaciones) if (ahora - estado.actualizada > DURACION) conversaciones.delete(id);
  if (!conversaciones.has(clave)) {
    if (conversaciones.size >= 500) throw error(503, 'El tutor está ocupado. Inténtalo más tarde.');
    conversaciones.set(clave, { mensajes: [], solicitudes: new Map(), comprension: 'inicial', temaActivo: '', actualizada: ahora });
  }
  const estado = conversaciones.get(clave);
  estado.actualizada = ahora;
  return estado;
}

function vista(estado, curriculo) {
  const publicados = new Set(curriculo.temas.map((tema) => tema.id));
  return {
    asignaturaId: curriculo.asignatura.id,
    mensajes: estado.mensajes.map((mensaje) => ({ ...mensaje, fuentes: (mensaje.fuentes || []).filter((fuente) => publicados.has(fuente.temaId)) })),
    temas: curriculo.temas.map(({ id, titulo, unidad }) => ({ id, titulo, unidad })),
    temaActivo: publicados.has(estado.temaActivo) ? estado.temaActivo : '', comprension: estado.comprension
  };
}

export async function consultarTutor(usuario, autorizacion, asignaturaId, reiniciar = false) {
  const clave = claveDe(usuario, autorizacion, asignaturaId);
  return await conBloqueo(`tutor:${clave}`, async () => {
    const curriculo = await cargarCurriculo(asignaturaId, usuario);
    if (reiniciar) conversaciones.delete(clave);
    return vista(conversacionDe(clave), curriculo);
  });
}

export async function responderTutor(cuerpo, usuario, autorizacion) {
  const fecha = Date.now();
  const clave = claveDe(usuario, autorizacion, cuerpo?.asignaturaId);
  return await conBloqueo(`tutor:${clave}`, async () => {
    const previa = conversaciones.get(clave);
    const datos = await preparar(cuerpo, usuario, previa && Date.now() - previa.actualizada <= DURACION ? previa : {});
    const estado = conversacionDe(clave);
    const firma = JSON.stringify([cuerpo.mensaje, cuerpo.temaId || '']);
    const anterior = estado.solicitudes.get(cuerpo.mensajeId);
    if (anterior) {
      if (anterior !== firma) throw error(409, 'Este mensaje ya se utilizó con otro contenido');
      return vista(estado, datos.curriculo);
    }
    let texto;
    let fuentes = [];
    let comprension = estado.comprension;
    if (!datos.curriculo.temas.length) {
      texto = 'Todavía no hay temas publicados para esta asignatura. Cuando tu docente publique los contenidos podremos estudiarlos juntos. ¿Qué tema deseas consultar cuando esté disponible?';
    } else if (datos.solicitaSolucion) {
      texto = 'Puedo acompañarte con pistas para construir tu propio razonamiento. ¿Qué has intentado y en qué paso de los contenidos de esta asignatura necesitas ayuda?';
    } else if (datos.fueraDeAmbito) {
      texto = `Puedo acompañarte solo con los contenidos publicados de ${datos.asignatura}. ¿Qué idea de sus unidades o temas te gustaría comprender mejor?`;
    } else {
      const respuesta = await ejecutarTarea('tutor', datos, usuario, { formato: 'json' });
      const actual = await cargarCurriculo(cuerpo.asignaturaId, usuario);
      const orientacion = validarOrientacion(respuesta, datos, actual);
      texto = orientacion.texto;
      fuentes = orientacion.fuentes;
      if (fuentes.length) {
        comprension = orientacion.comprension;
        estado.temaActivo = fuentes[0].temaId;
      }
    }
    texto = texto.slice(0, 700);
    await registrarConsultaTutor(usuario.id, cuerpo.temaId || datos.fuentes[0]?.temaId, fecha);
    estado.mensajes.push({ rol: 'estudiante', texto: datos.mensaje, fuentes: [] }, { rol: 'tutor', texto, fuentes });
    estado.mensajes = estado.mensajes.slice(-24);
    estado.comprension = comprension;
    estado.actualizada = Date.now();
    estado.solicitudes.set(cuerpo.mensajeId, firma);
    if (estado.solicitudes.size > 16) estado.solicitudes.delete(estado.solicitudes.keys().next().value);
    return vista(estado, datos.curriculo);
  });
}
