import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de noticia', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const noticiaId = util.parametro('id');
const esEdicion = Boolean(noticiaId);

let noticia = null;
let temas = [];

async function iniciar() {
  ui.cargando(true);
  try {
    const [listaTemas, datosNoticia] = await Promise.all([
      api.listar('temas'),
      esEdicion ? api.obtener('noticias', noticiaId) : Promise.resolve(null)
    ]);

    temas = listaTemas || [];
    noticia = datosNoticia || {
      titulo: '',
      resumen: '',
      cuerpo: '',
      imagen: '',
      categoria: 'Institucional',
      temaId: '',
      destacada: false,
      estado: 'borrador'
    };

    renderizar();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar noticia', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizar() {
  if (!contenido) return;

  contenido.innerHTML = `
    <header class="pila" style="gap: var(--espaciado-xs);">
      <nav style="margin-bottom: var(--espaciado-xs);">
        <a href="/paginas/noticias.html" style="font-size: var(--tamano-s);">← Volver a Noticias</a>
      </nav>
      <h1>${esEdicion ? 'Editar Noticia' : 'Nueva Noticia'}</h1>
      <p>Redacta y publica comunicados, eventos y novedades académicas para la comunidad educativa.</p>
    </header>

    <div class="editor-noticia-layout">
      <!-- Formulario de Edición -->
      <form id="form-noticia" class="tarjeta pila" style="gap: var(--espaciado-m);" novalidate>
        <div class="campo">
          <label for="campo-titulo"><strong>Título de la noticia *</strong></label>
          <input type="text" id="campo-titulo" required value="${ui.escapar(noticia.titulo || '')}" placeholder="Ej. Concurso de Competencias Digitales 2026" />
          <span class="campo__error oculto" id="err-titulo"></span>
        </div>

        <div class="campo">
          <div class="fila" style="justify-content: space-between;">
            <label for="campo-resumen"><strong>Resumen breve *</strong></label>
            <span style="font-size: var(--tamano-xs); opacity: 0.8;" id="cont-resumen">0 / 200</span>
          </div>
          <textarea id="campo-resumen" rows="3" maxlength="200" required placeholder="Breve introducción de hasta 200 caracteres...">${ui.escapar(noticia.resumen || '')}</textarea>
          <span class="campo__error oculto" id="err-resumen"></span>
        </div>

        <div class="campo">
          <label for="campo-cuerpo"><strong>Cuerpo de la noticia *</strong> (admite formato básico con viñetas y párrafos)</label>
          <textarea id="campo-cuerpo" rows="9" required placeholder="Escribe el desarrollo completo de la noticia...">${ui.escapar(noticia.cuerpo || '')}</textarea>
          <span class="campo__error oculto" id="err-cuerpo"></span>
        </div>

        <div class="campo">
          <label><strong>Imagen de portada</strong></label>
          <div class="fila" style="gap: var(--espaciado-s);">
            <input type="text" id="campo-imagen" value="${ui.escapar(noticia.imagen || '')}" placeholder="URL o sube una imagen..." style="flex: 1;" />
            <button type="button" class="btn btn--secundario" id="btn-subir-img">Subir Imagen</button>
          </div>
        </div>

        <div class="fila" style="gap: var(--espaciado-m); flex-wrap: wrap;">
          <div class="campo" style="flex: 1; min-width: 180px;">
            <label for="campo-categoria"><strong>Categoría *</strong></label>
            <select id="campo-categoria">
              <option value="Institucional" ${noticia.categoria === 'Institucional' ? 'selected' : ''}>Institucional</option>
              <option value="Académica" ${noticia.categoria === 'Académica' ? 'selected' : ''}>Académica</option>
              <option value="Eventos" ${noticia.categoria === 'Eventos' ? 'selected' : ''}>Eventos</option>
              <option value="Logros" ${noticia.categoria === 'Logros' ? 'selected' : ''}>Logros</option>
            </select>
          </div>

          <div class="campo" style="flex: 1; min-width: 180px;">
            <label for="campo-tema"><strong>Tema relacionado</strong> (opcional)</label>
            <select id="campo-tema">
              <option value="">-- Ninguno --</option>
              ${temas
                .map(
                  (t) =>
                    `<option value="${ui.escapar(t.id)}" ${noticia.temaId === t.id ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="fila" style="gap: var(--espaciado-m); align-items: center; flex-wrap: wrap;">
          <div class="campo" style="flex: 1; min-width: 160px;">
            <label for="campo-estado"><strong>Estado *</strong></label>
            <select id="campo-estado">
              <option value="borrador" ${noticia.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
              <option value="publicado" ${noticia.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
            </select>
          </div>

          <div class="campo" style="flex: 1; min-width: 160px; margin-top: var(--espaciado-m);">
            <label style="display: flex; align-items: center; gap: var(--espaciado-s); cursor: pointer;">
              <input type="checkbox" id="campo-destacada" ${noticia.destacada ? 'checked' : ''} />
              <span><strong>Destacar en portada</strong></span>
            </label>
          </div>
        </div>

        <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-s); margin-top: var(--espaciado-s);">
          <a href="/paginas/noticias.html" class="btn btn--secundario">Cancelar</a>
          <button type="submit" class="btn btn--primario" id="btn-guardar-noticia">
            ${esEdicion ? 'Guardar Cambios' : 'Publicar Noticia'}
          </button>
        </div>
      </form>

      <!-- Panel de Vista Previa en Vivo -->
      <aside class="noticia-preview-box" aria-label="Vista previa">
        <h2 style="font-size: var(--tamano-m); margin: 0; color: var(--color-primario); border-bottom: 1px solid var(--color-borde); padding-bottom: var(--espaciado-xs);">
          👁 Vista previa
        </h2>

        <div id="preview-img-cont" style="${noticia.imagen ? '' : 'display:none;'}">
          <img src="${ui.escapar(noticia.imagen || '')}" alt="Portada" class="noticia-preview-img" id="preview-img" />
        </div>

        <div>
          <div class="fila" style="gap: var(--espaciado-xs); margin-bottom: var(--espaciado-xs);">
            <span class="insignia insignia--acento" id="preview-cat">${ui.escapar(noticia.categoria)}</span>
            <span class="insignia" id="preview-dest" style="${noticia.destacada ? '' : 'display:none;'}">★ Destacada</span>
            <span class="insignia" id="preview-estado">${ui.escapar(noticia.estado)}</span>
          </div>
          <h3 id="preview-titulo" style="font-size: var(--tamano-l); margin: 0;">${ui.escapar(noticia.titulo || 'Título de la noticia')}</h3>
        </div>

        <p id="preview-resumen" style="font-size: var(--tamano-s); color: var(--color-texto); font-weight: var(--peso-medio); margin: 0;">
          ${ui.escapar(noticia.resumen || 'Resumen de la noticia...')}
        </p>

        <div id="preview-cuerpo" style="font-size: var(--tamano-s); line-height: var(--interlineado-base); border-top: 1px solid var(--color-borde); padding-top: var(--espaciado-s);">
          ${util.formatoBasico(noticia.cuerpo || '')}
        </div>
      </aside>
    </div>
  `;

  vincularEventos();
}

function vincularEventos() {
  const form = document.getElementById('form-noticia');
  const inputTitulo = document.getElementById('campo-titulo');
  const inputResumen = document.getElementById('campo-resumen');
  const inputCuerpo = document.getElementById('campo-cuerpo');
  const inputImagen = document.getElementById('campo-imagen');
  const selectCat = document.getElementById('campo-categoria');
  const selectTema = document.getElementById('campo-tema');
  const selectEstado = document.getElementById('campo-estado');
  const chkDestacada = document.getElementById('campo-destacada');
  const btnSubirImg = document.getElementById('btn-subir-img');

  const contResumen = document.getElementById('cont-resumen');
  const prevTitulo = document.getElementById('preview-titulo');
  const prevResumen = document.getElementById('preview-resumen');
  const prevCuerpo = document.getElementById('preview-cuerpo');
  const prevCat = document.getElementById('preview-cat');
  const prevDest = document.getElementById('preview-dest');
  const prevEstado = document.getElementById('preview-estado');
  const prevImg = document.getElementById('preview-img');
  const prevImgCont = document.getElementById('preview-img-cont');

  function actualizarPreview() {
    prevTitulo.textContent = inputTitulo.value || 'Título de la noticia';
    prevResumen.textContent = inputResumen.value || 'Resumen de la noticia...';
    contResumen.textContent = `${inputResumen.value.length} / 200`;
    prevCuerpo.innerHTML = util.formatoBasico(inputCuerpo.value || '');
    prevCat.textContent = selectCat.value;
    prevEstado.textContent = selectEstado.value;
    prevDest.style.display = chkDestacada.checked ? 'inline-block' : 'none';

    if (inputImagen.value) {
      prevImg.src = inputImagen.value;
      prevImgCont.style.display = 'block';
    } else {
      prevImgCont.style.display = 'none';
    }
  }

  [inputTitulo, inputResumen, inputCuerpo, inputImagen, selectCat, selectEstado, chkDestacada].forEach((el) => {
    el.addEventListener('input', actualizarPreview);
    el.addEventListener('change', actualizarPreview);
  });
  actualizarPreview();

  // Subir imagen
  btnSubirImg.addEventListener('click', () => {
    const inputF = document.createElement('input');
    inputF.type = 'file';
    inputF.accept = 'image/jpeg,image/png,image/webp';
    inputF.addEventListener('change', async () => {
      const arch = inputF.files?.[0];
      if (!arch) return;
      try {
        ui.cargando(true);
        const res = await api.subir(arch);
        if (res && res.url) {
          inputImagen.value = res.url;
          actualizarPreview();
          ui.aviso('Imagen subida con éxito', 'exito');
        }
      } catch (err) {
        ui.aviso(err.message || 'Error al subir imagen', 'error');
      } finally {
        ui.cargando(false);
      }
    });
    inputF.click();
  });

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valido = true;
    const titulo = inputTitulo.value.trim();
    const resumen = inputResumen.value.trim();
    const cuerpo = inputCuerpo.value.trim();

    const errTitulo = document.getElementById('err-titulo');
    const errResumen = document.getElementById('err-resumen');
    const errCuerpo = document.getElementById('err-cuerpo');

    if (!titulo) {
      errTitulo.textContent = 'El título es obligatorio';
      errTitulo.classList.remove('oculto');
      valido = false;
    } else {
      errTitulo.textContent = '';
      errTitulo.classList.add('oculto');
    }

    if (!resumen) {
      errResumen.textContent = 'El resumen es obligatorio';
      errResumen.classList.remove('oculto');
      valido = false;
    } else if (resumen.length > 200) {
      errResumen.textContent = 'Máximo 200 caracteres permitidos';
      errResumen.classList.remove('oculto');
      valido = false;
    } else {
      errResumen.textContent = '';
      errResumen.classList.add('oculto');
    }

    if (!cuerpo) {
      errCuerpo.textContent = 'El cuerpo de la noticia es obligatorio';
      errCuerpo.classList.remove('oculto');
      valido = false;
    } else {
      errCuerpo.textContent = '';
      errCuerpo.classList.add('oculto');
    }

    if (!valido) return;

    const payload = {
      titulo,
      resumen,
      cuerpo,
      imagen: inputImagen.value.trim() || null,
      categoria: selectCat.value,
      temaId: selectTema.value || null,
      destacada: chkDestacada.checked,
      estado: selectEstado.value
    };

    try {
      ui.cargando(true);
      if (esEdicion) {
        await api.actualizar('noticias', noticiaId, payload);
        ui.aviso('Noticia actualizada', 'exito');
      } else {
        await api.crear('noticias', payload);
        ui.aviso('Noticia creada con éxito', 'exito');
      }
      setTimeout(() => {
        window.location.href = '/paginas/noticias.html';
      }, 500);
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar noticia', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

iniciar();

