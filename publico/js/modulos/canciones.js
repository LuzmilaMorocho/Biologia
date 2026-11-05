import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Canciones educativas', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const temaIdParam = util.parametro('temaId');

let canciones = [];
let asignaturas = [];
let unidades = [];
let temas = [];

let cancionActiva = null;
let filtroAsignatura = 'todas';
let filtroTema = temaIdParam || 'todos';

// Audio state
let audioEl = null;
let estaReproduciendo = false;
let lrcLineas = []; // [{ tiempo: seg, texto: str }]

function formatearSegundos(seg) {
  if (isNaN(seg) || seg < 0) return '00:00';
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parsearLRC(lrcTexto) {
  if (!lrcTexto) return [];
  const lineas = lrcTexto.split('\n');
  const resultado = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

  for (const l of lineas) {
    const match = l.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const seg = parseInt(match[2], 10);
      const frac = match[3] ? parseFloat('0.' + match[3]) : 0;
      const tiempoSeg = min * 60 + seg + frac;
      const texto = match[4].trim();
      if (texto) {
        resultado.push({ tiempo: tiempoSeg, texto });
      }
    }
  }

  resultado.sort((a, b) => a.tiempo - b.tiempo);
  return resultado;
}

async function iniciar() {
  ui.cargando(true);
  try {
    const [listaCanciones, listaAsig, listaUni, listaTemas] = await Promise.all([
      api.listar('canciones'),
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    canciones = listaCanciones || [];
    asignaturas = listaAsig || [];
    unidades = listaUni || [];
    temas = listaTemas || [];

    // Si viene temaIdParam, preseleccionar asignatura correspondiente
    if (temaIdParam) {
      const temaObj = temas.find((t) => t.id === temaIdParam);
      if (temaObj) {
        const uniObj = unidades.find((u) => u.id === temaObj.unidadId);
        if (uniObj) {
          filtroAsignatura = uniObj.asignaturaId;
        }
      }
    }

    // Seleccionar primera canción disponible si hay
    const filtradas = obtenerFiltradas();
    if (filtradas.length > 0) {
      seleccionarCancion(filtradas[0]);
    }

    renderizar();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar canciones', 'error');
  } finally {
    ui.cargando(false);
  }
}

function obtenerFiltradas() {
  const mapaTemas = new Map(temas.map((t) => [t.id, t]));
  const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

  return canciones.filter((c) => {
    if (filtroTema !== 'todos' && c.temaId !== filtroTema) return false;

    if (filtroAsignatura !== 'todas') {
      const t = mapaTemas.get(c.temaId);
      if (!t) return false;
      const u = mapaUnidades.get(t.unidadId);
      if (!u || u.asignaturaId !== filtroAsignatura) return false;
    }

    return true;
  });
}

function seleccionarCancion(c) {
  if (cancionActiva && cancionActiva.id === c.id) return;

  if (audioEl) {
    audioEl.pause();
    estaReproduciendo = false;
  }

  cancionActiva = c;
  lrcLineas = parsearLRC(c.lrc || '');

  if (!audioEl) {
    audioEl = new Audio();
    configurarAudioEvents();
  }

  audioEl.src = c.audio;
  audioEl.load();
}

function configurarAudioEvents() {
  if (!audioEl) return;

  audioEl.addEventListener('timeupdate', () => {
    const actual = audioEl.currentTime;
    const duracion = audioEl.duration || 0;

    const tiempoEl = document.getElementById('rep-tiempo');
    if (tiempoEl) {
      tiempoEl.textContent = `${formatearSegundos(actual)} / ${formatearSegundos(duracion)}`;
    }

    const barraRelleno = document.getElementById('rep-relleno');
    const barraProgreso = document.getElementById('rep-barra');
    if (barraRelleno && duracion > 0) {
      const porcentaje = (actual / duracion) * 100;
      barraRelleno.style.width = `${porcentaje}%`;
      barraProgreso?.setAttribute('aria-valuenow', String(Math.round(porcentaje)));
    }

    // Resaltar línea LRC activa
    if (lrcLineas.length > 0) {
      let lineaActivaIndex = -1;
      for (let i = 0; i < lrcLineas.length; i++) {
        if (actual >= lrcLineas[i].tiempo) {
          lineaActivaIndex = i;
        } else {
          break;
        }
      }

      if (lineaActivaIndex !== -1) {
        document.querySelectorAll('.lrc-linea').forEach((el, idx) => {
          if (idx === lineaActivaIndex) {
            if (!el.classList.contains('lrc-linea--activa')) {
              el.classList.add('lrc-linea--activa');
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            el.classList.remove('lrc-linea--activa');
          }
        });
      }
    }
  });

  audioEl.addEventListener('ended', () => {
    estaReproduciendo = false;
    const btnPlay = document.getElementById('btn-play-pause');
    if (btnPlay) btnPlay.innerHTML = '▶ Reproducir';
  });
}

function renderizar() {
  if (!contenido) return;

  const usuario = usuarioActual();
  const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  const filtradas = obtenerFiltradas();
  const mapaTemas = new Map(temas.map((t) => [t.id, t.titulo]));

  // Temas filtrados por la asignatura seleccionada
  const temasParaSelect = temas.filter((t) => {
    if (filtroAsignatura === 'todas') return true;
    const u = unidades.find((uni) => uni.id === t.unidadId);
    return u && u.asignaturaId === filtroAsignatura;
  });

  contenido.innerHTML = `
    <header class="canciones-cabecera">
      <div class="pila" style="gap: var(--espaciado-xs);">
        <h1>Canciones Educativas</h1>
        <p>Aprende conceptos pedagógicos con música, letras sincronizadas y recursos interactivos.</p>
      </div>

      ${
        esDocenteOAdmin
          ? `
        <a href="/paginas/editor-cancion.html" class="btn btn--primario">
          + Nueva Canción
        </a>
      `
          : ''
      }
    </header>

    <!-- Barra de Filtros -->
    <div class="tarjeta fila" style="gap: var(--espaciado-m); flex-wrap: wrap; align-items: center; margin-bottom: var(--espaciado-l);">
      <div class="campo" style="margin: 0; min-width: 220px; flex: 1;">
        <label for="filtro-asig" style="font-size: var(--tamano-xs);">Asignatura</label>
        <select id="filtro-asig">
          <option value="todas" ${filtroAsignatura === 'todas' ? 'selected' : ''}>Todas las asignaturas</option>
          ${asignaturas
            .map(
              (a) =>
                `<option value="${ui.escapar(a.id)}" ${filtroAsignatura === a.id ? 'selected' : ''}>${ui.escapar(a.nombre)}</option>`
            )
            .join('')}
        </select>
      </div>

      <div class="campo" style="margin: 0; min-width: 220px; flex: 1;">
        <label for="filtro-tema" style="font-size: var(--tamano-xs);">Tema vinculado</label>
        <select id="filtro-tema">
          <option value="todos" ${filtroTema === 'todos' ? 'selected' : ''}>Todos los temas</option>
          ${temasParaSelect
            .map(
              (t) =>
                `<option value="${ui.escapar(t.id)}" ${filtroTema === t.id ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`
            )
            .join('')}
        </select>
      </div>

      <div style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8; margin-left: auto;">
        ${filtradas.length} canción(es)
      </div>
    </div>

    <!-- Layout Lista + Reproductor -->
    <div class="canciones-layout">
      <!-- Columna 1: Lista de Canciones -->
      <section aria-label="Lista de canciones">
        <h2 style="font-size: var(--tamano-m); margin-bottom: var(--espaciado-s);">Repertorio</h2>
        ${
          filtradas.length === 0
            ? `<div class="tarjeta vacio" style="padding: var(--espaciado-m); text-align: center;">No hay canciones con este filtro</div>`
            : `
          <div class="canciones-lista">
            ${filtradas
              .map((c) => {
                const esActiva = cancionActiva && cancionActiva.id === c.id;
                const temaTitulo = mapaTemas.get(c.temaId) || 'Tema general';
                return `
                <article class="item-cancion ${esActiva ? 'item-cancion--activa' : ''}" data-id="${ui.escapar(c.id)}">
                  <div class="fila" style="justify-content: space-between; align-items: flex-start; gap: var(--espaciado-xs);">
                    <strong style="font-size: var(--tamano-m); color: var(--color-primario);">
                      ${ui.escapar(c.titulo)}
                    </strong>
                    ${c.lrc ? '<span class="insignia insignia--acento" style="font-size: 10px;">Sincronizada</span>' : ''}
                  </div>
                  <div style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8;">
                    ${ui.escapar(c.autoria || 'Docente')} · ${ui.escapar(temaTitulo)}
                  </div>
                </article>
              `;
              })
              .join('')}
          </div>
        `
        }
      </section>

      <!-- Columna 2: Reproductor y Letra -->
      <section aria-label="Reproductor y letra">
        ${
          !cancionActiva
            ? `
          <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
            <p>Selecciona una canción del repertorio para reproducir.</p>
          </div>
        `
            : `
          <div class="reproductor-panel">
            <header class="fila" style="justify-content: space-between; align-items: flex-start; gap: var(--espaciado-s);">
              <div class="pila" style="gap: 4px;">
                <span class="insignia insignia--acento" style="align-self: flex-start;">${ui.escapar(mapaTemas.get(cancionActiva.temaId) || '')}</span>
                <h2 style="font-size: var(--tamano-l); margin: 0; color: var(--color-primario);">
                  ${ui.escapar(cancionActiva.titulo)}
                </h2>
                <div style="font-size: var(--tamano-s); color: var(--color-texto); opacity: 0.8;">
                  Autor: <strong>${ui.escapar(cancionActiva.autoria || 'No especificado')}</strong> · Licencia: ${ui.escapar(cancionActiva.licencia || 'Propia')}
                </div>
              </div>

              ${
                esDocenteOAdmin
                  ? `
                <a href="/paginas/editor-cancion.html?id=${encodeURIComponent(cancionActiva.id)}" class="btn btn--secundario btn--pequeno">
                  Editar
                </a>
              `
                  : ''
              }
            </header>

            <!-- Barra de Progreso Accesible -->
            <div class="pila" style="gap: var(--espaciado-xs);">
              <div
                class="reproductor-progreso-barra"
                id="rep-barra"
                role="slider"
                tabindex="0"
                aria-label="Posición de reproducción"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="0"
              >
                <div class="reproductor-progreso-relleno" id="rep-relleno"></div>
              </div>
              <div class="fila" style="justify-content: space-between; font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8;">
                <span id="rep-tiempo">00:00 / 00:00</span>
                <span>Barra operable con flechas ← →</span>
              </div>
            </div>

            <!-- Controles de Audio -->
            <div class="reproductor-controles">
              <button type="button" class="btn btn--primario" id="btn-play-pause">
                ${estaReproduciendo ? '⏸ Pausar' : '▶ Reproducir'}
              </button>

              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-retroceder" title="Retroceder 5 segundos" aria-label="Retroceder 5 segundos">
                ⏪ -5s
              </button>

              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-adelantar" title="Adelantar 5 segundos" aria-label="Adelantar 5 segundos">
                +5s ⏩
              </button>

              <div class="reproductor-volumen">
                <label for="rep-volumen" style="font-size: var(--tamano-xs); margin: 0;">🔊</label>
                <input type="range" id="rep-volumen" min="0" max="1" step="0.05" value="${audioEl ? audioEl.volume : 1}" aria-label="Control de volumen" />
              </div>
            </div>

            <!-- Panel de Letra / LRC -->
            <div class="pila" style="gap: var(--espaciado-xs); margin-top: var(--espaciado-s);">
              <div class="fila" style="justify-content: space-between; align-items: center;">
                <h3 style="font-size: var(--tamano-m); margin: 0;">
                  ${lrcLineas.length > 0 ? 'Letra Sincronizada (Karaoke)' : 'Letra de la Canción'}
                </h3>
                ${
                  lrcLineas.length > 0
                    ? '<span class="insignia insignia--acento" style="font-size: 10px;">Auto-scroll</span>'
                    : ''
                }
              </div>

              <div class="letra-contenedor" id="contenedor-letra" tabindex="0" aria-label="Letra de la canción">
                ${
                  lrcLineas.length > 0
                    ? lrcLineas
                        .map(
                          (l, idx) =>
                            `<div class="lrc-linea" data-idx="${idx}">${ui.escapar(l.texto)}</div>`
                        )
                        .join('')
                    : `<div style="white-space: pre-wrap;">${ui.escapar(cancionActiva.letra || 'Sin letra disponible')}</div>`
                }
              </div>
            </div>
          </div>
        `
        }
      </section>
    </div>
  `;

  vincularEventosDOM();
}

function vincularEventosDOM() {
  // Filtros
  const selAsig = document.getElementById('filtro-asig');
  const selTema = document.getElementById('filtro-tema');

  selAsig?.addEventListener('change', (e) => {
    filtroAsignatura = e.target.value;
    filtroTema = 'todos';
    const filtradas = obtenerFiltradas();
    if (filtradas.length > 0) seleccionarCancion(filtradas[0]);
    renderizar();
  });

  selTema?.addEventListener('change', (e) => {
    filtroTema = e.target.value;
    const filtradas = obtenerFiltradas();
    if (filtradas.length > 0) seleccionarCancion(filtradas[0]);
    renderizar();
  });

  // Selección de canción
  contenido.querySelectorAll('.item-cancion').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const c = canciones.find((x) => x.id === id);
      if (c) {
        seleccionarCancion(c);
        renderizar();
      }
    });
  });

  // Controles de Reproducción
  const btnPlay = document.getElementById('btn-play-pause');
  btnPlay?.addEventListener('click', () => {
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().then(() => {
        estaReproduciendo = true;
        btnPlay.innerHTML = '⏸ Pausar';
      }).catch((err) => ui.aviso(err.message || 'Error al reproducir audio', 'error'));
    } else {
      audioEl.pause();
      estaReproduciendo = false;
      btnPlay.innerHTML = '▶ Reproducir';
    }
  });

  document.getElementById('btn-retroceder')?.addEventListener('click', () => {
    if (!audioEl) return;
    audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
  });

  document.getElementById('btn-adelantar')?.addEventListener('click', () => {
    if (!audioEl) return;
    audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 5);
  });

  // Volumen
  const inputVol = document.getElementById('rep-volumen');
  inputVol?.addEventListener('input', (e) => {
    if (audioEl) audioEl.volume = parseFloat(e.target.value);
  });

  // Barra de progreso interactiva y accesible con teclado
  const barraProgreso = document.getElementById('rep-barra');
  barraProgreso?.addEventListener('click', (e) => {
    if (!audioEl || !audioEl.duration) return;
    const rect = barraProgreso.getBoundingClientRect();
    const posRel = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = posRel * audioEl.duration;
  });

  barraProgreso?.addEventListener('keydown', (e) => {
    if (!audioEl || !audioEl.duration) return;
    if (e.key === 'ArrowRight') {
      audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Enter') {
      btnPlay?.click();
      e.preventDefault();
    }
  });
}

iniciar();

