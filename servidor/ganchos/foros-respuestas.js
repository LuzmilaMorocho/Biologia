import * as almacen from '../almacen.js';
import { notificar } from '../notificar.js';
import { procesarIntento } from '../gamificacion.js';
import { filtrarLista as hilosVisibles } from './foros-hilos.js';
import { errorForo, moderador, validarCampos, textoValido, exigirEdicion, validarBanderas, hiloAccesible, publicacionAccesible } from '../foros.js';

export async function filtrarLista(lista, usuario) {
  const ids = new Set((await hilosVisibles(await almacen.leer('foros-hilos'), usuario)).map((h) => h.id));
  return lista.filter((r) => ids.has(r.hiloId) && (moderador(usuario) || !r.oculta));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  validarCampos(datos, ['hiloId', 'texto', 'autorId', 'destacada', 'oculta']);
  const hilo = await hiloAccesible(anterior?.hiloId || datos.hiloId, usuario);
  if (anterior) {
    await publicacionAccesible('foros-respuestas', anterior.id, usuario);
    exigirEdicion(anterior, usuario);
    if (datos.hiloId !== undefined && datos.hiloId !== anterior.hiloId || datos.autorId !== undefined && datos.autorId !== anterior.autorId) throw errorForo(400, 'El hilo y el autor no pueden cambiarse');
  } else if (hilo.cerrado) throw errorForo(409, 'Este hilo está cerrado y no admite nuevas respuestas');
  validarBanderas(datos, ['destacada', 'oculta'], usuario);
  const valor = { ...anterior, ...datos };
  return { hiloId: hilo.id, texto: textoValido(valor.texto), autorId: anterior?.autorId || usuario.id,
    destacada: valor.destacada || false, oculta: valor.oculta || false };
}

export async function despuesDeGuardar(reg, usuario, anterior) {
  if (!reg || anterior) return reg;
  const avisos = [];
  let gamificacion = null;
  try { await almacen.actualizar('foros-hilos', reg.hiloId, { ultimoMovimiento: reg.fecha }); }
  catch { avisos.push('La respuesta se guardó; no se pudo actualizar el último movimiento.'); }
  try {
    const hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === reg.hiloId);
    if (hilo && hilo.autorId !== usuario.id) await notificar(hilo.autorId, { tipo: 'foro-respuesta',
      mensaje: `Hay una nueva participación en «${hilo.titulo}».`, enlace: `/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}` });
  } catch { avisos.push('La respuesta se guardó; no se pudo enviar la notificación.'); }
  try { gamificacion = await procesarIntento(usuario, { actividad: 'foro', puntaje: 1, maximo: 1 }); }
  catch { avisos.push('La respuesta se guardó; los puntos no pudieron procesarse en este momento.'); }
  return { ...reg, gamificacion, avisos };
}

export default { filtrarLista, antesDeGuardar, despuesDeGuardar };
