// Cliente: selector de temas para actividades y juegos formativos (§A contratos.md)
import * as api from './api.js';
import * as util from './util.js';
import * as ui from './ui.js';

// Retorna el tema de la URL (?temaId=) o abre un modal interactivo para seleccionarlo
export async function obtenerTemaActividad() {
  // 1. Si viene ?temaId= en los parámetros de la URL
  const temaIdParam = util.parametro('temaId');
  if (temaIdParam) {
    try {
      const tema = await api.obtener('temas', temaIdParam);
      if (tema && tema.id) {
        return tema;
      }
    } catch (err) {
      console.warn('No se pudo cargar el tema indicado por parámetro:', err);
    }
  }

  // 2. Si no hay ?temaId= o no se encontró, abrir modal con selects en cascada
  ui.cargando(true);
  let asignaturas = [];
  let unidades = [];
  let temas = [];

  try {
    [asignaturas, unidades, temas] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);
  } catch (err) {
    ui.aviso('Error al cargar catálogo de contenidos', 'error');
    throw err;
  } finally {
    ui.cargando(false);
  }

  const unidadesVisibles = unidades.filter((u) => u.visible !== false);
  const temasPublicados = temas.filter((t) => t.estado === 'publicado');

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espaciado-m)';

  contenedor.innerHTML = `
    <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">
      Selecciona la asignatura, unidad y tema sobre el cual deseas realizar esta actividad:
    </p>

    <div class="campo">
      <label for="sel-modal-asignatura">Asignatura</label>
      <select id="sel-modal-asignatura">
        <option value="">-- Elige una asignatura --</option>
        ${asignaturas.map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)}</option>`).join('')}
      </select>
    </div>

    <div class="campo">
      <label for="sel-modal-unidad">Unidad</label>
      <select id="sel-modal-unidad" disabled>
        <option value="">-- Primero elige una asignatura --</option>
      </select>
    </div>

    <div class="campo">
      <label for="sel-modal-tema">Tema</label>
      <select id="sel-modal-tema" disabled>
        <option value="">-- Primero elige una unidad --</option>
      </select>
    </div>
  `;

  const selAsig = contenedor.querySelector('#sel-modal-asignatura');
  const selUni = contenedor.querySelector('#sel-modal-unidad');
  const selTem = contenedor.querySelector('#sel-modal-tema');

  selAsig.addEventListener('change', () => {
    const asigId = selAsig.value;
    selUni.innerHTML = '<option value="">-- Elige una unidad --</option>';
    selTem.innerHTML = '<option value="">-- Primero elige una unidad --</option>';
    selTem.disabled = true;

    if (!asigId) {
      selUni.disabled = true;
      return;
    }

    const unids = unidadesVisibles.filter((u) => u.asignaturaId === asigId);
    unids.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.titulo;
      selUni.appendChild(opt);
    });
    selUni.disabled = unids.length === 0;
  });

  selUni.addEventListener('change', () => {
    const uniId = selUni.value;
    selTem.innerHTML = '<option value="">-- Elige un tema --</option>';

    if (!uniId) {
      selTem.disabled = true;
      return;
    }

    const tms = temasPublicados.filter((t) => t.unidadId === uniId);
    tms.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selTem.appendChild(opt);
    });
    selTem.disabled = tms.length === 0;
  });

  const confirmacion = await ui.modal({
    titulo: 'Elegir tema de estudio',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Seleccionar', valor: 'seleccionar', clase: 'btn--primario' }
    ]
  });

  if (confirmacion === 'seleccionar' && selTem.value) {
    const elegido = temasPublicados.find((t) => t.id === selTem.value);
    if (elegido) return elegido;
  }

  return null;
}

