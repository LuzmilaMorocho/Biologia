import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { accionesPublicacion, vincularAcciones, formularioModal } from '../nucleo/foros.js';

await montarPlantilla({ titulo: 'Foros', roles: ['sesion'] });
const contenido = document.getElementById('contenido');
let asignaturas = [], temas = [], hilos = [];
let asignaturaId = '', temaId = '', ocupado = false;

async function cargarHilos() {
  hilos = asignaturaId ? await api.listar('foros-hilos', { asignaturaId, ...(temaId ? { temaId } : {}) }) : [];
}

function renderizar() {
  contenido.innerHTML = `<div class="foros"><header><h1>Foros de aprendizaje</h1><p>Comparte ideas, plantea preguntas y participa con respeto en tus asignaturas.</p></header>
    <div class="foros__filtros"><div class="campo"><label for="foro-asignatura">Asignatura</label><select id="foro-asignatura">
      ${asignaturas.length ? '' : '<option value="">No tienes asignaturas disponibles</option>'}
      ${asignaturas.map((a) => `<option value="${ui.escapar(a.id)}" ${a.id === asignaturaId ? 'selected' : ''}>${ui.escapar(a.nombre)}</option>`).join('')}</select></div>
    <div class="campo"><label for="foro-tema">Tema (opcional)</label><select id="foro-tema"><option value="">Todos los temas</option>
      ${temas.filter((t) => t.asignaturaId === asignaturaId).map((t) => `<option value="${ui.escapar(t.id)}" ${t.id === temaId ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`).join('')}</select></div></div>
    <div><button type="button" class="btn btn--primario" id="foro-nuevo" ${!asignaturaId ? 'disabled' : ''}>Nuevo hilo</button></div>
    <p id="foro-error" class="campo__error" role="alert"></p><section class="foros__lista" aria-label="Hilos de discusión">
      ${hilos.length ? hilos.map((h) => `<article class="tarjeta publicacion-foro"><h2><a href="/paginas/hilo.html?id=${encodeURIComponent(h.id)}">${ui.escapar(h.titulo)}</a></h2>
        <p class="publicacion-foro__meta">${ui.escapar(h.autorNombre)}${h.fijado ? ' · Fijado' : ''}${h.cerrado ? ' · Cerrado' : ''}${h.oculto ? ' · Oculto' : ''}</p>
        <p>${h.numeroRespuestas} respuestas · Último movimiento: ${ui.escapar(util.fechaRelativa(h.ultimoMovimiento || h.fecha))}</p>
        ${accionesPublicacion('foros-hilos', h)}</article>`).join('') : '<div class="tarjeta vacio"><p>Todavía no hay hilos para esta selección.</p></div>'}
    </section></div>`;
  document.getElementById('foro-asignatura').addEventListener('change', (evento) => trabajar(async () => { asignaturaId = evento.target.value; temaId = ''; await cargarHilos(); }));
  document.getElementById('foro-tema').addEventListener('change', (evento) => trabajar(async () => { temaId = evento.target.value; await cargarHilos(); }));
  document.getElementById('foro-nuevo').addEventListener('click', () => trabajar(async () => {
    const nuevo = await formularioModal('Nuevo hilo', `<div class="campo"><label for="foro-titulo">Título</label><input id="foro-titulo" name="titulo" required maxlength="180"></div>
      <div class="campo"><label for="foro-texto">Texto (máximo 5.000 caracteres)</label><textarea id="foro-texto" name="texto" required maxlength="5000" rows="8"></textarea></div>
      <div class="campo"><label for="foro-tema-nuevo">Tema (opcional)</label><select id="foro-tema-nuevo" name="temaId"><option value="">Conversación general</option>
      ${temas.filter((t) => t.asignaturaId === asignaturaId).map((t) => `<option value="${ui.escapar(t.id)}" ${t.id === temaId ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`).join('')}</select></div>`,
      (datos) => api.crear('foros-hilos', { ...datos, asignaturaId }));
    if (nuevo) { temaId = ''; await cargarHilos(); ui.aviso('Hilo publicado.', 'exito'); }
  }));
  vincularAcciones(contenido, hilos.map((h) => ({ ...h, coleccion: 'foros-hilos' })), () => trabajar(cargarHilos));
}

async function trabajar(accion) {
  if (ocupado) return;
  const anterior = { asignaturaId, temaId, hilos };
  ocupado = true;
  contenido.querySelectorAll('button, select').forEach((el) => { el.disabled = true; });
  try { await accion(); renderizar(); }
  catch (error) {
    ({ asignaturaId, temaId, hilos } = anterior);
    renderizar();
    ui.aviso(error.message, 'error'); document.getElementById('foro-error').textContent = error.message;
  }
  finally { ocupado = false; contenido.querySelectorAll('button, select').forEach((el) => { el.disabled = false; }); if (!asignaturaId) document.getElementById('foro-nuevo').disabled = true; }
}

async function iniciar() {
  ui.cargando(true);
  try {
    const [a, u, t] = await Promise.all([api.listar('asignaturas'), api.listar('unidades'), api.listar('temas')]);
    asignaturas = a;
    const unidades = new Map(u.filter((item) => item.visible !== false || usuarioActual()?.rol !== 'estudiante').map((item) => [item.id, item.asignaturaId]));
    temas = t.filter((item) => unidades.has(item.unidadId)).map((item) => ({ ...item, asignaturaId: unidades.get(item.unidadId) }));
    asignaturaId = asignaturas.find((item) => item.id === util.parametro('asignaturaId'))?.id || asignaturas[0]?.id || '';
    temaId = temas.find((item) => item.id === util.parametro('temaId') && item.asignaturaId === asignaturaId)?.id || '';
    await cargarHilos(); renderizar();
  } catch (error) {
    contenido.innerHTML = `<div class="tarjeta pila"><h1>Foros</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" class="btn btn--secundario" id="foro-recargar">Reintentar carga</button></div>`;
    document.getElementById('foro-recargar').addEventListener('click', iniciar);
  } finally { ui.cargando(false); }
}
if (usuarioActual()) await iniciar();
