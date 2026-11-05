// Módulo del panel de progreso del estudiante (P06.2)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Mi progreso', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');

// Nombres legibles para las actividades formativas
const NOMBRES_ACTIVIDADES = {
  ahorcado: 'Ahorcado',
  pareja: 'Encuentra la pareja',
  'sopa-letras': 'Sopa de letras',
  crucigrama: 'Crucigrama',
  quiz: 'Quiz interactivo',
  simulacion: 'Simulación',
  foro: 'Foros'
};

// Carga asíncrona de Chart.js desde cdnjs si no está presente en la página
async function asegurarChartJs() {
  if (window.Chart) return window.Chart;

  return new Promise((resolve, reject) => {
    const scriptExistente = document.querySelector('script[src*="chart.js"]');
    if (scriptExistente) {
      scriptExistente.addEventListener('load', () => resolve(window.Chart));
      scriptExistente.addEventListener('error', () => reject(new Error('Error al cargar Chart.js')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error('No se pudo cargar Chart.js desde cdnjs'));
    document.head.appendChild(script);
  });
}

function obtenerColoresTema() {
  const estilos = getComputedStyle(document.documentElement);
  return {
    primario: estilos.getPropertyValue('--color-primario').trim() || '#002e45',
    secundario: estilos.getPropertyValue('--color-secundario').trim() || '#264763',
    acento: estilos.getPropertyValue('--color-acento').trim() || '#ff6900',
    exito: estilos.getPropertyValue('--color-exito').trim() || '#1d6540',
    texto: estilos.getPropertyValue('--color-texto').trim() || '#182d3e',
    textoSuave: estilos.getPropertyValue('--color-texto-suave').trim() || '#627586',
    borde: estilos.getPropertyValue('--color-borde').trim() || '#dfe7ec',
    superficie: estilos.getPropertyValue('--color-superficie').trim() || '#ffffff'
  };
}

function renderizarGraficos(resumen, ChartClass) {
  const colores = obtenerColoresTema();

  // 1. Gráfico de evolución temporal (línea)
  const canvasEvolucion = document.getElementById('chart-evolucion');
  const contenedorEvolucion = document.getElementById('contenedor-chart-evolucion');

  if (canvasEvolucion) {
    const datosEvolucion = resumen.evolucion || [];
    if (datosEvolucion.length === 0) {
      if (contenedorEvolucion) {
        contenedorEvolucion.innerHTML = `
          <div class="tarjeta vacio" style="padding: var(--espaciado-l); min-height: 200px; justify-content: center;">
            <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">
              Aún no registras suficientes actividades para trazar tu evolución semanal.
            </p>
          </div>
        `;
      }
    } else {
      new ChartClass(canvasEvolucion, {
        type: 'line',
        data: {
          labels: datosEvolucion.map((d) => `Sem. ${d.semana.slice(5)}`),
          datasets: [
            {
              label: 'Promedio (/10)',
              data: datosEvolucion.map((d) => d.promedio),
              borderColor: colores.acento,
              backgroundColor: 'rgba(255, 105, 0, 0.12)',
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: colores.primario,
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Promedio: ${ctx.parsed.y} / 10`
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 10,
              ticks: { stepSize: 2, color: colores.textoSuave },
              grid: { color: colores.borde }
            },
            x: {
              ticks: { color: colores.textoSuave },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  // 2. Gráfico de promedio por actividad (barras)
  const canvasActividad = document.getElementById('chart-actividad');
  const contenedorActividad = document.getElementById('contenedor-chart-actividad');

  if (canvasActividad) {
    const datosActividad = resumen.porActividad || [];
    if (datosActividad.length === 0) {
      if (contenedorActividad) {
        contenedorActividad.innerHTML = `
          <div class="tarjeta vacio" style="padding: var(--espaciado-l); min-height: 200px; justify-content: center;">
            <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">
              No tienes calificaciones en actividades formativas registradas aún.
            </p>
          </div>
        `;
      }
    } else {
      new ChartClass(canvasActividad, {
        type: 'bar',
        data: {
          labels: datosActividad.map((a) => NOMBRES_ACTIVIDADES[a.actividad] || a.actividad),
          datasets: [
            {
              label: 'Promedio (/10)',
              data: datosActividad.map((a) => a.promedio),
              backgroundColor: colores.secundario,
              hoverBackgroundColor: colores.primario,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const item = datosActividad[ctx.dataIndex];
                  return `Promedio: ${item.promedio} / 10 (${item.intentos} intentos)`;
                }
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 10,
              ticks: { stepSize: 2, color: colores.textoSuave },
              grid: { color: colores.borde }
            },
            x: {
              ticks: { color: colores.textoSuave },
              grid: { display: false }
            }
          }
        }
      });
    }
  }
}

async function iniciar() {
  if (!contenido) return;

  ui.cargando(true);
  try {
    const resumen = await api.llamar('GET', '/api/resumen/estudiante/yo');

    const puntos = Number(resumen.puntos || 0);
    const nivelQuiz = Number(resumen.nivelQuizMax || 0);
    const pctTemas = Number(resumen.pctTemas || 0);
    const promedio = Number(resumen.promedio || 0);

    const pendientes = Array.isArray(resumen.pendientes) ? resumen.pendientes : [];

    contenido.innerHTML = `
      <div class="progreso-contenedor">
        <header class="progreso-cabecera pila" style="gap: var(--espaciado-xs);">
          <h1 style="color: var(--color-primario); margin: 0;">Mi progreso formativo</h1>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-m); margin: 0;">
            Supervisa tus métricas de aprendizaje, el avance en tus asignaturas y tus temas pendientes.
          </p>
        </header>

        <!-- 1. Tarjetas de Métricas Principales -->
        <section class="progreso-metricas-grid" aria-label="Métricas principales de aprendizaje">
          <article class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono" aria-hidden="true">🏆</div>
            <div class="tarjeta-metrica__cuerpo">
              <span class="tarjeta-metrica__etiqueta">Puntos</span>
              <strong class="tarjeta-metrica__valor">${puntos}</strong>
            </div>
          </article>

          <article class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono" aria-hidden="true">⭐</div>
            <div class="tarjeta-metrica__cuerpo">
              <span class="tarjeta-metrica__etiqueta">Nivel de Quiz</span>
              <strong class="tarjeta-metrica__valor">${nivelQuiz > 0 ? `Nivel ${nivelQuiz}` : 'Sin nivel'}</strong>
            </div>
          </article>

          <article class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono" aria-hidden="true">📚</div>
            <div class="tarjeta-metrica__cuerpo">
              <span class="tarjeta-metrica__etiqueta">Temas revisados</span>
              <strong class="tarjeta-metrica__valor">${pctTemas}%</strong>
            </div>
          </article>

          <article class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono" aria-hidden="true">📊</div>
            <div class="tarjeta-metrica__cuerpo">
              <span class="tarjeta-metrica__etiqueta">Promedio</span>
              <strong class="tarjeta-metrica__valor">${promedio} <span style="font-size: var(--tamano-s); font-weight: normal; color: var(--color-texto-suave);">/ 10</span></strong>
            </div>
          </article>
        </section>

        <!-- 2. Gráficos de Evolución y Actividad -->
        <section class="progreso-graficos-grid" aria-label="Gráficos estadísticos de desempeño">
          <!-- Gráfico de líneas: Evolución -->
          <article class="tarjeta-grafico">
            <header class="pila" style="gap: var(--espaciado-xs);">
              <h2 style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">
                Evolución semanal
              </h2>
              <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">
                Tendencia de calificaciones en las últimas 8 semanas activas.
              </p>
            </header>
            <div class="grafico-canvas-contenedor" id="contenedor-chart-evolucion">
              <canvas id="chart-evolucion" aria-label="Gráfico de evolución semanal"></canvas>
            </div>
          </article>

          <!-- Gráfico de barras: Promedio por actividad -->
          <article class="tarjeta-grafico">
            <header class="pila" style="gap: var(--espaciado-xs);">
              <h2 style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">
                Promedio por actividad
              </h2>
              <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">
                Desempeño medio alcanzado en los distintos formatos lúdicos.
              </p>
            </header>
            <div class="grafico-canvas-contenedor" id="contenedor-chart-actividad">
              <canvas id="chart-actividad" aria-label="Gráfico de promedios por actividad"></canvas>
            </div>
          </article>
        </section>

        <!-- 3. Lista de Temas Pendientes -->
        <section class="pendientes-seccion" aria-labelledby="titulo-temas-pendientes">
          <header class="pila" style="gap: var(--espaciado-xs);">
            <h2 id="titulo-temas-pendientes" style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">
              Temas pendientes por revisar
            </h2>
            <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">
              Contenidos publicados en tus asignaturas que aún no has marcado como revisados.
            </p>
          </header>

          ${
            pendientes.length === 0
              ? `
            <div class="tarjeta vacio">
              <div style="font-size: 2.2rem;" aria-hidden="true">🎉</div>
              <h3 class="vacio__titulo">¡Estás al día!</h3>
              <p class="vacio__texto">
                Has revisado todos los temas publicados en tus asignaturas inscritas.
              </p>
              <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espaciado-s);">
                Ir a practicar actividades
              </a>
            </div>
          `
              : `
            <div class="pendientes-lista">
              ${pendientes
                .map(
                  (tema) => `
                <a href="/paginas/tema.html?id=${encodeURIComponent(tema.temaId)}" class="pendiente-item">
                  <div class="pila" style="gap: var(--espaciado-xs);">
                    <span class="insignia" style="font-size: 10px; align-self: flex-start;">Pendiente</span>
                    <strong class="pendiente-item__titulo">${ui.escapar(tema.titulo)}</strong>
                  </div>
                  <span class="btn btn--texto btn--pequeno" aria-hidden="true">
                    Revisar →
                  </span>
                </a>
              `
                )
                .join('')}
            </div>
          `
          }
        </section>
      </div>
    `;

    // Cargar Chart.js y renderizar visualizaciones
    const ChartClass = await asegurarChartJs();
    renderizarGraficos(resumen, ChartClass);
  } catch (err) {
    console.error('Error al cargar progreso del estudiante:', err);
    ui.aviso(err.message || 'Error al obtener tu resumen de progreso', 'error');
  } finally {
    ui.cargando(false);
  }
}

iniciar();

