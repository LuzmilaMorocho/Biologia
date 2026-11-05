// Módulo del juego educativo del Ahorcado (P04.3)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Juego del Ahorcado', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');

// Filas del teclado en pantalla
const TECLADO_FILAS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

let tema = null;
let terminosValidos = [];
const usadosEnPartida = new Set();

let terminoActual = null;
let palabraNormalizada = '';
let letrasAdivinadas = new Set();
let letrasProbadas = new Set();
let errores = 0;
let partidaFinalizada = false;
let tiempoInicio = 0;

function generarSvgGlobo(numErrores) {
  const estadoClase = `globo-svg--estado-${Math.min(4, Math.max(0, numErrores))}`;

  return `
    <svg class="globo-svg ${estadoClase}" viewBox="0 0 160 180" role="img" aria-label="Globo indicando estado del juego: ${numErrores} errores">
      <!-- Cuerda y nudo -->
      <path class="globo-cuerda" d="M80,126 Q75,145 83,160 T78,175" />
      <polygon class="globo-nudo" points="75,125 85,125 80,131" />

      <!-- Cuerpo del globo -->
      <ellipse class="globo-cuerpo" cx="80" cy="72" rx="46" ry="54" />

      <!-- Brillo de volumen -->
      <ellipse class="globo-brillo" cx="64" cy="52" rx="10" ry="16" transform="rotate(-25 64 52)" />
    </svg>
  `;
}

function renderizarJuego() {
  if (!contenido) return;

  const letrasArray = palabraNormalizada.split('');

  contenido.innerHTML = `
    <div class="ahorcado-contenedor">
      <header class="ahorcado-cabecera">
        <div>
          <span class="insignia insignia--acento">Tema de estudio</span>
          <h1 style="color: var(--color-primario); margin: var(--espaciado-xs) 0 0; font-size: var(--tamano-xl);">
            ${ui.escapar(tema.titulo)}
          </h1>
        </div>
        <div class="fila" style="gap: var(--espaciado-s);">
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-cambiar-tema">
            Cambiar tema
          </button>
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--texto btn--pequeno">
            Ver tema
          </a>
        </div>
      </header>

      <div class="ahorcado-tablero">
        <!-- Figura del Globo -->
        <div class="ahorcado-figura" id="figura-globo" aria-live="polite">
          ${generarSvgGlobo(errores)}
          <div style="margin-top: var(--espaciado-s); font-size: var(--tamano-s); color: var(--color-texto-suave);">
            ${
              partidaFinalizada
                ? (errores >= 4 ? '¡El globo se desinfló por completo!' : '¡Excelente! Mantuviste el globo inflado.')
                : `Errores permitidos restantes: <strong>${Math.max(0, 3 - errores)}</strong> (termina al 4.°)`
            }
          </div>
        </div>

        <!-- Pista del término -->
        <div class="ahorcado-pista" role="region" aria-label="Pista">
          <div class="ahorcado-pista__etiqueta">Pista</div>
          <p class="ahorcado-pista__texto">
            ${ui.escapar(terminoActual.pista || 'Adivina la palabra del glosario correspondiente a este tema.')}
          </p>
        </div>

        <!-- Casillas de 6 letras -->
        <div class="ahorcado-casillas" role="region" aria-label="Letras de la palabra">
          ${letrasArray
            .map((letra) => {
              const descubierta = letrasAdivinadas.has(letra);
              if (descubierta) {
                return `<div class="ahorcado-casilla ahorcado-casilla--acertada">${ui.escapar(letra)}</div>`;
              }
              if (partidaFinalizada) {
                return `<div class="ahorcado-casilla ahorcado-casilla--no-acertada">${ui.escapar(letra)}</div>`;
              }
              return `<div class="ahorcado-casilla" aria-label="Letra oculta">_</div>`;
            })
            .join('')}
        </div>

        <!-- Contenedor para retroalimentación al terminar -->
        <div id="panel-retro-contenedor" style="width: 100%;"></div>

        <!-- Botón de otra palabra si terminó -->
        ${
          partidaFinalizada
            ? `
          <div class="ahorcado-acciones-fin">
            <button type="button" class="btn btn--primario" id="btn-otra-palabra">
              Otra palabra →
            </button>
          </div>
        `
            : ''
        }

        <!-- Teclado en pantalla A-Z con Ñ -->
        <div class="ahorcado-teclado" role="group" aria-label="Teclado para adivinar">
          ${TECLADO_FILAS.map(
            (fila) => `
            <div class="teclado-fila">
              ${fila
                .map((letra) => {
                  const probada = letrasProbadas.has(letra);
                  const acertada = probada && palabraNormalizada.includes(letra);
                  let clase = 'tecla';
                  if (acertada) clase += ' tecla--acertada';
                  else if (probada) clase += ' tecla--fallada';

                  const deshabilitado = probada || partidaFinalizada;
                  return `
                    <button type="button"
                            class="${clase}"
                            data-letra="${letra}"
                            ${deshabilitado ? 'disabled' : ''}
                            aria-label="Letra ${letra}">
                      ${letra}
                    </button>
                  `;
                })
                .join('')}
            </div>
          `
          ).join('')}
        </div>
      </div>
    </div>
  `;

  vincularEventosTablero();
}

async function finalizarPartida(gano) {
  partidaFinalizada = true;
  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;

  renderizarJuego();

  // 1. Mostrar panel de retroalimentación
  mostrarRetro({
    correcto: gano,
    explicacion: terminoActual.definicion || 'Definición del término.',
    sugerencia: terminoActual.retroalimentacion || '',
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
  });

  // 2. Registrar intento en gamificación
  try {
    await registrarIntento({
      actividad: 'ahorcado',
      temaId: tema.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de ahorcado:', err);
  }
}

function jugarLetra(letraIngresada) {
  if (partidaFinalizada) return;

  const letra = util.normalizar(letraIngresada);
  if (!letra || letra.length !== 1 || letrasProbadas.has(letra)) return;

  letrasProbadas.add(letra);

  if (palabraNormalizada.includes(letra)) {
    letrasAdivinadas.add(letra);
    const gano = palabraNormalizada.split('').every((ch) => letrasAdivinadas.has(ch));
    if (gano) {
      finalizarPartida(true);
      return;
    }
  } else {
    errores++;
    if (errores >= 4) {
      finalizarPartida(false);
      return;
    }
  }

  renderizarJuego();
}

function iniciarNuevaPalabra() {
  let disponibles = terminosValidos.filter((t) => !usadosEnPartida.has(t.id));
  if (disponibles.length === 0) {
    usadosEnPartida.clear();
    disponibles = [...terminosValidos];
  }

  terminoActual = disponibles[Math.floor(Math.random() * disponibles.length)];
  usadosEnPartida.add(terminoActual.id);

  palabraNormalizada = util.normalizar(terminoActual.termino);
  letrasAdivinadas = new Set();
  letrasProbadas = new Set();
  errores = 0;
  partidaFinalizada = false;
  tiempoInicio = Date.now();

  renderizarJuego();
}

function vincularEventosTablero() {
  // Teclas virtuales
  const botonesTeclas = contenido.querySelectorAll('.tecla:not(:disabled)');
  botonesTeclas.forEach((btn) => {
    btn.addEventListener('click', () => {
      const letra = btn.dataset.letra;
      if (letra) jugarLetra(letra);
    });
  });

  // Botón otra palabra
  const btnOtra = contenido.querySelector('#btn-otra-palabra');
  btnOtra?.addEventListener('click', () => {
    iniciarNuevaPalabra();
  });

  // Botón cambiar tema
  const btnCambiar = contenido.querySelector('#btn-cambiar-tema');
  btnCambiar?.addEventListener('click', async () => {
    await seleccionarTemaYArrancar(true);
  });
}

// Escuchar teclado físico
window.addEventListener('keydown', (e) => {
  if (partidaFinalizada || e.ctrlKey || e.altKey || e.metaKey) return;
  const tecla = e.key;
  if (/^[a-zA-ZñÑ]$/.test(tecla)) {
    jugarLetra(tecla);
  }
});

async function seleccionarTemaYArrancar(forzarModal = false) {
  ui.cargando(true);
  try {
    if (forzarModal) {
      // Si fuerza cambio, quitamos el query param visualmente para que abra el selector
      const url = new URL(window.location.href);
      url.searchParams.delete('temaId');
      window.history.replaceState({}, '', url.toString());
    }

    tema = await obtenerTemaActividad();
    if (!tema) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
          <p class="vacio__texto">Debes elegir un tema para poder practicar el Ahorcado.</p>
          <button type="button" class="btn btn--primario" id="btn-reintentar-seleccion">Elegir un tema</button>
        </div>
      `;
      document.getElementById('btn-reintentar-seleccion')?.addEventListener('click', () => {
        seleccionarTemaYArrancar(true);
      });
      return;
    }

    // Cargar glosario del tema
    const glosario = await api.listar('glosario', { temaId: tema.id });
    terminosValidos = (glosario || []).filter(
      (t) => util.normalizar(t.termino).length === 6
    );

    if (terminosValidos.length === 0) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <h2 class="vacio__titulo">Sin términos de 6 letras</h2>
          <p class="vacio__texto">
            El tema "<strong>${ui.escapar(tema.titulo)}</strong>" aún no tiene términos de exactamente 6 letras en su glosario para este juego.
          </p>
          <div class="fila" style="gap: var(--espaciado-m); margin-top: var(--espaciado-m);">
            <button type="button" class="btn btn--secundario" id="btn-cambiar-tema-vacio">Elegir otro tema</button>
            <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">Ver tema</a>
          </div>
        </div>
      `;
      document.getElementById('btn-cambiar-tema-vacio')?.addEventListener('click', () => {
        seleccionarTemaYArrancar(true);
      });
      return;
    }

    usadosEnPartida.clear();
    iniciarNuevaPalabra();
  } catch (err) {
    ui.aviso(err.message || 'Error al inicializar la actividad', 'error');
  } finally {
    ui.cargando(false);
  }
}

seleccionarTemaYArrancar();

