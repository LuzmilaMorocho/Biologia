// Módulo del panel de seguimiento y analítica docente (P06.3)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Panel docente', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');

let listaGrupos = [];
let mapaAsignaturas = new Map();
let grupoActualId = null;
let datosGrupoActual = null;
let estudiantesOrdenados = [];
let chartTemaInstancia = null;
let chartTutorInstancia = null;
let secuenciaGrupo = 0, revisionTutor = 0, cargaChart = null;

// Estado de ordenación de la tabla
let ordenActual = {
  columna: 'nombre',
  direccion: 'asc'
};

// Carga asíncrona de Chart.js desde cdnjs si no está presente
async function asegurarChartJs() {
  if (window.Chart) return window.Chart;
  if (cargaChart) return cargaChart;
  cargaChart = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src*="chart.js" i]');
    if (script?.dataset.estado === 'error') { script.remove(); script = null; }
    const nuevo = !script;
    if (nuevo) {
      script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      script.crossOrigin = 'anonymous';
    }
    const limpiar = () => { clearTimeout(plazo); script.removeEventListener('load', terminar); script.removeEventListener('error', fallar); };
    const fallar = () => { limpiar(); script.dataset.estado = 'error'; reject(new Error('No se pudo cargar Chart.js. Las cifras del tutor siguen disponibles.')); };
    const terminar = () => { if (!window.Chart) { fallar(); return; } limpiar(); script.dataset.estado = 'listo'; resolve(window.Chart); };
    const plazo = setTimeout(fallar, 15000);
    script.addEventListener('load', terminar); script.addEventListener('error', fallar);
    if (nuevo) document.head.appendChild(script);
  }).catch((error) => { cargaChart = null; throw error; });
  return cargaChart;
}

function obtenerColoresTema() {
  const estilos = getComputedStyle(document.documentElement);
  return {
    primario: estilos.getPropertyValue('--color-primario').trim(),
    secundario: estilos.getPropertyValue('--color-secundario').trim(),
    acento: estilos.getPropertyValue('--color-acento').trim(),
    textoSuave: estilos.getPropertyValue('--color-texto-suave').trim(),
    borde: estilos.getPropertyValue('--color-borde').trim()
  };
}

function ordenarEstudiantes(columna, direccion) {
  estudiantesOrdenados.sort((a, b) => {
    let valA = a[columna];
    let valB = b[columna];

    if (columna === 'nombre') {
      valA = `${a.nombre} ${a.apellido}`.toLowerCase();
      valB = `${b.nombre} ${b.apellido}`.toLowerCase();
    } else if (columna === 'ultimaConexion') {
      valA = valA ? new Date(valA).getTime() : 0;
      valB = valB ? new Date(valB).getTime() : 0;
    } else {
      valA = Number(valA || 0);
      valB = Number(valB || 0);
    }

    if (valA < valB) return direccion === 'asc' ? -1 : 1;
    if (valA > valB) return direccion === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderizarFilasTabla() {
  const tbody = document.getElementById('tbody-estudiantes');
  if (!tbody) return;

  if (estudiantesOrdenados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--espaciado-l); color: var(--color-texto-suave);">
          No hay estudiantes registrados en este grupo.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = estudiantesOrdenados
    .map((est) => {
      const tieneAlertas = est.alertasActivas > 0;
      const claseFila = tieneAlertas ? 'fila-estudiante fila--alerta' : 'fila-estudiante';
      const fechaConexion = est.ultimaConexion ? util.fechaRelativa(est.ultimaConexion) : 'Sin conexión';

      return `
      <tr class="${claseFila}" data-id="${ui.escapar(est.id)}" role="button" tabindex="0" aria-label="Ver detalle de ${ui.escapar(est.nombre)} ${ui.escapar(est.apellido)}">
        <td>
          <div class="fila" style="gap: var(--espaciado-xs); align-items: center;">
            <strong>${ui.escapar(est.nombre)} ${ui.escapar(est.apellido)}</strong>
          </div>
        </td>
        <td>
          <strong>${est.promedio}</strong> <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">/ 10</span>
        </td>
        <td>${est.actividades}</td>
        <td>
          <div class="fila" style="align-items: center; gap: var(--espaciado-xs);">
            <span>${est.pctTemas}%</span>
          </div>
        </td>
        <td>
          <time style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">${ui.escapar(fechaConexion)}</time>
        </td>
        <td>
          <button type="button"
                  class="chip-alerta insignia ${tieneAlertas ? 'insignia--acento' : ''}"
                  style="${tieneAlertas ? 'font-weight: bold;' : 'opacity: 0.6;'}"
                  data-estudiante-id="${ui.escapar(est.id)}"
                  data-estudiante-nombre="${ui.escapar(est.nombre)} ${ui.escapar(est.apellido)}"
                  aria-label="Ver alertas de ${ui.escapar(est.nombre)}">
            ${tieneAlertas ? `⚠️ ${est.alertasActivas}` : '0'}
          </button>
        </td>
      </tr>
    `;
    })
    .join('');

  // Eventos de clic en chips de alertas
  const chips = tbody.querySelectorAll('.chip-alerta');
  chips.forEach((chip) => {
    const abrirAlertas = (e) => {
      e.stopPropagation();
      const estudianteId = chip.dataset.estudianteId;
      const estudianteNombre = chip.dataset.estudianteNombre;
      if (estudianteId) {
        mostrarModalAlertasEstudiante(estudianteId, estudianteNombre);
      }
    };

    chip.addEventListener('click', abrirAlertas);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirAlertas(e);
      }
    });
  });

  // Eventos de clic en filas para abrir el modal de resumen del estudiante
  const filas = tbody.querySelectorAll('.fila-estudiante');
  filas.forEach((fila) => {
    const abrirModal = () => {
      const estudianteId = fila.dataset.id;
      if (estudianteId) mostrarModalEstudiante(estudianteId);
    };

    fila.addEventListener('click', abrirModal);
    fila.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirModal();
      }
    });
  });
}

function actualizarEncabezadosTabla() {
  const encabezados = contenido.querySelectorAll('.th-ordenable');
  encabezados.forEach((th) => {
    const col = th.dataset.col;
    const indicador = th.querySelector('.th-indicador');
    if (!indicador) return;

    if (col === ordenActual.columna) {
      indicador.textContent = ordenActual.direccion === 'asc' ? '▲' : '▼';
      th.setAttribute('aria-sort', ordenActual.direccion === 'asc' ? 'ascending' : 'descending');
    } else {
      indicador.textContent = '↕';
      th.removeAttribute('aria-sort');
    }
  });
}

function renderizarGraficoTemas(porTema, ChartClass) {
  const canvas = document.getElementById('chart-temas-grupo');
  const contenedor = document.getElementById('contenedor-chart-temas');
  if (!canvas || !contenedor) return;

  if (chartTemaInstancia) {
    chartTemaInstancia.destroy();
    chartTemaInstancia = null;
  }

  if (!porTema || porTema.length === 0) {
    contenedor.innerHTML = `
      <div class="tarjeta vacio" style="padding: var(--espaciado-l); min-height: 220px; justify-content: center;">
        <p style="color: var(--color-texto-suave); margin: 0;">
          No hay datos de actividades registradas por tema para este grupo.
        </p>
      </div>
    `;
    return;
  }

  const colores = obtenerColoresTema();

  chartTemaInstancia = new ChartClass(canvas, {
    type: 'bar',
    data: {
      labels: porTema.map((t) => t.titulo),
      datasets: [
        {
          label: 'Promedio (/10)',
          data: porTema.map((t) => t.promedio),
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
              const item = porTema[ctx.dataIndex];
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

async function mostrarModalEstudiante(estudianteId) {
  ui.cargando(true);
  try {
    const res = await api.llamar('GET', `/api/resumen/estudiante/${encodeURIComponent(estudianteId)}`);
    const est = estudiantesOrdenados.find((e) => e.id === estudianteId) || {};

    const modalContenido = document.createElement('div');
    modalContenido.className = 'pila';
    modalContenido.style.gap = 'var(--espaciado-m)';

    modalContenido.innerHTML = `
      <!-- Cajas de métricas clave -->
      <div class="modal-estudiante-metricas">
        <div class="modal-metrica-caja">
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Promedio</span>
          <strong style="font-size: var(--tamano-xl); color: var(--color-primario);">${res.promedio} / 10</strong>
        </div>
        <div class="modal-metrica-caja">
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Puntos</span>
          <strong style="font-size: var(--tamano-xl); color: var(--color-acento);">${res.puntos}</strong>
        </div>
        <div class="modal-metrica-caja">
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Nivel Quiz</span>
          <strong style="font-size: var(--tamano-xl); color: var(--color-primario);">${res.nivelQuizMax > 0 ? `Nivel ${res.nivelQuizMax}` : '—'}</strong>
        </div>
        <div class="modal-metrica-caja">
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">% Temas</span>
          <strong style="font-size: var(--tamano-xl); color: var(--color-primario);">${res.pctTemas}%</strong>
        </div>
        <div class="modal-metrica-caja">
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Tiempo activo</span>
          <strong style="font-size: var(--tamano-xl); color: var(--color-primario);">${res.tiempoMin} min</strong>
        </div>
      </div>

      <!-- Tabla de últimos 20 intentos -->
      <h3 style="font-size: var(--tamano-m); color: var(--color-primario); margin: var(--espaciado-xs) 0 0;">
        Últimos intentos registrados (hasta 20)
      </h3>

      <div class="modal-intentos-tabla tabla">
        <table>
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Puntaje</th>
              <th>Errores</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${
              !res.ultimosIntentos || res.ultimosIntentos.length === 0
                ? `<tr><td colspan="4" style="text-align:center; color:var(--color-texto-suave); padding: var(--espaciado-m);">Sin intentos registrados</td></tr>`
                : res.ultimosIntentos
                    .map((it) => {
                      const fecha = it.fecha ? util.fechaRelativa(it.fecha) : '—';
                      return `
                      <tr>
                        <td><strong>${ui.escapar(it.actividad)}</strong></td>
                        <td>${it.puntaje} / ${it.maximo}</td>
                        <td>${it.errores ?? 0}</td>
                        <td><time style="font-size: var(--tamano-xs);">${ui.escapar(fecha)}</time></td>
                      </tr>
                    `;
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    `;

    await ui.modal({
      titulo: `Progreso de ${est.nombre || 'Estudiante'} ${est.apellido || ''}`,
      contenido: modalContenido,
      acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn--secundario' }]
    });
  } catch (err) {
    ui.aviso(err.message || 'Error al obtener detalle del estudiante', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function mostrarModalAlertasEstudiante(estudianteId, nombreEstudiante) {
  ui.cargando(true);
  try {
    const resAlertas = await api.llamar('GET', `/api/alertas?grupoId=${grupoActualId}`);
    const todasAlertas = resAlertas.alertas || [];
    const mensajesApoyo = resAlertas.mensajesApoyo || [];
    const alertasEstudiante = todasAlertas.filter((a) => a.estudianteId === estudianteId);

    const modalContenido = document.createElement('div');
    modalContenido.className = 'modal-alertas-contenedor';

    const renderAlertasHtml = (lista) => {
      if (!lista || lista.length === 0) {
        return `<p class="vacio" style="padding: var(--espaciado-m); text-align: center; color: var(--color-texto-suave);">No hay alertas registradas para este estudiante.</p>`;
      }

      return lista
        .map((a) => {
          const esActiva = a.estado === 'activa';
          const fechaRel = a.fecha ? util.fechaRelativa(a.fecha) : '';
          const reglaNombre =
            a.regla === 'promedioBajo'
              ? 'Promedio bajo'
              : a.regla === 'fallosQuiz'
              ? 'Fallos en cuestionario'
              : a.regla === 'inactividad'
              ? 'Inactividad'
              : a.regla;

          return `
            <div class="tarjeta-alerta-item" data-id="${ui.escapar(a.id)}" style="background: var(--color-fondo); border: 1px solid var(--color-borde); border-radius: var(--radio-m); padding: var(--espaciado-m); margin-bottom: var(--espaciado-s);">
              <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-xs);">
                <strong>${ui.escapar(reglaNombre)}</strong>
                <span class="insignia ${esActiva ? 'insignia--acento' : 'insignia--exito'}">${ui.escapar(a.estado)}</span>
              </div>
              <p style="margin: 0 0 var(--espaciado-xs) 0; font-size: var(--tamano-s);">${ui.escapar(a.detalle || '')}</p>
              <div class="fila" style="justify-content: space-between; align-items: center;">
                <time style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">${ui.escapar(fechaRel)}</time>
                ${
                  esActiva
                    ? `<button type="button" class="btn btn--secundario btn--pequeno btn-atender-alerta" data-id="${ui.escapar(a.id)}">Marcar como atendida</button>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');
    };

    modalContenido.innerHTML = `
      <div style="margin-bottom: var(--espaciado-l);">
        <h3 style="font-size: var(--tamano-m); color: var(--color-primario); margin-bottom: var(--espaciado-s);">
          Alertas registradas
        </h3>
        <div id="contenedor-lista-alertas-modal">
          ${renderAlertasHtml(alertasEstudiante)}
        </div>
      </div>

      <div class="modal-seccion-apoyo" style="border-top: 1px solid var(--color-borde); padding-top: var(--espaciado-m);">
        <h3 style="font-size: var(--tamano-m); color: var(--color-primario); margin-bottom: var(--espaciado-s);">
          Enviar mensaje de apoyo
        </h3>
        <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin-bottom: var(--espaciado-s);">
          Selecciona un mensaje sugerido o redacta uno personalizado para notificar al estudiante.
        </p>

        <div class="campo" style="margin-bottom: var(--espaciado-s);">
          <label for="select-mensaje-apoyo-modal" class="sr-only">Mensajes sugeridos</label>
          <select id="select-mensaje-apoyo-modal" style="width: 100%;">
            <option value="">-- Elige un mensaje sugerido o escribe el tuyo --</option>
            ${mensajesApoyo.map((m) => `<option value="${ui.escapar(m)}">${ui.escapar(m)}</option>`).join('')}
          </select>
        </div>

        <div class="campo" style="margin-bottom: var(--espaciado-m);">
          <label for="texto-apoyo-modal" class="sr-only">Texto del mensaje</label>
          <textarea id="texto-apoyo-modal" rows="3" style="width: 100%; resize: vertical;" placeholder="Escribe aquí un mensaje motivador..."></textarea>
        </div>

        <button type="button" id="btn-enviar-apoyo-modal" class="btn btn--primario btn--pequeno">
          Enviar mensaje de apoyo
        </button>
      </div>
    `;

    // Vincular selector de mensajes para autocompletar el textarea
    const selMensaje = modalContenido.querySelector('#select-mensaje-apoyo-modal');
    const txtMensaje = modalContenido.querySelector('#texto-apoyo-modal');
    selMensaje?.addEventListener('change', (e) => {
      if (e.target.value) {
        txtMensaje.value = e.target.value;
      }
    });

    // Enviar mensaje de apoyo mediante notificación
    const btnEnviar = modalContenido.querySelector('#btn-enviar-apoyo-modal');
    btnEnviar?.addEventListener('click', async () => {
      const texto = txtMensaje.value.trim();
      if (!texto) {
        ui.aviso('Por favor escribe o selecciona un mensaje de apoyo', 'error');
        return;
      }

      btnEnviar.disabled = true;
      try {
        await api.llamar('POST', '/api/notificaciones', {
          usuarioId: estudianteId,
          mensaje: texto,
          enlace: '/paginas/actividades.html'
        });
        ui.aviso('Mensaje de apoyo enviado al estudiante', 'exito');
        txtMensaje.value = '';
        if (selMensaje) selMensaje.value = '';
      } catch (err) {
        ui.aviso(err.message || 'Error al enviar mensaje de apoyo', 'error');
      } finally {
        btnEnviar.disabled = false;
      }
    });

    // Delegación para marcar alerta como atendida
    const contenedorAlertas = modalContenido.querySelector('#contenedor-lista-alertas-modal');
    contenedorAlertas?.addEventListener('click', async (e) => {
      const btnAtender = e.target.closest('.btn-atender-alerta');
      if (!btnAtender) return;

      const alertaId = btnAtender.dataset.id;
      btnAtender.disabled = true;
      try {
        await api.actualizar('alertas', alertaId, { estado: 'atendida' });
        ui.aviso('Alerta marcada como atendida', 'exito');

        const alertaObj = alertasEstudiante.find((a) => a.id === alertaId);
        if (alertaObj) alertaObj.estado = 'atendida';
        contenedorAlertas.innerHTML = renderAlertasHtml(alertasEstudiante);

        // Actualizar datos del grupo de fondo
        if (grupoActualId) {
          cargarDatosGrupo(grupoActualId);
        }
      } catch (err) {
        ui.aviso(err.message || 'Error al actualizar alerta', 'error');
        btnAtender.disabled = false;
      }
    });

    await ui.modal({
      titulo: `Alertas: ${nombreEstudiante}`,
      contenido: modalContenido,
      acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn--secundario' }]
    });
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar alertas del estudiante', 'error');
  } finally {
    ui.cargando(false);
  }
}

function exportarCsv() {
  if (!datosGrupoActual || estudiantesOrdenados.length === 0) {
    ui.aviso('No hay datos disponibles para exportar', 'advertencia');
    return;
  }

  // BOM UTF-8 (\uFEFF) para visualización correcta de tildes y caracteres especiales en Excel
  const bom = '\uFEFF';
  const cabeceras = ['Estudiante', 'Promedio', 'Actividades', '% Temas', 'Última Conexión', 'Alertas Activas'];
  const separador = ';';

  const filas = estudiantesOrdenados.map((est) => {
    const nombreCompleto = `"${est.nombre} ${est.apellido}"`;
    const promedio = est.promedio;
    const actividades = est.actividades;
    const pctTemas = `${est.pctTemas}%`;
    const ultimaConexion = est.ultimaConexion ? `"${util.fechaLarga(est.ultimaConexion)}"` : '"Sin conexión"';
    const alertas = est.alertasActivas;

    return [nombreCompleto, promedio, actividades, pctTemas, ultimaConexion, alertas].join(separador);
  });

  const csvContenido = [cabeceras.join(separador), ...filas].join('\r\n');
  const blob = new Blob([bom + csvContenido], { type: 'text/csv;charset=utf-8;' });

  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  const fechaHoy = new Date().toISOString().slice(0, 10);
  enlace.download = `reporte-grupo-${grupoActualId}-${fechaHoy}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  ui.aviso('Archivo CSV exportado exitosamente', 'exito');
}

async function cargarUsoTutor(grupoId, versionGrupo) {
  if (versionGrupo !== secuenciaGrupo || grupoId !== grupoActualId) return;
  const revision = ++revisionTutor;
  const vigente = () => versionGrupo === secuenciaGrupo && grupoId === grupoActualId && revision === revisionTutor;
  const tarjeta = document.getElementById('panel-uso-tutor');
  if (!tarjeta) return;
  if (chartTutorInstancia) { chartTutorInstancia.destroy(); chartTutorInstancia = null; }
  tarjeta.setAttribute('aria-busy', 'true');
  tarjeta.innerHTML = '<p role="status">Cargando uso del tutor…</p>';
  try {
    const datos = await api.llamar('GET', `/api/resumen/tutor/${encodeURIComponent(grupoId)}`);
    if (!vigente()) return;
    const cantidad = (n) => Number.isSafeInteger(n) && n >= 0 ? n : 0;
    const temas = (datos.porTema || []).map((t) => ({ titulo: String(t.titulo || ''), consultas: cantidad(t.consultas) }))
      .filter((t) => t.consultas > 0).sort((a, b) => b.consultas - a.consultas || a.titulo.localeCompare(b.titulo, 'es')).slice(0, 5);
    const estudiantes = (datos.porEstudiante || []).map((e) => ({ nombre: String(e.nombre || e.id || ''), consultas: cantidad(e.consultas) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    tarjeta.innerHTML = `<div class="panel-tutor__datos"><section class="panel-tutor__temas" aria-labelledby="panel-tutor-temas">
      <h3 id="panel-tutor-temas">Los cinco temas más consultados</h3>
      ${temas.length ? `<div class="panel-tutor__grafico" id="panel-tutor-grafico"><canvas id="chart-uso-tutor" role="img" aria-label="Consultas al tutor en los cinco temas más consultados" aria-describedby="panel-tutor-cifras"></canvas></div>
        <p id="panel-tutor-aviso" class="texto-secundario" role="status"></p>
        <ol id="panel-tutor-cifras" class="sr-only">${temas.map((t) => `<li>${ui.escapar(t.titulo)}: ${t.consultas} consultas</li>`).join('')}</ol>`
        : '<p>Todavía no hay consultas del tutor registradas para este grupo.</p>'}</section>
      <div class="tabla"><table><caption>Consultas acumuladas por estudiante</caption><thead><tr><th scope="col">Estudiante</th><th scope="col">Consultas</th></tr></thead>
      <tbody>${estudiantes.length ? estudiantes.map((e) => `<tr><th scope="row">${ui.escapar(e.nombre)}</th><td>${e.consultas}</td></tr>`).join('')
        : '<tr><td colspan="2">No hay estudiantes registrados en este grupo.</td></tr>'}</tbody></table></div></div>`;
    tarjeta.setAttribute('aria-busy', 'false');
    if (!temas.length) return;
    try {
      const ChartClass = await asegurarChartJs();
      if (!vigente()) return;
      const colores = obtenerColoresTema();
      const fuente = getComputedStyle(document.documentElement).getPropertyValue('--fuente-base').trim();
      chartTutorInstancia = new ChartClass(document.getElementById('chart-uso-tutor'), {
        type: 'bar', data: { labels: temas.map((t) => t.titulo), datasets: [{ label: 'Consultas', data: temas.map((t) => t.consultas), backgroundColor: colores.primario, hoverBackgroundColor: colores.secundario }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          animation: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? false : undefined,
          plugins: { legend: { display: false }, tooltip: { titleFont: { family: fuente }, bodyFont: { family: fuente } } },
          scales: { x: { beginAtZero: true, title: { display: true, text: 'Consultas', color: colores.textoSuave, font: { family: fuente } }, ticks: { precision: 0, color: colores.textoSuave, font: { family: fuente } }, grid: { color: colores.borde } },
            y: { ticks: { autoSkip: false, color: colores.textoSuave, font: { family: fuente }, callback(valor) { const titulo = this.getLabelForValue(valor); return titulo.length > 36 ? titulo.slice(0, 33) + '…' : titulo; } }, grid: { display: false } } }
        }
      });
    } catch {
      if (!vigente()) return;
      document.getElementById('panel-tutor-grafico').hidden = true;
      document.getElementById('panel-tutor-cifras').classList.remove('sr-only');
      document.getElementById('panel-tutor-aviso').textContent = 'No se pudo mostrar el gráfico. Puedes consultar las cifras en la lista de temas y la tabla.';
    }
  } catch (error) {
    if (!vigente()) return;
    tarjeta.innerHTML = `<p class="campo__error" role="alert">${ui.escapar(error.message || 'No se pudo cargar el uso del tutor.')}</p><button type="button" id="panel-tutor-reintentar" class="btn btn--secundario">Reintentar uso del tutor</button>`;
    document.getElementById('panel-tutor-reintentar').addEventListener('click', () => cargarUsoTutor(grupoId, versionGrupo));
  } finally { if (vigente()) tarjeta.setAttribute('aria-busy', 'false'); }
}

async function cargarDatosGrupo(grupoId) {
  const version = ++secuenciaGrupo;
  grupoActualId = grupoId;
  datosGrupoActual = null; estudiantesOrdenados = [];
  if (chartTemaInstancia) { chartTemaInstancia.destroy(); chartTemaInstancia = null; }
  document.getElementById('contenedor-chart-temas').innerHTML = '<canvas id="chart-temas-grupo" aria-label="Gráfico de barras de rendimiento por tema"></canvas>';
  document.getElementById('tbody-estudiantes').innerHTML = '<tr><td colspan="6">Cargando estudiantes…</td></tr>';
  const usoTutor = cargarUsoTutor(grupoId, version);
  ui.cargando(true);

  try {
    const datos = await api.llamar('GET', `/api/resumen/grupo/${encodeURIComponent(grupoId)}`);
    if (version !== secuenciaGrupo) return;
    datosGrupoActual = datos;
    estudiantesOrdenados = [...(datosGrupoActual.estudiantes || [])];

    ordenarEstudiantes(ordenActual.columna, ordenActual.direccion);
    renderizarFilasTabla();
    actualizarEncabezadosTabla();

    const ChartClass = await asegurarChartJs();
    if (version !== secuenciaGrupo) return;
    renderizarGraficoTemas(datosGrupoActual.porTema || [], ChartClass);
  } catch (err) {
    if (version !== secuenciaGrupo) return;
    console.error('Error al cargar datos del grupo:', err);
    ui.aviso(err.message || 'Error al obtener resumen del grupo', 'error');
  } finally {
    if (version === secuenciaGrupo) ui.cargando(false);
  }
  await usoTutor;
}

async function iniciar() {
  if (!contenido) return;

  ui.cargando(true);
  try {
    const [distributivo, asignaturas] = await Promise.all([
      api.listar('distributivo'),
      api.listar('asignaturas')
    ]);

    listaGrupos = distributivo || [];
    mapaAsignaturas = new Map((asignaturas || []).map((a) => [a.id, a.nombre]));

    if (listaGrupos.length === 0) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <h2 class="vacio__titulo">Sin grupos asignados</h2>
          <p class="vacio__texto">No tienes grupos asignados en el distributivo académico actualmente.</p>
        </div>
      `;
      return;
    }

    const grupoInicial = listaGrupos[0];

    contenido.innerHTML = `
      <div class="panel-docente-contenedor">
        <header class="panel-docente-cabecera">
          <div>
            <h1 style="color: var(--color-primario); margin: 0;">Panel de seguimiento docente</h1>
            <p style="color: var(--color-texto-suave); font-size: var(--tamano-m); margin-top: var(--espaciado-xs);">
              Monitorea el progreso grupal, rendimiento académico y alertas activas de tus estudiantes.
            </p>
          </div>
        </header>

        <!-- Filtros y acciones -->
        <section class="panel-docente-filtros" aria-label="Filtros del panel docente">
          <div class="fila" style="align-items: center; gap: var(--espaciado-s);">
            <label for="sel-grupo" style="font-weight: var(--peso-seminegrita); color: var(--color-primario); font-size: var(--tamano-s);">
              Seleccionar grupo:
            </label>
            <select id="sel-grupo" class="campo panel-docente-selector">
              ${listaGrupos
                .map((g) => {
                  const nombreAsig = mapaAsignaturas.get(g.asignaturaId) || 'Asignatura';
                  return `
                  <option value="${ui.escapar(g.id)}" ${g.id === grupoInicial.id ? 'selected' : ''}>
                    ${ui.escapar(nombreAsig)} · Paralelo ${ui.escapar(g.paralelo || 'A')} (${ui.escapar(g.periodo || '')})
                  </option>
                `;
                })
                .join('')}
            </select>
          </div>

          <div>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-exportar-csv">
              📥 Exportar CSV
            </button>
          </div>
        </section>

        <!-- Gráfico de barras por tema -->
        <section class="grafico-tema-tarjeta" aria-labelledby="titulo-grafico-temas">
          <header class="pila" style="gap: var(--espaciado-xs);">
            <h2 id="titulo-grafico-temas" style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">
              Rendimiento promedio por tema
            </h2>
            <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">
              Calificación media (/10) obtenida por el grupo en cada tema publicado.
            </p>
          </header>

          <div class="grafico-tema-contenedor" id="contenedor-chart-temas">
            <canvas id="chart-temas-grupo" aria-label="Gráfico de barras de rendimiento por tema"></canvas>
          </div>
        </section>

        <section class="tarjeta panel-tutor" aria-labelledby="titulo-uso-tutor">
          <h2 id="titulo-uso-tutor">Uso del tutor</h2>
          <p class="texto-secundario">Consultas acumuladas de los estudiantes del grupo en los temas de su asignatura.</p>
          <div id="panel-uso-tutor" aria-busy="true"><p role="status">Cargando uso del tutor…</p></div>
        </section>

        <!-- Tabla ordenable de estudiantes -->
        <section class="tarjeta pila" style="gap: var(--espaciado-m);" aria-labelledby="titulo-tabla-estudiantes">
          <header class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espaciado-s);">
            <div>
              <h2 id="titulo-tabla-estudiantes" style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">
                Estudiantes del grupo
              </h2>
              <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">
                Haz clic sobre el encabezado de cualquier columna para ordenar o sobre un estudiante para ver su historial.
              </p>
            </div>
            <span class="insignia" style="font-size: var(--tamano-xs);">
              Las filas en tono naranja indican alertas activas
            </span>
          </header>

          <div class="tabla">
            <table aria-label="Lista de estudiantes del grupo">
              <thead>
                <tr>
                  <th class="th-ordenable" data-col="nombre" scope="col">
                    Estudiante <span class="th-indicador">▲</span>
                  </th>
                  <th class="th-ordenable" data-col="promedio" scope="col">
                    Promedio <span class="th-indicador">↕</span>
                  </th>
                  <th class="th-ordenable" data-col="actividades" scope="col">
                    Actividades <span class="th-indicador">↕</span>
                  </th>
                  <th class="th-ordenable" data-col="pctTemas" scope="col">
                    % Temas <span class="th-indicador">↕</span>
                  </th>
                  <th class="th-ordenable" data-col="ultimaConexion" scope="col">
                    Última conexión <span class="th-indicador">↕</span>
                  </th>
                  <th class="th-ordenable" data-col="alertasActivas" scope="col">
                    Alertas <span class="th-indicador">↕</span>
                  </th>
                </tr>
              </thead>
              <tbody id="tbody-estudiantes"></tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    // Evento selector de grupos
    const selGrupo = document.getElementById('sel-grupo');
    selGrupo?.addEventListener('change', () => {
      cargarDatosGrupo(selGrupo.value);
    });

    // Evento botón exportar CSV
    const btnExportar = document.getElementById('btn-exportar-csv');
    btnExportar?.addEventListener('click', () => {
      exportarCsv();
    });

    // Eventos de ordenación en encabezados
    const encabezados = contenido.querySelectorAll('.th-ordenable');
    encabezados.forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (ordenActual.columna === col) {
          ordenActual.direccion = ordenActual.direccion === 'asc' ? 'desc' : 'asc';
        } else {
          ordenActual.columna = col;
          ordenActual.direccion = 'asc';
        }
        ordenarEstudiantes(ordenActual.columna, ordenActual.direccion);
        renderizarFilasTabla();
        actualizarEncabezadosTabla();
      });
    });

    // Cargar datos del primer grupo
    await cargarDatosGrupo(grupoInicial.id);
  } catch (err) {
    console.error('Error al inicializar panel docente:', err);
    ui.aviso(err.message || 'Error al cargar el panel docente', 'error');
  } finally {
    ui.cargando(false);
  }
}

if (['docente', 'admin'].includes(usuarioActual()?.rol)) await iniciar();

