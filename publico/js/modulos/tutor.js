import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Tutor IA', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');
let tema = null, historial = [], ocupado = false, conversacion = 0;
const nodo = (id) => document.getElementById(id);

function actualizarControles() {
  nodo('tutor-pregunta').disabled = ocupado;
  nodo('tutor-enviar').disabled = ocupado || !nodo('tutor-pregunta').value.trim() || nodo('tutor-pregunta').value.length > 1000;
  nodo('tutor-contador').textContent = `${nodo('tutor-pregunta').value.length} / 1.000`;
  nodo('tutor-pensando').hidden = !ocupado;
  nodo('tutor-historial').setAttribute('aria-busy', String(ocupado));
  contenido.querySelectorAll('[data-pregunta-guia]').forEach((boton) => { boton.disabled = ocupado; });
}

function mostrarHistorial(pendiente = '') {
  const mensajes = pendiente ? [...historial, { rol: 'estudiante', texto: pendiente, pendiente: true }] : historial;
  nodo('tutor-historial').innerHTML = mensajes.length ? mensajes.map((m) => `<article class="tutor-tema__burbuja ${m.rol === 'estudiante' ? 'tutor-tema__burbuja--estudiante' : ''}">
    <strong>${m.rol === 'estudiante' ? 'Tú' : 'Tutor'}${m.pendiente ? ' · Enviando' : ''}</strong>
    <div class="tutor-tema__texto">${m.rol === 'tutor' ? util.formatoBasico(m.texto) : `<p>${ui.escapar(m.texto).replace(/\n/g, '<br>')}</p>`}</div></article>`).join('')
    : '<p class="tutor-tema__bienvenida">Piensa en lo que ya sabes del tema. Elige una pregunta guía o cuéntame qué necesitas comprender.</p>';
  nodo('tutor-historial').scrollTop = nodo('tutor-historial').scrollHeight;
}

async function enviar(evento) {
  evento.preventDefault();
  const pregunta = nodo('tutor-pregunta').value.trim();
  if (ocupado || !pregunta || pregunta.length > 1000 || !tema) return;
  const version = conversacion;
  const mensajes = [...historial, { rol: 'estudiante', texto: pregunta }].slice(-10).map(({ rol, texto }) => ({ rol, texto }));
  ocupado = true;
  cambiarEstado('pensando');
  nodo('tutor-error').textContent = ''; nodo('tutor-estado').textContent = '';
  mostrarHistorial(pregunta); actualizarControles();
  try {
    const resultado = await api.ia('tutor', { temaId: tema.id, historial: mensajes });
    if (version !== conversacion) return;
    if (typeof resultado?.respuesta !== 'string' || !resultado.respuesta.trim()) throw new Error('No se recibió una respuesta del tutor. Puedes intentarlo nuevamente.');
    historial.push({ rol: 'estudiante', texto: pregunta }, { rol: 'tutor', texto: resultado.respuesta });
    decir(resultado.respuesta);
    nodo('tutor-pregunta').value = '';
    nodo('tutor-estado').textContent = 'El tutor respondió. Revisa su pregunta y cuéntale tu razonamiento.';
  } catch (error) {
    if (version !== conversacion) return;
    cambiarEstado('reposo');
    nodo('tutor-error').textContent = error.estado === 429
      ? 'Por hoy alcanzaste tu límite diario del tutor. Puedes continuar mañana; mientras tanto, repasa el tema y sus preguntas guía.'
      : error.message || 'No se pudo consultar al tutor. Tu pregunta sigue disponible para reintentar.';
  } finally {
    if (version === conversacion) {
      ocupado = false; mostrarHistorial(); actualizarControles(); nodo('tutor-pregunta').focus();
    }
  }
}

function nuevaConversacion() {
  conversacion++; historial = []; ocupado = false;
  cambiarEstado('reposo');
  nodo('tutor-pregunta').value = ''; nodo('tutor-error').textContent = '';
  nodo('tutor-estado').textContent = 'Nueva conversación. Puedes comenzar con una pregunta guía.';
  mostrarHistorial(); actualizarControles(); nodo('tutor-pregunta').focus();
}

function renderizar() {
  const preguntas = (Array.isArray(tema.preguntasGuia) ? tema.preguntasGuia : []).filter((p) => typeof p === 'string' && p.trim()).slice(0, 3);
  contenido.innerHTML = `<div class="tutor-tema"><header><span class="insignia insignia--acento">Tutor socrático</span><h1>Tutor IA</h1>
    <p>Tema: <strong>${ui.escapar(tema.titulo)}</strong></p><p>Construye tus respuestas con preguntas, pistas y razonamiento.</p>
    <div class="tutor-tema__acciones"><a class="btn btn--secundario" href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}">Repasar el tema</a>
    <a class="btn btn--texto" href="/paginas/tutor.html">Elegir otro tema</a><button type="button" class="btn btn--secundario" id="tutor-nueva">Nueva conversación</button></div></header>
    <section aria-labelledby="tutor-preguntas-titulo"><h2 id="tutor-preguntas-titulo">Preguntas guía para empezar</h2>
      <div class="tutor-tema__preguntas">${preguntas.map((p, i) => `<button type="button" class="btn btn--secundario" data-pregunta-guia="${i}">${ui.escapar(p)}</button>`).join('') || '<p>Este tema aún no tiene preguntas guía. Puedes escribir tu propia consulta.</p>'}</div></section>
    <section class="tarjeta tutor-tema__chat" aria-label="Chat con el tutor">
      <p class="texto-secundario">La conversación solo se conserva en esta página y se borra al recargar o iniciar una nueva. No compartas datos personales.</p>
      <div id="tutor-historial" class="tutor-tema__historial" role="log" aria-label="Conversación" aria-live="off" tabindex="0"></div>
      <p id="tutor-pensando" class="tutor-tema__pensando" role="status" hidden>El tutor está pensando...</p>
      <p id="tutor-estado" role="status"></p><p id="tutor-error" class="campo__error" role="alert"></p>
      <form id="tutor-formulario" class="pila"><div class="campo"><label for="tutor-pregunta">Tu pregunta o razonamiento</label>
        <textarea id="tutor-pregunta" rows="3" maxlength="1000" required aria-describedby="tutor-ayuda tutor-contador"></textarea>
        <span id="tutor-ayuda" class="texto-secundario">Enter envía · Mayús + Enter añade una línea</span></div>
        <div class="tutor-tema__acciones"><span id="tutor-contador">0 / 1.000</span><button type="submit" id="tutor-enviar" class="btn btn--primario">Enviar</button></div></form>
    </section></div>`;
  contenido.querySelectorAll('[data-pregunta-guia]').forEach((boton) => boton.addEventListener('click', () => {
    if (ocupado) return;
    nodo('tutor-pregunta').value = preguntas[Number(boton.dataset.preguntaGuia)].slice(0, 1000);
    nodo('tutor-error').textContent = ''; actualizarControles(); nodo('tutor-pregunta').focus();
  }));
  nodo('tutor-formulario').addEventListener('submit', enviar);
  nodo('tutor-pregunta').addEventListener('input', actualizarControles);
  nodo('tutor-pregunta').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); nodo('tutor-formulario').requestSubmit(); }
  });
  nodo('tutor-nueva').addEventListener('click', nuevaConversacion);
  mostrarHistorial(); actualizarControles();
}

async function iniciar() {
  contenido.innerHTML = '<div class="tarjeta"><p role="status">Selecciona el tema que quieres estudiar con el tutor.</p></div>';
  try {
    const seleccionado = await obtenerTemaActividad();
    if (!seleccionado) {
      contenido.innerHTML = '<div class="tarjeta pila"><h1>Tutor IA</h1><p>Elige un tema para comenzar a conversar.</p><button type="button" id="tutor-elegir" class="btn btn--primario">Elegir tema</button></div>';
      nodo('tutor-elegir').addEventListener('click', iniciar); return;
    }
    tema = seleccionado; renderizar();
  } catch (error) {
    contenido.innerHTML = `<div class="tarjeta pila"><h1>Tutor IA</h1><p role="alert">${ui.escapar(error.message || 'No se pudo cargar el tema.')}</p><button type="button" id="tutor-recargar" class="btn btn--secundario">Reintentar</button></div>`;
    nodo('tutor-recargar').addEventListener('click', iniciar);
  }
}

if (usuarioActual()?.rol === 'estudiante') await iniciar();
