import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { PartidaEscenario, imagenEscenario, erroresRol, normalizarEvaluacionRol } from '../nucleo/simulaciones.js';
import { montarAvatar, cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Simulador', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const previa = util.parametro('vista') === 'previa';
let simulacion, partida, guardando = false, registrado = false, inicio;
let historialRol = [], ocupadoRol = false, evaluandoRol = false, evaluacionRol = null;
const nodo = (id) => document.getElementById(id);
const volver = () => `/paginas/simulaciones.html${simulacion?.temaId ? `?temaId=${encodeURIComponent(simulacion.temaId)}` : ''}`;
const encabezado = () => `<div class="simulador-contenido"><a href="${volver()}">← Volver a simulaciones</a><h1>${ui.escapar(simulacion.titulo)}</h1>
  ${previa ? '<p class="alerta alerta--info" role="status">Vista previa: esta práctica no registra intentos ni puntos.</p>' : ''}`;

async function guardarInforme() {
  if (previa || registrado || guardando) return;
  guardando = true;
  const boton = document.getElementById('simulador-guardar');
  const aviso = document.getElementById('simulador-registro');
  boton.disabled = true; aviso.textContent = 'Guardando tu intento…';
  try {
    const informe = simulacion.modo === 'rol' ? evaluacionRol : partida.informe();
    await registrarIntento({ actividad: 'simulacion', temaId: simulacion.temaId, puntaje: informe.puntaje, maximo: informe.maximo,
      errores: simulacion.modo === 'rol' ? (informe.puntaje === informe.maximo ? 0 : 1) : informe.recorrido.filter((p) => p.puntos <= 0).length,
      duracionSeg: Math.floor((Date.now() - inicio) / 1000),
      detalle: simulacion.modo === 'rol' ? { simulacionId: simulacion.id, modo: 'rol', evaluacionId: informe.evaluacionId } : { simulacionId: simulacion.id, recorrido: informe.recorrido } });
    registrado = true; boton.hidden = true; aviso.textContent = 'Tu intento se guardó correctamente.';
  } catch (error) {
    aviso.textContent = error.message || 'No se pudo guardar el intento. Puedes reintentar sin perder el informe.';
    boton.hidden = false; boton.disabled = false;
  } finally { guardando = false; }
}

const turnosRol = () => historialRol.filter((m) => m.rol === 'estudiante').length;

function controlesRol() {
  const entrada = nodo('rol-mensaje');
  if (!entrada) return;
  const terminada = Boolean(evaluacionRol), maximo = turnosRol() >= simulacion.maxTurnos;
  entrada.disabled = ocupadoRol || terminada || maximo;
  nodo('rol-enviar').disabled = entrada.disabled || !entrada.value.trim() || entrada.value.length > 1000;
  nodo('rol-terminar').disabled = ocupadoRol || terminada || turnosRol() === 0;
  nodo('rol-turnos').textContent = `Turnos: ${turnosRol()} / ${simulacion.maxTurnos}`;
  nodo('rol-caracteres').textContent = `${entrada.value.length} / 1.000`;
  nodo('rol-espera').hidden = !ocupadoRol;
  nodo('rol-espera').textContent = evaluandoRol ? 'Evaluando tu práctica…' : 'El personaje está pensando…';
  nodo('rol-historial').setAttribute('aria-busy', String(ocupadoRol));
}

function mostrarHistorialRol(pendiente = '') {
  const mensajes = pendiente ? [...historialRol, { rol: 'estudiante', texto: pendiente }] : historialRol;
  nodo('rol-historial').innerHTML = mensajes.length ? mensajes.map((m) => `<article class="simulador-burbuja ${m.rol === 'estudiante' ? 'simulador-burbuja--propia' : ''}"><strong>${m.rol === 'estudiante' ? 'Tú' : ui.escapar(simulacion.personaje.nombre)}</strong>${util.formatoBasico(m.texto)}</article>`).join('')
    : '<p>Presenta tu propuesta al personaje para comenzar la práctica.</p>';
  nodo('rol-historial').scrollTop = nodo('rol-historial').scrollHeight;
}

async function terminarRol() {
  if (ocupadoRol || evaluacionRol || !turnosRol()) return;
  ocupadoRol = true; evaluandoRol = true; controlesRol(); cambiarEstado('pensando'); nodo('rol-error').textContent = '';
  try {
    const resultado = await api.ia('evaluar-rol', { simulacionId: simulacion.id, historial: historialRol });
    const informe = normalizarEvaluacionRol(resultado, simulacion.rubrica);
    if (!previa && (typeof resultado.evaluacionId !== 'string' || !resultado.evaluacionId)) throw new Error('La evaluación no tiene un comprobante válido. Vuelve a terminar la práctica.');
    evaluacionRol = { ...informe, evaluacionId: resultado.evaluacionId };
    contenido.innerHTML = `${encabezado()}<section class="tarjeta"><h2 id="simulador-titulo" tabindex="-1">Informe de la práctica de rol</h2><p><strong>Puntaje: ${informe.puntaje} / ${informe.maximo}</strong></p>
      <div class="tabla"><table><caption>Evaluación por criterio</caption><thead><tr><th scope="col">Criterio</th><th scope="col">Puntos</th><th scope="col">Retroalimentación</th></tr></thead><tbody>
      ${informe.criterios.map((c) => `<tr><th scope="row">${ui.escapar(c.criterio)}</th><td>${c.puntos} / ${simulacion.rubrica.find((r) => r.criterio === c.criterio).puntos}</td><td>${util.formatoBasico(c.comentario)}</td></tr>`).join('')}</tbody></table></div>
      <h3>Comentario general</h3>${util.formatoBasico(informe.comentarioGeneral)}<div id="retroalimentacion"></div>
      ${previa ? '' : '<p id="simulador-registro" role="status" aria-live="polite"></p><button type="button" id="simulador-guardar" class="btn btn--secundario" hidden>Reintentar guardar</button>'}
      <a class="btn btn--primario" href="${volver()}">Volver a simulaciones</a></section></div>`;
    mostrarRetro({ correcto: informe.puntaje > 0, explicacion: informe.comentarioGeneral });
    cambiarEstado('hablando'); decir(informe.comentarioGeneral); nodo('simulador-titulo').focus();
    if (!previa) { nodo('simulador-guardar').addEventListener('click', guardarInforme); await guardarInforme(); }
  } catch (error) {
    nodo('rol-error').textContent = error.estado === 429 ? 'Alcanzaste el límite diario de evaluación. Conserva esta página y vuelve a intentarlo mañana.' : error.message || 'No se pudo evaluar. La conversación se conserva; pulsa Terminar para reintentar.';
    cambiarEstado('reposo');
  } finally { ocupadoRol = false; evaluandoRol = false; controlesRol(); }
}

async function enviarRol(evento) {
  evento?.preventDefault();
  const entrada = nodo('rol-mensaje'), texto = entrada.value.trim();
  if (ocupadoRol || evaluacionRol || turnosRol() >= simulacion.maxTurnos || !texto || entrada.value.length > 1000) return;
  ocupadoRol = true; controlesRol(); mostrarHistorialRol(texto); cambiarEstado('pensando'); nodo('rol-error').textContent = '';
  try {
    const mensajes = [...historialRol, { rol: 'estudiante', texto }];
    const resultado = await api.ia('rol-simulacion', { simulacionId: simulacion.id, historial: mensajes });
    if (typeof resultado?.respuesta !== 'string' || !resultado.respuesta.trim()) throw new Error('El personaje no respondió. Puedes reintentar tu mensaje.');
    const respuesta = resultado.respuesta.trim().slice(0, 1000);
    historialRol = [...mensajes, { rol: 'personaje', texto: respuesta }]; entrada.value = '';
    mostrarHistorialRol(); cambiarEstado('hablando'); decir(respuesta);
  } catch (error) {
    mostrarHistorialRol(); nodo('rol-error').textContent = error.estado === 429 ? 'Alcanzaste tu límite diario de práctica con IA. Puedes continuar mañana; tu mensaje se conserva.' : error.message || 'No se pudo enviar. Tu mensaje se conserva.';
    cambiarEstado('reposo');
  } finally { ocupadoRol = false; controlesRol(); if (!entrada.disabled) entrada.focus(); }
  if (turnosRol() >= simulacion.maxTurnos) await terminarRol();
}

function iniciarRol() {
  const errores = erroresRol(simulacion);
  if (errores.length) throw new Error(errores[0].mensaje);
  historialRol = []; evaluacionRol = null; inicio = Date.now(); montarAvatar();
  const p = simulacion.personaje;
  contenido.innerHTML = `${encabezado()}<section class="tarjeta"><h2>Practica con ${ui.escapar(p.nombre)}</h2>${util.formatoBasico(p.descripcion)}<h3>Situación</h3>${util.formatoBasico(p.contexto)}<h3>Tu objetivo</h3>${util.formatoBasico(p.objetivo)}
    <p>Se evaluará lo que envíes según esta rúbrica:</p><ul>${simulacion.rubrica.map((c) => `<li><strong>${ui.escapar(c.criterio)}</strong> (${c.puntos} puntos): ${ui.escapar(c.descripcion)}</li>`).join('')}</ul>
    <p id="rol-turnos" role="status"></p><div id="rol-historial" class="simulador-chat" role="log" aria-label="Conversación con el personaje" aria-live="polite"></div><p id="rol-espera" role="status" hidden></p>
    <form id="rol-formulario"><div class="campo"><label for="rol-mensaje">Tu intervención</label><textarea id="rol-mensaje" rows="3" maxlength="1000" required aria-describedby="rol-caracteres"></textarea><span id="rol-caracteres"></span></div>
    <div class="simulaciones-acciones"><button type="submit" id="rol-enviar" class="btn btn--primario">Enviar</button><button type="button" id="rol-terminar" class="btn btn--secundario">Terminar</button></div></form><p id="rol-error" role="alert"></p></section></div>`;
  nodo('rol-formulario').addEventListener('submit', enviarRol);
  nodo('rol-mensaje').addEventListener('input', controlesRol);
  nodo('rol-mensaje').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviarRol(); } });
  nodo('rol-terminar').addEventListener('click', terminarRol); mostrarHistorialRol(); controlesRol();
  decir('Practica tu objetivo dialogando con el personaje. Al terminar recibirás un informe por criterio.');
}

async function dibujar() {
  const escena = partida.escena;
  const imagen = imagenEscenario(escena.imagen);
  const textoEscena = util.formatoBasico(escena.texto);
  if (partida.finalizada) {
    const informe = partida.informe();
    contenido.innerHTML = `${encabezado()}<section class="tarjeta"><h2 id="simulador-titulo" tabindex="-1">Informe de la simulación</h2>${textoEscena}
      ${imagen ? `<img class="simulador-imagen" src="${ui.escapar(imagen)}" alt="Ilustración de la escena final" referrerpolicy="no-referrer">` : ''}
      <p><strong>Puntaje: ${informe.puntaje} / ${informe.maximo}</strong></p><p>Balance de tus decisiones: ${informe.puntos} puntos. Mejor camino posible: ${informe.maximo} puntos.</p>
      <ol class="simulador-informe">${informe.recorrido.map((p) => `<li><strong>${ui.escapar(p.decision)}</strong>${util.formatoBasico(p.consecuencia)}<p>Puntos: ${p.puntos}</p></li>`).join('')}</ol>
      ${previa ? '' : '<p id="simulador-registro" role="status" aria-live="polite"></p><button type="button" id="simulador-guardar" class="btn btn--secundario" hidden>Reintentar guardar</button>'}
      <a class="btn btn--primario" href="${volver()}">Elegir otra simulación</a></section></div>`;
    document.getElementById('simulador-titulo').focus();
    if (!previa) { document.getElementById('simulador-guardar').addEventListener('click', guardarInforme); await guardarInforme(); }
    return;
  }
  contenido.innerHTML = `${encabezado()}<section class="tarjeta"><h2 id="simulador-titulo" tabindex="-1">Decisión ${partida.recorrido.length + 1}</h2>
    ${textoEscena}${imagen ? `<img class="simulador-imagen" src="${ui.escapar(imagen)}" alt="Ilustración de la situación" referrerpolicy="no-referrer">` : ''}
    <p>Elige qué harías en esta situación.</p><div class="simulador-opciones">${escena.opciones.map((o, i) => `<button type="button" class="btn btn--secundario simulador-opcion" data-opcion="${i}">${ui.escapar(o.texto)}</button>`).join('')}</div>
    <div id="retroalimentacion"></div><button type="button" id="simulador-continuar" class="btn btn--primario" hidden>Continuar</button></section></div>`;
  const botones = contenido.querySelectorAll('[data-opcion]');
  const continuar = document.getElementById('simulador-continuar');
  botones.forEach((boton) => boton.addEventListener('click', () => {
    if (partida.pendiente) return;
    const decision = partida.elegir(Number(boton.dataset.opcion));
    botones.forEach((b) => { b.disabled = true; });
    mostrarRetro({ correcto: decision.puntos > 0, explicacion: decision.consecuencia });
    continuar.hidden = false; continuar.focus();
  }));
  continuar.addEventListener('click', async () => {
    if (!partida.pendiente) return;
    continuar.disabled = true; partida.continuar(); await dibujar();
  });
  document.getElementById('simulador-titulo').focus();
}

async function iniciar() {
  ui.cargando(true);
  try {
    const id = util.parametro('id');
    if (!id) throw new Error('Selecciona una simulación para comenzar.');
    simulacion = await api.obtener('simulaciones', id);
    if (simulacion.modo === 'rol') {
      iniciarRol();
    } else if (simulacion.modo === 'escenarios') {
      partida = new PartidaEscenario(simulacion); inicio = Date.now(); await dibujar();
    } else throw new Error('Esta simulación no tiene un modo compatible.');
  } catch (error) {
    contenido.innerHTML = `<section class="tarjeta"><h1>No se pudo abrir la simulación</h1><p role="alert">${ui.escapar(error.message)}</p><a class="btn btn--secundario" href="${volver()}">Volver a simulaciones</a></section>`;
  } finally { ui.cargando(false); }
}

if (usuarioActual()) await iniciar();
