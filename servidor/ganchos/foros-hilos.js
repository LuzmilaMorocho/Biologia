import * as almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';
import { errorForo, moderador, validarCampos, textoValido, exigirAsignatura, exigirEdicion, validarBanderas, hiloAccesible } from '../foros.js';

export async function filtrarLista(lista, usuario) {
  const ids = new Set((await asignaturasDe(usuario)).map((a) => a.id));
  return lista.filter((h) => ids.has(h.asignaturaId) && (moderador(usuario) || !h.oculto));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  validarCampos(datos, ['asignaturaId', 'temaId', 'titulo', 'texto', 'autorId', 'fijado', 'cerrado', 'oculto']);
  const asignaturaId = anterior?.asignaturaId || datos.asignaturaId;
  await exigirAsignatura(asignaturaId, usuario);
  if (anterior) {
    await hiloAccesible(anterior.id, usuario);
    exigirEdicion(anterior, usuario);
    if (datos.asignaturaId !== undefined && datos.asignaturaId !== anterior.asignaturaId || datos.autorId !== undefined && datos.autorId !== anterior.autorId) {
      throw errorForo(400, 'La asignatura y el autor no pueden cambiarse');
    }
  }
  validarBanderas(datos, ['fijado', 'cerrado', 'oculto'], usuario);
  const valor = { ...anterior, ...datos };
  const temaId = valor.temaId || null;
  if (temaId !== null) {
    const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
    const unidad = tema && (await almacen.leer('unidades')).find((u) => u.id === tema.unidadId);
    if (!tema || unidad?.asignaturaId !== asignaturaId || usuario.rol === 'estudiante' && (tema.estado !== 'publicado' || unidad.visible === false)) {
      throw errorForo(403, 'El tema no está disponible en esta asignatura');
    }
  }
  return { asignaturaId, temaId, titulo: textoValido(valor.titulo, 'El título', 180), texto: textoValido(valor.texto),
    autorId: anterior?.autorId || usuario.id, fijado: valor.fijado || false, cerrado: valor.cerrado || false, oculto: valor.oculto || false,
    ...(!anterior ? { ultimoMovimiento: new Date().toISOString() } : {}) };
}

export default { filtrarLista, antesDeGuardar };
