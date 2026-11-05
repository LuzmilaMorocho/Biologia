// Núcleo de notificaciones y campana interactiva (§A contratos.md)
import * as api from './api.js';
import * as util from './util.js';
import * as ui from './ui.js';
import { usuarioActual } from './sesion.js';

let contadorSinLeer = 0;
let listaNotificaciones = [];
let panelAbierto = false;
let intervaloConsulta = null;
let consultando = false;
let alConsultar = async () => {};

function actualizarPermiso() {
  const boton = document.getElementById('btn-avisos-navegador');
  const estado = document.getElementById('estado-avisos-navegador');
  if (!boton || !estado) return;
  const compatible = 'Notification' in window && window.isSecureContext;
  const permiso = compatible ? window.Notification.permission : '';
  boton.disabled = !compatible || permiso !== 'default';
  estado.textContent = !compatible ? 'Este navegador necesita HTTPS y compatibilidad con avisos.'
    : permiso === 'granted' ? 'Avisos del navegador activados.'
    : permiso === 'denied' ? 'Avisos bloqueados. Puedes habilitarlos en los permisos del sitio.'
    : 'Los recordatorios se consultan con la plataforma abierta y visible.';
}

function mostrarAvisos(recordatorios) {
  if (!('Notification' in window) || window.Notification.permission !== 'granted') return;
  for (const aviso of Array.isArray(recordatorios) ? recordatorios : []) {
    if (aviso.leida) continue;
    try {
      const notificacion = new window.Notification('Recordatorio de agenda', {
        body: aviso.mensaje, tag: `agenda-${aviso.id}`, lang: 'es-EC'
      });
      notificacion.onclick = () => {
        window.focus();
        window.location.href = '/paginas/agenda.html';
        notificacion.close();
      };
    } catch {
      // Algunos navegadores solo admiten avisos mediante un service worker.
    }
  }
}

/**
 * Retorna el número actual de notificaciones no leídas
 * @returns {number}
 */
export function noLeidas() {
  return contadorSinLeer;
}

/**
 * Actualiza el indicador visual y aria-label del botón de campana
 * @param {number} total
 */
function actualizarBadge(total) {
  contadorSinLeer = typeof total === 'number' ? total : 0;
  const btn = document.getElementById('btn-campana');
  const badge = document.getElementById('badge-campana');

  if (btn) {
    const textoAria =
      contadorSinLeer > 0
        ? `Notificaciones: ${contadorSinLeer} no leída${contadorSinLeer > 1 ? 's' : ''}`
        : 'Notificaciones: ninguna sin leer';
    btn.setAttribute('aria-label', textoAria);
  }

  if (badge) {
    if (contadorSinLeer > 0) {
      badge.textContent = contadorSinLeer > 99 ? '99+' : String(contadorSinLeer);
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '0';
      badge.style.display = 'none';
    }
  }
}

/**
 * Renderiza la lista de notificaciones en el panel desplegable
 * @param {Array} items
 */
function renderizarLista(items) {
  const contenedorLista = document.getElementById('lista-campana');
  if (!contenedorLista) return;

  if (!items || items.length === 0) {
    contenedorLista.innerHTML = `
      <div class="panel-campana__vacio">
        <p>No tienes notificaciones pendientes.</p>
      </div>
    `;
    return;
  }

  contenedorLista.innerHTML = items
    .map((item) => {
      const claseNoLeida = !item.leida ? 'notificacion-item--no-leida' : '';
      const textoFecha = util.fechaRelativa(item.fecha);
      const enlaceHtml = item.enlace
        ? `<a href="${ui.escapar(item.enlace)}" class="notificacion-item__enlace">Ver detalle →</a>`
        : '';

      return `
        <li class="notificacion-item ${claseNoLeida}" data-id="${item.id}" tabindex="0" role="article">
          <div class="notificacion-item__cuerpo">
            ${util.formatoBasico(item.mensaje || '')}
          </div>
          <div class="notificacion-item__pie">
            <time datetime="${ui.escapar(item.fecha || '')}">${textoFecha}</time>
            ${enlaceHtml}
          </div>
        </li>
      `;
    })
    .join('');

  // Manejar clics en cada notificación
  const elementos = contenedorLista.querySelectorAll('.notificacion-item');
  elementos.forEach((el) => {
    const id = el.getAttribute('data-id');
    const notif = items.find((n) => n.id === id);

    const manejarAccion = async (e) => {
      // Si el clic fue en el enlace <a>, dejar que navegue pero marcar como leída
      if (notif && !notif.leida) {
        notif.leida = true;
        el.classList.remove('notificacion-item--no-leida');
        actualizarBadge(Math.max(0, contadorSinLeer - 1));
        try {
          await api.llamar('POST', `/api/notificaciones/${id}/leida`);
        } catch {
          // Silencioso
        }
      }

      // Si no fue en el enlace directo pero tiene enlace, navegar
      if (notif?.enlace && (!e.target.closest('a') || e.type === 'keydown')) {
        window.location.href = notif.enlace;
      }
    };

    el.addEventListener('click', manejarAccion);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        manejarAccion(e);
      }
    });
  });
}

/**
 * Consulta las notificaciones al servidor
 */
async function cargarNotificaciones() {
  if (document.visibilityState !== 'visible' || consultando) return;
  consultando = true;
  const consultaAdicional = Promise.resolve().then(alConsultar).catch(() => {});

  try {
    actualizarPermiso();
    try {
      mostrarAvisos(await api.llamar('GET', '/api/agenda/recordatorios'));
    } catch {
      // Un fallo de agenda no impide consultar la campana.
    }
    const respuesta = await api.llamar('GET', '/api/notificaciones');
    if (respuesta) {
      listaNotificaciones = respuesta.notificaciones || [];
      const sinLeer =
        typeof respuesta.totalSinLeer === 'number'
          ? respuesta.totalSinLeer
          : respuesta.sinLeer || 0;
      actualizarBadge(sinLeer);

      if (panelAbierto) {
        renderizarLista(listaNotificaciones);
      }
    }
  } catch {
    // Si no hay red o sesión caduca, no romper la interfaz
  } finally {
    await consultaAdicional;
    consultando = false;
  }
}

/**
 * Alterna el estado del panel desplegable
 * @param {boolean} [forzar]
 */
function togglePanel(forzar) {
  const panel = document.getElementById('panel-campana');
  const btn = document.getElementById('btn-campana');
  if (!panel || !btn) return;

  panelAbierto = typeof forzar === 'boolean' ? forzar : !panelAbierto;

  btn.setAttribute('aria-expanded', String(panelAbierto));
  panel.setAttribute('aria-hidden', String(!panelAbierto));
  panel.style.display = panelAbierto ? 'flex' : 'none';

  if (panelAbierto) {
    renderizarLista(listaNotificaciones);
    // Cargar versión más fresca
    cargarNotificaciones();
  }
}

/**
 * Monta el botón campana y panel en el encabezado
 */
export async function montarCampana(opciones = {}) {
  const usuario = usuarioActual();
  if (!usuario) return;
  alConsultar = typeof opciones.alConsultar === 'function' ? opciones.alConsultar : async () => {};

  // Evitar montaje duplicado
  if (document.getElementById('btn-campana')) return;

  // Buscar el contenedor de la campana en la plantilla
  let contenedor = document.getElementById('campana-contenedor');
  if (!contenedor) {
    const encabezado = document.querySelector('.app-encabezado');
    if (!encabezado) return;
    contenedor = document.createElement('div');
    contenedor.id = 'campana-contenedor';
    contenedor.className = 'campana-contenedor';
    const filaUsuario = encabezado.querySelector('.fila:last-child');
    if (filaUsuario) {
      filaUsuario.prepend(contenedor);
    } else {
      encabezado.appendChild(contenedor);
    }
  }

  contenedor.innerHTML = `
    <div style="position: relative;">
      <button type="button"
              id="btn-campana"
              class="btn-campana"
              aria-label="Notificaciones: 0 no leídas"
              aria-expanded="false"
              aria-haspopup="true">
        <span class="campana-icono" aria-hidden="true">🔔</span>
        <span id="badge-campana" class="insignia insignia--acento badge-campana" style="display: none;">0</span>
      </button>

      <div id="panel-campana"
           class="panel-campana"
           role="dialog"
           aria-label="Panel de notificaciones"
           aria-hidden="true"
           style="display: none;">
        <div class="panel-campana__cabecera">
          <h3 class="panel-campana__titulo">Notificaciones</h3>
          <button type="button"
                  id="btn-marcar-todas-leidas"
                  class="btn btn--texto btn--pequeno panel-campana__accion">
            Marcar todas como leídas
          </button>
        </div>
        <div class="panel-campana__avisos">
          <button type="button" id="btn-avisos-navegador" class="btn btn--secundario btn--pequeno" aria-describedby="estado-avisos-navegador">Activar avisos del navegador</button>
          <p id="estado-avisos-navegador" class="texto-secundario" role="status"></p>
        </div>
        <ul id="lista-campana" class="panel-campana__lista" tabindex="-1"></ul>
      </div>
    </div>
  `;

  const btnCampana = document.getElementById('btn-campana');
  const btnMarcarTodas = document.getElementById('btn-marcar-todas-leidas');
  const panelCampana = document.getElementById('panel-campana');

  actualizarPermiso();
  document.getElementById('btn-avisos-navegador')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!('Notification' in window) || !window.isSecureContext || window.Notification.permission !== 'default') return;
    try {
      await window.Notification.requestPermission();
    } catch {
      ui.aviso('No se pudo solicitar el permiso. Revisa los permisos del sitio.', 'error');
    }
    actualizarPermiso();
  });

  btnCampana?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  btnMarcarTodas?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await api.llamar('POST', '/api/notificaciones/leidas');
      contadorSinLeer = 0;
      listaNotificaciones.forEach((n) => (n.leida = true));
      actualizarBadge(0);
      renderizarLista(listaNotificaciones);
    } catch (err) {
      ui.aviso(err.message || 'Error al actualizar notificaciones', 'error');
    }
  });

  // Cerrar panel al hacer clic fuera o presionar Escape
  document.addEventListener('click', (e) => {
    if (panelAbierto && !contenedor.contains(e.target)) {
      togglePanel(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelAbierto) {
      togglePanel(false);
      btnCampana?.focus();
    }
  });

  // Carga inicial
  await cargarNotificaciones();

  // Consulta periódica cada 60 s solo con pestaña visible
  if (intervaloConsulta) {
    clearInterval(intervaloConsulta);
  }

  intervaloConsulta = setInterval(() => {
    if (document.visibilityState === 'visible') {
      cargarNotificaciones();
    }
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      cargarNotificaciones();
    }
  });
}

