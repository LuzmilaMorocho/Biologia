import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros, logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');
let tema = null;
let niveles = [];
let sesion = null;
let nivelActual = 1;
let indice = 0;
let retro = null;
let resultado = null;
let ocupado = false;
let respuestaVF = null;

const porcentaje = (valor) => Number(valor || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 }) + ' %';
const enlaceTema = () => `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;

function cabecera() {
  return `<header><h1>Quiz por niveles</h1><p>Tema: <strong>${ui.escapar(tema.titulo)}</strong></p>
    <div class="quiz__acciones"><a href="${enlaceTema()}" class="btn btn--secundario">Repasar el tema</a>
    <a href="/paginas/quiz.html" class="btn btn--texto">Elegir otro tema</a></div></header>`;
}

function informarError(error) {
  const destino = document.getElementById('quiz-error');
  if (destino) destino.textContent = error.message || 'No se pudo completar la operación. Inténtalo nuevamente.';
  else ui.aviso(error.message || 'No se pudo completar la operación.', 'error');
}

function actualizarControles() {
  contenido.querySelectorAll('[data-ocupacion]').forEach((boton) => {
    boton.disabled = ocupado || boton.dataset.bloqueado === 'true';
  });
  const campo = document.getElementById('quiz-respuestas');
  if (campo) campo.disabled = ocupado || Boolean(retro);
  const responder = document.getElementById('quiz-responder');
  if (responder) responder.disabled = ocupado || Boolean(retro);
}

function enfocar(id) {
  document.getElementById(id)?.focus();
}

async function cargarNiveles() {
  const datos = await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(tema.id)}`);
  niveles = datos.niveles;
}

function renderizarNiveles() {
  contenido.innerHTML = `<div class="quiz">${cabecera()}
    <p>Supera los cinco niveles cognitivos. Aprobar un nivel desbloquea el siguiente y permite descargar su diploma.</p>
    <p id="quiz-error" class="campo__error" role="alert"></p>
    <div class="quiz__niveles">${niveles.map((item) => `<article class="tarjeta quiz__nivel">
      <h2>Nivel ${item.nivel}: ${ui.escapar(item.nombre)}</h2>
      <p><strong>Estado:</strong> ${ui.escapar({ bloqueado: 'Bloqueado', disponible: 'Disponible', aprobado: 'Aprobado' }[item.estado])}</p>
      <p>Mejor porcentaje: <strong>${porcentaje(item.mejorPorcentaje)}</strong></p>
      ${item.estado === 'bloqueado' ? '<p>Aprueba el nivel anterior para desbloquearlo.</p>' : ''}
      <button type="button" class="btn btn--primario" data-iniciar="${item.nivel}" data-ocupacion data-bloqueado="${item.estado === 'bloqueado'}" ${item.estado === 'bloqueado' ? 'disabled' : ''}>${item.estado === 'bloqueado' ? 'Nivel bloqueado' : item.estado === 'aprobado' ? 'Volver a practicar' : 'Iniciar nivel'}</button>
      ${item.estado === 'aprobado' ? `<button type="button" class="btn btn--secundario" data-diploma="${item.nivel}" data-ocupacion>Descargar diploma del nivel ${item.nivel}</button>` : ''}
    </article>`).join('')}</div></div>`;
  contenido.querySelectorAll('[data-iniciar]').forEach((boton) => boton.addEventListener('click', () => iniciarNivel(Number(boton.dataset.iniciar))));
  vincularDiplomas();
  actualizarControles();
}

async function iniciarNivel(nivel) {
  if (ocupado) return;
  ocupado = true;
  actualizarControles();
  document.getElementById('quiz-error').textContent = '';
  ui.cargando(true);
  try {
    const nuevaSesion = await api.llamar('POST', '/api/quiz/iniciar', { temaId: tema.id, nivel });
    if (!nuevaSesion.preguntas?.length) throw new Error('El nivel no devolvió preguntas para responder.');
    sesion = nuevaSesion;
    nivelActual = nivel;
    indice = 0;
    retro = null;
    resultado = null;
    renderizarPregunta();
    enfocar('quiz-enunciado');
  } catch (error) {
    informarError(error);
  } finally {
    ocupado = false;
    actualizarControles();
    ui.cargando(false);
  }
}

function renderizarPregunta() {
  const pregunta = sesion.preguntas[indice];
  respuestaVF = null;
  let opciones;
  if (pregunta.tipo === 'opcion') {
    opciones = pregunta.opciones.map((opcion, posicion) => `<label class="opcion-grande"><input type="radio" name="respuesta" value="${posicion}" required><span>${ui.escapar(opcion)}</span></label>`).join('');
  } else if (pregunta.tipo === 'vf') {
    opciones = `<div class="quiz__acciones" role="group" aria-label="Selecciona verdadero o falso">
      <button type="button" class="btn btn--secundario" data-vf="true" aria-pressed="false">Verdadero</button>
      <button type="button" class="btn btn--secundario" data-vf="false" aria-pressed="false">Falso</button></div>`;
  } else {
    opciones = '<div class="campo"><label for="quiz-completar">Palabra o frase que completa el enunciado</label><input id="quiz-completar" name="respuesta" type="text" maxlength="1000" required autocomplete="off"></div>';
  }
  contenido.innerHTML = `<div class="quiz">${cabecera()}
    <section class="tarjeta pila quiz__pregunta" aria-labelledby="quiz-enunciado">
      <p>Nivel ${nivelActual}: ${ui.escapar(niveles.find((item) => item.nivel === nivelActual)?.nombre || '')}</p>
      <label for="quiz-progreso" id="quiz-avance" aria-live="polite">${indice} de ${sesion.preguntas.length} preguntas respondidas</label>
      <progress id="quiz-progreso" class="barra-progreso" value="${indice}" max="${sesion.preguntas.length}"></progress>
      <h2 id="quiz-enunciado" tabindex="-1">Pregunta ${indice + 1}: ${ui.escapar(pregunta.enunciado)}</h2>
      <form id="quiz-formulario" class="pila">
        <fieldset id="quiz-respuestas" class="grupo-opciones"><legend>Elige o escribe tu respuesta</legend>${opciones}</fieldset>
        <p id="quiz-error" class="campo__error" role="alert"></p>
        <button type="submit" class="btn btn--primario" id="quiz-responder">Responder</button>
      </form>
      <div id="retroalimentacion"></div>
      <button type="button" class="btn btn--primario" id="quiz-siguiente" data-ocupacion hidden>${indice + 1 === sesion.preguntas.length ? 'Ver resultado' : 'Siguiente'}</button>
    </section></div>`;
  contenido.querySelectorAll('[data-vf]').forEach((boton) => boton.addEventListener('click', () => {
    if (ocupado || retro) return;
    respuestaVF = boton.dataset.vf === 'true';
    contenido.querySelectorAll('[data-vf]').forEach((opcion) => opcion.setAttribute('aria-pressed', String(opcion === boton)));
    document.getElementById('quiz-error').textContent = '';
  }));
  document.getElementById('quiz-formulario').addEventListener('submit', responderPregunta);
  document.getElementById('quiz-siguiente').addEventListener('click', async () => {
    if (ocupado || !retro) return;
    if (indice + 1 === sesion.preguntas.length) { await finalizar(); return; }
    indice++;
    retro = null;
    renderizarPregunta();
    enfocar('quiz-enunciado');
  });
  actualizarControles();
}

async function responderPregunta(evento) {
  evento.preventDefault();
  if (ocupado || retro) return;
  const form = document.getElementById('quiz-formulario');
  const pregunta = sesion.preguntas[indice];
  if (!form.reportValidity()) return;
  let respuesta;
  if (pregunta.tipo === 'opcion') respuesta = Number(form.querySelector('[name="respuesta"]:checked').value);
  else if (pregunta.tipo === 'vf') {
    if (respuestaVF === null) { informarError(new Error('Selecciona Verdadero o Falso antes de responder.')); return; }
    respuesta = respuestaVF;
  } else {
    respuesta = form.elements.respuesta.value.trim();
    if (!respuesta) { informarError(new Error('Escribe tu respuesta.')); return; }
  }
  ocupado = true;
  actualizarControles();
  document.getElementById('quiz-error').textContent = '';
  ui.cargando(true);
  try {
    retro = await api.llamar('POST', '/api/quiz/responder', { sesionId: sesion.sesionId, preguntaId: pregunta.id, respuesta });
    mostrarRetro({ correcto: retro.correcto, explicacion: retro.retroalimentacion,
      sugerencia: retro.correcto ? '' : `Respuesta correcta: ${retro.correcta}`, enlaceTema: enlaceTema() });
    document.getElementById('quiz-progreso').value = indice + 1;
    document.getElementById('quiz-avance').textContent = `${indice + 1} de ${sesion.preguntas.length} preguntas respondidas`;
    document.getElementById('quiz-siguiente').hidden = false;
    document.getElementById('quiz-responder').hidden = true;
  } catch (error) {
    informarError(error);
  } finally {
    ocupado = false;
    actualizarControles();
    ui.cargando(false);
    if (retro) enfocar('quiz-siguiente');
  }
}

function renderizarResultado() {
  contenido.innerHTML = `<div class="quiz">${cabecera()}
    <section class="tarjeta pila" aria-labelledby="quiz-resultado">
      <h2 id="quiz-resultado" tabindex="-1">Nivel ${nivelActual}: ${resultado.aprobado ? 'Aprobado' : 'Sigue practicando'}</h2>
      <p class="quiz__porcentaje">${porcentaje(resultado.porcentaje)}</p>
      <p>${resultado.aciertos} aciertos de ${resultado.total} preguntas.</p>
      <h3>Ideas para repasar</h3>
      ${resultado.repasar.length ? `<ul class="quiz__repaso">${resultado.repasar.map((idea) => `<li>${ui.escapar(idea)}</li>`).join('')}</ul>` : '<p>¡Respondiste correctamente todas las preguntas!</p>'}
      <p id="quiz-error" class="campo__error" role="alert"></p>
      <div class="quiz__acciones">
        ${resultado.aprobado ? `<button type="button" class="btn btn--primario" data-diploma="${nivelActual}" data-ocupacion>Descargar diploma</button>` : '<button type="button" class="btn btn--primario" id="quiz-reintentar" data-ocupacion>Reintentar</button>'}
        <button type="button" class="btn btn--secundario" id="quiz-niveles" data-ocupacion>Ver niveles</button>
      </div>
    </section></div>`;
  vincularDiplomas();
  document.getElementById('quiz-reintentar')?.addEventListener('click', () => iniciarNivel(nivelActual));
  document.getElementById('quiz-niveles').addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    actualizarControles();
    ui.cargando(true);
    try { await cargarNiveles(); sesion = null; resultado = null; renderizarNiveles(); }
    catch (error) { informarError(error); }
    finally { ocupado = false; actualizarControles(); ui.cargando(false); }
  });
  actualizarControles();
}

async function finalizar() {
  if (ocupado || resultado) return;
  ocupado = true;
  actualizarControles();
  let accion = 'salir';
  ui.cargando(true);
  try {
    resultado = await api.llamar('POST', '/api/quiz/finalizar', { sesionId: sesion.sesionId });
    renderizarResultado();
    ui.cargando(false);
    accion = await mostrarResumen({
      titulo: `${resultado.aprobado ? 'Nivel aprobado' : 'Sigue practicando'} · ${porcentaje(resultado.porcentaje)}`,
      aciertos: resultado.aciertos, errores: resultado.total - resultado.aciertos,
      recomendaciones: resultado.repasar.length ? `Repasa estas ideas: ${resultado.repasar.join(' · ')}` : '¡Excelente! Completaste este nivel sin errores.',
      enlaceTema: enlaceTema()
    });
    if (resultado.aprobado) {
      try {
        const logros = await logrosDe();
        if (Number.isFinite(logros.puntos)) resultado.puntosTotales = logros.puntos;
      } catch {
        // La aprobación y el diploma siguen disponibles si falla la consulta de puntos.
      }
      await mostrarLogros(resultado);
    }
    enfocar('quiz-resultado');
  } catch (error) {
    informarError(error);
  } finally {
    ocupado = false;
    actualizarControles();
    ui.cargando(false);
  }
  if (resultado && accion === 'repetir') await iniciarNivel(nivelActual);
}

function vincularDiplomas() {
  contenido.querySelectorAll('[data-diploma]').forEach((boton) => boton.addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    actualizarControles();
    document.getElementById('quiz-error').textContent = '';
    ui.cargando(true);
    try { await generarDiploma({ tipo: 'nivel-quiz', temaId: tema.id, nivel: Number(boton.dataset.diploma) }); }
    catch (error) { informarError(error); }
    finally { ocupado = false; actualizarControles(); ui.cargando(false); boton.focus(); }
  }));
}

async function iniciarPagina() {
  if (ocupado) return;
  ocupado = true;
  contenido.innerHTML = '<div class="tarjeta"><h1>Quiz por niveles</h1><p role="status">Selecciona un tema para empezar.</p></div>';
  try {
    tema = await obtenerTemaActividad();
    if (!tema) {
      contenido.innerHTML = '<div class="tarjeta pila"><h1>Quiz por niveles</h1><p>Elige un tema para consultar sus niveles.</p><button type="button" class="btn btn--primario" id="quiz-elegir">Elegir tema</button></div>';
      document.getElementById('quiz-elegir').addEventListener('click', iniciarPagina);
      return;
    }
    ui.cargando(true);
    await cargarNiveles();
    renderizarNiveles();
  } catch (error) {
    contenido.innerHTML = `<div class="tarjeta pila"><h1>Quiz por niveles</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" class="btn btn--secundario" id="quiz-recargar">Reintentar carga</button></div>`;
    document.getElementById('quiz-recargar').addEventListener('click', iniciarPagina);
  } finally {
    ocupado = false;
    actualizarControles();
    ui.cargando(false);
  }
}

window.addEventListener('beforeunload', (evento) => {
  if (sesion && !resultado) { evento.preventDefault(); evento.returnValue = ''; }
});
if (usuarioActual()?.rol === 'estudiante') await iniciarPagina();
