import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Editor de contenidos', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');

let asignaturas = [];
let asignaturaSeleccionadaId = null;
let unidades = [];
let unidadSeleccionadaId = null;
let temas = [];

async function iniciar() {
  ui.cargando(true);
  try {
    asignaturas = await api.listar('asignaturas');
    if (asignaturas.length > 0) {
      asignaturaSeleccionadaId = asignaturas[0].id;
      await cargarUnidadesYTemas();
    } else {
      renderizarSinAsignaturas();
    }
  } catch (error) {
    ui.aviso(error.message || 'Error al cargar asignaturas', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function cargarUnidadesYTemas() {
  if (!asignaturaSeleccionadaId) return;
  ui.cargando(true);
  try {
    const [todasUnidades, todosTemas] = await Promise.all([
      api.listar('unidades'),
      api.listar('temas')
    ]);

    // Filtrar unidades de la asignatura actual y ordenar por orden
    unidades = todasUnidades
      .filter((u) => u.asignaturaId === asignaturaSeleccionadaId)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    // Si la unidad seleccionada ya no pertenece, reiniciar selección
    if (!unidades.some((u) => u.id === unidadSeleccionadaId)) {
      unidadSeleccionadaId = unidades.length > 0 ? unidades[0].id : null;
    }

    temas = todosTemas;
    renderizar();
  } catch (error) {
    ui.aviso(error.message || 'Error al cargar contenidos', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizarSinAsignaturas() {
  if (!contenido) return;
  contenido.innerHTML = `
    <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
      <h1>Editor de contenidos</h1>
      <p>No tienes asignaturas disponibles asignadas actualmente.</p>
    </div>
  `;
}

function renderizar() {
  if (!contenido) return;

  const temasUnidad = unidadSeleccionadaId
    ? temas
        .filter((t) => t.unidadId === unidadSeleccionadaId)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    : [];

  const unidadActual = unidades.find((u) => u.id === unidadSeleccionadaId);

  contenido.innerHTML = `
    <header class="editor-cabecera">
      <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espaciado-s);">
        <div>
          <h1>Editor de contenidos</h1>
          <p>Organiza las unidades didácticas y los temas educativos de tus asignaturas.</p>
        </div>
      </div>

      <div class="campo editor-selector-asig" style="margin-top: var(--espaciado-xs);">
        <label for="selector-asignatura"><strong>Asignatura:</strong></label>
        <select id="selector-asignatura">
          ${asignaturas
            .map(
              (a) =>
                `<option value="${ui.escapar(a.id)}" ${a.id === asignaturaSeleccionadaId ? 'selected' : ''}>${ui.escapar(a.nombre)} (${ui.escapar(a.nivel)})</option>`
            )
            .join('')}
        </select>
      </div>
    </header>

    <div class="editor-layout">
      <!-- Columna 1: Unidades -->
      <section class="panel-columna" aria-labelledby="titulo-unidades">
        <div class="fila" style="justify-content: space-between; align-items: center;">
          <h2 id="titulo-unidades" style="font-size: var(--tamano-l); margin: 0;">Unidades</h2>
          <button type="button" class="btn btn--primario btn--pequeno" id="btn-nueva-unidad">
            + Agregar
          </button>
        </div>

        <div class="lista-items" id="lista-unidades">
          ${
            unidades.length === 0
              ? `<div class="tarjeta vacio" style="padding: var(--espaciado-m); text-align: center;">No hay unidades registradas</div>`
              : unidades
                  .map((u, index) => {
                    const esSeleccionada = u.id === unidadSeleccionadaId;
                    const esVisible = u.visible !== false;
                    const esPrimera = index === 0;
                    const esUltima = index === unidades.length - 1;

                    return `
                    <article class="item-tarjeta ${esSeleccionada ? 'item-tarjeta--seleccionada' : ''}" data-id="${ui.escapar(u.id)}">
                      <div class="item-tarjeta__cabecera">
                        <a href="javascript:void(0)" class="item-tarjeta__titulo btn-seleccionar-unidad" data-id="${ui.escapar(u.id)}">
                          ${index + 1}. ${ui.escapar(u.titulo)}
                        </a>
                        <span class="insignia ${esVisible ? 'insignia--acento' : ''}" style="font-size: var(--tamano-xs);">
                          ${esVisible ? 'Visible' : 'Oculta'}
                        </span>
                      </div>

                      <div class="item-tarjeta__acciones">
                        <button type="button" class="btn btn--secundario btn-icono btn-subir-u" data-id="${ui.escapar(u.id)}" ${esPrimera ? 'disabled' : ''} title="Subir orden" aria-label="Subir orden de unidad">
                          ▲
                        </button>
                        <button type="button" class="btn btn--secundario btn-icono btn-bajar-u" data-id="${ui.escapar(u.id)}" ${esUltima ? 'disabled' : ''} title="Bajar orden" aria-label="Bajar orden de unidad">
                          ▼
                        </button>
                        <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar-u" data-id="${ui.escapar(u.id)}" data-titulo="${ui.escapar(u.titulo)}">
                          Renombrar
                        </button>
                        <button type="button" class="btn btn--secundario btn--pequeno btn-visibilidad-u" data-id="${ui.escapar(u.id)}" data-visible="${esVisible}">
                          ${esVisible ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                    </article>
                  `;
                  })
                  .join('')
          }
        </div>
      </section>

      <!-- Columna 2: Temas de la unidad -->
      <section class="panel-columna" aria-labelledby="titulo-temas">
        <div class="fila" style="justify-content: space-between; align-items: center;">
          <div>
            <h2 id="titulo-temas" style="font-size: var(--tamano-l); margin: 0;">
              Temas ${unidadActual ? `· ${ui.escapar(unidadActual.titulo)}` : ''}
            </h2>
            <small style="color: var(--color-texto); opacity: 0.8;">
              ${unidadActual ? `${temasUnidad.length} tema(s) en esta unidad` : 'Selecciona una unidad'}
            </small>
          </div>
          ${
            unidadActual
              ? `<button type="button" class="btn btn--primario btn--pequeno" id="btn-nuevo-tema">+ Agregar Tema</button>`
              : ''
          }
        </div>

        <div class="lista-items" id="lista-temas">
          ${
            !unidadActual
              ? `<div class="tarjeta vacio" style="padding: var(--espaciado-l); text-align: center;">Selecciona o crea una unidad para ver sus temas</div>`
              : temasUnidad.length === 0
                ? `<div class="tarjeta vacio" style="padding: var(--espaciado-l); text-align: center;">No hay temas en esta unidad. Agrega el primero con el botón "+ Agregar Tema".</div>`
                : temasUnidad
                    .map((t, index) => {
                      const esPublicado = t.estado === 'publicado';
                      const esPrimero = index === 0;
                      const esUltimo = index === temasUnidad.length - 1;

                      return `
                      <article class="item-tarjeta" data-id="${ui.escapar(t.id)}">
                        <div class="item-tarjeta__cabecera">
                          <div>
                            <span style="font-weight: var(--peso-negrita); font-size: var(--tamano-m);">
                              ${index + 1}. ${ui.escapar(t.titulo)}
                            </span>
                          </div>
                          <span class="insignia ${esPublicado ? 'insignia--acento' : ''}" style="font-size: var(--tamano-xs);">
                            ${esPublicado ? 'Publicado' : 'Borrador'}
                          </span>
                        </div>

                        <div class="item-tarjeta__acciones">
                          <button type="button" class="btn btn--secundario btn-icono btn-subir-t" data-id="${ui.escapar(t.id)}" ${esPrimero ? 'disabled' : ''} title="Subir orden" aria-label="Subir orden de tema">
                            ▲
                          </button>
                          <button type="button" class="btn btn--secundario btn-icono btn-bajar-t" data-id="${ui.escapar(t.id)}" ${esUltimo ? 'disabled' : ''} title="Bajar orden" aria-label="Bajar orden de tema">
                            ▼
                          </button>
                          <button type="button" class="btn btn--secundario btn--pequeno btn-estado-t" data-id="${ui.escapar(t.id)}" data-estado="${ui.escapar(t.estado || 'borrador')}">
                            ${esPublicado ? 'Pasar a borrador' : 'Publicar'}
                          </button>
                          <a href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--primario btn--pequeno" style="margin-left: auto;">
                            Editar ficha
                          </a>
                        </div>
                      </article>
                    `;
                    })
                    .join('')
          }
        </div>
      </section>
    </div>
  `;

  vincularEventos();
}

function vincularEventos() {
  // Cambio de asignatura
  const selectorAsig = document.getElementById('selector-asignatura');
  selectorAsig?.addEventListener('change', async (e) => {
    asignaturaSeleccionadaId = e.target.value;
    unidadSeleccionadaId = null;
    await cargarUnidadesYTemas();
  });

  // Agregar unidad
  document.getElementById('btn-nueva-unidad')?.addEventListener('click', async () => {
    abrirModalTexto({
      titulo: 'Nueva Unidad',
      etiqueta: 'Título de la unidad',
      valorInicial: '',
      onGuardar: async (nuevoTitulo) => {
        const nuevoOrden = unidades.length > 0 ? Math.max(...unidades.map((u) => u.orden || 0)) + 1 : 1;
        const creada = await api.crear('unidades', {
          asignaturaId: asignaturaSeleccionadaId,
          titulo: nuevoTitulo,
          orden: nuevoOrden,
          visible: true
        });
        unidadSeleccionadaId = creada.id;
        ui.aviso('Unidad creada', 'exito');
        await cargarUnidadesYTemas();
      }
    });
  });

  // Seleccionar unidad
  contenido.querySelectorAll('.btn-seleccionar-unidad').forEach((btn) => {
    btn.addEventListener('click', () => {
      unidadSeleccionadaId = btn.dataset.id;
      renderizar();
    });
  });

  // Renombrar unidad
  contenido.querySelectorAll('.btn-renombrar-u').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const tituloActual = btn.dataset.titulo;
      abrirModalTexto({
        titulo: 'Renombrar Unidad',
        etiqueta: 'Nuevo título',
        valorInicial: tituloActual,
        onGuardar: async (nuevoTitulo) => {
          await api.actualizar('unidades', id, { titulo: nuevoTitulo });
          ui.aviso('Unidad renombrada', 'exito');
          await cargarUnidadesYTemas();
        }
      });
    });
  });

  // Mostrar / Ocultar unidad (visible)
  contenido.querySelectorAll('.btn-visibilidad-u').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const visibleActual = btn.dataset.visible === 'true';
      const nuevoVisible = !visibleActual;
      try {
        ui.cargando(true);
        await api.actualizar('unidades', id, { visible: nuevoVisible });
        ui.aviso(nuevoVisible ? 'Unidad ahora es visible' : 'Unidad oculta para estudiantes', 'info');
        await cargarUnidadesYTemas();
      } catch (err) {
        ui.aviso(err.message || 'Error al cambiar visibilidad', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });

  // Reordenar unidades
  contenido.querySelectorAll('.btn-subir-u').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await moverItem(unidades, btn.dataset.id, -1, 'unidades');
    });
  });
  contenido.querySelectorAll('.btn-bajar-u').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await moverItem(unidades, btn.dataset.id, 1, 'unidades');
    });
  });

  // Agregar tema
  document.getElementById('btn-nuevo-tema')?.addEventListener('click', () => {
    if (!unidadSeleccionadaId) return;
    abrirModalTexto({
      titulo: 'Nuevo Tema',
      etiqueta: 'Título del tema',
      valorInicial: '',
      onGuardar: async (nuevoTitulo) => {
        const temasUnidad = temas.filter((t) => t.unidadId === unidadSeleccionadaId);
        const nuevoOrden = temasUnidad.length > 0 ? Math.max(...temasUnidad.map((t) => t.orden || 0)) + 1 : 1;
        await api.crear('temas', {
          unidadId: unidadSeleccionadaId,
          titulo: nuevoTitulo,
          orden: nuevoOrden,
          objetivos: [],
          resumen: '',
          ejemplos: [],
          erroresFrecuentes: [],
          preguntasGuia: [],
          recursos: [],
          palabrasClave: [],
          dificultad: 'intermedio',
          fuentes: '',
          estado: 'borrador'
        });
        ui.aviso('Tema agregado en borrador', 'exito');
        await cargarUnidadesYTemas();
      }
    });
  });

  // Reordenar temas
  const temasUnidad = unidadSeleccionadaId
    ? temas.filter((t) => t.unidadId === unidadSeleccionadaId).sort((a, b) => (a.orden || 0) - (b.orden || 0))
    : [];

  contenido.querySelectorAll('.btn-subir-t').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await moverItem(temasUnidad, btn.dataset.id, -1, 'temas');
    });
  });
  contenido.querySelectorAll('.btn-bajar-t').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await moverItem(temasUnidad, btn.dataset.id, 1, 'temas');
    });
  });

  // Cambiar estado tema (borrador o publicado)
  contenido.querySelectorAll('.btn-estado-t').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const estadoActual = btn.dataset.estado;
      const nuevoEstado = estadoActual === 'publicado' ? 'borrador' : 'publicado';

      try {
        ui.cargando(true);
        await api.actualizar('temas', id, { estado: nuevoEstado });
        ui.aviso(nuevoEstado === 'publicado' ? 'Tema publicado' : 'Tema puesto en borrador', 'info');
        await cargarUnidadesYTemas();
      } catch (err) {
        ui.aviso(err.message || 'Error al cambiar estado', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });
}

async function moverItem(listaOrdenada, id, direccion, coleccion) {
  const index = listaOrdenada.findIndex((item) => item.id === id);
  if (index === -1) return;
  const nuevoIndex = index + direccion;
  if (nuevoIndex < 0 || nuevoIndex >= listaOrdenada.length) return;

  const actual = listaOrdenada[index];
  const otro = listaOrdenada[nuevoIndex];

  try {
    ui.cargando(true);
    // Intercambiar ordenes
    const ordenTemp = actual.orden || index + 1;
    const ordenDestino = otro.orden || nuevoIndex + 1;

    await Promise.all([
      api.actualizar(coleccion, actual.id, { orden: ordenDestino }),
      api.actualizar(coleccion, otro.id, { orden: ordenTemp })
    ]);

    await cargarUnidadesYTemas();
  } catch (err) {
    ui.aviso(err.message || 'Error al reordenar', 'error');
  } finally {
    ui.cargando(false);
  }
}

function abrirModalTexto({ titulo, etiqueta, valorInicial, onGuardar }) {
  const div = document.createElement('div');
  div.className = 'pila';
  div.style.gap = 'var(--espaciado-m)';

  div.innerHTML = `
    <form id="form-modal-texto" class="pila" novalidate>
      <div class="campo">
        <label for="input-modal-texto">${ui.escapar(etiqueta)} *</label>
        <input type="text" id="input-modal-texto" required value="${ui.escapar(valorInicial)}" />
        <span class="campo__error oculto" id="err-modal-texto"></span>
      </div>

      <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-s);">
        <button type="button" class="btn btn--secundario" id="btn-cancelar-modal">Cancelar</button>
        <button type="submit" class="btn btn--primario" id="btn-guardar-modal">Guardar</button>
      </div>
    </form>
  `;

  const input = div.querySelector('#input-modal-texto');
  const errorEl = div.querySelector('#err-modal-texto');

  div.querySelector('#form-modal-texto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) {
      errorEl.textContent = 'Este campo no puede estar vacío';
      errorEl.classList.remove('oculto');
      return;
    }

    try {
      ui.cargando(true);
      await onGuardar(val);
      document.querySelector('.modal-fondo')?.remove();
    } catch (err) {
      ui.aviso(err.message || 'Error al procesar acción', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  div.querySelector('#btn-cancelar-modal').addEventListener('click', () => {
    document.querySelector('.modal-fondo')?.remove();
  });

  ui.modal({
    titulo,
    contenido: div,
    acciones: []
  });

  setTimeout(() => input.focus(), 50);
}

iniciar();

