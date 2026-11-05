import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Tema de aprendizaje', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('id');

let tema = null;
let unidad = null;
let asignatura = null;
let estaRevisado = false;

function extraerEmbedUrl(urlOriginal) {
  if (!urlOriginal) return null;
  // YouTube watch / share / shorts
  const ytMatch = urlOriginal.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (ytMatch) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }
  // Vimeo
  const vimeoMatch = urlOriginal.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

async function iniciar() {
  if (!temaId) {
    renderizarError('No se especificó ningún identificador de tema.');
    return;
  }

  ui.cargando(true);
  try {
    const [datosTema, todasUnidades, todasAsignaturas, progresos] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('unidades'),
      api.listar('asignaturas'),
      api.listar('progreso-temas')
    ]);

    tema = datosTema;
    unidad = todasUnidades.find((u) => u.id === tema.unidadId) || null;
    asignatura = unidad ? todasAsignaturas.find((a) => a.id === unidad.asignaturaId) : null;

    const usuario = usuarioActual();
    estaRevisado = progresos.some(
      (p) => (!usuario || p.usuarioId === usuario.id) && p.temaId === tema.id
    );

    // Guardar en localStorage "ultimoTema" = { id, titulo }
    try {
      localStorage.setItem('ultimoTema', JSON.stringify({ id: tema.id, titulo: tema.titulo }));
    } catch {
      // Ignorar restricciones en navegación privada
    }

    renderizar();
  } catch (err) {
    renderizarError(err.message || 'Error al cargar el tema.');
  } finally {
    ui.cargando(false);
  }
}

function renderizarError(mensaje) {
  if (!contenido) return;
  contenido.innerHTML = `
    <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
      <h1>Error</h1>
      <p>${ui.escapar(mensaje)}</p>
      <a href="/paginas/asignaturas.html" class="btn btn--primario" style="margin-top: var(--espaciado-m);">
        Ir a Mis Asignaturas
      </a>
    </div>
  `;
}

function renderizar() {
  if (!contenido || !tema) return;

  const htmlResumen = util.formatoBasico(tema.resumen || '');
  const objetivos = Array.isArray(tema.objetivos) ? tema.objetivos.filter(Boolean) : [];
  const ejemplos = Array.isArray(tema.ejemplos) ? tema.ejemplos.filter(Boolean) : [];
  const recursos = Array.isArray(tema.recursos) ? tema.recursos.filter((r) => r.titulo || r.url) : [];

  contenido.innerHTML = `
    <header class="tema-cabecera">
      <nav class="tema-miga" aria-label="Miga de pan">
        <a href="/paginas/asignaturas.html">Mis Asignaturas</a>
        <span aria-hidden="true">›</span>
        ${
          asignatura
            ? `<a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${ui.escapar(asignatura.nombre)}</a>`
            : ''
        }
        ${
          unidad
            ? `
            <span aria-hidden="true">›</span>
            <span>${ui.escapar(unidad.titulo)}</span>
          `
            : ''
        }
        <span aria-hidden="true">›</span>
        <span aria-current="page">${ui.escapar(tema.titulo)}</span>
      </nav>

      <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espaciado-m);">
        <div>
          <span class="insignia insignia--acento" style="font-size: var(--tamano-xs);">
            Nivel: ${ui.escapar(tema.dificultad || 'Intermedio')}
          </span>
          <h1 style="margin-top: var(--espaciado-xs); color: var(--color-primario);">
            ${ui.escapar(tema.titulo)}
          </h1>
        </div>

        <div class="fila">
          ${usuarioActual()?.rol === 'estudiante' ? `<a href="/paginas/tutor.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--secundario">Pregunta al tutor</a>` : ''}
          <div id="contenedor-btn-revision">
          ${
            estaRevisado
              ? `<button type="button" class="btn btn--secundario" disabled style="cursor: default;">Revisado ✓</button>`
              : `<button type="button" class="btn btn--primario" id="btn-marcar-revisado">Marcar como revisado</button>`
          }
          </div>
        </div>
      </div>
    </header>

    <!-- Objetivos de aprendizaje -->
    ${
      objetivos.length > 0
        ? `
      <section class="tema-bloque" aria-labelledby="titulo-objetivos">
        <h2 id="titulo-objetivos" style="font-size: var(--tamano-l); margin: 0;">Objetivos de aprendizaje</h2>
        <ul style="padding-left: var(--espaciado-l); line-height: var(--interlineado-base);">
          ${objetivos.map((obj) => `<li>${ui.escapar(obj)}</li>`).join('')}
        </ul>
      </section>
    `
        : ''
    }

    <!-- Resumen Pedagógico -->
    <section class="tema-bloque" aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen" style="font-size: var(--tamano-l); margin: 0;">Resumen del tema</h2>
      <div class="tema-resumen">
        ${htmlResumen || '<p>Contenido no disponible.</p>'}
      </div>
    </section>

    <!-- Ejemplos prácticos -->
    ${
      ejemplos.length > 0
        ? `
      <section class="tema-bloque" aria-labelledby="titulo-ejemplos">
        <h2 id="titulo-ejemplos" style="font-size: var(--tamano-l); margin: 0;">Ejemplos prácticos</h2>
        <ul style="padding-left: var(--espaciado-l); line-height: var(--interlineado-base);">
          ${ejemplos.map((ej) => `<li>${ui.escapar(ej)}</li>`).join('')}
        </ul>
      </section>
    `
        : ''
    }

    <!-- Recursos multimedia -->
    ${
      recursos.length > 0
        ? `
      <section class="tema-bloque" aria-labelledby="titulo-recursos">
        <h2 id="titulo-recursos" style="font-size: var(--tamano-l); margin: 0;">Recursos multimedia y complementarios</h2>
        <div class="pila" style="gap: var(--espaciado-m);">
          ${recursos
            .map((rec) => {
              const tipo = rec.tipo || 'enlace';
              const tituloRec = rec.titulo || 'Recurso educativo';
              const embedUrl = extraerEmbedUrl(rec.url);

              if (tipo === 'video' && embedUrl) {
                return `
                <div class="pila" style="gap: var(--espaciado-xs);">
                  <strong>${ui.escapar(tituloRec)}</strong>
                  <div class="recurso-video-marco">
                    <iframe src="${embedUrl}" title="${ui.escapar(tituloRec)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                  </div>
                </div>
              `;
              }

              if (tipo === 'imagen') {
                return `
                <div class="pila" style="gap: var(--espaciado-xs);">
                  <strong>${ui.escapar(tituloRec)}</strong>
                  <img src="${ui.escapar(rec.url)}" alt="${ui.escapar(tituloRec)}" class="recurso-imagen" loading="lazy" />
                </div>
              `;
              }

              if (tipo === 'pdf') {
                return `
                <div class="fila" style="align-items: center; gap: var(--espaciado-s);">
                  <span aria-hidden="true">📄</span>
                  <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer" style="font-weight: var(--peso-negrita);">
                    ${ui.escapar(tituloRec)} (Documento PDF)
                  </a>
                </div>
              `;
              }

              // Enlace general
              return `
              <div class="fila" style="align-items: center; gap: var(--espaciado-s);">
                <span aria-hidden="true">🔗</span>
                <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer">
                  ${ui.escapar(tituloRec)}
                </a>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>
    `
        : ''
    }

    <!-- Práctica este tema (Actividades) -->
    <section class="tema-bloque" aria-labelledby="titulo-practica">
      <h2 id="titulo-practica" style="font-size: var(--tamano-l); margin: 0;">Practica este tema</h2>
      ${
        ACTIVIDADES.length === 0
          ? `
          <div class="tarjeta vacio" style="padding: var(--espaciado-m); text-align: center;">
            <p>Las actividades formativas de este tema estarán disponibles próximamente.</p>
          </div>
        `
          : `
          <div class="actividades-grid">
            ${ACTIVIDADES.map(
              (act) => `
              <a href="${act.href}?temaId=${encodeURIComponent(tema.id)}" class="tarjeta-actividad">
                <div class="pila" style="gap: var(--espaciado-xs);">
                  <strong>${ui.escapar(act.texto)}</strong>
                  <p style="font-size: var(--tamano-s); color: var(--color-texto); opacity: 0.8; margin: 0;">
                    ${ui.escapar(act.descripcion || '')}
                  </p>
                </div>
                <span class="btn btn--secundario btn--pequeno" style="align-self: flex-start;">
                  Iniciar actividad →
                </span>
              </a>
            `
            ).join('')}
          </div>
        `
      }
    </section>
  `;

  vincularEventos();
}

function vincularEventos() {
  const btnMarcar = document.getElementById('btn-marcar-revisado');
  btnMarcar?.addEventListener('click', async () => {
    try {
      btnMarcar.disabled = true;
      ui.cargando(true);

      await api.crear('progreso-temas', {
        temaId: tema.id
      });

      // Registrar intento de actividad tema-revisado para gamificación
      await registrarIntento({
        actividad: 'tema-revisado',
        temaId: tema.id,
        puntaje: 1,
        maximo: 1
      });

      estaRevisado = true;
      const contenedor = document.getElementById('contenedor-btn-revision');
      if (contenedor) {
        contenedor.innerHTML = `<button type="button" class="btn btn--secundario" disabled style="cursor: default;">Revisado ✓</button>`;
      }
      ui.aviso('Tema marcado como revisado', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al registrar progreso', 'error');
      btnMarcar.disabled = false;
    } finally {
      ui.cargando(false);
    }
  });
}

iniciar();

