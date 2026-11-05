// Módulo del juego educativo Sopa de Letras (P05.1)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { usuarioActual } from '../nucleo/sesion.js';

let contenido = null;
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  await montarPlantilla({ titulo: 'Sopa de letras', roles: ['estudiante', 'docente', 'admin'] });
  contenido = document.getElementById('contenido');
}

const LETRAS_ESPANOL = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

// Configuraciones por dificultad
const CONFIG_DIFICULTAD = {
  facil: {
    nombre: 'Fácil',
    tamano: 10,
    maxPalabras: 8,
    direcciones: [
      [0, 1], // horizontal
      [1, 0]  // vertical
    ]
  },
  media: {
    nombre: 'Media',
    tamano: 12,
    maxPalabras: 10,
    direcciones: [
      [0, 1],  // horizontal
      [1, 0],  // vertical
      [1, 1],  // diagonal abajo-derecha
      [1, -1]  // diagonal abajo-izquierda
    ]
  },
  dificil: {
    nombre: 'Difícil',
    tamano: 15,
    maxPalabras: 12,
    direcciones: [
      [0, 1],   // horizontal
      [0, -1],  // horizontal invertida
      [1, 0],   // vertical
      [-1, 0],  // vertical invertida
      [1, 1],   // diagonal abajo-derecha
      [-1, -1], // diagonal arriba-izquierda
      [1, -1],  // diagonal abajo-izquierda
      [-1, 1]   // diagonal arriba-derecha
    ]
  }
};

// Función pura exportada que genera la sopa de letras
export function generarSopa(palabras, tamano, direcciones) {
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(''));
  const ubicaciones = [];

  // Ordenar de la más larga a la más corta sin mutar el original
  const ordenadas = [...palabras].sort((a, b) => b.length - a.length);

  for (const palabra of ordenadas) {
    const longitud = palabra.length;
    if (longitud > tamano) continue;

    let colocada = false;

    for (let intento = 0; intento < 200; intento++) {
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const [df, dc] = dir;

      const minF = df < 0 ? longitud - 1 : 0;
      const maxF = df > 0 ? tamano - longitud : tamano - 1;
      const minC = dc < 0 ? longitud - 1 : 0;
      const maxC = dc > 0 ? tamano - longitud : tamano - 1;

      if (minF > maxF || minC > maxC) continue;

      const f0 = Math.floor(Math.random() * (maxF - minF + 1)) + minF;
      const c0 = Math.floor(Math.random() * (maxC - minC + 1)) + minC;

      let esValido = true;
      const celdas = [];

      for (let i = 0; i < longitud; i++) {
        const f = f0 + i * df;
        const c = c0 + i * dc;
        const actual = grilla[f][c];
        if (actual !== '' && actual !== palabra[i]) {
          esValido = false;
          break;
        }
        celdas.push({ fila: f, col: c });
      }

      if (esValido) {
        for (let i = 0; i < longitud; i++) {
          const { fila, col } = celdas[i];
          grilla[fila][col] = palabra[i];
        }

        ubicaciones.push({
          palabra,
          filaInicio: f0,
          colInicio: c0,
          filaFin: f0 + (longitud - 1) * df,
          colFin: c0 + (longitud - 1) * dc,
          celdas
        });

        colocada = true;
        break;
      }
    }
  }

  // Rellenar celdas vacías con letras aleatorias A-Z y Ñ
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[f][c] === '') {
        grilla[f][c] = LETRAS_ESPANOL[Math.floor(Math.random() * LETRAS_ESPANOL.length)];
      }
    }
  }

  return { grilla, ubicaciones };
}

let tema = null;
let glosarioTema = [];
let dificultadActual = 'facil';
let palabrasIA = null;
let generandoIA = false;
const utilizadasPorTema = new Map();

let grillaActual = [];
let ubicacionesActuales = [];
let mapaTerminosPorPalabra = new Map();
let palabrasEncontradas = new Set();
let celdasEncontradas = new Set(); // clave: "f,c"

let tiempoInicio = 0;
let segundosTranscurridos = 0;
let intervaloTiempo = null;
let partidaFinalizada = false;

// Variables de interacción Pointer Events
let punteroActivo = false;
let celdaInicio = null;
let celdasSeleccionadas = [];

function formatearTiempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

function iniciarCronometro(reiniciar = true) {
  detenerCronometro();
  if (reiniciar) {
    segundosTranscurridos = 0;
    tiempoInicio = Date.now();
  }
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
  partidaFinalizada = false;
  palabrasEncontradas.clear();
  celdasEncontradas.clear();
  grillaActual = [];
  ubicacionesActuales = [];
  punteroActivo = false;
  celdaInicio = null;
  celdasSeleccionadas = [];

  const config = CONFIG_DIFICULTAD[dificultadActual] || CONFIG_DIFICULTAD.facil;

  // Filtrar términos de una sola palabra con longitud válida: 3 <= len <= config.tamano
  const candidatos = (palabrasIA || glosarioTema)
    .map((t) => ({
      ...t,
      palabraNorm: util.normalizar(t.termino).replace(/\s+/g, '')
    }))
    .filter((t) => {
      // Debe ser una sola palabra y tener entre 3 y tamano letras
      const esUnaSola = !t.termino.trim().includes(' ');
      const len = t.palabraNorm.length;
      return esUnaSola && /^[A-ZÑ]+$/.test(t.palabraNorm) && len >= 3 && len <= config.tamano;
    });

  if (candidatos.length === 0) {
    mostrarAvisoSinPalabras();
    return;
  }

  // Barajar candidatos y tomar hasta config.maxPalabras
  const seleccionados = util.barajar(candidatos).slice(0, config.maxPalabras);
  const listaPalabras = seleccionados.map((t) => t.palabraNorm);

  mapaTerminosPorPalabra.clear();
  seleccionados.forEach((t) => {
    mapaTerminosPorPalabra.set(t.palabraNorm, t);
  });

  const resultado = generarSopa(listaPalabras, config.tamano, config.direcciones);
  grillaActual = resultado.grilla;
  ubicacionesActuales = resultado.ubicaciones;

  const utilizadas = utilizadasPorTema.get(tema.id) || new Set();
  ubicacionesActuales.forEach(({ palabra }) => utilizadas.add(palabra));
  while (utilizadas.size > 200) utilizadas.delete(utilizadas.values().next().value);
  utilizadasPorTema.set(tema.id, utilizadas);

  renderizarJuego();
  iniciarCronometro();
}

function controlesIA() {
  if (usuarioActual()?.rol !== 'estudiante') return '';
  return `<button type="button" class="btn btn--primario btn--pequeno" id="btn-generar-ia" aria-describedby="sopa-estado-ia">Generar con IA</button>`;
}

function estadoIA() {
  if (usuarioActual()?.rol !== 'estudiante') return '';
  return `<p id="sopa-estado-ia" class="sopa-estado-ia" role="status" aria-live="polite">${palabrasIA
    ? 'Partida con palabras generadas por IA a partir del contenido de este tema.'
    : 'Genera palabras del tema y sus subtemas para una nueva partida.'}</p>`;
}

function marcarGeneracion(ocupado) {
  for (const id of ['btn-generar-ia', 'btn-cambiar-tema', 'btn-cambiar-tema-vacio', 'sel-dificultad', 'btn-rendirse']) {
    const control = document.getElementById(id);
    if (control) control.disabled = ocupado;
  }
  const boton = document.getElementById('btn-generar-ia');
  if (boton) {
    boton.textContent = ocupado ? 'Generando palabras…' : 'Generar con IA';
    boton.setAttribute('aria-busy', String(ocupado));
  }
}

async function generarConIA() {
  if (generandoIA || usuarioActual()?.rol !== 'estudiante' || !tema) return;
  generandoIA = true;
  let pausaInicio = null;
  let reiniciada = false;
  try {
    if (!partidaFinalizada && palabrasEncontradas.size > 0 &&
        !await ui.confirmar('Se iniciará una nueva sopa de letras y se reiniciará esta partida. ¿Continuar?')) return;
    pausaInicio = Date.now();
    detenerCronometro();
    punteroActivo = false;
    celdasSeleccionadas = [];
    actualizarResaltado();
    marcarGeneracion(true);
    const estado = document.getElementById('sopa-estado-ia');
    if (estado) estado.textContent = 'Buscando palabras nuevas en el contenido del tema…';
    ui.cargando(true);
    const nuevas = await api.ia('sopa-letras', {
      temaId: tema.id, dificultad: dificultadActual,
      excluir: [...(utilizadasPorTema.get(tema.id) || [])]
    });
    if (!Array.isArray(nuevas) || nuevas.length < 3) throw new Error('No se recibieron suficientes palabras. Inténtalo nuevamente.');
    palabrasIA = nuevas;
    iniciarPartida();
    reiniciada = true;
    ui.aviso('¡Lista tu nueva sopa de letras con palabras del tema!', 'exito');
  } catch (error) {
    const mensaje = error.message || 'No se pudieron generar palabras. Inténtalo nuevamente.';
    const estado = document.getElementById('sopa-estado-ia');
    if (estado) estado.textContent = `${mensaje} Tu partida se conserva.`;
    ui.aviso(mensaje, 'error');
  } finally {
    generandoIA = false;
    if (pausaInicio !== null) {
      if (!reiniciada && !partidaFinalizada && ubicacionesActuales.length) {
        tiempoInicio += Date.now() - pausaInicio;
        iniciarCronometro(false);
      }
      ui.cargando(false);
    }
    marcarGeneracion(false);
    document.getElementById('btn-generar-ia')?.focus();
  }
}

function mostrarAvisoSinPalabras() {
  if (!contenido) return;
  contenido.innerHTML = `
    <div class="tarjeta vacio">
      <h2 class="vacio__titulo">Términos insuficientes</h2>
      <p class="vacio__texto">
        El tema "<strong>${ui.escapar(tema.titulo)}</strong>" no cuenta con términos de una sola palabra de entre 3 y ${CONFIG_DIFICULTAD[dificultadActual].tamano} letras.
      </p>
      <div class="fila" style="gap: var(--espaciado-m); margin-top: var(--espaciado-m);">
        ${controlesIA()}
        <button type="button" class="btn btn--secundario" id="btn-cambiar-tema-vacio">Elegir otro tema</button>
        <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">Ver tema</a>
      </div>
      ${estadoIA()}
    </div>
  `;
  document.getElementById('btn-cambiar-tema-vacio')?.addEventListener('click', () => {
    seleccionarTemaYArrancar(true);
  });
  document.getElementById('btn-generar-ia')?.addEventListener('click', generarConIA);
}

function renderizarJuego() {
  if (!contenido) return;

  const config = CONFIG_DIFICULTAD[dificultadActual];
  const tamano = config.tamano;

  contenido.innerHTML = `
    <div class="sopa-contenedor">
      <header class="sopa-cabecera">
        <div>
          <span class="insignia insignia--acento">Tema de estudio</span>
          <h1 style="color: var(--color-primario); margin: var(--espaciado-xs) 0 0; font-size: var(--tamano-xl);">
            ${ui.escapar(tema.titulo)}
          </h1>
        </div>
        <div class="fila" style="gap: var(--espaciado-s);">
          ${controlesIA()}
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-cambiar-tema">
            Cambiar tema
          </button>
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--texto btn--pequeno">
            Ver tema
          </a>
        </div>
      </header>
      ${estadoIA()}

      <!-- Marcador -->
      <div class="sopa-marcador" role="region" aria-label="Marcador del juego">
        <div class="sopa-estadistica">
          <span class="sopa-estadistica__etiqueta">Palabras</span>
          <span class="sopa-estadistica__valor" id="marcador-palabras">
            ${palabrasEncontradas.size} / ${ubicacionesActuales.length}
          </span>
        </div>

        <div class="sopa-estadistica">
          <span class="sopa-estadistica__etiqueta">Tiempo</span>
          <span class="sopa-estadistica__valor" id="tiempo-transcurrido">
            00:00
          </span>
        </div>

        <div class="fila" style="gap: var(--espaciado-s); align-items: center;">
          <label for="sel-dificultad" style="font-size: var(--tamano-xs); color: var(--color-texto-suave); font-weight: var(--peso-seminegrita);">
            Dificultad:
          </label>
          <select id="sel-dificultad" class="btn btn--secundario btn--pequeno" style="padding: var(--espaciado-xs) var(--espaciado-s);">
            <option value="facil" ${dificultadActual === 'facil' ? 'selected' : ''}>Fácil (10×10)</option>
            <option value="media" ${dificultadActual === 'media' ? 'selected' : ''}>Media (12×12)</option>
            <option value="dificil" ${dificultadActual === 'dificil' ? 'selected' : ''}>Difícil (15×15)</option>
          </select>

          <button type="button" class="btn btn--peligro btn--pequeno" id="btn-rendirse">
            Rendirse
          </button>
        </div>
      </div>

      <div class="sopa-cuerpo">
        <!-- Grilla de letras -->
        <div class="sopa-grilla-envoltorio">
          <div class="sopa-grilla"
               id="tablero-sopa"
               style="grid-template-columns: repeat(${tamano}, 1fr);"
               role="grid"
               aria-label="Sopa de letras de ${tamano} por ${tamano}">
            ${grillaActual
              .map((fila, f) =>
                fila
                  .map((letra, c) => {
                    const clave = `${f},${c}`;
                    const esEncontrada = celdasEncontradas.has(clave);
                    let clase = 'sopa-celda';
                    if (esEncontrada) clase += ' sopa-celda--encontrada';

                    return `
                      <div class="${clase}"
                           data-fila="${f}"
                           data-col="${c}"
                           role="gridcell"
                           aria-label="Fila ${f + 1}, Columna ${c + 1}: ${letra}">
                        ${letra}
                      </div>
                    `;
                  })
                  .join('')
              )
              .join('')}
          </div>
        </div>

        <!-- Panel lateral con lista de palabras -->
        <aside class="sopa-palabras-panel" aria-label="Palabras a encontrar">
          <h2 style="font-size: var(--tamano-m); color: var(--color-primario); margin: 0;">
            Palabras a encontrar
          </h2>
          <div class="sopa-palabras-lista" id="lista-palabras">
            ${ubicacionesActuales
              .map((u) => {
                const tachada = palabrasEncontradas.has(u.palabra);
                const terminoObj = mapaTerminosPorPalabra.get(u.palabra);
                const etiqueta = terminoObj ? terminoObj.termino : u.palabra;
                return `
                <span class="palabra-item ${tachada ? 'palabra-item--tachada' : ''}" data-palabra="${u.palabra}">
                  <span>${ui.escapar(etiqueta)}</span>
                  ${tachada ? '<span aria-hidden="true">✓</span>' : ''}
                </span>
              `;
              })
              .join('')}
          </div>
        </aside>
      </div>

      <!-- Panel de retroalimentación inmediata -->
      <div id="retroalimentacion" style="width: 100%;"></div>
    </div>
  `;

  vincularEventosInteraccion();
}

function vincularEventosInteraccion() {
  document.getElementById('btn-generar-ia')?.addEventListener('click', generarConIA);
  const selDif = document.getElementById('sel-dificultad');
  selDif?.addEventListener('change', () => {
    if (generandoIA) return;
    dificultadActual = selDif.value;
    iniciarPartida();
  });

  const btnRendirse = document.getElementById('btn-rendirse');
  btnRendirse?.addEventListener('click', () => {
    rendirse();
  });

  const btnCambiarTema = document.getElementById('btn-cambiar-tema');
  btnCambiarTema?.addEventListener('click', async () => {
    await seleccionarTemaYArrancar(true);
  });

  const grillaEl = document.getElementById('tablero-sopa');
  if (!grillaEl) return;

  // Interacción Pointer Events para mouse y táctil
  grillaEl.addEventListener('pointerdown', (e) => {
    if (partidaFinalizada || generandoIA) return;
    const celda = e.target.closest('.sopa-celda');
    if (!celda) return;

    punteroActivo = true;
    celdaInicio = {
      f: parseInt(celda.dataset.fila, 10),
      c: parseInt(celda.dataset.col, 10)
    };
    celdasSeleccionadas = [{ ...celdaInicio }];
    actualizarResaltado();

    try {
      grillaEl.setPointerCapture(e.pointerId);
    } catch {}
  });

  grillaEl.addEventListener('pointermove', (e) => {
    if (!punteroActivo || !celdaInicio || partidaFinalizada || generandoIA) return;

    const elemento = document.elementFromPoint(e.clientX, e.clientY);
    const celda = elemento?.closest('.sopa-celda');
    if (!celda) return;

    const f1 = parseInt(celda.dataset.fila, 10);
    const c1 = parseInt(celda.dataset.col, 10);

    const f0 = celdaInicio.f;
    const c0 = celdaInicio.c;

    const df = f1 - f0;
    const dc = c1 - c0;

    const esHorizontal = df === 0 && dc !== 0;
    const esVertical = dc === 0 && df !== 0;
    const esDiagonal = Math.abs(df) === Math.abs(dc) && df !== 0;
    const esMismoPunto = df === 0 && dc === 0;

    if (esHorizontal || esVertical || esDiagonal || esMismoPunto) {
      const pasos = Math.max(Math.abs(df), Math.abs(dc));
      const stepF = df === 0 ? 0 : Math.sign(df);
      const stepC = dc === 0 ? 0 : Math.sign(dc);

      const nuevaSeleccion = [];
      for (let i = 0; i <= pasos; i++) {
        nuevaSeleccion.push({
          f: f0 + i * stepF,
          c: c0 + i * stepC
        });
      }
      celdasSeleccionadas = nuevaSeleccion;
      actualizarResaltado();
    }
  });

  const finalizarSeleccion = (e) => {
    if (!punteroActivo) return;
    punteroActivo = false;

    try {
      grillaEl.releasePointerCapture(e.pointerId);
    } catch {}

    validarSeleccion();
    celdasSeleccionadas = [];
    actualizarResaltado();
  };

  grillaEl.addEventListener('pointerup', finalizarSeleccion);
  grillaEl.addEventListener('pointercancel', finalizarSeleccion);
}

function actualizarResaltado() {
  const celdasEl = contenido.querySelectorAll('.sopa-celda');
  const mapaSeleccion = new Set(celdasSeleccionadas.map((c) => `${c.f},${c.c}`));

  celdasEl.forEach((el) => {
    const clave = `${el.dataset.fila},${el.dataset.col}`;
    el.classList.toggle('sopa-celda--resaltada', mapaSeleccion.has(clave));
  });
}

function validarSeleccion() {
  if (celdasSeleccionadas.length < 2) return;

  const palabraSeleccionada = celdasSeleccionadas
    .map((c) => grillaActual[c.f][c.c])
    .join('');
  const palabraInvertida = palabraSeleccionada.split('').reverse().join('');

  const ubicacion = ubicacionesActuales.find(
    (u) =>
      !palabrasEncontradas.has(u.palabra) &&
      (u.palabra === palabraSeleccionada || u.palabra === palabraInvertida)
  );

  if (ubicacion) {
    // Palabra acertada
    palabrasEncontradas.add(ubicacion.palabra);

    // Marcar celdas como encontradas permanentemente
    ubicacion.celdas.forEach(({ fila, col }) => {
      celdasEncontradas.add(`${fila},${col}`);
      const el = contenido.querySelector(`.sopa-celda[data-fila="${fila}"][data-col="${col}"]`);
      if (el) el.classList.add('sopa-celda--encontrada');
    });

    // Tachar palabra en la lista
    const itemEl = contenido.querySelector(`.palabra-item[data-palabra="${ubicacion.palabra}"]`);
    if (itemEl) {
      itemEl.classList.add('palabra-item--tachada');
      itemEl.innerHTML += ' <span aria-hidden="true">✓</span>';
    }

    // Actualizar marcador
    const elMarcador = document.getElementById('marcador-palabras');
    if (elMarcador) {
      elMarcador.textContent = `${palabrasEncontradas.size} / ${ubicacionesActuales.length}`;
    }

    // Mostrar retroalimentación con la definición del término
    const terminoObj = mapaTerminosPorPalabra.get(ubicacion.palabra);
    if (terminoObj) {
      mostrarRetro({
        correcto: true,
        explicacion: `${terminoObj.termino}: ${terminoObj.definicion}`,
        sugerencia: terminoObj.retroalimentacion || '',
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
      });
    }

    // Comprobar si se completó la sopa de letras
    if (palabrasEncontradas.size === ubicacionesActuales.length) {
      finalizarPartida(true);
    }
  }
}

function rendirse() {
  if (partidaFinalizada || generandoIA) return;

  // Revelar palabras restantes
  ubicacionesActuales.forEach((u) => {
    if (!palabrasEncontradas.has(u.palabra)) {
      u.celdas.forEach(({ fila, col }) => {
        const el = contenido.querySelector(`.sopa-celda[data-fila="${fila}"][data-col="${col}"]`);
        if (el && !el.classList.contains('sopa-celda--encontrada')) {
          el.classList.add('sopa-celda--revelada');
        }
      });
      const itemEl = contenido.querySelector(`.palabra-item[data-palabra="${u.palabra}"]`);
      if (itemEl) {
        itemEl.classList.add('palabra-item--tachada');
      }
    }
  });

  finalizarPartida(false);
}

async function finalizarPartida(gano) {
  partidaFinalizada = true;
  detenerCronometro();

  const duracionSeg = Math.max(1, segundosTranscurridos);
  const total = ubicacionesActuales.length;
  const encontradas = palabrasEncontradas.size;
  const errores = total - encontradas;
  const puntaje = encontradas;

  // 1. Registrar intento en gamificación
  try {
    await registrarIntento({
      actividad: 'sopa-letras',
      temaId: tema.id,
      puntaje,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar intento de sopa de letras:', err);
  }

  // 2. Mostrar resumen
  const accion = await mostrarResumen({
    titulo: gano ? '¡Felicidades! Completaste la sopa de letras' : 'Partida finalizada',
    aciertos: encontradas,
    errores,
    recomendaciones:
      errores === 0
        ? '¡Excelente agudeza visual! Encontraste todas las palabras sin rendirte.'
        : `Encontraste ${encontradas} de ${total} palabras. ¡Sigue entrenando tu concentración!`,
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
  });

  if (accion === 'repetir') {
    iniciarPartida();
  }
}

async function seleccionarTemaYArrancar(forzarModal = false) {
  if (generandoIA) return;
  ui.cargando(true);
  try {
    if (forzarModal) {
      const url = new URL(window.location.href);
      url.searchParams.delete('temaId');
      window.history.replaceState({}, '', url.toString());
    }

    const seleccionado = await obtenerTemaActividad();
    if (!seleccionado) {
      if (tema) return;
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
          <p class="vacio__texto">Debes elegir un tema para jugar a la Sopa de letras.</p>
          <button type="button" class="btn btn--primario" id="btn-reintentar-seleccion">Elegir un tema</button>
        </div>
      `;
      document.getElementById('btn-reintentar-seleccion')?.addEventListener('click', () => {
        seleccionarTemaYArrancar(true);
      });
      return;
    }

    const glosario = await api.listar('glosario', { temaId: seleccionado.id });
    tema = seleccionado;
    glosarioTema = (glosario || []).filter((t) => t.termino && t.definicion && t.estado === 'aprobado');
    palabrasIA = null;
    ubicacionesActuales = [];

    iniciarPartida();
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar la Sopa de letras', 'error');
  } finally {
    ui.cargando(false);
  }
}

if (typeof window !== 'undefined') {
  await seleccionarTemaYArrancar();
}
