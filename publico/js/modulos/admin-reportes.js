import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Reportes de contenido', roles: ['admin'] });
const contenido = document.getElementById('contenido');
let reportes = [], ocupado = false, mensajeError = '', mensajeEstado = '';
const contextos = new Map(), ocultados = new Set(), desactivados = new Set();

async function cargarContexto(id) {
  try { contextos.set(id, { datos: await api.llamar('GET', `/api/mensajes/reporte/${encodeURIComponent(id)}`) }); }
  catch (error) { contextos.set(id, { error: error.message }); }
}

async function cargarReportes(forzarContextos = false) {
  const lista = await api.listar('reportes', { estado: 'pendiente' });
  if (forzarContextos) contextos.clear();
  reportes = lista;
  await Promise.all(lista.filter((r) => r.tipo === 'mensaje' && !contextos.get(r.id)?.datos).map((r) => cargarContexto(r.id)));
}

function autorDe(contexto, id) { return contexto.autores?.find((u) => u.id === id); }
function nombreAutor(contexto, id) {
  const usuario = autorDe(contexto, id);
  return [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || id;
}

function contextoMensaje(reporte) {
  const contexto = contextos.get(reporte.id);
  if (!contexto?.datos) return `<p role="alert">${ui.escapar(contexto?.error || 'No se pudo cargar el contexto.')}</p>
    <button type="button" class="btn btn--secundario" data-contexto="${ui.escapar(reporte.id)}">Reintentar contexto</button>`;
  const datos = contexto.datos;
  return `<h3>Contexto del mensaje</h3><p>Hasta cinco mensajes anteriores y el mensaje reportado.</p>
    <ol class="admin-reportes__contexto">${[...datos.anteriores, datos.mensaje].map((m) => `<li class="admin-reportes__mensaje ${m.id === datos.mensaje.id ? 'admin-reportes__mensaje--reportado' : ''}">
      <p><strong>${ui.escapar(nombreAutor(datos, m.autorId))}</strong> · ${ui.escapar(m.autorId)} · <time datetime="${ui.escapar(m.fecha)}">${ui.escapar(util.fechaLarga(m.fecha))}</time>${m.id === datos.mensaje.id ? ' · Mensaje reportado' : ''}${m.oculto || ocultados.has(`${datos.conversacionId}/${m.id}`) ? ' · Oculto' : ''}</p>
      <p class="admin-reportes__texto">${ui.escapar(m.texto)}</p></li>`).join('')}</ol>`;
}

function contenidoForo(r) {
  return `<h3>Contenido reportado</h3>${r.publicacion ? `<p>${ui.escapar(r.publicacion.titulo || r.publicacion.autorNombre)}</p><div class="publicacion-foro__texto">${util.formatoBasico(r.publicacion.texto)}</div>
    <a href="/paginas/hilo.html?id=${encodeURIComponent(r.coleccion === 'foros-hilos' ? r.referenciaId : r.publicacion.hiloId)}">Ver conversación</a>` : '<p>El contenido ya no está disponible.</p>'}`;
}

function acciones(r) {
  const datos = contextos.get(r.id)?.datos;
  const autorId = datos?.mensaje.autorId;
  const desactivado = desactivados.has(autorId) || autorDe(datos || {}, autorId)?.activo === false;
  const oculto = datos?.mensaje.oculto || ocultados.has(r.referenciaId);
  const boton = (accion, texto, clase = 'btn--secundario', deshabilitado = false) => `<button type="button" class="btn ${clase}" data-reporte="${ui.escapar(r.id)}" data-resolucion="${accion}" ${deshabilitado ? 'disabled' : ''}>${texto}</button>`;
  return `<div class="fila">${r.tipo === 'mensaje'
    ? boton('ocultar', oculto ? 'Resolver mensaje oculto' : 'Ocultar mensaje', 'btn--peligro', !datos) +
      boton('desactivar', desactivado ? 'Usuario desactivado' : 'Desactivar usuario', 'btn--peligro', !autorId || desactivado || autorId === usuarioActual()?.id)
    : r.publicacion ? boton('ocultar', 'Ocultar contenido', 'btn--peligro') : ''}
    ${boton('descartar', 'Descartar')}</div>`;
}

function renderizar() {
  contenido.innerHTML = `<div class="admin-reportes"><header><h1>Reportes pendientes</h1><p>Revisa el contenido y el motivo antes de resolver cada reporte.</p>
    <button type="button" id="reportes-actualizar" class="btn btn--secundario">Actualizar reportes</button></header>
    <p role="status">${reportes.length} reportes pendientes. ${ui.escapar(mensajeEstado)}</p><p id="reportes-error" class="campo__error" role="alert" tabindex="-1">${ui.escapar(mensajeError)}</p><div class="admin-reportes__lista">
    ${reportes.length ? reportes.map((r) => `<article class="tarjeta admin-reportes__reporte"><h2>${r.tipo === 'mensaje' ? 'Mensaje reportado' : r.coleccion === 'foros-hilos' ? 'Hilo reportado' : 'Respuesta reportada'}</h2>
      <p>Reportado el ${ui.escapar(util.fechaLarga(r.fecha))} · ${ui.escapar(r.reportadoPor)}</p><h3>Motivo</h3><div class="publicacion-foro__texto">${util.formatoBasico(r.motivo)}</div>
      ${r.tipo === 'mensaje' ? contextoMensaje(r) : contenidoForo(r)}${acciones(r)}</article>`).join('') : '<div class="tarjeta vacio"><p>No hay reportes pendientes.</p></div>'}</div></div>`;
  contenido.querySelectorAll('[data-reporte]').forEach((boton) => boton.addEventListener('click', () => trabajar(async () => {
    const reporte = reportes.find((r) => r.id === boton.dataset.reporte);
    if (!reporte) return;
    const accion = boton.dataset.resolucion;
    if (accion === 'desactivar') {
      const contexto = contextos.get(reporte.id)?.datos;
      const autorId = contexto?.mensaje.autorId;
      if (!autorId || !await ui.confirmar(`¿Desactivar a ${nombreAutor(contexto, autorId)} (${autorId})? Esta persona perderá el acceso a la plataforma.`)) return;
      await api.actualizar('usuarios', autorId, { activo: false });
      desactivados.add(autorId);
      mensajeEstado = 'Usuario desactivado. Puedes ocultar el mensaje o descartar el reporte.';
      return;
    }
    if (accion === 'ocultar' && reporte.tipo === 'mensaje' && !ocultados.has(reporte.referenciaId)) {
      await api.llamar('POST', '/api/mensajes/ocultar', { referenciaId: reporte.referenciaId });
      ocultados.add(reporte.referenciaId);
    }
    await api.llamar('POST', `/api/reportes/${encodeURIComponent(reporte.id)}/resolver`, { accion });
    reportes = reportes.filter((r) => r.id !== reporte.id);
    mensajeEstado = 'Reporte resuelto.';
    await cargarReportes();
    ui.aviso('Reporte resuelto.', 'exito');
  })));
  contenido.querySelectorAll('[data-contexto]').forEach((boton) => boton.addEventListener('click', () => trabajar(() => cargarContexto(boton.dataset.contexto))));
  document.getElementById('reportes-actualizar').addEventListener('click', () => trabajar(async () => {
    await cargarReportes(true);
  }));
}

async function trabajar(operacion) {
  if (ocupado) return;
  ocupado = true; mensajeError = ''; mensajeEstado = '';
  contenido.querySelectorAll('button').forEach((el) => { el.disabled = true; });
  try { await operacion(); }
  catch (error) { mensajeError = error.message; }
  finally { ocupado = false; renderizar(); document.getElementById(mensajeError ? 'reportes-error' : 'reportes-actualizar').focus(); }
}

async function iniciar() {
  ui.cargando(true);
  try { await cargarReportes(); renderizar(); }
  catch (error) {
    contenido.innerHTML = `<div class="tarjeta pila"><h1>Reportes</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" class="btn btn--secundario" id="reportes-recargar">Reintentar carga</button></div>`;
    document.getElementById('reportes-recargar').addEventListener('click', iniciar);
  } finally { ui.cargando(false); }
}
if (usuarioActual()?.rol === 'admin') await iniciar();
