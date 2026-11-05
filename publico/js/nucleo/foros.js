import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

export { formularioModal } from './formularios.js';

export function accionesPublicacion(coleccion, reg) {
  const hilo = coleccion === 'foros-hilos';
  const accion = (nombre, texto) => `<button type="button" class="btn btn--texto btn--pequeno" data-foro-accion="${nombre}" data-foro-id="${ui.escapar(reg.id)}" data-foro-col="${coleccion}">${texto}</button>`;
  return `<details class="publicacion-foro__menu"><summary>Acciones de la publicación</summary><div class="fila">
    ${reg.puedeEditar ? accion('editar', 'Editar') : ''}${accion('reportar', 'Reportar')}
    ${reg.puedeModerar ? (hilo ? accion('fijado', reg.fijado ? 'Dejar de fijar' : 'Fijar') + accion('cerrado', reg.cerrado ? 'Reabrir' : 'Cerrar')
      : accion('destacada', reg.destacada ? 'Quitar destacado' : 'Destacar')) + accion(hilo ? 'oculto' : 'oculta', reg.oculto || reg.oculta ? 'Mostrar' : 'Ocultar') : ''}
    </div></details>`;
}

export function publicacion(coleccion, reg) {
  return `<article class="tarjeta publicacion-foro" id="publicacion-${coleccion}-${ui.escapar(reg.id)}">
    ${reg.titulo ? `<h2>${ui.escapar(reg.titulo)}</h2>` : ''}
    <p class="publicacion-foro__meta">${ui.escapar(reg.autorNombre || 'Participante')} · ${ui.escapar(util.fechaRelativa(reg.fecha))}
    ${reg.fijado ? ' · Fijado' : ''}${reg.cerrado ? ' · Cerrado' : ''}${reg.destacada ? ' · Destacada' : ''}${reg.oculto || reg.oculta ? ' · Oculta' : ''}</p>
    <div class="publicacion-foro__texto">${util.formatoBasico(reg.texto)}</div>${accionesPublicacion(coleccion, reg)}</article>`;
}

export function vincularAcciones(contenedor, registros, actualizar) {
  let ocupado = false;
  contenedor.querySelectorAll('[data-foro-accion]').forEach((boton) => boton.addEventListener('click', async () => {
    if (ocupado) return;
    const col = boton.dataset.foroCol;
    const reg = registros.find((r) => r.id === boton.dataset.foroId && r.coleccion === col);
    if (!reg) return;
    ocupado = true;
    try {
      const accion = boton.dataset.foroAccion;
      let cambio;
      if (accion === 'reportar') {
        cambio = await formularioModal('Reportar publicación', `<div class="campo"><label for="foro-motivo">Motivo del reporte</label><textarea id="foro-motivo" name="motivo" required maxlength="5000" rows="5"></textarea></div>`,
          (datos) => api.crear('reportes', { tipo: 'foro', coleccion: col, referenciaId: reg.id, motivo: datos.motivo }));
        if (cambio) ui.aviso('Reporte enviado a administración.', 'exito');
      } else if (accion === 'editar') {
        cambio = await formularioModal('Editar publicación', `${reg.titulo !== undefined ? `<div class="campo"><label for="foro-titulo-editar">Título</label><input id="foro-titulo-editar" name="titulo" maxlength="180" required value="${ui.escapar(reg.titulo)}"></div>` : ''}
          <div class="campo"><label for="foro-texto-editar">Texto (máximo 5.000 caracteres)</label><textarea id="foro-texto-editar" name="texto" required maxlength="5000" rows="8">${ui.escapar(reg.texto)}</textarea></div>`,
          (datos) => api.actualizar(col, reg.id, datos));
      } else {
        boton.disabled = true;
        cambio = await api.actualizar(col, reg.id, { [accion]: !reg[accion] });
      }
      if (cambio && accion !== 'reportar') await actualizar();
    } catch (error) { ui.aviso(error.message, 'error'); }
    finally { ocupado = false; boton.disabled = false; }
  }));
}

export function paginador(pagina, paginas, total) {
  return `<nav class="paginacion-foro" aria-label="Páginas de respuestas">
    <button type="button" class="btn btn--secundario" data-pagina="${pagina - 1}" ${pagina <= 1 ? 'disabled' : ''}>Anteriores</button>
    <span role="status">Página ${pagina} de ${paginas} · ${total} respuestas</span>
    <button type="button" class="btn btn--secundario" data-pagina="${pagina + 1}" ${pagina >= paginas ? 'disabled' : ''}>Siguientes</button></nav>`;
}
