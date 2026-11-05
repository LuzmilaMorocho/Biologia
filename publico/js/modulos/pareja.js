// Módulo del juego Encuentra la Pareja (P04.4)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Encuentra la pareja', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');

let tema = null;
let terminosGlosario = [];
let dificultadDeseada = 6; // 6, 8 o 10 parejas

let cartas = [];
let cartasVolteadas = [];
let parejasEncontradas = new Set();
let intentos = 0;
let tiempoInicio = 0;
let intervaloTiempo = null;
let bloqueado = false;
let segundosTranscurridos = 0;

function formatearTiempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

function iniciarCronometro() {
  detenerCronometro();
  segundosTranscurridos = 0;
  tiempoInicio = Date.now();
  intervaloTiempo = setInterval(() => {
    segundosTranscurridos = Math.floor((Date.now() - tiempoInicio) / 1000);
    const elTiempo = document.getElementById('tiempo-transcurrido');
    if (elTiempo) {
      elTiempo.textContent = formatearTiempo(segundosTranscurridos);
    }
  }, 1000);
}

function detenerCronometro() {
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }
}

function iniciarPartida() {
  detenerCronometro();

  const totalDisponibles = terminosGlosario.length;
  const numParejas = Math.min(dificultadDeseada, totalDisponibles);

  // Elegir términos al azar sin repetir
  const seleccionados = util.barajar(terminosGlosario).slice(0, numParejas);

  // Generar cartas (término y definición)
  const baraja = [];
  seleccionados.forEach((t, i) => {
    baraja.push({
      indice: 0,
      terminoId: t.id,
      tipo: 'termino',
      texto: t.termino,
      terminoObj: t
    });
    baraja.push({
      indice: 0,
      terminoId: t.id,
      tipo: 'definicion',
      texto: t.definicion,
      terminoObj: t
    });
  });

  cartas = util.barajar(baraja).map((c, i) => ({ ...c, indice: i }));
  cartasVolteadas = [];
  parejasEncontradas = new Set();
  intentos = 0;
  bloqueado = false;

  renderizarTablero(numParejas);
  iniciarCronometro();
}

function renderizarTablero(numParejas) {
  if (!contenido) return;

  contenido.innerHTML = `
    <div class="pareja-contenedor">
      <header class="pareja-cabecera">
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

      <!-- Marcador y controles -->
      <div class="pareja-marcador" role="region" aria-label="Marcador del juego">
        <div class="pareja-estadistica">
          <span class="pareja-estadistica__etiqueta">Parejas</span>
          <span class="pareja-estadistica__valor" id="marcador-parejas">
            ${parejasEncontradas.size} / ${numParejas}
          </span>
        </div>

        <div class="pareja-estadistica">
          <span class="pareja-estadistica__etiqueta">Intentos</span>
          <span class="pareja-estadistica__valor" id="marcador-intentos">
            ${intentos}
          </span>
        </div>

        <div class="pareja-estadistica">
          <span class="pareja-estadistica__etiqueta">Tiempo</span>
          <span class="pareja-estadistica__valor" id="tiempo-transcurrido">
            00:00
          </span>
        </div>

        <div class="pareja-dificultades">
          <label for="sel-dificultad" style="font-size: var(--tamano-xs); color: var(--color-texto-suave); font-weight: var(--peso-seminegrita); margin-right: var(--espaciado-xs);">
            Dificultad:
          </label>
          <select id="sel-dificultad" class="btn btn--secundario btn--pequeno" style="padding: var(--espaciado-xs) var(--espaciado-s);">
            <option value="6" ${dificultadDeseada === 6 ? 'selected' : ''}>6 parejas</option>
            <option value="8" ${dificultadDeseada === 8 ? 'selected' : ''}>8 parejas</option>
            <option value="10" ${dificultadDeseada === 10 ? 'selected' : ''}>10 parejas</option>
          </select>
        </div>
      </div>

      <!-- Cuadrícula de cartas -->
      <div class="pareja-grid" id="cuadricula-cartas" role="region" aria-label="Tablero de cartas">
        ${cartas
          .map((carta) => {
            const esAcertada = parejasEncontradas.has(carta.terminoId);
            const esVolteada = cartasVolteadas.includes(carta.indice) || esAcertada;

            let claseCarta = 'carta-btn';
            if (esAcertada) claseCarta += ' carta--acertada';
            else if (esVolteada) claseCarta += ' carta--volteada';

            const esTermino = carta.tipo === 'termino';
            const etiquetaTipo = esTermino ? 'Término' : 'Definición';
            const claseTexto = esTermino ? 'carta-texto carta-texto--termino' : 'carta-texto';
            const claseBadge = esTermino ? 'carta-badge carta-badge--termino' : 'carta-badge carta-badge--definicion';

            return `
            <button type="button"
                    class="${claseCarta}"
                    data-indice="${carta.indice}"
                    aria-label="${esVolteada ? `${etiquetaTipo}: ${ui.escapar(carta.texto)}` : 'Carta boca abajo'}"
                    ${esAcertada ? 'disabled' : ''}>
              <div class="carta-inner">
                <div class="carta-cara carta-cara--dorso" aria-hidden="true"></div>
                <div class="carta-cara carta-cara--frente">
                  <span class="${claseBadge}">${etiquetaTipo}</span>
                  <div class="${claseTexto}">${ui.escapar(carta.texto)}</div>
                </div>
              </div>
            </button>
          `;
          })
          .join('')}
      </div>

      <!-- Panel de retroalimentación inmediata al acertar -->
      <div id="retroalimentacion" style="width: 100%;"></div>
    </div>
  `;

  vincularEventos(numParejas);
}

function vincularEventos(numParejas) {
  // Cambio de dificultad
  const selDif = document.getElementById('sel-dificultad');
  selDif?.addEventListener('change', () => {
    dificultadDeseada = parseInt(selDif.value, 10) || 6;
    iniciarPartida();
  });

  // Botón cambiar tema
  const btnCambiarTema = document.getElementById('btn-cambiar-tema');
  btnCambiarTema?.addEventListener('click', async () => {
    await seleccionarTemaYArrancar(true);
  });

  // Clic en cartas
  const botonesCartas = contenido.querySelectorAll('.carta-btn:not([disabled])');
  botonesCartas.forEach((btn) => {
    btn.addEventListener('click', () => {
      const indice = parseInt(btn.dataset.indice, 10);
      manejarGiroCarta(indice, numParejas);
    });
  });
}

async function manejarGiroCarta(indice, numParejas) {
  if (bloqueado) return;
  const carta = cartas[indice];
  if (!carta || parejasEncontradas.has(carta.terminoId) || cartasVolteadas.includes(indice)) {
    return;
  }

  // Voltear carta
  cartasVolteadas.push(indice);
  actualizarEstadoCartas();

  if (cartasVolteadas.length === 2) {
    intentos++;
    bloqueado = true;

    const elIntentos = document.getElementById('marcador-intentos');
    if (elIntentos) elIntentos.textContent = String(intentos);

    const [idx1, idx2] = cartasVolteadas;
    const c1 = cartas[idx1];
    const c2 = cartas[idx2];

    if (c1.terminoId === c2.terminoId) {
      // ¡Pareja encontrada!
      parejasEncontradas.add(c1.terminoId);
      actualizarEstadoCartas();

      const elParejas = document.getElementById('marcador-parejas');
      if (elParejas) elParejas.textContent = `${parejasEncontradas.size} / ${numParejas}`;

      // Mostrar retroalimentación inmediata con la definición
      mostrarRetro({
        correcto: true,
        explicacion: `${c1.terminoObj.termino}: ${c1.terminoObj.definicion}`,
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
      });

      cartasVolteadas = [];
      bloqueado = false;

      // Verificar si completó todas las parejas
      if (parejasEncontradas.size === numParejas) {
        await finalizarJuego(numParejas);
      }
    } else {
      // No coinciden -> esperar 1.2 segundos y voltear
      setTimeout(() => {
        cartasVolteadas = [];
        actualizarEstadoCartas();
        bloqueado = false;
      }, 1200);
    }
  }
}

function actualizarEstadoCartas() {
  const botonesCartas = contenido.querySelectorAll('.carta-btn');
  botonesCartas.forEach((btn) => {
    const idx = parseInt(btn.dataset.indice, 10);
    const carta = cartas[idx];
    if (!carta) return;

    const esAcertada = parejasEncontradas.has(carta.terminoId);
    const esVolteada = cartasVolteadas.includes(idx) || esAcertada;

    btn.classList.toggle('carta--volteada', esVolteada && !esAcertada);
    btn.classList.toggle('carta--acertada', esAcertada);

    if (esAcertada) {
      btn.setAttribute('disabled', 'true');
    }

    const etiquetaTipo = carta.tipo === 'termino' ? 'Término' : 'Definición';
    btn.setAttribute(
      'aria-label',
      esVolteada ? `${etiquetaTipo}: ${carta.texto}` : 'Carta boca abajo'
    );
  });
}

async function finalizarJuego(numParejas) {
  detenerCronometro();
  const duracionSeg = Math.max(1, segundosTranscurridos);
  const errores = Math.max(0, intentos - numParejas);
  const puntaje = Math.max(0, 10 - errores);

  // 1. Registrar intento en gamificación
  try {
    await registrarIntento({
      actividad: 'pareja',
      temaId: tema.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de pareja:', err);
  }

  // 2. Mostrar modal de resumen
  const accion = await mostrarResumen({
    titulo: '¡Completaste todas las parejas!',
    aciertos: numParejas,
    errores,
    recomendaciones:
      errores === 0
        ? '¡Excelente! Encontraste todas las parejas sin cometer errores.'
        : `Completaste el juego en ${intentos} intentos. ¡Sigue practicando para mejorar tu memoria!`,
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
  });

  if (accion === 'repetir') {
    iniciarPartida();
  }
}

async function seleccionarTemaYArrancar(forzarModal = false) {
  ui.cargando(true);
  try {
    if (forzarModal) {
      const url = new URL(window.location.href);
      url.searchParams.delete('temaId');
      window.history.replaceState({}, '', url.toString());
    }

    tema = await obtenerTemaActividad();
    if (!tema) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
          <p class="vacio__texto">Debes elegir un tema para poder practicar Encuentra la pareja.</p>
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
    terminosGlosario = (glosario || []).filter((t) => t.termino && t.definicion);

    if (terminosGlosario.length < 4) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <h2 class="vacio__titulo">Glosario insuficiente</h2>
          <p class="vacio__texto">
            El tema "<strong>${ui.escapar(tema.titulo)}</strong>" cuenta con ${terminosGlosario.length} términos. Se necesitan al menos 4 para jugar a Encuentra la pareja.
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

    iniciarPartida();
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar Encuentra la pareja', 'error');
  } finally {
    ui.cargando(false);
  }
}

seleccionarTemaYArrancar();

