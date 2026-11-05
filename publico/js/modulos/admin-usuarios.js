import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Administración de usuarios', roles: ['admin'] });

const contenido = document.getElementById('contenido');

let usuarios = [];
let textoBusqueda = '';
let rolFiltro = 'todos';

async function cargarUsuarios() {
  ui.cargando(true);
  try {
    usuarios = await api.listar('usuarios');
    renderizar();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar usuarios', 'error');
  } finally {
    ui.cargando(false);
  }
}

function filtrarUsuarios() {
  const normBusqueda = util.normalizar(textoBusqueda);

  return usuarios.filter((u) => {
    // Filtro por rol
    if (rolFiltro !== 'todos' && u.rol !== rolFiltro) {
      return false;
    }

    // Filtro por búsqueda
    if (!normBusqueda) return true;

    const nom = util.normalizar(u.nombre || '');
    const ape = util.normalizar(u.apellido || '');
    const cor = util.normalizar(u.correo || '');

    return (
      nom.includes(normBusqueda) ||
      ape.includes(normBusqueda) ||
      cor.includes(normBusqueda) ||
      `${nom} ${ape}`.includes(normBusqueda)
    );
  });
}

function renderizar() {
  if (!contenido) return;

  const yo = usuarioActual();
  const usuariosFiltrados = filtrarUsuarios();

  contenido.innerHTML = `
    <header class="pila" style="gap: var(--espaciado-xs); margin-bottom: var(--espaciado-m);">
      <h1>Administración de usuarios</h1>
      <p>Gestiona los roles, el estado de activación y restablece contraseñas de las cuentas del sistema.</p>
    </header>

    <section class="tarjeta pila" style="gap: var(--espaciado-m);">
      <div class="admin-filtros">
        <div class="admin-filtros-grupo">
          <div class="campo" style="margin: 0; min-width: 240px; flex: 1;">
            <label for="input-busqueda" class="sr-only">Buscar usuarios</label>
            <input
              type="search"
              id="input-busqueda"
              placeholder="Buscar por nombre, apellido o correo..."
              value="${ui.escapar(textoBusqueda)}"
              aria-label="Buscar usuarios"
            />
          </div>

          <div class="campo" style="margin: 0; min-width: 160px;">
            <label for="select-rol" class="sr-only">Filtrar por rol</label>
            <select id="select-rol" aria-label="Filtrar por rol">
              <option value="todos" ${rolFiltro === 'todos' ? 'selected' : ''}>Todos los roles</option>
              <option value="estudiante" ${rolFiltro === 'estudiante' ? 'selected' : ''}>Estudiantes</option>
              <option value="docente" ${rolFiltro === 'docente' ? 'selected' : ''}>Docentes</option>
              <option value="admin" ${rolFiltro === 'admin' ? 'selected' : ''}>Administradores</option>
            </select>
          </div>
        </div>

        <div style="font-size: var(--tamano-s); color: var(--color-texto); opacity: 0.8;">
          Total: <strong>${usuariosFiltrados.length}</strong> de ${usuarios.length} cuentas
        </div>
      </div>

      <div class="tabla">
        <table>
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Correo</th>
              <th scope="col" style="min-width: 140px;">Rol</th>
              <th scope="col" style="text-align: center;">Activo</th>
              <th scope="col" style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-cuerpo">
            ${
              usuariosFiltrados.length === 0
                ? `<tr><td colspan="5" style="text-align: center; padding: var(--espaciado-l);">No se encontraron usuarios</td></tr>`
                : usuariosFiltrados
                    .map((u) => {
                      const esYo = yo && yo.id === u.id;
                      const iniciales = (
                        (u.nombre?.[0] || '') + (u.apellido?.[0] || 'U')
                      ).toUpperCase();

                      return `
                        <tr data-id="${ui.escapar(u.id)}">
                          <td>
                            <div class="admin-usuario-info">
                              <span class="admin-avatar-mini" aria-hidden="true">
                                ${
                                  u.foto
                                    ? `<img src="${u.foto}" alt="" />`
                                    : `<span>${iniciales}</span>`
                                }
                              </span>
                              <div>
                                <strong>${ui.escapar(u.nombre)} ${ui.escapar(u.apellido)}</strong>
                                ${esYo ? '<span class="insignia insignia--acento" style="margin-left: 4px;">Tú</span>' : ''}
                                <div style="font-size: var(--tamano-xs); opacity: 0.6;">${ui.escapar(u.id)}</div>
                              </div>
                            </div>
                          </td>
                          <td>${ui.escapar(u.correo)}</td>
                          <td>
                            <select class="select-cambio-rol" data-id="${ui.escapar(u.id)}" aria-label="Rol para ${ui.escapar(u.nombre)}" ${esYo ? 'disabled title="No puedes modificar tu propio rol"' : ''}>
                              <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                              <option value="docente" ${u.rol === 'docente' ? 'selected' : ''}>Docente</option>
                              <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                            </select>
                          </td>
                          <td style="text-align: center;">
                            <label class="sr-only" for="chk-${ui.escapar(u.id)}">Usuario activo</label>
                            <input
                              type="checkbox"
                              id="chk-${ui.escapar(u.id)}"
                              class="chk-cambio-activo"
                              data-id="${ui.escapar(u.id)}"
                              ${u.activo !== false ? 'checked' : ''}
                              ${esYo ? 'disabled title="No puedes desactivar tu propia cuenta"' : ''}
                            />
                          </td>
                          <td style="text-align: right;">
                            <button
                              type="button"
                              class="btn btn--secundario btn--pequeno btn-restablecer"
                              data-id="${ui.escapar(u.id)}"
                              data-nombre="${ui.escapar(u.nombre)} ${ui.escapar(u.apellido)}"
                              data-correo="${ui.escapar(u.correo)}"
                            >
                              Restablecer clave
                            </button>
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

  // Eventos de filtro y búsqueda
  const inputBusqueda = document.getElementById('input-busqueda');
  const selectRol = document.getElementById('select-rol');

  inputBusqueda?.addEventListener('input', (e) => {
    textoBusqueda = e.target.value;
    renderizar();
    // Restaurar foco al final del input
    const el = document.getElementById('input-busqueda');
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  selectRol?.addEventListener('change', (e) => {
    rolFiltro = e.target.value;
    renderizar();
  });

  // Delegación de eventos en la tabla
  const tablaCuerpo = document.getElementById('tabla-cuerpo');
  if (!tablaCuerpo) return;

  // Cambio de Rol
  tablaCuerpo.addEventListener('change', async (e) => {
    const target = e.target;

    if (target.classList.contains('select-cambio-rol')) {
      const id = target.dataset.id;
      const nuevoRol = target.value;
      const usuarioObj = usuarios.find((u) => u.id === id);
      const rolAnterior = usuarioObj?.rol;

      try {
        ui.cargando(true);
        await api.actualizar('usuarios', id, { rol: nuevoRol });
        if (usuarioObj) usuarioObj.rol = nuevoRol;
        ui.aviso(`Rol actualizado a "${nuevoRol}"`, 'exito');
      } catch (err) {
        target.value = rolAnterior;
        ui.aviso(err.message || 'Error al actualizar rol', 'error');
      } finally {
        ui.cargando(false);
      }
    }

    // Cambio de Estado Activo
    if (target.classList.contains('chk-cambio-activo')) {
      const id = target.dataset.id;
      const nuevoEstado = target.checked;
      const usuarioObj = usuarios.find((u) => u.id === id);
      const estadoAnterior = usuarioObj?.activo !== false;

      try {
        ui.cargando(true);
        await api.actualizar('usuarios', id, { activo: nuevoEstado });
        if (usuarioObj) usuarioObj.activo = nuevoEstado;
        ui.aviso(`Cuenta ${nuevoEstado ? 'activada' : 'desactivada'} con éxito`, 'exito');
      } catch (err) {
        target.checked = estadoAnterior;
        ui.aviso(err.message || 'Error al cambiar estado de la cuenta', 'error');
      } finally {
        ui.cargando(false);
      }
    }
  });

  // Botón Restablecer Clave
  tablaCuerpo.addEventListener('click', async (e) => {
    const btnRestablecer = e.target.closest('.btn-restablecer');
    if (!btnRestablecer) return;

    const id = btnRestablecer.dataset.id;
    const nombre = btnRestablecer.dataset.nombre;
    const correo = btnRestablecer.dataset.correo;

    const confirmado = await ui.confirmar(
      `¿Deseas restablecer la contraseña de ${nombre}? Se generará una clave temporal.`
    );
    if (!confirmado) return;

    try {
      ui.cargando(true);
      const respuesta = await api.llamar('POST', `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`);
      ui.cargando(false);

      if (respuesta && respuesta.claveTemporal) {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'pila';
        modalDiv.style.gap = 'var(--espaciado-m)';

        modalDiv.innerHTML = `
          <p>Se ha generado una clave temporal para <strong>${ui.escapar(correo)}</strong>:</p>
          <div class="fila" style="gap: var(--espaciado-s); align-items: stretch;">
            <input
              type="text"
              readonly
              value="${ui.escapar(respuesta.claveTemporal)}"
              id="input-clave-temporal"
              style="font-family: monospace; font-size: var(--tamano-m); font-weight: var(--peso-negrita); text-align: center; letter-spacing: 2px;"
            />
            <button type="button" class="btn btn--primario" id="btn-copiar-temporal">
              Copiar
            </button>
          </div>
          <p style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8; margin: 0;">
            Copia esta clave y compártela con el usuario. Se le solicitará actualizarla al ingresar.
          </p>
        `;

        modalDiv.querySelector('#btn-copiar-temporal')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(respuesta.claveTemporal);
            ui.aviso('Clave temporal copiada al portapapeles', 'exito');
          } catch {
            const inputEl = modalDiv.querySelector('#input-clave-temporal');
            if (inputEl) {
              inputEl.select();
              ui.aviso('Selecciona el texto y presiona Ctrl+C', 'advertencia');
            }
          }
        });

        await ui.modal({
          titulo: 'Contraseña restablecida',
          contenido: modalDiv,
          acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn--secundario' }]
        });
      }
    } catch (err) {
      ui.cargando(false);
      ui.aviso(err.message || 'Error al restablecer contraseña', 'error');
    }
  });
}

cargarUsuarios();
