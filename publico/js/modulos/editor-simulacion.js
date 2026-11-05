import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { erroresEscenario, imagenEscenario, erroresRol } from '../nucleo/simulaciones.js';

await montarPlantilla({ titulo: 'Editor de simulación', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
let simulacion, temas = [], nombresTemas = new Map(), siguiente = 1, revision = 0;
let sucio = false, guardando = false, validarCambios = false, validarPropuesta = false;
let generacion = null;
const subiendo = new Set();
const idsUsados = new Set();
const nodo = (id) => document.getElementById(id);
const opcionNueva = () => ({ texto: '', destino: '', puntos: 0, consecuencia: '' });
const criterioNuevo = () => ({ criterio: '', descripcion: '', puntos: 5 });
const bloqueado = () => guardando || Boolean(generacion?.enCurso && !generacion.cerrada);

function reservarIdentificadores() {
  idsUsados.clear();
  for (const s of simulacion.escenas) {
    idsUsados.add(s.id);
    for (const o of s.opciones) if (o.destino) idsUsados.add(o.destino);
  }
  if (simulacion.escenaInicial) idsUsados.add(simulacion.escenaInicial);
  siguiente = 1;
}

function controles() {
  nodo('editor-guardar').disabled = bloqueado() || subiendo.size > 0 || !temas.length;
  nodo('editor-previa').disabled = bloqueado() || subiendo.size > 0 || !simulacion.id || sucio;
  nodo('editor-campos').disabled = bloqueado();
  nodo('editor-generar-ia').disabled = bloqueado() || subiendo.size > 0 || Boolean(generacion) || !temas.some((t) => t.id === simulacion.temaId);
  nodo('editor-previa-ayuda').textContent = sucio || !simulacion.id ? 'Guarda los cambios para habilitar la vista previa.' : 'La vista previa usa la versión guardada y no registra intentos.';
}

function erroresDatos({ previa = false, guardarBorrador = false } = {}) {
  const errores = [];
  if (!simulacion.titulo.trim() || simulacion.titulo.length > 200) errores.push({ destino: 'editor-titulo', mensaje: 'Escribe un título de hasta 200 caracteres.' });
  if (!temas.some((t) => t.id === simulacion.temaId)) errores.push({ destino: 'editor-tema', mensaje: 'Selecciona un tema que puedas editar.' });
  if (simulacion.modo === 'escenarios') {
    for (const e of erroresEscenario(simulacion, { publicar: previa || simulacion.estado === 'publicado' || (validarPropuesta && !guardarBorrador) })) {
      const indice = simulacion.escenas.findIndex((s) => s.id === e.escenaId);
      errores.push({ destino: indice >= 0 ? `editor-escena-${indice}` : 'editor-inicial', mensaje: `${e.escenaId ? e.escenaId + ': ' : ''}${e.mensaje}` });
    }
  } else if (simulacion.modo === 'rol') {
    for (const e of erroresRol(simulacion, { publicar: previa || simulacion.estado === 'publicado' })) {
      errores.push({ destino: e.campo === 'maxTurnos' ? 'editor-rol-max-turnos' : `editor-rol-${e.campo.replaceAll('.', '-')}`, mensaje: e.mensaje });
    }
  }
  return errores;
}

function mostrarErrores(errores, enfocar = false) {
  const panel = nodo('editor-errores');
  panel.hidden = !errores.length;
  panel.innerHTML = errores.length ? `<h2>Revisa estos datos</h2><ul>${errores.map((e) => `<li><a href="#${e.destino}" data-ir-error="${e.destino}">${ui.escapar(e.mensaje)}</a></li>`).join('')}</ul>` : '';
  panel.querySelectorAll('[data-ir-error]').forEach((enlace) => enlace.addEventListener('click', (evento) => {
    evento.preventDefault(); const destino = nodo(enlace.dataset.irError); destino?.focus(); destino?.scrollIntoView?.({ block: 'center' });
  }));
  if (enfocar && errores.length) panel.focus();
}

function dibujarMapa() {
  const porId = new Map(simulacion.escenas.map((s, i) => [s.id, { ...s, indice: i }]));
  const expandidas = new Set();
  const vinculo = (id, etiqueta) => porId.has(id) ? `<a href="#editor-escena-${porId.get(id).indice}">${ui.escapar(etiqueta)}</a>` : ui.escapar(etiqueta);
  function rama(id) {
    const escena = porId.get(id);
    if (!escena || expandidas.has(id)) return '';
    expandidas.add(id);
    if (!escena.opciones.length) return `<ul><li>${ui.escapar(id)} · Final</li></ul>`;
    return `<ul>${escena.opciones.map((o) => {
      const etiqueta = `${id} → ${o.destino || 'Sin destino'} (${o.texto || 'Sin texto'})`;
      const referencia = expandidas.has(o.destino);
      return `<li>${vinculo(o.destino, etiqueta)}${referencia ? ' · Escena ya mostrada' : rama(o.destino)}</li>`;
    }).join('')}</ul>`;
  }
  let html = porId.has(simulacion.escenaInicial) ? `<p>Inicio: ${vinculo(simulacion.escenaInicial, simulacion.escenaInicial)}</p>${rama(simulacion.escenaInicial)}` : '<p>Selecciona una escena inicial.</p>';
  const desconectadas = [...porId.keys()].filter((id) => !expandidas.has(id));
  for (const id of desconectadas) if (!expandidas.has(id)) html += `<p>Sin conexión desde la inicial: ${vinculo(id, id)}</p>${rama(id)}`;
  nodo('editor-mapa').innerHTML = html;
}

function cambiar() {
  sucio = true; revision++;
  nodo('editor-mensaje').textContent = 'Cambios sin guardar.';
  if (simulacion.modo === 'escenarios') dibujarMapa();
  if (validarCambios) mostrarErrores(erroresDatos());
  controles();
}

function destinos(actual = '') {
  return `<option value="">Selecciona una escena</option>${actual && !simulacion.escenas.some((s) => s.id === actual) ? `<option value="${ui.escapar(actual)}" selected>Destino inexistente: ${ui.escapar(actual)}</option>` : ''}` +
    simulacion.escenas.map((s) => `<option value="${ui.escapar(s.id)}"${s.id === actual ? ' selected' : ''}>${ui.escapar(s.id)}</option>`).join('');
}

function actualizarImagen(indice) {
  const escena = simulacion.escenas[indice], imagen = nodo(`editor-imagen-${indice}`), url = imagenEscenario(escena.imagen);
  imagen.hidden = !url;
  if (url) imagen.src = url; else imagen.removeAttribute('src');
  nodo(`editor-quitar-imagen-${indice}`).disabled = !url;
}

async function subirImagen(indice, entrada) {
  const archivo = entrada.files?.[0];
  if (!archivo || bloqueado() || subiendo.has(indice)) return;
  const aviso = nodo(`editor-subida-${indice}`);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
    aviso.textContent = 'Selecciona una imagen JPG, PNG o WEBP.'; entrada.value = ''; return;
  }
  subiendo.add(indice); entrada.disabled = true; controles(); aviso.textContent = 'Subiendo imagen…';
  try {
    const { url } = await api.subir(archivo);
    if (!imagenEscenario(url)) throw new Error('El servidor no devolvió una imagen válida.');
    simulacion.escenas[indice].imagen = url; actualizarImagen(indice); cambiar(); aviso.textContent = 'Imagen subida. Guarda la simulación para conservar el enlace.';
  } catch (error) { aviso.textContent = error.message || 'No se pudo subir la imagen. Se conserva la imagen anterior.'; }
  finally { subiendo.delete(indice); entrada.disabled = false; entrada.value = ''; controles(); }
}

function dibujarEscenas() {
  nodo('editor-inicial').innerHTML = destinos(simulacion.escenaInicial);
  nodo('editor-escenas').innerHTML = simulacion.escenas.map((s, i) => `<article class="tarjeta" id="editor-escena-${i}" tabindex="-1">
    <div class="editor-barra"><h3>${ui.escapar(s.id)}${s.opciones.length ? '' : ' · Final'}</h3><button type="button" class="btn btn--texto" data-accion="eliminar-escena" data-escena="${i}">Eliminar ${ui.escapar(s.id)}</button></div>
    <div class="campo"><label for="editor-texto-${i}">Texto de ${ui.escapar(s.id)}</label><textarea id="editor-texto-${i}" rows="4" maxlength="5000" data-escena="${i}" data-campo="texto">${ui.escapar(s.texto)}</textarea></div>
    <div class="campo"><label for="editor-archivo-${i}">Imagen de ${ui.escapar(s.id)} (opcional)</label><input id="editor-archivo-${i}" type="file" accept="image/jpeg,image/png,image/webp" data-archivo="${i}">
    <p id="editor-subida-${i}" role="status"></p><img id="editor-imagen-${i}" class="editor-imagen" alt="Imagen de la escena ${ui.escapar(s.id)}" referrerpolicy="no-referrer" hidden>
    <button type="button" id="editor-quitar-imagen-${i}" class="btn btn--texto" data-accion="quitar-imagen" data-escena="${i}">Quitar imagen de ${ui.escapar(s.id)}</button></div>
    <div class="editor-opciones">${s.opciones.map((o, j) => `<fieldset class="editor-opcion"><legend>Opción ${j + 1} de ${ui.escapar(s.id)}</legend>
      <div class="campo"><label for="opcion-texto-${i}-${j}">Decisión</label><input id="opcion-texto-${i}-${j}" maxlength="500" value="${ui.escapar(o.texto)}" data-escena="${i}" data-opcion="${j}" data-campo="texto"></div>
      <div class="editor-rejilla"><div class="campo"><label for="opcion-destino-${i}-${j}">Destino</label><select id="opcion-destino-${i}-${j}" data-escena="${i}" data-opcion="${j}" data-campo="destino">${destinos(o.destino)}</select></div>
      <div class="campo"><label for="opcion-puntos-${i}-${j}">Puntos (−10 a 10)</label><input id="opcion-puntos-${i}-${j}" type="number" min="-10" max="10" step="any" value="${ui.escapar(o.puntos)}" data-escena="${i}" data-opcion="${j}" data-campo="puntos"></div></div>
      <div class="campo"><label for="opcion-consecuencia-${i}-${j}">Consecuencia</label><textarea id="opcion-consecuencia-${i}-${j}" rows="3" maxlength="2000" data-escena="${i}" data-opcion="${j}" data-campo="consecuencia">${ui.escapar(o.consecuencia)}</textarea></div>
      <button type="button" class="btn btn--texto" data-accion="eliminar-opcion" data-escena="${i}" data-opcion="${j}">Eliminar opción ${j + 1} de ${ui.escapar(s.id)}</button></fieldset>`).join('')}</div>
    ${s.opciones.length ? '' : '<p>Escena final: no tiene opciones. Agrega opciones para convertirla en una decisión.</p>'}
    <button type="button" class="btn btn--secundario" data-accion="agregar-opcion" data-escena="${i}"${s.opciones.length >= 4 ? ' disabled' : ''}>${s.opciones.length ? 'Agregar opción' : 'Agregar dos opciones'}</button></article>`).join('') || '<p>No hay escenas. Agrega la primera para comenzar.</p>';
  simulacion.escenas.forEach((s, i) => actualizarImagen(i));
  nodo('editor-escenas').querySelectorAll('[data-campo]').forEach((entrada) => {
    entrada.addEventListener(entrada.tagName === 'SELECT' ? 'change' : 'input', () => {
      const s = simulacion.escenas[Number(entrada.dataset.escena)];
      const destino = entrada.dataset.opcion === undefined ? s : s.opciones[Number(entrada.dataset.opcion)];
      destino[entrada.dataset.campo] = entrada.dataset.campo === 'puntos' ? (entrada.value.trim() === '' ? NaN : Number(entrada.value)) : entrada.value;
      cambiar();
    });
  });
  nodo('editor-escenas').querySelectorAll('[data-archivo]').forEach((entrada) => entrada.addEventListener('change', () => subirImagen(Number(entrada.dataset.archivo), entrada)));
  nodo('editor-escenas').querySelectorAll('[data-accion]').forEach((boton) => boton.addEventListener('click', async () => {
    if (bloqueado() || subiendo.size) return;
    const i = Number(boton.dataset.escena), s = simulacion.escenas[i];
    if (boton.dataset.accion === 'eliminar-escena') {
      if (!await ui.confirmar(`¿Eliminar la escena ${s.id}? Tendrás que corregir los destinos que la usan.`)) return;
      const vigente = simulacion.escenas.indexOf(s);
      if (vigente < 0 || bloqueado() || subiendo.size) return;
      simulacion.escenas.splice(vigente, 1); if (simulacion.escenaInicial === s.id) simulacion.escenaInicial = '';
    } else if (boton.dataset.accion === 'agregar-opcion') {
      if (s.opciones.length >= 4) return;
      s.opciones.push(opcionNueva()); if (s.opciones.length === 1) s.opciones.push(opcionNueva());
    } else if (boton.dataset.accion === 'eliminar-opcion') s.opciones.splice(Number(boton.dataset.opcion), 1);
    else if (boton.dataset.accion === 'quitar-imagen') { s.imagen = ''; actualizarImagen(i); cambiar(); return; }
    dibujarEscenas(); cambiar();
  }));
  dibujarMapa();
}

async function guardar(evento) {
  evento?.preventDefault();
  if (bloqueado() || subiendo.size) return;
  validarCambios = true; const errores = erroresDatos({ guardarBorrador: true });
  mostrarErrores(validarPropuesta ? erroresDatos() : errores, errores.length > 0);
  if (errores.length) return;
  const datos = { titulo: simulacion.titulo.trim(), temaId: simulacion.temaId, modo: simulacion.modo, estado: simulacion.estado };
  Object.assign(datos, { escenaInicial: simulacion.escenaInicial, escenas: structuredClone(simulacion.escenas),
    personaje: { ...simulacion.personaje }, rubrica: structuredClone(simulacion.rubrica), maxTurnos: simulacion.maxTurnos });
  const version = revision; guardando = true; controles(); nodo('editor-mensaje').textContent = 'Guardando…';
  try {
    const guardada = simulacion.id ? await api.actualizar('simulaciones', simulacion.id, datos) : await api.crear('simulaciones', datos);
    simulacion.id = guardada.id; simulacion.titulo = datos.titulo;
    if (revision === version) sucio = false;
    window.history.replaceState(null, '', `/paginas/editor-simulacion.html?id=${encodeURIComponent(simulacion.id)}`);
    nodo('editor-mensaje').textContent = 'Simulación guardada correctamente.';
    nodo('editor-titulo').value = simulacion.titulo;
  } catch (error) { nodo('editor-mensaje').textContent = error.message || 'No se pudo guardar. Tus cambios siguen en el editor.'; }
  finally { guardando = false; controles(); }
}

function abrirGeneracionIA() {
  if (bloqueado() || subiendo.size || generacion || simulacion.modo !== 'escenarios' || !temas.some((t) => t.id === simulacion.temaId)) return;
  const temaId = simulacion.temaId;
  const solicitud = { enCurso: false, cerrada: false, aplicada: false };
  generacion = solicitud; controles();
  const div = document.createElement('div');
  div.innerHTML = `<form class="pila" novalidate><p>Se usará el contenido guardado del tema seleccionado. El resultado reemplazará las escenas del editor como borrador; solo se conservará cuando pulses Guardar.</p>
    <div class="campo"><label for="editor-ia-situacion">Situación propuesta</label><textarea id="editor-ia-situacion" rows="5" maxlength="800" required aria-describedby="editor-ia-ayuda"></textarea><p id="editor-ia-ayuda" class="texto-secundario">Describe una situación del tema en hasta 800 caracteres.</p></div>
    <div class="campo"><label for="editor-ia-cantidad">Número de escenas</label><input id="editor-ia-cantidad" type="number" min="5" max="10" step="1" value="6" required></div>
    <button type="submit" id="editor-ia-enviar" class="btn btn--primario">Generar borrador</button><p id="editor-ia-estado" role="status" aria-live="polite"></p></form>`;
  const form = div.querySelector('form'), situacion = div.querySelector('#editor-ia-situacion'), cantidad = div.querySelector('#editor-ia-cantidad');
  const boton = div.querySelector('#editor-ia-enviar'), aviso = div.querySelector('#editor-ia-estado');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (solicitud.enCurso || solicitud.cerrada || solicitud.aplicada) return;
    const escenas = Number(cantidad.value);
    if (!situacion.value.trim() || situacion.value.length > 800) { aviso.textContent = 'Describe la situación en entre 1 y 800 caracteres.'; situacion.focus(); return; }
    if (!Number.isInteger(escenas) || escenas < 5 || escenas > 10) { aviso.textContent = 'Elige un número entero de escenas entre 5 y 10.'; cantidad.focus(); return; }
    if (simulacion.temaId !== temaId || simulacion.modo !== 'escenarios') { aviso.textContent = 'El tema o el modo cambiaron. Cierra el cuadro y vuelve a abrirlo.'; return; }
    const version = revision;
    solicitud.enCurso = true; boton.disabled = true; situacion.disabled = true; cantidad.disabled = true; controles();
    aviso.textContent = 'La IA está preparando el borrador…'; form.setAttribute('aria-busy', 'true');
    try {
      const resultado = await api.ia('generar-escenario', { temaId, situacion: situacion.value.trim(), escenas });
      if (solicitud.cerrada) return;
      if (revision !== version || simulacion.temaId !== temaId || simulacion.modo !== 'escenarios') throw new Error('El editor cambió mientras se generaba. Se conservaron tus cambios; vuelve a intentarlo.');
      if (!resultado || typeof resultado.titulo !== 'string' || !resultado.titulo.trim() || resultado.titulo.length > 200 ||
          typeof resultado.escenaInicial !== 'string' || !resultado.escenaInicial.trim() || resultado.escenaInicial.length > 50 ||
          !Array.isArray(resultado.escenas) || resultado.escenas.length !== escenas || erroresEscenario(resultado, { publicar: false }).length) {
        throw new Error('La IA no devolvió un borrador editable válido. Puedes volver a intentarlo.');
      }
      const propuestas = resultado.escenas.map((s) => ({ id: s.id, texto: s.texto, imagen: s.imagen || '',
        opciones: s.opciones.map((o) => ({ texto: o.texto, destino: o.destino, puntos: o.puntos, consecuencia: o.consecuencia })) }));
      simulacion = { ...simulacion, titulo: resultado.titulo.trim(), modo: 'escenarios', estado: 'borrador', escenaInicial: resultado.escenaInicial, escenas: propuestas };
      reservarIdentificadores(); validarCambios = true; validarPropuesta = true;
      solicitud.aplicada = true; dibujar(); cambiar();
      nodo('editor-mensaje').textContent = 'Borrador generado con IA, sin guardar. Revisa las escenas y los avisos antes de publicarlo.';
      aviso.textContent = 'Borrador cargado y validado, sin guardar. Cierra este cuadro para revisarlo en el editor.';
    } catch (error) {
      if (!solicitud.cerrada) aviso.textContent = error.estado === 429 ? 'Alcanzaste el límite diario de IA. Puedes continuar mañana; tu edición se conserva.' : error.message || 'No se pudo generar el borrador. Tu edición se conserva.';
    } finally {
      solicitud.enCurso = false; boton.disabled = solicitud.aplicada; situacion.disabled = solicitud.aplicada; cantidad.disabled = solicitud.aplicada;
      form.setAttribute('aria-busy', 'false');
      if (solicitud.cerrada && generacion === solicitud) generacion = null;
      controles();
    }
  });
  ui.modal({ titulo: 'Generar borrador con IA', contenido: div, acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn--secundario' }] }).then(() => {
    solicitud.cerrada = true;
    if (!solicitud.enCurso && generacion === solicitud) generacion = null;
    controles();
    if (solicitud.aplicada) (nodo('editor-errores').hidden ? nodo('editor-texto-0') : nodo('editor-errores'))?.focus();
  });
}

function dibujarRol() {
  nodo('editor-rol-campos').innerHTML = `<div class="campo"><label for="editor-rol-personaje-nombre">Nombre del personaje</label><input id="editor-rol-personaje-nombre" data-personaje="nombre" maxlength="100" value="${ui.escapar(simulacion.personaje.nombre)}"></div>
    ${[['descripcion', 'Descripción del personaje', 1000], ['contexto', 'Contexto del caso', 1800], ['objetivo', 'Objetivo del estudiante', 1000]].map(([campo, etiqueta, max]) => `<div class="campo"><label for="editor-rol-personaje-${campo}">${etiqueta}</label><textarea id="editor-rol-personaje-${campo}" data-personaje="${campo}" rows="3" maxlength="${max}">${ui.escapar(simulacion.personaje[campo])}</textarea></div>`).join('')}
    <div class="campo"><label for="editor-rol-max-turnos">Máximo de turnos (4 a 12)</label><input type="number" id="editor-rol-max-turnos" min="4" max="12" step="1" value="${ui.escapar(simulacion.maxTurnos)}" aria-describedby="editor-rol-turnos-ayuda"><p id="editor-rol-turnos-ayuda">Cada turno incluye una intervención del estudiante y la respuesta del personaje.</p></div>
    <section id="editor-rol-rubrica" tabindex="-1"><h3>Rúbrica: de tres a cinco criterios</h3><div class="editor-opciones">${simulacion.rubrica.map((c, i) => `<fieldset class="editor-opcion"><legend>Criterio ${i + 1}</legend>
      <div class="campo"><label for="editor-rol-rubrica-${i}-criterio">Nombre del criterio ${i + 1}</label><input id="editor-rol-rubrica-${i}-criterio" data-criterio="${i}" data-rubrica="criterio" maxlength="120" value="${ui.escapar(c.criterio)}"></div>
      <div class="campo"><label for="editor-rol-rubrica-${i}-descripcion">Descripción del criterio ${i + 1}</label><textarea id="editor-rol-rubrica-${i}-descripcion" data-criterio="${i}" data-rubrica="descripcion" maxlength="700" rows="3">${ui.escapar(c.descripcion)}</textarea></div>
      <div class="campo"><label for="editor-rol-rubrica-${i}-puntos">Puntos máximos del criterio ${i + 1}</label><input id="editor-rol-rubrica-${i}-puntos" type="number" min="0" step="any" value="${ui.escapar(c.puntos)}" data-criterio="${i}" data-rubrica="puntos"></div>
      <button type="button" class="btn btn--texto" data-quitar-criterio="${i}"${simulacion.rubrica.length <= 3 ? ' disabled' : ''}>Eliminar criterio ${i + 1}</button></fieldset>`).join('')}</div>
      <button type="button" id="editor-rol-agregar-criterio" class="btn btn--secundario"${simulacion.rubrica.length >= 5 ? ' disabled' : ''}>Agregar criterio</button></section>`;
  nodo('editor-rol-campos').querySelectorAll('[data-personaje]').forEach((entrada) => entrada.addEventListener('input', () => { simulacion.personaje[entrada.dataset.personaje] = entrada.value; cambiar(); }));
  nodo('editor-rol-campos').querySelectorAll('[data-rubrica]').forEach((entrada) => entrada.addEventListener('input', () => {
    simulacion.rubrica[Number(entrada.dataset.criterio)][entrada.dataset.rubrica] = entrada.dataset.rubrica === 'puntos' ? (entrada.value.trim() ? Number(entrada.value) : NaN) : entrada.value;
    cambiar();
  }));
  nodo('editor-rol-max-turnos').addEventListener('input', () => { simulacion.maxTurnos = Number(nodo('editor-rol-max-turnos').value); cambiar(); });
  nodo('editor-rol-agregar-criterio').addEventListener('click', () => {
    if (bloqueado() || subiendo.size || simulacion.rubrica.length >= 5) return;
    simulacion.rubrica.push(criterioNuevo()); dibujarRol(); cambiar(); nodo(`editor-rol-rubrica-${simulacion.rubrica.length - 1}-criterio`).focus();
  });
  nodo('editor-rol-campos').querySelectorAll('[data-quitar-criterio]').forEach((boton) => boton.addEventListener('click', () => {
    if (bloqueado() || subiendo.size || simulacion.rubrica.length <= 3) return;
    simulacion.rubrica.splice(Number(boton.dataset.quitarCriterio), 1); dibujarRol(); cambiar();
  }));
}

function dibujar() {
  contenido.innerHTML = `<div class="editor-simulacion"><header><a href="/paginas/simulaciones.html">← Volver a simulaciones</a><h1>${simulacion.id ? 'Editar' : 'Nueva'} simulación</h1></header>
    <section id="editor-errores" class="tarjeta editor-errores" role="alert" tabindex="-1" hidden></section>
    <form id="editor-formulario" novalidate><fieldset id="editor-campos"><legend>Datos generales</legend><div class="editor-rejilla">
      <div class="campo"><label for="editor-titulo">Título</label><input id="editor-titulo" maxlength="200" required value="${ui.escapar(simulacion.titulo)}"></div>
      <div class="campo"><label for="editor-tema">Tema</label><select id="editor-tema" required><option value="">Selecciona un tema</option>${temas.map((t) => `<option value="${ui.escapar(t.id)}"${t.id === simulacion.temaId ? ' selected' : ''}>${ui.escapar(nombresTemas.get(t.id) || t.titulo)}</option>`).join('')}</select></div>
      <div class="campo"><label for="editor-modo">Modo</label><select id="editor-modo"><option value="escenarios"${simulacion.modo === 'escenarios' ? ' selected' : ''}>Escenarios</option><option value="rol"${simulacion.modo === 'rol' ? ' selected' : ''}>Rol</option></select></div>
      <div class="campo"><label for="editor-estado">Estado</label><select id="editor-estado"><option value="borrador"${simulacion.estado === 'borrador' ? ' selected' : ''}>Borrador</option><option value="publicado"${simulacion.estado === 'publicado' ? ' selected' : ''}>Publicado</option></select></div></div>
      ${temas.length ? '' : '<p role="status">No tienes temas que puedas editar. Solicita la asignación de una asignatura.</p>'}
      <section id="editor-aviso-rol" class="tarjeta"${simulacion.modo === 'rol' ? '' : ' hidden'}><h2>Práctica de rol</h2><p>Define el caso, el personaje y los criterios que orientarán la evaluación.</p><div id="editor-rol-campos" class="pila"></div></section>
      <section id="editor-modo-escenarios"${simulacion.modo === 'escenarios' ? '' : ' hidden'}><h2>Escenas</h2>
      <button type="button" id="editor-generar-ia" class="btn btn--secundario">Generar borrador con IA</button>
      <p>Una escena final no tiene opciones. Las demás necesitan de dos a cuatro opciones para publicarse. Puedes guardar un borrador mientras lo completas.</p>
      <div class="campo"><label for="editor-inicial">Escena inicial</label><select id="editor-inicial"></select></div>
      <div id="editor-escenas"></div><button type="button" id="editor-agregar-escena" class="btn btn--secundario">Agregar escena</button>
      <section class="tarjeta"><h2>Mapa del escenario</h2><div id="editor-mapa" class="editor-mapa"></div></section></section>
    </fieldset><div class="editor-barra"><button type="submit" id="editor-guardar" class="btn btn--primario">Guardar</button><button type="button" id="editor-previa" class="btn btn--secundario" aria-describedby="editor-previa-ayuda">Vista previa</button></div>
    <p id="editor-previa-ayuda" class="texto-secundario"></p><p id="editor-mensaje" role="status" aria-live="polite"></p></form></div>`;
  for (const campo of ['titulo', 'tema', 'modo', 'estado']) nodo(`editor-${campo}`).addEventListener(campo === 'titulo' ? 'input' : 'change', () => {
    simulacion[campo === 'tema' ? 'temaId' : campo] = nodo(`editor-${campo}`).value;
    nodo('editor-modo-escenarios').hidden = simulacion.modo !== 'escenarios'; nodo('editor-aviso-rol').hidden = simulacion.modo !== 'rol'; cambiar();
  });
  nodo('editor-inicial').addEventListener('change', () => { simulacion.escenaInicial = nodo('editor-inicial').value; cambiar(); });
  nodo('editor-agregar-escena').addEventListener('click', () => {
    if (bloqueado() || subiendo.size) return;
    if (simulacion.escenas.length >= 100) { ui.aviso('El límite es de 100 escenas.', 'info'); return; }
    let id; do { id = `E${siguiente++}`; } while (idsUsados.has(id)); idsUsados.add(id);
    simulacion.escenas.push({ id, texto: '', imagen: '', opciones: [] });
    if (simulacion.escenas.length === 1 && !simulacion.escenaInicial) simulacion.escenaInicial = id;
    dibujarEscenas(); cambiar(); nodo(`editor-escena-${simulacion.escenas.length - 1}`).focus();
  });
  nodo('editor-formulario').addEventListener('submit', guardar);
  nodo('editor-generar-ia').addEventListener('click', abrirGeneracionIA);
  nodo('editor-previa').addEventListener('click', () => {
    if (!simulacion.id || sucio || bloqueado() || subiendo.size) return;
    const errores = erroresDatos({ previa: true }); mostrarErrores(errores, true); if (errores.length) return;
    window.open(`/paginas/simulador.html?id=${encodeURIComponent(simulacion.id)}&vista=previa`, '_blank', 'noopener');
  });
  dibujarEscenas(); dibujarRol(); controles();
}

async function iniciar() {
  ui.cargando(true);
  try {
    const id = util.parametro('id');
    const [listaTemas, unidades, asignaturas, grupos, existente] = await Promise.all([
      api.listar('temas'), api.listar('unidades'), api.listar('asignaturas'), api.listar('distributivo'), id ? api.obtener('simulaciones', id) : null
    ]);
    const usuario = usuarioActual();
    const permitidas = new Set(grupos.filter((g) => g.docenteId === usuario.id).map((g) => g.asignaturaId));
    const editables = new Set(unidades.filter((u) => usuario.rol === 'admin' || permitidas.has(u.asignaturaId)).map((u) => u.id));
    temas = listaTemas.filter((t) => editables.has(t.unidadId));
    nombresTemas = new Map(temas.map((t) => { const unidad = unidades.find((u) => u.id === t.unidadId); const asignatura = asignaturas.find((a) => a.id === unidad?.asignaturaId); return [t.id, [asignatura?.nombre, unidad?.titulo, t.titulo].filter(Boolean).join(' · ')]; }));
    if (existente && !temas.some((t) => t.id === existente.temaId)) throw new Error('No tienes permiso para editar esta simulación.');
    simulacion = existente || { titulo: '', temaId: temas.some((t) => t.id === util.parametro('temaId')) ? util.parametro('temaId') : '', modo: 'escenarios', estado: 'borrador', escenaInicial: 'E1', escenas: [{ id: 'E1', texto: '', imagen: '', opciones: [] }] };
    simulacion.escenas ||= []; simulacion.escenaInicial ||= '';
    simulacion.personaje = { nombre: '', descripcion: '', contexto: '', objetivo: '', ...simulacion.personaje };
    simulacion.rubrica ||= [criterioNuevo(), criterioNuevo(), criterioNuevo()]; simulacion.maxTurnos ??= 6;
    reservarIdentificadores();
    sucio = false; revision = 0; validarCambios = false; validarPropuesta = false; dibujar();
  } catch (error) {
    contenido.innerHTML = `<section class="tarjeta"><h1>Editor de simulación</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" id="editor-reintentar" class="btn btn--secundario">Reintentar</button><a href="/paginas/simulaciones.html">Volver a simulaciones</a></section>`;
    nodo('editor-reintentar').addEventListener('click', iniciar);
  } finally { ui.cargando(false); }
}

window.addEventListener('beforeunload', (evento) => { if (sucio || subiendo.size || generacion?.enCurso) { evento.preventDefault(); evento.returnValue = ''; } });
if (['docente', 'admin'].includes(usuarioActual()?.rol)) await iniciar();
