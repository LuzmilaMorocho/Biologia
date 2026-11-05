import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';
import { formularioModal } from './formularios.js';

export function textoConEnlaces(texto) {
  const cadena = String(texto || '');
  let html = '', posicion = 0;
  for (const coincidencia of cadena.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    let enlace = coincidencia[0];
    const cierres = { ')': '(', ']': '[', '}': '{' };
    while (enlace) {
      const ultimo = enlace.at(-1), apertura = cierres[ultimo];
      if (/[.,;:!?]/.test(ultimo) || apertura && enlace.split(ultimo).length > enlace.split(apertura).length) enlace = enlace.slice(0, -1);
      else break;
    }
    html += ui.escapar(cadena.slice(posicion, coincidencia.index));
    try {
      const url = new URL(enlace);
      html += ['http:', 'https:'].includes(url.protocol)
        ? `<a href="${ui.escapar(url.href)}" target="_blank" rel="noopener noreferrer">${ui.escapar(enlace)}</a>`
        : ui.escapar(enlace);
    } catch { html += ui.escapar(enlace); }
    html += ui.escapar(coincidencia[0].slice(enlace.length));
    posicion = coincidencia.index + coincidencia[0].length;
  }
  return html + ui.escapar(cadena.slice(posicion));
}

const nombreDe = (u) => [u?.nombre, u?.apellido].filter(Boolean).join(' ') || 'Usuario';
const fechaDe = (iso, opciones) => {
  const fecha = new Date(iso);
  return Number.isFinite(fecha.getTime()) ? new Intl.DateTimeFormat('es-EC', opciones).format(fecha) : '';
};

export function montarMensajeria(contenedor, usuario, actualizarContador = async () => {}) {
  let conversaciones = [], abierta = null, cargandoLista = false, nuevaPendiente = false, pausado = false;
  let relojChat, relojLista;
  const borradores = new Map();
  const enviosPendientes = new Set();
  const bloqueosPendientes = new Set(), reportados = new Set();
  let revisionBloqueos = 0, difundiendo = false, reportando = false;
  contenedor.innerHTML = `<header><h1>Mensajes</h1><p>Conversa con tus contactos de la comunidad educativa.</p></header>
    <div class="mensajes" id="mensajeria">
      <aside class="mensajes__lateral" aria-label="Conversaciones">
        <button type="button" id="mensaje-nueva" class="btn btn--primario">Nueva conversación</button>
        ${usuario.rol === 'docente' ? '<button type="button" id="mensaje-curso" class="btn btn--secundario">Mensaje al curso</button><p id="mensaje-difusion-estado" role="status"></p>' : ''}
        <div class="campo"><label for="mensaje-buscar">Buscar conversación</label><input id="mensaje-buscar" type="search" placeholder="Nombre o mensaje" autocomplete="off"></div>
        <p id="mensajes-error-lista" class="campo__error" role="alert"></p>
        <button type="button" id="mensajes-recargar" class="btn btn--secundario" hidden>Reintentar lista</button>
        <nav id="mensajes-lista" class="mensajes__lista" aria-label="Elige una conversación"><p>Cargando conversaciones…</p></nav>
      </aside>
      <section class="mensajes__chat" aria-label="Conversación">
        <header class="mensajes__cabecera"><button type="button" id="mensaje-volver" class="btn btn--secundario mensajes__volver" hidden>← Volver</button>
          <div><h2 id="mensaje-contacto">Selecciona una conversación</h2><p id="mensaje-rol" class="texto-secundario"></p></div>
          <button type="button" id="mensaje-bloquear" class="btn btn--secundario" hidden>Bloquear</button></header>
        <p id="mensaje-bloqueo-estado" class="mensajes__estado" role="status"></p>
        <p id="mensaje-estado" class="mensajes__estado" role="status">Elige un chat o inicia una nueva conversación.</p>
        <p id="mensaje-error" class="campo__error" role="alert"></p>
        <button type="button" id="mensaje-reintentar" class="btn btn--secundario" hidden>Reintentar conversación</button>
        <button type="button" id="mensaje-anteriores" class="btn btn--texto" hidden>Ver anteriores</button>
        <ol id="mensajes-historial" class="mensajes__historial" role="log" aria-label="Historial de mensajes" aria-live="off" tabindex="0"></ol>
        <form id="mensaje-formulario" class="mensajes__formulario" hidden>
          <div class="campo"><label for="mensaje-texto">Escribe un mensaje</label><textarea id="mensaje-texto" rows="3" maxlength="2000" aria-describedby="mensaje-ayuda mensaje-contador" required></textarea></div>
          <div class="mensajes__pie"><span id="mensaje-ayuda" class="texto-secundario">Enter envía · Mayús + Enter añade una línea</span>
            <span id="mensaje-contador">0 / 2.000</span><button type="submit" id="mensaje-enviar" class="btn btn--primario">Enviar</button></div>
        </form>
      </section>
    </div>`;
  const nodo = (id) => document.getElementById(id);
  const visible = () => !pausado && document.visibilityState === 'visible';
  const actual = (sesion) => abierta === sesion && !pausado;
  const ruta = (sesion) => `/api/mensajes/${encodeURIComponent(sesion.id)}`;
  const errorChat = (texto = '') => { nodo('mensaje-error').textContent = texto; };

  function pintarLista() {
    const busqueda = util.normalizar(nodo('mensaje-buscar').value || '');
    const lista = conversaciones.filter((c) => util.normalizar(`${nombreDe(c.participante)} ${c.ultimo?.texto || ''}`).includes(busqueda));
    const enfocado = document.activeElement?.dataset?.conversacion;
    nodo('mensajes-lista').innerHTML = lista.length ? lista.map((c) => `<button type="button" class="mensajes__conversacion ${abierta?.id === c.id ? 'mensajes__conversacion--activa' : ''}" data-conversacion="${ui.escapar(c.id)}" ${abierta?.id === c.id ? 'aria-current="true"' : ''}>
      <span class="mensajes__nombre">${ui.escapar(nombreDe(c.participante))}</span>
      <time datetime="${ui.escapar(c.ultimo?.fecha || '')}">${ui.escapar(fechaDe(c.ultimo?.fecha, { hour: '2-digit', minute: '2-digit' }))}</time>
      <span class="mensajes__ultimo">${ui.escapar(c.ultimo?.texto || 'Sin mensajes todavía')}</span>
      ${c.noLeidos > 0 ? `<span class="insignia insignia--acento" aria-label="${Number(c.noLeidos)} sin leer">${Number(c.noLeidos)}</span>` : ''}</button>`).join('')
      : `<p class="vacio">${busqueda ? 'No hay conversaciones que coincidan.' : 'Todavía no tienes conversaciones. Pulsa Nueva conversación para empezar.'}</p>`;
    if (enfocado) nodo('mensajes-lista').querySelector(`[data-conversacion="${enfocado}"]`)?.focus();
  }

  async function cargarLista() {
    if (!visible() || cargandoLista) return;
    cargandoLista = true;
    const revision = revisionBloqueos;
    try {
      const lista = await api.llamar('GET', '/api/mensajes/conversaciones');
      if (pausado || revision !== revisionBloqueos) return;
      conversaciones = lista;
      if (abierta) {
        const conv = conversaciones.find((c) => c.id === abierta.id);
        if (conv) { abierta.bloqueado = Boolean(conv.bloqueado); abierta.bloqueadoPorMi = Boolean(conv.bloqueadoPorMi); }
        controles();
      }
      pintarLista();
      nodo('mensajes-error-lista').textContent = '';
      nodo('mensajes-recargar').hidden = true;
    } catch (error) {
      nodo('mensajes-error-lista').textContent = error.message;
      nodo('mensajes-recargar').hidden = false;
    } finally { cargandoLista = false; }
  }

  function controles() {
    const enviando = abierta && enviosPendientes.has(abierta.id);
    const lista = abierta?.lista && !enviando && !abierta.bloqueado && !bloqueosPendientes.has(abierta.participante?.id);
    nodo('mensaje-bloquear').hidden = !abierta?.participante?.id;
    nodo('mensaje-bloquear').textContent = abierta?.bloqueadoPorMi ? 'Desbloquear' : 'Bloquear';
    nodo('mensaje-bloquear').disabled = Boolean(bloqueosPendientes.has(abierta?.participante?.id));
    nodo('mensaje-bloqueo-estado').textContent = abierta?.bloqueadoPorMi ? 'Has bloqueado a este contacto. Puedes consultar el historial o desbloquearlo.'
      : abierta?.bloqueado ? 'No puedes enviar mensajes a este contacto. El historial sigue disponible.' : '';
    nodo('mensaje-texto').disabled = !lista;
    nodo('mensaje-enviar').disabled = !lista || !nodo('mensaje-texto').value.trim() || nodo('mensaje-texto').value.length > 2000;
    nodo('mensaje-enviar').textContent = enviando ? 'Enviando…' : 'Enviar';
    nodo('mensaje-contador').textContent = `${nodo('mensaje-texto').value.length} / 2.000`;
    nodo('mensaje-anteriores').hidden = !abierta?.hayAnteriores;
    nodo('mensaje-anteriores').disabled = Boolean(abierta?.anteriores);
  }

  function pintarHistorial(sesion, { bajar = false, conservar = false } = {}) {
    if (!actual(sesion)) return;
    const historial = nodo('mensajes-historial');
    const alto = historial.scrollHeight, arriba = historial.scrollTop;
    const cercaDelFinal = alto - arriba - historial.clientHeight < 80;
    let dia = '';
    historial.innerHTML = sesion.mensajes.map((m) => {
      const fecha = fechaDe(m.fecha, { dateStyle: 'full' });
      const separador = fecha !== dia ? `<li class="mensajes__dia">${ui.escapar(fecha)}</li>` : '';
      dia = fecha;
      const mio = m.autorId === usuario.id;
      return `${separador}<li class="mensajes__fila ${mio ? 'mensajes__fila--mia' : ''}"><article class="mensajes__burbuja ${mio ? 'mensajes__burbuja--mia' : ''}" aria-label="${ui.escapar(mio ? 'Tú' : nombreDe(sesion.participante))}">
        <p class="mensajes__texto">${textoConEnlaces(m.texto)}</p><time datetime="${ui.escapar(m.fecha)}">${ui.escapar(fechaDe(m.fecha, { hour: '2-digit', minute: '2-digit' }))}</time>
        ${!mio ? `<button type="button" class="btn btn--texto btn--pequeno" data-reportar="${ui.escapar(m.id)}" ${reportados.has(`${sesion.id}/${m.id}`) ? 'disabled' : ''}>${reportados.has(`${sesion.id}/${m.id}`) ? 'Reportado' : 'Reportar'}</button>` : ''}</article></li>`;
    }).join('');
    if (conservar) historial.scrollTop = arriba + historial.scrollHeight - alto;
    else if (bajar || cercaDelFinal) historial.scrollTop = historial.scrollHeight;
  }

  function incorporar(sesion, lista) {
    const mensajes = new Map(sesion.mensajes.map((m) => [m.id, m]));
    for (const mensaje of lista) if (!mensaje.oculto) mensajes.set(mensaje.id, mensaje);
    sesion.mensajes = [...mensajes.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  }

  async function marcarLeido(sesion) {
    if (!actual(sesion) || !visible() || !sesion.pendienteLectura || sesion.leyendo) return;
    sesion.leyendo = true;
    const version = sesion.versionLectura;
    try {
      await api.llamar('POST', `${ruta(sesion)}/leido`, {});
      if (!actual(sesion)) return;
      sesion.pendienteLectura = sesion.versionLectura !== version;
      const conversacion = conversaciones.find((c) => c.id === sesion.id);
      if (conversacion) conversacion.noLeidos = 0;
      pintarLista();
      await actualizarContador();
    } catch {
      // Conserva la marca pendiente para reintentarla en la siguiente consulta.
    } finally { sesion.leyendo = false; }
  }

  async function cargarInicial(sesion) {
    if (!actual(sesion) || !visible() || sesion.cargando) return;
    sesion.cargando = true;
    nodo('mensaje-estado').textContent = 'Cargando conversación…';
    nodo('mensaje-reintentar').hidden = true;
    errorChat();
    try {
      const mensajes = await api.llamar('GET', ruta(sesion));
      if (!actual(sesion)) return;
      sesion.mensajes = mensajes;
      sesion.cursor = mensajes.at(-1)?.id || '1970-01-01T00:00:00.000Z';
      sesion.hayAnteriores = mensajes.length === 50;
      sesion.lista = true;
      sesion.pendienteLectura = true;
      sesion.versionLectura = (sesion.versionLectura || 0) + 1;
      nodo('mensaje-estado').textContent = mensajes.length ? 'Conversación cargada.' : 'Todavía no hay mensajes. Escribe el primero.';
      pintarHistorial(sesion, { bajar: true }); controles();
      await marcarLeido(sesion);
    } catch (error) {
      if (actual(sesion)) { errorChat(error.message); nodo('mensaje-reintentar').hidden = false; nodo('mensaje-estado').textContent = 'No se pudo cargar la conversación.'; }
    } finally { sesion.cargando = false; if (actual(sesion)) controles(); }
  }

  async function abrir(id) {
    const conversacion = conversaciones.find((c) => c.id === id);
    if (!conversacion || !visible()) return;
    if (abierta?.id === id) { nodo('mensaje-texto').focus(); return; }
    abierta = { id, participante: conversacion.participante, mensajes: [], lista: false, hayAnteriores: false,
      bloqueado: Boolean(conversacion.bloqueado), bloqueadoPorMi: Boolean(conversacion.bloqueadoPorMi) };
    nodo('mensajeria').classList.add('mensajes--abierta');
    nodo('mensaje-contacto').textContent = nombreDe(conversacion.participante);
    nodo('mensaje-rol').textContent = conversacion.participante?.rol || '';
    nodo('mensaje-formulario').hidden = false;
    nodo('mensaje-volver').hidden = false;
    nodo('mensajes-historial').innerHTML = '';
    nodo('mensaje-texto').value = borradores.get(id) || '';
    pintarLista(); controles();
    const sesion = abierta;
    await cargarInicial(sesion);
    if (actual(sesion) && sesion.lista) nodo('mensaje-texto').focus();
  }

  async function nuevos() {
    const sesion = abierta;
    if (!visible() || !sesion?.lista || sesion.nuevos) return;
    sesion.nuevos = true;
    try {
      let cantidad = 0, lote;
      do {
        lote = await api.llamar('GET', `${ruta(sesion)}?desde=${encodeURIComponent(sesion.cursor)}`);
        if (!actual(sesion)) return;
        if (lote.length) {
          const ids = new Set(sesion.mensajes.map((m) => m.id));
          cantidad += lote.filter((m) => !ids.has(m.id) && m.autorId !== usuario.id).length;
          incorporar(sesion, lote);
          sesion.cursor = lote.at(-1).id;
          sesion.pendienteLectura = true;
          sesion.versionLectura = (sesion.versionLectura || 0) + 1;
          pintarHistorial(sesion);
        }
      } while (lote.length === 50 && visible());
      if (cantidad) nodo('mensaje-estado').textContent = `${cantidad} mensaje${cantidad === 1 ? '' : 's'} nuevo${cantidad === 1 ? '' : 's'}.`;
      else if (nodo('mensaje-estado').textContent.startsWith('No se pudo actualizar:')) nodo('mensaje-estado').textContent = 'Conversación actualizada.';
      await marcarLeido(sesion);
    } catch (error) {
      if (actual(sesion)) nodo('mensaje-estado').textContent = `No se pudo actualizar: ${error.message}. Volveremos a intentarlo.`;
    } finally { sesion.nuevos = false; }
  }

  async function anteriores() {
    const sesion = abierta;
    if (!visible() || !sesion?.lista || sesion.anteriores || !sesion.hayAnteriores) return;
    const restaurarFoco = document.activeElement === nodo('mensaje-anteriores');
    sesion.anteriores = true; controles(); errorChat();
    try {
      const lista = await api.llamar('GET', `${ruta(sesion)}?antes=${encodeURIComponent(sesion.mensajes[0].id)}`);
      if (!actual(sesion)) return;
      incorporar(sesion, lista); sesion.hayAnteriores = lista.length === 50;
      pintarHistorial(sesion, { conservar: true });
      nodo('mensaje-estado').textContent = lista.length ? 'Mensajes anteriores cargados.' : 'Llegaste al inicio de la conversación.';
    } catch (error) { if (actual(sesion)) errorChat(error.message); }
    finally {
      sesion.anteriores = false;
      if (actual(sesion)) {
        controles();
        if (restaurarFoco) nodo(nodo('mensaje-anteriores').hidden ? 'mensajes-historial' : 'mensaje-anteriores').focus();
      }
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    const sesion = abierta, texto = nodo('mensaje-texto').value;
    if (!visible() || !sesion?.lista || sesion.bloqueado || bloqueosPendientes.has(sesion.participante?.id) || enviosPendientes.has(sesion.id) || !texto.trim() || texto.length > 2000) return;
    enviosPendientes.add(sesion.id); controles(); errorChat();
    try {
      const mensaje = await api.llamar('POST', ruta(sesion), { texto });
      if (borradores.get(sesion.id) === texto) borradores.delete(sesion.id);
      incorporar(sesion, [mensaje]);
      const destino = abierta?.id === sesion.id ? abierta : null;
      // El cursor solo avanza al consultar: puede haber mensajes ajenos antes del envío.
      if (destino && actual(destino)) {
        incorporar(destino, [mensaje]);
        if (nodo('mensaje-texto').value === texto) nodo('mensaje-texto').value = '';
        pintarHistorial(destino, { bajar: true });
        nodo('mensaje-estado').textContent = 'Mensaje enviado.';
      }
      await cargarLista();
    } catch (error) { if (actual(sesion)) errorChat(error.message); else ui.aviso(`No se envió el mensaje a ${nombreDe(sesion.participante)}: ${error.message}`, 'error'); }
    finally { enviosPendientes.delete(sesion.id); if (abierta?.id === sesion.id && !pausado) { controles(); nodo('mensaje-texto').focus(); } }
  }

  async function nueva() {
    if (nuevaPendiente || !visible()) return;
    nuevaPendiente = true; nodo('mensaje-nueva').disabled = true;
    let creada = null;
    try {
      const contactos = await api.llamar('GET', '/api/mensajes/contactos');
      if (!contactos.length) { ui.aviso('No tienes contactos disponibles para iniciar una conversación.'); return; }
      creada = await formularioModal('Nueva conversación', `<div class="campo"><label for="mensaje-destinatario">Contacto</label><select id="mensaje-destinatario" name="con" required>
        <option value="">Selecciona un contacto</option>${contactos.map((c) => `<option value="${ui.escapar(c.id)}">${ui.escapar(nombreDe(c))} · ${ui.escapar(c.rol)}</option>`).join('')}</select></div>`,
        (datos) => api.llamar('POST', '/api/mensajes/conversaciones', datos));
      if (creada) {
        await cargarLista();
        if (!conversaciones.some((c) => c.id === creada.id)) conversaciones.push({ id: creada.id, participante: contactos.find((c) => creada.participantes.includes(c.id)), ultimo: creada.ultimo, noLeidos: 0 });
        await abrir(creada.id);
      }
    } catch (error) { nodo('mensajes-error-lista').textContent = error.message; }
    finally { nuevaPendiente = false; nodo('mensaje-nueva').disabled = false; if (!creada) nodo('mensaje-nueva').focus(); }
  }

  async function cambiarBloqueo() {
    const sesion = abierta, contactoId = sesion?.participante?.id;
    if (!visible() || !contactoId || bloqueosPendientes.has(contactoId)) return;
    const bloquear = !sesion.bloqueadoPorMi;
    bloqueosPendientes.add(contactoId); controles(); errorChat();
    try {
      const resultado = bloquear ? await api.llamar('POST', '/api/mensajes/bloquear', { usuarioId: contactoId })
        : await api.llamar('DELETE', `/api/mensajes/bloquear/${encodeURIComponent(contactoId)}`);
      revisionBloqueos++;
      for (const c of conversaciones.filter((c) => c.participante?.id === contactoId)) {
        c.bloqueadoPorMi = bloquear; c.bloqueado = bloquear || Boolean(resultado.bloqueado);
      }
      if (abierta?.participante?.id === contactoId) {
        abierta.bloqueadoPorMi = bloquear; abierta.bloqueado = bloquear || Boolean(resultado.bloqueado);
      }
      pintarLista();
      ui.aviso(bloquear ? 'Contacto bloqueado.' : 'Se eliminó tu bloqueo.', 'exito');
    } catch (error) { if (actual(sesion)) errorChat(error.message); else ui.aviso(error.message, 'error'); }
    finally { bloqueosPendientes.delete(contactoId); controles(); }
  }

  async function difundir() {
    if (usuario.rol !== 'docente' || difundiendo || !visible()) return;
    difundiendo = true; nodo('mensaje-curso').disabled = true;
    try {
      const [grupos, asignaturas] = await Promise.all([api.listar('distributivo'), api.listar('asignaturas')]);
      const propios = grupos.filter((g) => g.docenteId === usuario.id);
      if (!propios.length) { ui.aviso('No tienes grupos asignados para enviar un mensaje al curso.'); return; }
      const resultado = await formularioModal('Mensaje al curso', `<div class="campo"><label for="mensaje-grupo">Curso o grupo</label><select id="mensaje-grupo" name="grupoId" required><option value="">Selecciona un grupo</option>
        ${propios.map((g) => `<option value="${ui.escapar(g.id)}">${ui.escapar([asignaturas.find((a) => a.id === g.asignaturaId)?.nombre, g.paralelo, g.periodo].filter(Boolean).join(' · ') || g.id)}</option>`).join('')}</select></div>
        <div class="campo"><label for="mensaje-difusion">Mensaje (máximo 2.000 caracteres)</label><textarea id="mensaje-difusion" name="texto" rows="5" maxlength="2000" required></textarea></div>
        <p>Se envía individualmente a estudiantes activos y no bloqueados. Cada destinatario cuenta para el límite de 30 mensajes por minuto.</p>`,
        (datos) => api.llamar('POST', '/api/mensajes/difusion', datos));
      if (resultado) {
        nodo('mensaje-difusion-estado').textContent = `Enviado a ${resultado.enviados} estudiante(s). Contactos omitidos: ${resultado.omitidos}.`;
        await cargarLista(); await nuevos();
      }
    } catch (error) { nodo('mensajes-error-lista').textContent = error.message; }
    finally { difundiendo = false; nodo('mensaje-curso').disabled = false; nodo('mensaje-curso').focus(); }
  }

  async function reportar(id) {
    const sesion = abierta, mensaje = sesion?.mensajes.find((m) => m.id === id && m.autorId !== usuario.id);
    if (!mensaje || reportando || !visible()) return;
    const referenciaId = `${sesion.id}/${mensaje.id}`;
    if (reportados.has(referenciaId)) return;
    reportando = true;
    try {
      const reporte = await formularioModal('Reportar mensaje', `<p>Mensaje de ${ui.escapar(nombreDe(sesion.participante))}</p><blockquote class="mensajes__cita">${ui.escapar(mensaje.texto)}</blockquote>
        <div class="campo"><label for="mensaje-motivo">Motivo del reporte</label><textarea id="mensaje-motivo" name="motivo" rows="4" maxlength="5000" required></textarea></div>`,
        ({ motivo }) => api.crear('reportes', { tipo: 'mensaje', referenciaId, motivo }));
      if (reporte) { reportados.add(referenciaId); ui.aviso('Reporte enviado a administración.', 'exito'); if (actual(sesion)) pintarHistorial(sesion); }
    } catch (error) { if (actual(sesion)) errorChat(error.message); else ui.aviso(error.message, 'error'); }
    finally { reportando = false; if (actual(sesion)) nodo('mensajes-historial').focus(); }
  }

  nodo('mensaje-buscar').addEventListener('input', pintarLista);
  nodo('mensajes-lista').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-conversacion]');
    if (boton) return abrir(boton.dataset.conversacion);
  });
  nodo('mensaje-nueva').addEventListener('click', nueva);
  nodo('mensaje-curso')?.addEventListener('click', difundir);
  nodo('mensaje-bloquear').addEventListener('click', cambiarBloqueo);
  nodo('mensajes-historial').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-reportar]');
    if (boton) return reportar(boton.dataset.reportar);
  });
  nodo('mensajes-recargar').addEventListener('click', cargarLista);
  nodo('mensaje-reintentar').addEventListener('click', () => abierta && cargarInicial(abierta));
  nodo('mensaje-anteriores').addEventListener('click', anteriores);
  nodo('mensaje-volver').addEventListener('click', () => {
    abierta = null;
    nodo('mensajeria').classList.remove('mensajes--abierta');
    nodo('mensaje-formulario').hidden = true; nodo('mensaje-volver').hidden = true;
    nodo('mensaje-anteriores').hidden = true; nodo('mensaje-reintentar').hidden = true;
    nodo('mensaje-contacto').textContent = 'Selecciona una conversación'; nodo('mensaje-rol').textContent = '';
    nodo('mensajes-historial').innerHTML = ''; errorChat();
    nodo('mensaje-estado').textContent = 'Elige un chat o inicia una nueva conversación.';
    pintarLista(); controles(); nodo('mensaje-buscar').focus();
  });
  nodo('mensaje-texto').addEventListener('input', () => { if (abierta) borradores.set(abierta.id, nodo('mensaje-texto').value); controles(); });
  nodo('mensaje-texto').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); nodo('mensaje-formulario').requestSubmit(); }
  });
  nodo('mensaje-formulario').addEventListener('submit', enviar);
  const alMostrar = () => { if (visible()) { cargarLista(); if (abierta && !abierta.lista) cargarInicial(abierta); else nuevos(); } };
  document.addEventListener('visibilitychange', alMostrar);
  function detener() { pausado = true; clearInterval(relojChat); clearInterval(relojLista); }
  function iniciarRelojes() { pausado = false; clearInterval(relojChat); clearInterval(relojLista); relojChat = setInterval(nuevos, 4000); relojLista = setInterval(cargarLista, 15000); }
  window.addEventListener('pagehide', detener);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      iniciarRelojes();
      if (abierta) nodo('mensaje-texto').value = borradores.get(abierta.id) || '';
      controles(); alMostrar();
    }
  });
  iniciarRelojes(); controles();
  const listo = cargarLista();
  return { listo, detener };
}
