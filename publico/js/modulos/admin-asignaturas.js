import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Asignaturas', roles: ['admin'] });

const contenido = document.getElementById('contenido');
let asignaturas = [];
let distributivo = [];

async function cargarDatos() {
  ui.cargando(true);
  try {
    const [listaAsig, listaDist] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('distributivo')
    ]);
    asignaturas = listaAsig;
    distributivo = listaDist;
    renderizar();
  } catch (error) {
    ui.aviso(error.message || 'Error al cargar asignaturas', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizar() {
  if (!contenido) return;

  contenido.innerHTML = `
    <div class="asignaturas-cabecera">
      <div class="pila" style="gap: var(--espaciado-xs);">
        <h1>Gestión de Asignaturas</h1>
        <p>Administra las materias y niveles educativos del ecosistema digital.</p>
      </div>
      <div>
        <button type="button" class="btn btn--primario" id="btn-nueva-asignatura">
          + Nueva Asignatura
        </button>
      </div>
    </div>

    ${
      asignaturas.length === 0
        ? `
        <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
          <p>No hay asignaturas registradas actualmente.</p>
          <button type="button" class="btn btn--primario" id="btn-nueva-vacio" style="margin-top: var(--espaciado-m);">
            Crear primera asignatura
          </button>
        </div>
      `
        : `
        <div class="asignaturas-grid">
          ${asignaturas
            .map((asig) => {
              const gruposAsig = distributivo.filter((d) => d.asignaturaId === asig.id);
              const cantGrupos = gruposAsig.length;

              return `
                <article class="tarjeta tarjeta-asignatura" data-id="${ui.escapar(asig.id)}">
                  <div class="tarjeta-asignatura__cuerpo">
                    <div class="fila" style="justify-content: space-between; align-items: flex-start;">
                      <span class="insignia insignia--acento">${ui.escapar(asig.nivel || 'Nivel no definido')}</span>
                      <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.6;">${cantGrupos} ${cantGrupos === 1 ? 'grupo' : 'grupos'}</span>
                    </div>
                    <h2 style="font-size: var(--tamano-l); margin-top: var(--espaciado-xs); color: var(--color-primario);">
                      ${ui.escapar(asig.nombre)}
                    </h2>
                    <p style="font-size: var(--tamano-s); color: var(--color-texto); line-height: var(--interlineado-base);">
                      ${ui.escapar(asig.descripcion || 'Sin descripción')}
                    </p>
                  </div>
                  <div class="tarjeta-asignatura__acciones">
                    <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(asig.id)}">
                      Editar
                    </button>
                    <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(asig.id)}" data-grupos="${cantGrupos}">
                      Eliminar
                    </button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `
    }
  `;

  document.getElementById('btn-nueva-asignatura')?.addEventListener('click', () => abrirModalFormulario());
  document.getElementById('btn-nueva-vacio')?.addEventListener('click', () => abrirModalFormulario());

  contenido.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const asig = asignaturas.find((a) => a.id === id);
      if (asig) abrirModalFormulario(asig);
    });
  });

  contenido.querySelectorAll('.btn-eliminar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const cantGrupos = Number(btn.dataset.grupos || 0);

      if (cantGrupos > 0) {
        ui.aviso(`No se puede eliminar la asignatura porque tiene ${cantGrupos} grupo(s) asignado(s) en distributivo.`, 'error');
        return;
      }

      const confirmado = await ui.confirmar('¿Estás seguro de que deseas eliminar esta asignatura? Esta acción no se puede deshacer.');
      if (!confirmado) return;

      try {
        ui.cargando(true);
        await api.eliminar('asignaturas', id);
        ui.aviso('Asignatura eliminada con éxito', 'exito');
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al eliminar asignatura', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });
}

function abrirModalFormulario(asig = null) {
  const esEdicion = Boolean(asig);
  const formDiv = document.createElement('div');
  formDiv.className = 'pila';
  formDiv.style.gap = 'var(--espaciado-m)';

  formDiv.innerHTML = `
    <form id="form-modal-asig" class="pila" novalidate>
      <div class="campo">
        <label for="modal-nombre">Nombre de la Asignatura *</label>
        <input type="text" id="modal-nombre" required value="${ui.escapar(asig?.nombre || '')}" placeholder="Ej. BIOLOGÍA" />
        <span class="campo__error oculto" id="err-modal-nombre"></span>
      </div>

      <div class="campo">
        <label for="modal-nivel">Nivel Educativo *</label>
        <input type="text" id="modal-nivel" required value="${ui.escapar(asig?.nivel || '')}" placeholder="Ej. BACHILLERATO" />
        <span class="campo__error oculto" id="err-modal-nivel"></span>
      </div>

      <div class="campo">
        <label for="modal-descripcion">Descripción</label>
        <textarea id="modal-descripcion" rows="3" placeholder="Breve resumen de la asignatura...">${ui.escapar(asig?.descripcion || '')}</textarea>
      </div>

      <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-s); margin-top: var(--espaciado-s);">
        <button type="button" class="btn btn--secundario" id="btn-cancelar-modal">Cancelar</button>
        <button type="submit" class="btn btn--primario" id="btn-guardar-modal">
          ${esEdicion ? 'Guardar Cambios' : 'Crear Asignatura'}
        </button>
      </div>
    </form>
  `;

  const inputNombre = formDiv.querySelector('#modal-nombre');
  const inputNivel = formDiv.querySelector('#modal-nivel');
  const inputDesc = formDiv.querySelector('#modal-descripcion');
  const errNombre = formDiv.querySelector('#err-modal-nombre');
  const errNivel = formDiv.querySelector('#err-modal-nivel');

  let modalObjPromise = null;

  formDiv.querySelector('#form-modal-asig').addEventListener('submit', async (e) => {
    e.preventDefault();

    let valido = true;
    const nombre = inputNombre.value.trim();
    const nivel = inputNivel.value.trim();
    const descripcion = inputDesc.value.trim();

    if (!nombre) {
      errNombre.textContent = 'El nombre es obligatorio';
      errNombre.classList.remove('oculto');
      valido = false;
    } else {
      errNombre.textContent = '';
      errNombre.classList.add('oculto');
    }

    if (!nivel) {
      errNivel.textContent = 'El nivel es obligatorio';
      errNivel.classList.remove('oculto');
      valido = false;
    } else {
      errNivel.textContent = '';
      errNivel.classList.add('oculto');
    }

    if (!valido) return;

    try {
      ui.cargando(true);
      if (esEdicion) {
        await api.actualizar('asignaturas', asig.id, { nombre, nivel, descripcion });
        ui.aviso('Asignatura actualizada', 'exito');
      } else {
        await api.crear('asignaturas', { nombre, nivel, descripcion });
        ui.aviso('Asignatura creada', 'exito');
      }
      // Cerrar modal
      document.querySelector('.modal-fondo')?.remove();
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  formDiv.querySelector('#btn-cancelar-modal').addEventListener('click', () => {
    document.querySelector('.modal-fondo')?.remove();
  });

  ui.modal({
    titulo: esEdicion ? 'Editar Asignatura' : 'Nueva Asignatura',
    contenido: formDiv,
    acciones: []
  });
}

cargarDatos();
