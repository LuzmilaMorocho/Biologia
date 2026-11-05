import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de canción', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const cancionId = util.parametro('id');
const esEdicion = Boolean(cancionId);

let cancion = null;
let temas = [];

async function iniciar() {
  ui.cargando(true);
  try {
    const [listaTemas, datosCancion] = await Promise.all([
      api.listar('temas'),
      esEdicion ? api.obtener('canciones', cancionId) : Promise.resolve(null)
    ]);

    temas = listaTemas || [];
    cancion = datosCancion || {
      titulo: '',
      temaId: temas.length > 0 ? temas[0].id : '',
      audio: '',
      letra: '',
      lrc: '',
      autoria: '',
      licencia: 'Propia'
    };

    renderizar();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar canción', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizar() {
  if (!contenido) return;

  const esOtraLicencia = !['Propia', 'CC BY', 'CC BY-SA'].includes(cancion.licencia);
  const tipoLicencia = esOtraLicencia ? 'Otra' : cancion.licencia;
  const descripcionOtra = esOtraLicencia ? cancion.licencia : '';

  contenido.innerHTML = `
    <header class="pila" style="gap: var(--espaciado-xs);">
      <nav style="margin-bottom: var(--espaciado-xs);">
        <a href="/paginas/canciones.html" style="font-size: var(--tamano-s);">← Volver a Canciones</a>
      </nav>
      <h1>${esEdicion ? 'Editar Canción Educativa' : 'Nueva Canción Educativa'}</h1>
      <p>Sube temas musicales pedagógicos, registra su letra y sincronización LRC para los estudiantes.</p>
    </header>

    <div class="editor-cancion-layout">
      <!-- Formulario de Edición -->
      <form id="form-cancion" class="tarjeta pila" style="gap: var(--espaciado-m);" novalidate>
        <div class="campo">
          <label for="campo-titulo"><strong>Título de la canción *</strong></label>
          <input type="text" id="campo-titulo" required value="${ui.escapar(cancion.titulo || '')}" placeholder="Ej. El Rap de la Célula Eucariota" />
          <span class="campo__error oculto" id="err-titulo"></span>
        </div>

        <div class="campo">
          <label for="campo-tema"><strong>Tema pedagógico vinculado *</strong></label>
          <select id="campo-tema" required>
            <option value="">-- Selecciona un tema --</option>
            ${temas
              .map(
                (t) =>
                  `<option value="${ui.escapar(t.id)}" ${cancion.temaId === t.id ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`
              )
              .join('')}
          </select>
          <span class="campo__error oculto" id="err-tema"></span>
        </div>

        <div class="campo">
          <label for="campo-audio"><strong>Archivo de audio MP3 *</strong></label>
          <div class="fila" style="gap: var(--espaciado-s);">
            <input type="text" id="campo-audio" required value="${ui.escapar(cancion.audio || '')}" placeholder="URL del archivo MP3..." style="flex: 1;" />
            <button type="button" class="btn btn--secundario" id="btn-subir-mp3">Subir MP3</button>
          </div>
          <span class="campo__error oculto" id="err-audio"></span>
        </div>

        <div class="campo">
          <label for="campo-letra"><strong>Letra completa de la canción *</strong></label>
          <textarea id="campo-letra" rows="8" required placeholder="Escribe o pega aquí la letra de la canción...">${ui.escapar(cancion.letra || '')}</textarea>
          <span class="campo__error oculto" id="err-letra"></span>
        </div>

        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <label for="campo-lrc"><strong>Letra sincronizada LRC (opcional)</strong></label>
            <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.7;">Formato: [mm:ss.xx] Verso</span>
          </div>
          <textarea id="campo-lrc" rows="8" placeholder="[00:12.30] En el núcleo reside el material genético&#10;[00:16.80] La célula eucariota tiene un orden cinético...">${ui.escapar(cancion.lrc || '')}</textarea>
        </div>

        <div class="fila" style="gap: var(--espaciado-m); flex-wrap: wrap;">
          <div class="campo" style="flex: 1; min-width: 220px;">
            <label for="campo-autoria"><strong>Autoría / Intérprete *</strong></label>
            <input type="text" id="campo-autoria" required value="${ui.escapar(cancion.autoria || '')}" placeholder="Nombre del docente, autor o grupo musical" />
            <span class="campo__error oculto" id="err-autoria"></span>
          </div>

          <div class="campo" style="flex: 1; min-width: 220px;">
            <label for="campo-licencia-tipo"><strong>Licencia de uso *</strong></label>
            <select id="campo-licencia-tipo" required>
              <option value="Propia" ${tipoLicencia === 'Propia' ? 'selected' : ''}>Propia</option>
              <option value="CC BY" ${tipoLicencia === 'CC BY' ? 'selected' : ''}>Creative Commons BY (Reconocimiento)</option>
              <option value="CC BY-SA" ${tipoLicencia === 'CC BY-SA' ? 'selected' : ''}>Creative Commons BY-SA (Compartir Igual)</option>
              <option value="Otra" ${tipoLicencia === 'Otra' ? 'selected' : ''}>Otra (especificar)</option>
            </select>
          </div>
        </div>

        <div class="campo ${tipoLicencia === 'Otra' ? '' : 'oculto'}" id="campo-otra-licencia-cont">
          <label for="campo-otra-licencia"><strong>Descripción de la licencia *</strong></label>
          <input type="text" id="campo-otra-licencia" value="${ui.escapar(descripcionOtra)}" placeholder="Detalla los términos o permisos de la obra..." />
          <span class="campo__error oculto" id="err-otra-licencia"></span>
        </div>

        <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-s); margin-top: var(--espaciado-s);">
          <a href="/paginas/canciones.html" class="btn btn--secundario">Cancelar</a>
          <button type="submit" class="btn btn--primario" id="btn-guardar-cancion">
            ${esEdicion ? 'Guardar Cambios' : 'Publicar Canción'}
          </button>
        </div>
      </form>

      <!-- Panel Lateral de Vista Previa de Audio -->
      <aside class="editor-audio-preview" aria-label="Vista previa de audio">
        <h2 style="font-size: var(--tamano-m); margin: 0; color: var(--color-primario); border-bottom: 1px solid var(--color-borde); padding-bottom: var(--espaciado-xs);">
          🎵 Comprobación de Audio
        </h2>
        <div id="preview-audio-cont">
          ${
            cancion.audio
              ? `
            <audio controls src="${ui.escapar(cancion.audio)}" style="width: 100%; margin-top: var(--espaciado-s);" id="audio-preview-el"></audio>
            <p style="font-size: var(--tamano-xs); color: var(--color-exito); margin-top: 4px;">✓ Audio cargado</p>
          `
              : `<p style="font-size: var(--tamano-s); opacity: 0.7; margin: 0;">Sube o ingresa un archivo MP3 para comprobar la reproducción.</p>`
          }
        </div>
      </aside>
    </div>
  `;

  vincularEventos();
}

function vincularEventos() {
  const form = document.getElementById('form-cancion');
  const inputTitulo = document.getElementById('campo-titulo');
  const selectTema = document.getElementById('campo-tema');
  const inputAudio = document.getElementById('campo-audio');
  const inputLetra = document.getElementById('campo-letra');
  const inputLrc = document.getElementById('campo-lrc');
  const inputAutoria = document.getElementById('campo-autoria');
  const selectLicTipo = document.getElementById('campo-licencia-tipo');
  const inputOtraLic = document.getElementById('campo-otra-licencia');
  const contOtraLic = document.getElementById('campo-otra-licencia-cont');
  const btnSubirMp3 = document.getElementById('btn-subir-mp3');
  const previewCont = document.getElementById('preview-audio-cont');

  selectLicTipo.addEventListener('change', () => {
    if (selectLicTipo.value === 'Otra') {
      contOtraLic.classList.remove('oculto');
      inputOtraLic.focus();
    } else {
      contOtraLic.classList.add('oculto');
    }
  });

  inputAudio.addEventListener('change', () => {
    actualizarAudioPreview(inputAudio.value.trim());
  });

  function actualizarAudioPreview(url) {
    if (url) {
      previewCont.innerHTML = `
        <audio controls src="${ui.escapar(url)}" style="width: 100%; margin-top: var(--espaciado-s);" id="audio-preview-el"></audio>
        <p style="font-size: var(--tamano-xs); color: var(--color-exito); margin-top: 4px;">✓ Audio cargado</p>
      `;
    } else {
      previewCont.innerHTML = `<p style="font-size: var(--tamano-s); opacity: 0.7; margin: 0;">Sube o ingresa un archivo MP3 para comprobar la reproducción.</p>`;
    }
  }

  // Subir MP3
  btnSubirMp3.addEventListener('click', () => {
    const inputF = document.createElement('input');
    inputF.type = 'file';
    inputF.accept = 'audio/mpeg,audio/mp3';
    inputF.addEventListener('change', async () => {
      const arch = inputF.files?.[0];
      if (!arch) return;
      try {
        ui.cargando(true);
        const res = await api.subir(arch);
        if (res && res.url) {
          inputAudio.value = res.url;
          actualizarAudioPreview(res.url);
          ui.aviso('Audio MP3 subido con éxito', 'exito');
        }
      } catch (err) {
        ui.aviso(err.message || 'Error al subir audio', 'error');
      } finally {
        ui.cargando(false);
      }
    });
    inputF.click();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valido = true;
    const titulo = inputTitulo.value.trim();
    const temaId = selectTema.value;
    const audio = inputAudio.value.trim();
    const letra = inputLetra.value.trim();
    const lrc = inputLrc.value.trim();
    const autoria = inputAutoria.value.trim();
    const licTipo = selectLicTipo.value;
    const otraLic = inputOtraLic.value.trim();

    const errTitulo = document.getElementById('err-titulo');
    const errTema = document.getElementById('err-tema');
    const errAudio = document.getElementById('err-audio');
    const errLetra = document.getElementById('err-letra');
    const errAutoria = document.getElementById('err-autoria');
    const errOtraLic = document.getElementById('err-otra-licencia');

    if (!titulo) {
      errTitulo.textContent = 'El título es obligatorio';
      errTitulo.classList.remove('oculto');
      valido = false;
    } else {
      errTitulo.textContent = '';
      errTitulo.classList.add('oculto');
    }

    if (!temaId) {
      errTema.textContent = 'Debes seleccionar un tema';
      errTema.classList.remove('oculto');
      valido = false;
    } else {
      errTema.textContent = '';
      errTema.classList.add('oculto');
    }

    if (!audio) {
      errAudio.textContent = 'La URL o archivo de audio MP3 es obligatorio';
      errAudio.classList.remove('oculto');
      valido = false;
    } else {
      errAudio.textContent = '';
      errAudio.classList.add('oculto');
    }

    if (!letra) {
      errLetra.textContent = 'La letra es obligatoria';
      errLetra.classList.remove('oculto');
      valido = false;
    } else {
      errLetra.textContent = '';
      errLetra.classList.add('oculto');
    }

    if (!autoria) {
      errAutoria.textContent = 'La autoría es obligatoria';
      errAutoria.classList.remove('oculto');
      valido = false;
    } else {
      errAutoria.textContent = '';
      errAutoria.classList.add('oculto');
    }

    let licenciaFinal = licTipo;
    if (licTipo === 'Otra') {
      if (!otraLic) {
        errOtraLic.textContent = 'Debes describir la licencia';
        errOtraLic.classList.remove('oculto');
        valido = false;
      } else {
        errOtraLic.textContent = '';
        errOtraLic.classList.add('oculto');
        licenciaFinal = otraLic;
      }
    }

    if (!valido) return;

    const payload = {
      titulo,
      temaId,
      audio,
      letra,
      lrc: lrc || null,
      autoria,
      licencia: licenciaFinal
    };

    try {
      ui.cargando(true);
      if (esEdicion) {
        await api.actualizar('canciones', cancionId, payload);
        ui.aviso('Canción actualizada con éxito', 'exito');
      } else {
        await api.crear('canciones', payload);
        ui.aviso('Canción publicada con éxito', 'exito');
      }
      setTimeout(() => {
        window.location.href = '/paginas/canciones.html';
      }, 500);
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar canción', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

iniciar();

