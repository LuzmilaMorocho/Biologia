import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Distributivo', roles: ['admin'] });

const contenido = document.getElementById('contenido');
let distributivo = [];
let asignaturas = [];
let usuarios = [];

async function cargarDatos() {
  ui.cargando(true);
  try {
    const [listaDist, listaAsig, listaUsu] = await Promise.all([
      api.listar('distributivo'),
      api.listar('asignaturas'),
      api.listar('usuarios')
    ]);
    distributivo = listaDist;
    asignaturas = listaAsig;
    usuarios = listaUsu;
    renderizar();
  } catch (error) {
    ui.aviso(error.message || 'Error al cargar distributivo', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizar() {
  if (!contenido) return;

  const mapaAsig = new Map(asignaturas.map((a) => [a.id, a]));
  const mapaUsu = new Map(usuarios.map((u) => [u.id, u]));

  contenido.innerHTML = `
    <div class="distributivo-cabecera">
      <div class="pila" style="gap: var(--espaciado-xs);">
        <h1>Distributivo Académico</h1>
        <p>Asigna docentes, paralelos y nóminas de estudiantes a cada asignatura.</p>
      </div>
      <div>
        <button type="button" class="btn btn--primario" id="btn-nuevo-grupo">
          + Nuevo Grupo
        </button>
      </div>
    </div>

    <section class="tarjeta pila">
      <div class="tabla">
        <table>
          <thead>
            <tr>
              <th scope="col">Asignatura</th>
              <th scope="col">Paralelo</th>
              <th scope="col">Período</th>
              <th scope="col">Docente</th>
              <th scope="col" style="text-align: center;">Estudiantes</th>
              <th scope="col" style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${
              distributivo.length === 0
                ? `<tr><td colspan="6" style="text-align: center; padding: var(--espaciado-l);">No hay grupos configurados</td></tr>`
                : distributivo
                    .map((item) => {
                      const asig = mapaAsig.get(item.asignaturaId);
                      const doc = mapaUsu.get(item.docenteId);
                      const cantEstudiantes = Array.isArray(item.estudiantes) ? item.estudiantes.length : 0;

                      return `
                        <tr data-id="${ui.escapar(item.id)}">
                          <td>
                            <strong>${ui.escapar(asig ? asig.nombre : item.asignaturaId)}</strong>
                            <div style="font-size: var(--tamano-xs); opacity: 0.6;">${ui.escapar(asig ? asig.nivel : '')}</div>
                          </td>
                          <td><span class="insignia insignia--acento">${ui.escapar(item.paralelo)}</span></td>
                          <td>${ui.escapar(item.periodo)}</td>
                          <td>
                            ${
                              doc
                                ? `${ui.escapar(doc.nombre)} ${ui.escapar(doc.apellido)}`
                                : `<span style="opacity: 0.5;">Sin docente</span>`
                            }
                          </td>
                          <td style="text-align: center;">
                            <strong>${cantEstudiantes}</strong>
                          </td>
                          <td style="text-align: right;">
                            <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-xs);">
                              <button type="button" class="btn btn--secundario btn--pequeno btn-editar-grupo" data-id="${ui.escapar(item.id)}">
                                Editar
                              </button>
                              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-grupo" data-id="${ui.escapar(item.id)}">
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `;

  document.getElementById('btn-nuevo-grupo')?.addEventListener('click', () => abrirModalGrupo());

  contenido.querySelectorAll('.btn-editar-grupo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const g = distributivo.find((item) => item.id === id);
      if (g) abrirModalGrupo(g);
    });
  });

  contenido.querySelectorAll('.btn-eliminar-grupo').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const confirmado = await ui.confirmar('¿Estás seguro de eliminar este grupo del distributivo?');
      if (!confirmado) return;

      try {
        ui.cargando(true);
        await api.eliminar('distributivo', id);
        ui.aviso('Grupo eliminado correctamente', 'exito');
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al eliminar grupo', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });
}

function abrirModalGrupo(grupo = null) {
  const esEdicion = Boolean(grupo);
  const docentes = usuarios.filter((u) => u.rol === 'docente');
  const estudiantesTodos = usuarios.filter((u) => u.rol === 'estudiante');

  let seleccionados = new Set(grupo && Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []);

  const formDiv = document.createElement('div');
  formDiv.className = 'pila';
  formDiv.style.gap = 'var(--espaciado-m)';

  formDiv.innerHTML = `
    <form id="form-modal-grupo" class="pila" novalidate>
      <div class="campo">
        <label for="modal-asig">Asignatura *</label>
        <select id="modal-asig" required>
          <option value="">-- Seleccionar Asignatura --</option>
          ${asignaturas
            .map(
              (a) => `
            <option value="${ui.escapar(a.id)}" ${grupo?.asignaturaId === a.id ? 'selected' : ''}>
              ${ui.escapar(a.nombre)} (${ui.escapar(a.nivel)})
            </option>
          `
            )
            .join('')}
        </select>
        <span class="campo__error oculto" id="err-modal-asig"></span>
      </div>

      <div class="fila" style="gap: var(--espaciado-m);">
        <div class="campo" style="flex: 1;">
          <label for="modal-paralelo">Paralelo *</label>
          <input type="text" id="modal-paralelo" required value="${ui.escapar(grupo?.paralelo || 'A')}" placeholder="Ej. A" />
          <span class="campo__error oculto" id="err-modal-paralelo"></span>
        </div>

        <div class="campo" style="flex: 2;">
          <label for="modal-periodo">Período *</label>
          <input type="text" id="modal-periodo" required value="${ui.escapar(grupo?.periodo || '2026-2027')}" placeholder="Ej. 2026-2027" />
          <span class="campo__error oculto" id="err-modal-periodo"></span>
        </div>
      </div>

      <div class="campo">
        <label for="modal-docente">Docente Asignado *</label>
        <select id="modal-docente" required>
          <option value="">-- Seleccionar Docente --</option>
          ${docentes
            .map(
              (d) => `
            <option value="${ui.escapar(d.id)}" ${grupo?.docenteId === d.id ? 'selected' : ''}>
              ${ui.escapar(d.nombre)} ${ui.escapar(d.apellido)} (${ui.escapar(d.correo)})
            </option>
          `
            )
            .join('')}
        </select>
        <span class="campo__error oculto" id="err-modal-docente"></span>
      </div>

      <div class="campo">
        <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-xs);">
          <label style="margin: 0;">Estudiantes Asignados</label>
          <span style="font-size: var(--tamano-s);">
            Seleccionados: <strong id="contador-estudiantes">${seleccionados.size}</strong>
          </span>
        </div>

        <input
          type="search"
          id="buscador-estudiantes"
          placeholder="Buscar estudiante por nombre o correo..."
          style="margin-bottom: var(--espaciado-xs);"
        />

        <div class="selector-estudiantes-lista" id="lista-estudiantes">
          <!-- Opciones renderizadas dinámicamente -->
        </div>
      </div>

      <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-s); margin-top: var(--espaciado-s);">
        <button type="button" class="btn btn--secundario" id="btn-cancelar-modal">Cancelar</button>
        <button type="submit" class="btn btn--primario" id="btn-guardar-grupo">
          ${esEdicion ? 'Guardar Cambios' : 'Crear Grupo'}
        </button>
      </div>
    </form>
  `;

  const contenedorLista = formDiv.querySelector('#lista-estudiantes');
  const contadorEl = formDiv.querySelector('#contador-estudiantes');
  const buscadorEl = formDiv.querySelector('#buscador-estudiantes');

  function renderizarListaEstudiantes(filtro = '') {
    const norm = util.normalizar(filtro);
    const filtrados = estudiantesTodos.filter((est) => {
      if (!norm) return true;
      const nom = util.normalizar(est.nombre || '');
      const ape = util.normalizar(est.apellido || '');
      const cor = util.normalizar(est.correo || '');
      return nom.includes(norm) || ape.includes(norm) || cor.includes(norm) || `${nom} ${ape}`.includes(norm);
    });

    if (filtrados.length === 0) {
      contenedorLista.innerHTML = `<p style="font-size: var(--tamano-xs); text-align: center; opacity: 0.6; padding: var(--espaciado-s);">No se encontraron estudiantes</p>`;
      return;
    }

    contenedorLista.innerHTML = filtrados
      .map((est) => {
        const estaChecked = seleccionados.has(est.id);
        return `
        <label class="estudiante-opcion">
          <input type="checkbox" class="chk-estudiante" value="${ui.escapar(est.id)}" ${estaChecked ? 'checked' : ''} />
          <span style="font-size: var(--tamano-s);">
            <strong>${ui.escapar(est.nombre)} ${ui.escapar(est.apellido)}</strong> (${ui.escapar(est.correo)})
          </span>
        </label>
      `;
      })
      .join('');
  }

  contenedorLista.addEventListener('change', (e) => {
    if (e.target.classList.contains('chk-estudiante')) {
      const id = e.target.value;
      if (e.target.checked) {
        seleccionados.add(id);
      } else {
        seleccionados.delete(id);
      }
      contadorEl.textContent = String(seleccionados.size);
    }
  });

  buscadorEl.addEventListener('input', (e) => {
    renderizarListaEstudiantes(e.target.value);
  });

  renderizarListaEstudiantes();

  // Validaciones y Submit
  const inputAsig = formDiv.querySelector('#modal-asig');
  const inputParalelo = formDiv.querySelector('#modal-paralelo');
  const inputPeriodo = formDiv.querySelector('#modal-periodo');
  const inputDocente = formDiv.querySelector('#modal-docente');

  const errAsig = formDiv.querySelector('#err-modal-asig');
  const errParalelo = formDiv.querySelector('#err-modal-paralelo');
  const errPeriodo = formDiv.querySelector('#err-modal-periodo');
  const errDocente = formDiv.querySelector('#err-modal-docente');

  formDiv.querySelector('#form-modal-grupo').addEventListener('submit', async (e) => {
    e.preventDefault();

    let valido = true;
    const asignaturaId = inputAsig.value;
    const paralelo = inputParalelo.value.trim();
    const periodo = inputPeriodo.value.trim();
    const docenteId = inputDocente.value;
    const estudiantes = Array.from(seleccionados);

    if (!asignaturaId) {
      errAsig.textContent = 'Selecciona una asignatura';
      errAsig.classList.remove('oculto');
      valido = false;
    } else {
      errAsig.textContent = '';
      errAsig.classList.add('oculto');
    }

    if (!paralelo) {
      errParalelo.textContent = 'El paralelo es obligatorio';
      errParalelo.classList.remove('oculto');
      valido = false;
    } else {
      errParalelo.textContent = '';
      errParalelo.classList.add('oculto');
    }

    if (!periodo) {
      errPeriodo.textContent = 'El período es obligatorio';
      errPeriodo.classList.remove('oculto');
      valido = false;
    } else {
      errPeriodo.textContent = '';
      errPeriodo.classList.add('oculto');
    }

    if (!docenteId) {
      errDocente.textContent = 'Selecciona un docente';
      errDocente.classList.remove('oculto');
      valido = false;
    } else {
      errDocente.textContent = '';
      errDocente.classList.add('oculto');
    }

    if (!valido) return;

    try {
      ui.cargando(true);
      const payload = { asignaturaId, paralelo, periodo, docenteId, estudiantes };

      if (esEdicion) {
        await api.actualizar('distributivo', grupo.id, payload);
        ui.aviso('Grupo actualizado con éxito', 'exito');
      } else {
        await api.crear('distributivo', payload);
        ui.aviso('Grupo creado con éxito', 'exito');
      }

      document.querySelector('.modal-fondo')?.remove();
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar grupo', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  formDiv.querySelector('#btn-cancelar-modal').addEventListener('click', () => {
    document.querySelector('.modal-fondo')?.remove();
  });

  ui.modal({
    titulo: esEdicion ? 'Editar Grupo del Distributivo' : 'Nuevo Grupo del Distributivo',
    contenido: formDiv,
    acciones: []
  });
}

cargarDatos();
