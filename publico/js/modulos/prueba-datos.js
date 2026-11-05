import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Prueba de datos', roles: ['publico'] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="pila">
      <header>
        <h1>Prueba de datos y almacenamiento</h1>
        <p>Formulario conectado al servidor base para crear y consultar registros en la colección <code>prueba</code>.</p>
      </header>

      <section class="tarjeta pila">
        <h2>Nuevo registro</h2>
        <form id="form-prueba" class="prueba-formulario" novalidate>
          <div class="campo">
            <label for="campo-texto">Texto del registro</label>
            <input
              type="text"
              id="campo-texto"
              name="texto"
              placeholder="Escribe un mensaje para guardar..."
              required
              autocomplete="off"
            />
          </div>
          <div class="fila">
            <button type="submit" class="btn btn--primario" id="btn-guardar">
              Guardar registro
            </button>
          </div>
        </form>
      </section>

      <section class="tarjeta pila prueba-lista">
        <div class="fila" style="justify-content: space-between;">
          <h2>Registros guardados</h2>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-recargar">
            Recargar
          </button>
        </div>
        <div id="contenedor-registros" aria-live="polite">
          <div class="cargando">
            <div class="cargando-spinner" aria-hidden="true"></div>
            <span>Cargando registros...</span>
          </div>
        </div>
      </section>
    </div>
  `;

  const form = document.getElementById('form-prueba');
  const inputTexto = document.getElementById('campo-texto');
  const btnGuardar = document.getElementById('btn-guardar');
  const contenedorRegistros = document.getElementById('contenedor-registros');
  const btnRecargar = document.getElementById('btn-recargar');

  async function cargarRegistros() {
    try {
      const lista = await api.listar('prueba');
      if (!Array.isArray(lista) || lista.length === 0) {
        contenedorRegistros.innerHTML = `
          <div class="vacio">
            <div class="vacio__titulo">No hay registros</div>
            <p class="vacio__texto">Aún no se han guardado registros en la colección prueba. Ingresa un texto arriba para comenzar.</p>
          </div>
        `;
        return;
      }

      const filas = lista
        .map(
          (reg) => `
            <tr>
              <td><code>${ui.escapar(reg.id)}</code></td>
              <td>${ui.escapar(reg.texto)}</td>
              <td>${reg.fecha ? fechaRelativa(reg.fecha) : '-'}</td>
            </tr>
          `
        )
        .join('');

      contenedorRegistros.innerHTML = `
        <div class="tabla" tabindex="0" role="region" aria-label="Lista de registros guardados">
          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Texto</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${filas}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      contenedorRegistros.innerHTML = `
        <div class="alerta alerta--error" role="alert">
          Error al cargar registros: ${ui.escapar(error.message)}
        </div>
      `;
      ui.aviso(error.message, 'error');
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = inputTexto.value.trim();

    if (!texto) {
      ui.aviso('Por favor escribe un texto para guardar', 'advertencia');
      inputTexto.focus();
      return;
    }

    try {
      btnGuardar.disabled = true;
      ui.cargando(true);
      await api.crear('prueba', { texto });
      ui.aviso('Registro guardado exitosamente', 'exito');
      inputTexto.value = '';
      await cargarRegistros();
    } catch (error) {
      ui.aviso(error.message || 'Error al guardar el registro', 'error');
    } finally {
      btnGuardar.disabled = false;
      ui.cargando(false);
      inputTexto.focus();
    }
  });

  btnRecargar?.addEventListener('click', () => {
    cargarRegistros();
  });

  // Carga inicial
  cargarRegistros();
}
