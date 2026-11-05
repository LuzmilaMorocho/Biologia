import { MENU } from './menu.js';
import { usuarioActual, exigirRol, cerrar } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import { aviso } from './ui.js';
import * as api from './api.js';
import { logrosDe } from './gamificacion.js';
import { montarCampana } from './notificaciones.js';
import { montarAvatar, decir } from './avatar.js';

export const NOMBRE = 'Ecosistema Educativo';

export async function actualizarNoLeidosMensajes() {
  if (!usuarioActual() || document.visibilityState !== 'visible') return;
  try {
    const { total } = await api.llamar('GET', '/api/mensajes/no-leidos');
    const badge = document.getElementById('badge-mensajes-no-leidos');
    if (!badge) return;
    const cantidad = Math.max(0, Number(total) || 0);
    badge.textContent = cantidad > 99 ? '99+' : String(cantidad);
    badge.hidden = cantidad === 0;
    badge.setAttribute('aria-label', `${cantidad} mensaje${cantidad === 1 ? '' : 's'} sin leer`);
  } catch {
    // Conserva el contador anterior si falla la conexión.
  }
}

export async function montarPlantilla({ titulo, roles = [] }) {
  // Verificar permisos si se indican roles
  if (roles && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  document.title = `${titulo} · ${NOMBRE}`;

  const plantillaEl = document.getElementById('plantilla');
  if (!plantillaEl) return;

  const rutaActual = window.location.pathname || '';
  const usuario = usuarioActual();

  // Registrar visita de página en bitácora si hay sesión activa (sin await)
  if (usuario) {
    registrarEvento('pagina', rutaActual);
  }

  // Filtrar enlaces de navegación según roles
  const enlacesVisibles = MENU.filter((item) => {
    if (!item.roles || item.roles.includes('publico')) return true;
    if (item.roles.includes('sesion') && usuario) return true;
    if (usuario && item.roles.includes(usuario.rol)) return true;
    return false;
  });

  const linksHtml = enlacesVisibles
    .map((item) => {
      const esActual =
        rutaActual === item.href ||
        (item.href === '/index.html' && (rutaActual === '/' || rutaActual === ''));
      const clase = esActual ? 'activo' : '';
      const ariaCurrent = esActual ? 'aria-current="page"' : '';
      const badgeSpan = item.texto === 'Noticias' ? ' <span id="badge-noticias-no-leidas" class="insignia insignia--acento" style="display:none; font-size: 10px; padding: 2px 6px;"></span>'
        : item.texto === 'Mensajes' ? ' <span id="badge-mensajes-no-leidos" class="insignia insignia--acento contador-mensajes" hidden></span>' : '';
      return `<a href="${item.href}" class="${clase}" ${ariaCurrent}>${item.texto}${badgeSpan}</a>`;
    })
    .join('');

  // Sección de usuario en el encabezado
  let usuarioHtml = '';
  if (usuario) {
    const puntosHtml =
      usuario.rol === 'estudiante'
        ? `<span id="puntos-usuario" class="puntos-usuario" title="Tus puntos acumulados">0 pts</span>`
        : '';

    usuarioHtml = `
      <div class="fila" style="gap: var(--espaciado-s); align-items: center;">
        ${puntosHtml}
        <div id="campana-contenedor" class="campana-contenedor"></div>
        <a href="/paginas/perfil.html" style="color: var(--color-texto-inverso); font-size: var(--tamano-s); text-decoration: none;">
          <strong>${usuario.nombre}</strong> <span class="insignia" style="background: rgba(255,255,255,0.15); color: #fff; border: 0;">${usuario.rol}</span>
        </a>
        <button type="button" class="btn btn--texto btn--pequeno" id="btn-salir" style="color: var(--color-texto-inverso);">
          Salir
        </button>
      </div>
    `;
  } else {
    usuarioHtml = `
      <div class="fila" style="gap: var(--espaciado-xs);">
        <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno" style="color: var(--color-texto-inverso); border-color: var(--color-texto-inverso);">
          Ingresar
        </a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno" style="background-color: var(--color-acento); color: var(--color-primario);">
          Registrarse
        </a>
      </div>
    `;
  }

  plantillaEl.innerHTML = `
    <header class="encabezado app-encabezado">
      <div class="fila">
        <button type="button" class="btn btn--secundario btn--pequeno app-btn-menu" id="btn-menu" aria-label="Abrir o cerrar menú" aria-controls="menu-lateral" aria-expanded="false" style="color: var(--color-texto-inverso); border-color: var(--color-texto-inverso);">
          ☰
        </button>
        <a href="/index.html" style="font-weight: var(--peso-negrita); font-size: var(--tamano-l); color: var(--color-texto-inverso); text-decoration: none;">
          ${NOMBRE}
        </a>
        <span style="opacity: 0.5; margin-inline: var(--espaciado-xs);" aria-hidden="true">|</span>
        <span style="font-size: var(--tamano-m); color: var(--color-fondo);">${titulo}</span>
      </div>
      <div>
        ${usuarioHtml}
      </div>
    </header>

    <aside class="menu app-menu" id="menu-lateral" aria-label="Navegación principal">
      ${linksHtml}
    </aside>
  `;

  // Comportamiento del botón salir
  const btnSalir = document.getElementById('btn-salir');
  if (btnSalir) {
    btnSalir.addEventListener('click', async () => {
      await cerrar();
    });
  }

  // Comportamiento del botón de menú en celular
  const btnMenu = document.getElementById('btn-menu');
  const menuLateral = document.getElementById('menu-lateral');

  if (btnMenu && menuLateral) {
    btnMenu.addEventListener('click', () => {
      const abierto = menuLateral.classList.toggle('menu--abierto');
      btnMenu.setAttribute('aria-expanded', String(abierto));
    });

    document.addEventListener('click', (e) => {
      if (
        !menuLateral.contains(e.target) &&
        !btnMenu.contains(e.target) &&
        menuLateral.classList.contains('menu--abierto')
      ) {
        menuLateral.classList.remove('menu--abierto');
        btnMenu.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Agregar pie con el año al final del body si no existe
  let pie = document.querySelector('body > footer.pie');
  if (!pie) {
    const anio = new Date().getFullYear();
    pie = document.createElement('footer');
    pie.className = 'pie';
    pie.innerHTML = `<p>&copy; ${anio} ${NOMBRE} · Universidad Estatal de Milagro</p>`;
    document.body.appendChild(pie);
  }

  // Montar campana de notificaciones, puntos y badges si hay sesión
  if (usuario) {
    montarCampana({ alConsultar: actualizarNoLeidosMensajes });

    if (usuario.rol === 'estudiante') {
      (async () => {
        try {
          const logros = await logrosDe('yo');
          const elPuntos = document.getElementById('puntos-usuario');
          if (elPuntos && logros && typeof logros.puntos === 'number') {
            elPuntos.textContent = `${logros.puntos} pts`;
          }
        } catch {
          // Silencioso
        }
      })();
    }

    (async () => {
      try {
        const [noticias, lecturas] = await Promise.all([
          api.listar('noticias'),
          api.listar('lecturas-noticias')
        ]);
        const idsLeidas = new Set(lecturas.map((l) => l.noticiaId));
        const noLeidas = noticias.filter(
          (n) => n.estado === 'publicado' && !idsLeidas.has(n.id)
        ).length;

        const badge = document.getElementById('badge-noticias-no-leidas');
        if (badge && noLeidas > 0) {
          badge.textContent = String(noLeidas);
          badge.style.display = 'inline-block';
        }
      } catch {
        // Silencioso
      }
    })();
  }

  const instruccionesAvatar = document.querySelector('[data-avatar]');
  if (instruccionesAvatar) { montarAvatar(); decir(instruccionesAvatar.dataset.avatar); }

  // Mostrar aviso pendiente en cola si existe
  try {
    const avisoPendiente = sessionStorage.getItem('aviso_pendiente');
    if (avisoPendiente) {
      sessionStorage.removeItem('aviso_pendiente');
      const { texto, tipo } = JSON.parse(avisoPendiente);
      aviso(texto, tipo || 'info');
    }
  } catch {
    // Si no es JSON válido
  }
}
