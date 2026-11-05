import * as api from './api.js';
import * as ui from './ui.js';
import { cambiarEstado, decir } from './avatar.js';

export function montarTutor({ contenedor, asignaturaId, nombre }) {
  if (!contenedor) return;
  let estado = { mensajes: [], temas: [] };
  let cargado = false;
  let ocupado = false;
  let pendiente = null;
  contenedor.innerHTML = `<section class="tutor" aria-labelledby="tutor-titulo">
    <header class="tutor__cabecera">
      <span class="tutor__avatar" aria-hidden="true">✦</span>
      <div class="tutor__presentacion"><span class="insignia insignia--acento">Tutor socrático</span>
        <h2 id="tutor-titulo">Aprende razonando, paso a paso</h2>
        <p>Conversemos sobre ${ui.escapar(nombre)} con preguntas, pistas y ejemplos de tus temas.</p></div>
      <button type="button" class="btn btn--primario" id="tutor-abrir" aria-expanded="true" aria-controls="tutor-panel">Minimizar conversación</button>
    </header>
    <div id="tutor-panel" class="tutor__panel">
      <div class="tutor__herramientas"><div class="campo tutor__selector"><label for="tutor-tema">¿En qué tema quieres concentrarte?</label>
        <select id="tutor-tema" disabled><option value="">Toda la asignatura</option></select></div>
        <button type="button" class="btn btn--texto" id="tutor-reiniciar" disabled>Nueva conversación</button></div>
      <p class="tutor__alcance">Trabajaremos solo con los contenidos publicados de esta asignatura. El tutor te ayuda a construir tu respuesta.</p>
      <div id="tutor-mensajes" class="tutor__mensajes" role="log" aria-label="Conversación con el tutor" aria-live="polite" aria-relevant="additions text" tabindex="0"></div>
      <div class="tutor__sugerencias" aria-label="Ideas para comenzar">
        <button type="button" class="btn btn--secundario btn--pequeno" data-sugerencia="No sé por dónde empezar">No sé por dónde empezar</button>
        <button type="button" class="btn btn--secundario btn--pequeno" data-sugerencia="Dame una pista">Dame una pista</button>
        <button type="button" class="btn btn--secundario btn--pequeno" data-sugerencia="¿Puedo explicarlo con mis palabras?">Quiero explicar mi idea</button>
      </div>
      <form id="tutor-formulario" class="tutor__formulario">
        <div class="campo"><label for="tutor-texto">Tu pregunta o razonamiento</label>
          <textarea id="tutor-texto" name="mensaje" rows="3" maxlength="1500" required disabled placeholder="Cuéntame qué has entendido y qué te genera dudas…" aria-describedby="tutor-ayuda"></textarea>
          <span id="tutor-ayuda">Enter para enviar · Mayús + Enter para una nueva línea · Hasta 1500 caracteres</span></div>
        <div class="tutor__acciones"><p id="tutor-estado" role="status" aria-live="polite"></p><button type="submit" class="btn btn--primario" id="tutor-enviar" disabled>Enviar mensaje</button></div>
      </form>
      <p id="tutor-error" class="campo__error" role="alert"></p>
      <button type="button" class="btn btn--secundario" id="tutor-reintentar" hidden>Reintentar conexión del tutor</button>
    </div></section>`;
  const buscar = (selector) => contenedor.querySelector(selector);
  const panel = buscar('#tutor-panel');
  const abrir = buscar('#tutor-abrir');
  const registro = buscar('#tutor-mensajes');
  const formulario = buscar('#tutor-formulario');
  const texto = buscar('#tutor-texto');
  const selector = buscar('#tutor-tema');
  const mensajeEstado = buscar('#tutor-estado');
  const error = buscar('#tutor-error');

  function controles() {
    const habilitado = cargado && estado.temas.length > 0 && !ocupado;
    selector.disabled = !habilitado;
    texto.disabled = !habilitado;
    buscar('#tutor-enviar').disabled = !habilitado;
    buscar('#tutor-reiniciar').disabled = !cargado || ocupado;
    buscar('#tutor-reintentar').hidden = cargado || ocupado;
    contenedor.querySelectorAll('[data-sugerencia]').forEach((boton) => { boton.disabled = !habilitado; });
    registro.setAttribute('aria-busy', String(ocupado));
  }

  function mostrarMensajes(enviado = '') {
    registro.innerHTML = estado.mensajes.length ? estado.mensajes.map((mensaje) => `<article class="tutor__mensaje ${mensaje.rol === 'estudiante' ? 'tutor__mensaje--estudiante' : 'tutor__mensaje--guia'}">
      <strong class="tutor__autor">${mensaje.rol === 'estudiante' ? 'Tú' : 'Tutor'}</strong><p>${ui.escapar(mensaje.texto)}</p>
      ${mensaje.fuentes?.length ? `<details class="tutor__fuentes"><summary>Temas que estamos utilizando</summary>${mensaje.fuentes.map((fuente) => `<a href="${ui.escapar(fuente.enlace)}">${ui.escapar(fuente.titulo)}</a><blockquote>${ui.escapar(fuente.extracto)}</blockquote>`).join('')}</details>` : ''}
    </article>`).join('') : `<article class="tutor__mensaje tutor__mensaje--guia"><strong class="tutor__autor">Tutor</strong><p>${estado.temas.length ? '¡Hola! Pensemos juntos. Elige un tema o cuéntame qué idea estás intentando comprender. ¿Qué sabes hasta ahora sobre ella?' : 'Aún no hay temas publicados para esta asignatura. El tutor estará listo cuando tu docente publique los contenidos.'}</p></article>`;
    if (enviado) registro.innerHTML += `<article class="tutor__mensaje tutor__mensaje--estudiante"><strong class="tutor__autor">Tú · enviando</strong><p>${ui.escapar(enviado)}</p></article>`;
    registro.scrollTop = registro.scrollHeight;
  }

  function aplicar(datos) {
    const eleccion = selector.value;
    estado = datos;
    selector.innerHTML = '<option value="">Toda la asignatura</option>' + estado.temas.map((tema) => `<option value="${ui.escapar(tema.id)}">${ui.escapar(tema.unidad)} · ${ui.escapar(tema.titulo)}</option>`).join('');
    selector.value = estado.temas.some((tema) => tema.id === eleccion) ? eleccion : '';
    mostrarMensajes();
  }

  async function cargar(enfocar = false) {
    if (ocupado) return;
    ocupado = true;
    controles();
    error.textContent = '';
    mensajeEstado.textContent = 'Preparando tu espacio de aprendizaje…';
    try {
      aplicar(await api.llamar('GET', `/api/tutor/${encodeURIComponent(asignaturaId)}`));
      cargado = true;
      mensajeEstado.textContent = 'Puedes contarme tu idea. Iremos paso a paso.';
    } catch (causa) {
      error.textContent = causa.message || 'No se pudo abrir el tutor. Puedes reintentar la conexión.';
      mensajeEstado.textContent = '';
    } finally { ocupado = false; controles(); if (cargado && enfocar) texto.focus(); }
  }

  abrir.addEventListener('click', async () => {
    panel.hidden = !panel.hidden;
    abrir.setAttribute('aria-expanded', String(!panel.hidden));
    abrir.textContent = panel.hidden ? 'Conversar con el tutor' : 'Minimizar conversación';
    if (!panel.hidden) {
      if (!cargado) await cargar(true);
      else texto.focus();
    }
  });
  buscar('#tutor-reintentar').addEventListener('click', () => cargar(true));

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (ocupado || !cargado || !estado.temas.length || !formulario.reportValidity()) return;
    const mensaje = texto.value.trim();
    if (!mensaje) return;
    if (!pendiente || pendiente.mensaje !== mensaje || pendiente.temaId !== selector.value) {
      const mensajeId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (numero) => numero.toString(16).padStart(2, '0')).join('');
      pendiente = { asignaturaId, temaId: selector.value, mensaje, mensajeId };
    }
    ocupado = true;
    controles();
    mostrarMensajes(mensaje);
    mensajeEstado.textContent = 'El tutor está preparando una pista y una pregunta para ti…';
    cambiarEstado('pensando');
    error.textContent = '';
    try {
      aplicar(await api.ia('tutor', pendiente));
      decir(estado.mensajes.at(-1)?.texto || '');
      texto.value = '';
      pendiente = null;
      mensajeEstado.textContent = 'Tu turno: reflexiona y comparte tu razonamiento.';
    } catch (causa) {
      mostrarMensajes();
      cambiarEstado('reposo');
      error.textContent = causa.message || 'No se pudo enviar el mensaje. Puedes intentarlo otra vez.';
      mensajeEstado.textContent = 'Tu mensaje sigue en el campo para reintentarlo.';
    } finally { ocupado = false; controles(); texto.focus(); }
  });
  texto.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) { evento.preventDefault(); formulario.requestSubmit(); }
  });
  contenedor.querySelectorAll('[data-sugerencia]').forEach((boton) => boton.addEventListener('click', () => { texto.value = boton.dataset.sugerencia; texto.focus(); }));
  buscar('#tutor-reiniciar').addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    controles();
    try {
      const confirmado = await ui.confirmar('¿Quieres comenzar una nueva conversación para esta asignatura?');
      if (!confirmado) return;
      cambiarEstado('reposo');
      aplicar(await api.llamar('DELETE', `/api/tutor/${encodeURIComponent(asignaturaId)}`));
      pendiente = null;
      texto.value = '';
      error.textContent = '';
      mensajeEstado.textContent = 'Comenzamos de nuevo. ¿Qué idea te gustaría explorar?';
    } catch (causa) { error.textContent = causa.message || 'No se pudo reiniciar la conversación.'; }
    finally { ocupado = false; controles(); texto.focus(); }
  });
  controles();
  return { listo: cargar() };
}
