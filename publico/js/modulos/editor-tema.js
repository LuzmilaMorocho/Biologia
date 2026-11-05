import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Ficha del tema', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('id');

let tema = null;
let unidad = null;
let asignatura = null;
let terminosGlosario = [];
let hayCambiosSinGuardar = false;

function marcarCambio() {
  hayCambiosSinGuardar = true;
}

window.addEventListener('beforeunload', (e) => {
  if (hayCambiosSinGuardar) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function cargarDatos() {
  if (!temaId) {
    renderizarError('No se especificó ningún identificador de tema.');
    return;
  }

  ui.cargando(true);
  try {
    const [datosTema, listaGlosario, listaUnidades, listaAsignaturas] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('glosario', { temaId }),
      api.listar('unidades'),
      api.listar('asignaturas')
    ]);

    tema = datosTema;
    terminosGlosario = Array.isArray(listaGlosario) ? listaGlosario : [];

    unidad = listaUnidades.find((u) => u.id === tema.unidadId) || null;
    asignatura = unidad ? listaAsignaturas.find((a) => a.id === unidad.asignaturaId) : null;

    hayCambiosSinGuardar = false;
    renderizar();
  } catch (err) {
    renderizarError(err.message || 'Error al cargar los datos del tema.');
  } finally {
    ui.cargando(false);
  }
}

function renderizarError(mensaje) {
  if (!contenido) return;
  contenido.innerHTML = `
    <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
      <h1>Error</h1>
      <p>${ui.escapar(mensaje)}</p>
      <a href="/paginas/editor-contenidos.html" class="btn btn--primario" style="margin-top: var(--espaciado-m);">
        Volver al Editor de Contenidos
      </a>
    </div>
  `;
}

function contarPalabras(texto) {
  if (!texto) return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function renderizar() {
  if (!contenido || !tema) return;

  const palabrasResumen = contarPalabras(tema.resumen || '');

  contenido.innerHTML = `
    <div class="editor-tema-nav">
      <div>
        <a href="/paginas/editor-contenidos.html" class="btn btn--secundario btn--pequeno" id="btn-volver-atras">
          ← Volver a Contenidos
        </a>
        <div style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8; margin-top: 4px;">
          ${ui.escapar(asignatura ? asignatura.nombre : '')} · ${ui.escapar(unidad ? unidad.titulo : '')}
        </div>
      </div>

      <div class="fila" style="gap: var(--espaciado-s);">
        <button type="button" class="btn btn--secundario" id="btn-generar-ia">
          ✨ Generar con IA
        </button>
        <button type="button" class="btn btn--primario" id="btn-guardar-ficha">
          Guardar cambios
        </button>
      </div>
    </div>

    <!-- SECCIÓN 1: FICHA PEDAGÓGICA DEL TEMA -->
    <form id="form-ficha-tema" class="editor-tema-seccion" novalidate>
      <header class="pila" style="gap: var(--espaciado-xs);">
        <h2>Ficha Pedagógica del Tema</h2>
        <p>Configura los contenidos didácticos, objetivos de aprendizaje y recursos multimedia.</p>
      </header>

      <div class="fila" style="gap: var(--espaciado-m); align-items: flex-start; flex-wrap: wrap;">
        <div class="campo" style="flex: 2; min-width: 280px;">
          <label for="campo-titulo"><strong>Título del Tema *</strong></label>
          <input type="text" id="campo-titulo" required value="${ui.escapar(tema.titulo || '')}" />
          <span class="campo__error oculto" id="err-titulo"></span>
        </div>

        <div class="campo" style="flex: 1; min-width: 160px;">
          <label for="campo-estado"><strong>Estado *</strong></label>
          <select id="campo-estado">
            <option value="borrador" ${tema.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
            <option value="publicado" ${tema.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
          </select>
        </div>

        <div class="campo" style="flex: 1; min-width: 160px;">
          <label for="campo-dificultad"><strong>Dificultad *</strong></label>
          <select id="campo-dificultad">
            <option value="basico" ${tema.dificultad === 'basico' ? 'selected' : ''}>Básico</option>
            <option value="intermedio" ${!tema.dificultad || tema.dificultad === 'intermedio' ? 'selected' : ''}>Intermedio</option>
            <option value="avanzado" ${tema.dificultad === 'avanzado' ? 'selected' : ''}>Avanzado</option>
          </select>
        </div>
      </div>

      <!-- Resumen -->
      <div class="campo">
        <label for="campo-resumen"><strong>Resumen Pedagógico</strong> (admite formato básico con párrafos y viñetas)</label>
        <textarea id="campo-resumen" rows="8" placeholder="Escribe el resumen del tema pedagógico...">${ui.escapar(tema.resumen || '')}</textarea>
        <div class="contador-palabras">
          <span id="label-contador-palabras">Palabras: <strong>${palabrasResumen}</strong> (Recomendado: 300 a 800)</span>
          <span id="alerta-resumen" style="color: var(--color-advertencia); ${palabrasResumen >= 300 && palabrasResumen <= 800 ? 'display:none;' : ''}">
            ${palabrasResumen < 300 ? 'Se recomienda mayor profundidad' : palabrasResumen > 800 ? 'Se recomienda concisión' : ''}
          </span>
        </div>
      </div>

      <!-- Listas dinámicas: Objetivos, Ejemplos, Errores Frecuentes, Preguntas Guía -->
      <div class="grid-auto" style="gap: var(--espaciado-l);">
        <!-- Objetivos -->
        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <label style="margin: 0;"><strong>Objetivos de Aprendizaje</strong></label>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-add-objetivo">+ Añadir</button>
          </div>
          <div class="lista-dinamica" id="lista-objetivos"></div>
        </div>

        <!-- Ejemplos -->
        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <label style="margin: 0;"><strong>Ejemplos Prácticos</strong></label>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-add-ejemplo">+ Añadir</button>
          </div>
          <div class="lista-dinamica" id="lista-ejemplos"></div>
        </div>

        <!-- Errores Frecuentes -->
        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <label style="margin: 0;"><strong>Errores Frecuentes</strong></label>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-add-error">+ Añadir</button>
          </div>
          <div class="lista-dinamica" id="lista-errores"></div>
        </div>

        <!-- Preguntas Guía -->
        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <label style="margin: 0;"><strong>Preguntas Guía</strong></label>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-add-pregunta">+ Añadir</button>
          </div>
          <div class="lista-dinamica" id="lista-preguntas"></div>
        </div>
      </div>

      <!-- Recursos Multimedia -->
      <div class="campo" style="margin-top: var(--espaciado-m);">
        <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-xs);">
          <label style="margin: 0;"><strong>Recursos Educativos (Video, PDF, Imagen o Enlace)</strong></label>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-add-recurso">+ Añadir Recurso</button>
        </div>
        <div class="pila" style="gap: var(--espaciado-s);" id="lista-recursos"></div>
      </div>

      <!-- Palabras Clave y Fuentes -->
      <div class="fila" style="gap: var(--espaciado-m); flex-wrap: wrap;">
        <div class="campo" style="flex: 1; min-width: 260px;">
          <label for="campo-palabras"><strong>Palabras Clave</strong> (separadas por coma)</label>
          <input type="text" id="campo-palabras" value="${ui.escapar(Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : '')}" placeholder="ejemplo: celula, adn, nucleo" />
        </div>

        <div class="campo" style="flex: 1; min-width: 260px;">
          <label for="campo-fuentes"><strong>Fuentes Bibliográficas</strong></label>
          <input type="text" id="campo-fuentes" value="${ui.escapar(tema.fuentes || '')}" placeholder="Libros, currículo nacional, referencias..." />
        </div>
      </div>
    </form>

    <!-- SECCIÓN 2: GLOSARIO DEL TEMA -->
    ${htmlGlosario()}
  `;

  vincularEventosFormulario();
  vincularEventosGlosario();
}

function htmlGlosario() {
  // Métricas del glosario
  const totalTerminos = terminosGlosario.length;
  const terminos6Letras = terminosGlosario.filter((g) => {
    const norm = util.normalizar(g.termino || '');
    return norm.length === 6;
  }).length;
  const aptoJuegos = totalTerminos >= 12 && terminos6Letras >= 3;

  return `
    <section id="seccion-glosario" class="editor-tema-seccion" aria-labelledby="titulo-glosario">
      <header class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espaciado-s);">
        <div>
          <h2 id="titulo-glosario">Glosario del Tema</h2>
          <p>Términos clave para el glosario interactivo y los juegos del estudiante.</p>
        </div>
        <button type="button" class="btn btn--primario btn--pequeno" id="btn-nuevo-termino">
          + Agregar Término
        </button>
      </header>

      <!-- Métricas -->
      <div class="glosario-metricas">
        <div class="glosario-metricas__item">
          <span>Total de términos:</span>
          <strong>${totalTerminos}</strong>
        </div>
        <div class="glosario-metricas__item">
          <span>Términos con 6 letras:</span>
          <strong>${terminos6Letras}</strong>
        </div>
        <div class="glosario-metricas__item">
          <span>Estado gamificación:</span>
          <span class="glosario-apto ${aptoJuegos ? 'glosario-apto--si' : 'glosario-apto--no'}">
            ${aptoJuegos ? '✓ Apto para juegos' : '⚠ Requiere mín. 12 términos y 3 de 6 letras'}
          </span>
        </div>
      </div>

      <!-- Tabla Glosario -->
      <div class="tabla">
        <table>
          <thead>
            <tr>
              <th scope="col" style="min-width: 130px;">Término</th>
              <th scope="col">Definición</th>
              <th scope="col">Pista</th>
              <th scope="col">Retroalimentación</th>
              <th scope="col" style="text-align: right; min-width: 140px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-glosario-cuerpo">
            ${
              terminosGlosario.length === 0
                ? `<tr><td colspan="5" style="text-align: center; padding: var(--espaciado-l);">No hay términos en el glosario de este tema.</td></tr>`
                : terminosGlosario
                    .map((g) => {
                      const norm = util.normalizar(g.termino);
                      const es6 = norm.length === 6;
                      return `
                      <tr data-id="${ui.escapar(g.id)}">
                        <td>
                          <strong>${ui.escapar(norm)}</strong>
                          ${es6 ? '<span class="insignia insignia--acento" style="font-size: 10px; margin-left: 4px;">6 letras</span>' : ''}
                        </td>
                        <td style="font-size: var(--tamano-s);">${ui.escapar(g.definicion || '')}</td>
                        <td style="font-size: var(--tamano-s);">${ui.escapar(g.pista || '')}</td>
                        <td style="font-size: var(--tamano-s);">${ui.escapar(g.retroalimentacion || '')}</td>
                        <td style="text-align: right;">
                          <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-xs);">
                            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-termino" data-id="${ui.escapar(g.id)}">
                              Editar
                            </button>
                            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-termino" data-id="${ui.escapar(g.id)}">
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
}

function actualizarGlosario() {
  const seccion = document.getElementById('seccion-glosario');
  if (!seccion) return;
  seccion.outerHTML = htmlGlosario();
  vincularEventosGlosario();
}

function vincularEventosFormulario() {
  document.getElementById('btn-generar-ia')?.addEventListener('click', abrirGeneracionIA);
  const form = document.getElementById('form-ficha-tema');
  const inputTitulo = document.getElementById('campo-titulo');
  const selectEstado = document.getElementById('campo-estado');
  const selectDificultad = document.getElementById('campo-dificultad');
  const inputResumen = document.getElementById('campo-resumen');
  const inputPalabras = document.getElementById('campo-palabras');
  const inputFuentes = document.getElementById('campo-fuentes');

  // Marcadores de cambio
  [inputTitulo, selectEstado, selectDificultad, inputResumen, inputPalabras, inputFuentes].forEach((el) => {
    el?.addEventListener('input', marcarCambio);
    el?.addEventListener('change', marcarCambio);
  });

  // Contador de palabras del resumen
  inputResumen?.addEventListener('input', () => {
    const palabras = contarPalabras(inputResumen.value);
    const contadorEl = document.getElementById('label-contador-palabras');
    const alertaEl = document.getElementById('alerta-resumen');

    if (contadorEl) {
      contadorEl.innerHTML = `Palabras: <strong>${palabras}</strong> (Recomendado: 300 a 800)`;
    }
    if (alertaEl) {
      if (palabras >= 300 && palabras <= 800) {
        alertaEl.style.display = 'none';
      } else {
        alertaEl.style.display = 'inline';
        alertaEl.textContent = palabras < 300 ? 'Se recomienda mayor profundidad' : 'Se recomienda concisión';
      }
    }
  });

  // Inicializar listas dinámicas
  const objetivos = [...(tema.objetivos || [])];
  const ejemplos = [...(tema.ejemplos || [])];
  const errores = [...(tema.erroresFrecuentes || [])];
  const preguntas = [...(tema.preguntasGuia || [])];
  const recursos = [...(tema.recursos || [])];

  function montarListaTexto(contenedorId, lista, btnAddId, placeholder) {
    const cont = document.getElementById(contenedorId);
    if (!cont) return;

    function renderLista() {
      cont.innerHTML = lista
        .map(
          (val, idx) => `
        <div class="item-dinamico">
          <input type="text" value="${ui.escapar(val)}" placeholder="${placeholder}" data-idx="${idx}" />
          <button type="button" class="btn btn--texto btn--pequeno btn-quitar-item" data-idx="${idx}" aria-label="Eliminar elemento">✕</button>
        </div>
      `
        )
        .join('');

      cont.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          lista[Number(e.target.dataset.idx)] = e.target.value;
          marcarCambio();
        });
      });

      cont.querySelectorAll('.btn-quitar-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          lista.splice(Number(btn.dataset.idx), 1);
          marcarCambio();
          renderLista();
        });
      });
    }

    document.getElementById(btnAddId)?.addEventListener('click', () => {
      lista.push('');
      marcarCambio();
      renderLista();
      const inputs = cont.querySelectorAll('input');
      inputs[inputs.length - 1]?.focus();
    });

    renderLista();
  }

  montarListaTexto('lista-objetivos', objetivos, 'btn-add-objetivo', 'Objetivo de aprendizaje...');
  montarListaTexto('lista-ejemplos', ejemplos, 'btn-add-ejemplo', 'Ejemplo ilustrativo...');
  montarListaTexto('lista-errores', errores, 'btn-add-error', 'Error conceptual común...');
  montarListaTexto('lista-preguntas', preguntas, 'btn-add-pregunta', 'Pregunta orientadora...');

  // Recursos
  const contRecursos = document.getElementById('lista-recursos');
  function renderRecursos() {
    if (!contRecursos) return;
    contRecursos.innerHTML = recursos
      .map(
        (rec, idx) => `
      <div class="tarjeta" style="padding: var(--espaciado-s); background: var(--color-fondo);" data-idx="${idx}">
        <div class="fila" style="gap: var(--espaciado-s); flex-wrap: wrap; align-items: flex-end;">
          <div class="campo" style="margin: 0; min-width: 120px;">
            <label style="font-size: var(--tamano-xs);">Tipo</label>
            <select class="rec-tipo" data-idx="${idx}">
              <option value="video" ${rec.tipo === 'video' ? 'selected' : ''}>Video</option>
              <option value="pdf" ${rec.tipo === 'pdf' ? 'selected' : ''}>PDF</option>
              <option value="imagen" ${rec.tipo === 'imagen' ? 'selected' : ''}>Imagen</option>
              <option value="enlace" ${rec.tipo === 'enlace' ? 'selected' : ''}>Enlace</option>
            </select>
          </div>

          <div class="campo" style="margin: 0; flex: 2; min-width: 200px;">
            <label style="font-size: var(--tamano-xs);">Título</label>
            <input type="text" class="rec-titulo" value="${ui.escapar(rec.titulo || '')}" placeholder="Nombre del recurso" data-idx="${idx}" />
          </div>

          <div class="campo" style="margin: 0; flex: 3; min-width: 240px;">
            <label style="font-size: var(--tamano-xs);">URL</label>
            <div class="fila" style="gap: 4px;">
              <input type="text" class="rec-url" value="${ui.escapar(rec.url || '')}" placeholder="https://..." data-idx="${idx}" />
              ${
                rec.tipo === 'pdf' || rec.tipo === 'imagen'
                  ? `<button type="button" class="btn btn--secundario btn--pequeno btn-subir-archivo" data-idx="${idx}">Subir</button>`
                  : ''
              }
            </div>
          </div>

          <button type="button" class="btn btn--peligro btn--pequeno btn-quitar-rec" data-idx="${idx}" title="Eliminar recurso">
            ✕
          </button>
        </div>
      </div>
    `
      )
      .join('');

    contRecursos.querySelectorAll('.rec-tipo').forEach((el) => {
      el.addEventListener('change', (e) => {
        recursos[Number(e.target.dataset.idx)].tipo = e.target.value;
        marcarCambio();
        renderRecursos();
      });
    });

    contRecursos.querySelectorAll('.rec-titulo').forEach((el) => {
      el.addEventListener('input', (e) => {
        recursos[Number(e.target.dataset.idx)].titulo = e.target.value;
        marcarCambio();
      });
    });

    contRecursos.querySelectorAll('.rec-url').forEach((el) => {
      el.addEventListener('input', (e) => {
        recursos[Number(e.target.dataset.idx)].url = e.target.value;
        marcarCambio();
      });
    });

    contRecursos.querySelectorAll('.btn-quitar-rec').forEach((btn) => {
      btn.addEventListener('click', () => {
        recursos.splice(Number(btn.dataset.idx), 1);
        marcarCambio();
        renderRecursos();
      });
    });

    // Subida de archivos para PDF o Imagen
    contRecursos.querySelectorAll('.btn-subir-archivo').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const tipo = recursos[idx].tipo;

        const inputArchivo = document.createElement('input');
        inputArchivo.type = 'file';
        inputArchivo.accept = tipo === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp';

        inputArchivo.addEventListener('change', async () => {
          const archivo = inputArchivo.files?.[0];
          if (!archivo) return;
          try {
            ui.cargando(true);
            const res = await api.subir(archivo);
            if (res && res.url) {
              recursos[idx].url = res.url;
              if (!recursos[idx].titulo) {
                recursos[idx].titulo = archivo.name;
              }
              marcarCambio();
              renderRecursos();
              ui.aviso('Archivo subido con éxito', 'exito');
            }
          } catch (err) {
            ui.aviso(err.message || 'Error al subir archivo', 'error');
          } finally {
            ui.cargando(false);
          }
        });

        inputArchivo.click();
      });
    });
  }

  document.getElementById('btn-add-recurso')?.addEventListener('click', () => {
    recursos.push({ tipo: 'enlace', titulo: '', url: '' });
    marcarCambio();
    renderRecursos();
  });

  renderRecursos();

  // Guardar Ficha
  async function guardarFicha() {
    const titulo = inputTitulo.value.trim();
    if (!titulo) {
      ui.aviso('El título del tema es obligatorio', 'advertencia');
      inputTitulo.focus();
      return;
    }

    const palabrasClave = inputPalabras.value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      titulo,
      estado: selectEstado.value,
      dificultad: selectDificultad.value,
      resumen: inputResumen.value,
      objetivos: objetivos.filter((o) => o.trim()),
      ejemplos: ejemplos.filter((e) => e.trim()),
      erroresFrecuentes: errores.filter((e) => e.trim()),
      preguntasGuia: preguntas.filter((p) => p.trim()),
      recursos: recursos.filter((r) => r.titulo.trim() || r.url.trim()),
      palabrasClave,
      fuentes: inputFuentes.value.trim()
    };

    try {
      ui.cargando(true);
      await api.actualizar('temas', tema.id, payload);
      hayCambiosSinGuardar = false;
      ui.aviso('Ficha pedagógica guardada con éxito', 'exito');
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar la ficha', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  document.getElementById('btn-guardar-ficha')?.addEventListener('click', guardarFicha);

  // Volver a contenidos con confirmación
  document.getElementById('btn-volver-atras')?.addEventListener('click', async (e) => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      const confirmado = await ui.confirmar('Tienes cambios sin guardar en la ficha pedagógica. ¿Deseas salir de todas formas?');
      if (confirmado) {
        hayCambiosSinGuardar = false;
        window.location.href = '/paginas/editor-contenidos.html';
      }
    }
  });
}

function vincularEventosGlosario() {
  document.getElementById('btn-nuevo-termino')?.addEventListener('click', () => {
    abrirModalTermino();
  });

  contenido.querySelectorAll('.btn-editar-termino').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const term = terminosGlosario.find((g) => g.id === id);
      if (term) abrirModalTermino(term);
    });
  });

  contenido.querySelectorAll('.btn-eliminar-termino').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const term = terminosGlosario.find((g) => g.id === id);
      const confirmado = await ui.confirmar(`¿Estás seguro de eliminar el término "${term?.termino || id}" del glosario?`);
      if (!confirmado) return;

      try {
        ui.cargando(true);
        await api.eliminar('glosario', id);
        ui.aviso('Término eliminado del glosario', 'exito');
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al eliminar término', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });
}

function abrirGeneracionIA() {
  const div = document.createElement('div');
  div.className = 'pila';
  div.innerHTML = `
    <form class="pila" id="form-generar-glosario">
      <p>Se usará el contenido de la última ficha guardada. Revisa las propuestas antes de aprobarlas.</p>
      <div class="campo">
        <label for="cantidad-glosario-ia">Cantidad</label>
        <input id="cantidad-glosario-ia" name="cantidad" type="number" min="5" max="20" step="1" value="10" required>
      </div>
      <button type="submit" class="btn btn--primario">Generar propuestas</button>
      <p class="campo__error" role="status" aria-live="polite"></p>
    </form>
  `;
  const form = div.querySelector('form');
  const boton = form.querySelector('button');
  const mensaje = form.querySelector('[role="status"]');
  let generando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (generando || !form.reportValidity()) return;
    const cantidad = Number(form.elements.cantidad.value);
    if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 20) return;
    generando = true;
    boton.disabled = true;
    mensaje.textContent = 'Generando propuestas…';
    ui.cargando(true);
    try {
      const propuestas = await api.ia('generar-glosario', { temaId, cantidad });
      if (!Array.isArray(propuestas) || propuestas.length === 0) throw new Error('La IA no devolvió propuestas para revisar.');
      if (div.isConnected) montarPropuestasIA(div, propuestas);
    } catch (error) {
      mensaje.textContent = error.message || 'No se pudieron generar las propuestas.';
    } finally {
      generando = false;
      boton.disabled = false;
      ui.cargando(false);
    }
  });
  ui.modal({
    titulo: 'Generar glosario con IA', contenido: div,
    acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn--secundario' }]
  });
}

function montarPropuestasIA(div, propuestas) {
  const campos = [
    ['termino', 'Término'], ['definicion', 'Definición'],
    ['pista', 'Pista'], ['retroalimentacion', 'Retroalimentación']
  ];
  div.closest('.modal-dialogo')?.classList.add('modal-dialogo--amplio');
  div.innerHTML = `
    <form class="pila" novalidate>
      <p>Corrige los textos y selecciona los términos que deseas aprobar. Las propuestas repetidas se desmarcan.</p>
      <div class="tabla tabla--editable" tabindex="0" role="region" aria-label="Propuestas de glosario, desplazamiento horizontal">
        <table>
          <caption>Propuestas de IA pendientes de aprobación docente</caption>
          <thead><tr><th scope="col">Seleccionar</th>${campos.map(([, nombre]) => `<th scope="col">${nombre}</th>`).join('')}<th scope="col">Estado</th></tr></thead>
          <tbody>${propuestas.map((propuesta, indice) => `
            <tr>
              <td><input type="checkbox" checked aria-label="Seleccionar propuesta ${indice + 1}"></td>
              ${campos.map(([campo, nombre]) => `
                <td><label class="sr-only" for="propuesta-ia-${indice}-${campo}">${nombre}, propuesta ${indice + 1}</label>
                <textarea id="propuesta-ia-${indice}-${campo}" data-campo="${campo}" rows="3" required>${ui.escapar(propuesta[campo] || '')}</textarea></td>
              `).join('')}
              <td data-estado aria-live="polite">Pendiente</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
      <p data-resumen role="status" aria-live="polite"></p>
      <p data-error class="campo__error" role="alert"></p>
      <button type="submit" class="btn btn--primario">Aprobar seleccionados</button>
    </form>
  `;
  const form = div.querySelector('form');
  const filas = [...form.querySelectorAll('tbody tr')];
  const boton = form.querySelector('button[type="submit"]');
  const mensaje = form.querySelector('[data-error]');
  let guardando = false;
  const leerFila = (fila) => Object.fromEntries(campos.map(([campo]) =>
    [campo, fila.querySelector(`[data-campo="${campo}"]`).value.trim()]));

  function actualizarPropuestas() {
    const vistos = new Set(terminosGlosario.map((item) => util.normalizar(item.termino)));
    for (const fila of filas) {
      if (fila.dataset.aprobada) continue;
      const termino = util.normalizar(leerFila(fila).termino);
      const repetida = Boolean(termino) && vistos.has(termino);
      fila.classList.toggle('tabla__fila-advertencia', repetida);
      fila.querySelector('[data-estado]').textContent = repetida ? 'Repetida: cambia el término para aprobarlo' : 'Pendiente';
      if (repetida) fila.querySelector('[type="checkbox"]').checked = false;
      if (termino) vistos.add(termino);
    }
    const seleccionadas = filas.filter((fila) => !fila.dataset.aprobada && fila.querySelector('[type="checkbox"]').checked).length;
    const aprobadas = filas.filter((fila) => fila.dataset.aprobada).length;
    form.querySelector('[data-resumen]').textContent = `${seleccionadas} seleccionadas · ${aprobadas} aprobadas de ${filas.length} propuestas`;
    boton.disabled = guardando || seleccionadas === 0;
  }

  form.addEventListener('input', actualizarPropuestas);
  form.addEventListener('change', actualizarPropuestas);
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardando) return;
    guardando = true;
    boton.disabled = true;
    mensaje.textContent = '';
    ui.cargando(true);
    const controles = [...form.querySelectorAll('input, textarea')];
    controles.forEach((control) => { control.disabled = true; });
    try {
      // Refrescar antes de guardar detecta términos añadidos desde otra sesión.
      terminosGlosario = await api.listar('glosario', { temaId });
      actualizarPropuestas();
      const seleccionadas = filas.filter((fila) => !fila.dataset.aprobada && fila.querySelector('[type="checkbox"]').checked);
      if (seleccionadas.length === 0) throw new Error('Selecciona al menos una propuesta que no esté repetida.');
      for (const fila of seleccionadas) {
        const datos = leerFila(fila);
        if (campos.some(([campo]) => !datos[campo]) || /\s/.test(datos.termino) ||
            contarPalabras(datos.definicion) > 25 || contarPalabras(datos.pista) > 10) {
          throw new Error('Revisa las filas seleccionadas: término de una palabra, definición de máximo 25 palabras, pista de máximo 10 y todos los campos completos.');
        }
      }
      for (const fila of seleccionadas) {
        const creado = await api.crear('glosario', {
          ...leerFila(fila), temaId, origen: 'ia', estado: 'aprobado'
        });
        terminosGlosario.push(creado);
        fila.dataset.aprobada = 'true';
        fila.classList.remove('tabla__fila-advertencia');
        fila.querySelector('[type="checkbox"]').checked = false;
        fila.querySelector('[data-estado]').textContent = 'Aprobada y guardada';
        actualizarGlosario();
      }
      ui.aviso(`${seleccionadas.length} términos aprobados y agregados al glosario.`, 'exito');
    } catch (error) {
      mensaje.textContent = error.message || 'No se pudieron aprobar los términos. Las filas ya guardadas están señaladas.';
    } finally {
      controles.forEach((control) => { control.disabled = Boolean(control.closest('tr')?.dataset.aprobada); });
      guardando = false;
      actualizarGlosario();
      actualizarPropuestas();
      ui.cargando(false);
    }
  });
  actualizarPropuestas();
  form.querySelector('textarea')?.focus();
}

function abrirModalTermino(terminoObj = null) {
  const esEdicion = Boolean(terminoObj);
  const div = document.createElement('div');
  div.className = 'pila';
  div.style.gap = 'var(--espaciado-m)';

  div.innerHTML = `
    <form id="form-modal-termino" class="pila" novalidate>
      <div class="campo">
        <label for="modal-glo-termino"><strong>Término *</strong> (debe ser una sola palabra)</label>
        <input type="text" id="modal-glo-termino" required value="${ui.escapar(terminoObj?.termino || '')}" placeholder="Ej. MITOCONDRIA" />
        <span class="campo__error oculto" id="err-glo-termino"></span>
      </div>

      <div class="campo">
        <label for="modal-glo-def"><strong>Definición *</strong> (máximo 25 palabras)</label>
        <textarea id="modal-glo-def" rows="3" required placeholder="Explicación precisa del término...">${ui.escapar(terminoObj?.definicion || '')}</textarea>
        <div class="fila" style="justify-content: space-between; font-size: var(--tamano-xs); opacity: 0.8;">
          <span id="cont-glo-def">Palabras: 0 / 25</span>
          <span class="campo__error oculto" id="err-glo-def"></span>
        </div>
      </div>

      <div class="campo">
        <label for="modal-glo-pista"><strong>Pista *</strong> (máximo 10 palabras)</label>
        <input type="text" id="modal-glo-pista" required value="${ui.escapar(terminoObj?.pista || '')}" placeholder="Pista breve para juegos..." />
        <div class="fila" style="justify-content: space-between; font-size: var(--tamano-xs); opacity: 0.8;">
          <span id="cont-glo-pista">Palabras: 0 / 10</span>
          <span class="campo__error oculto" id="err-glo-pista"></span>
        </div>
      </div>

      <div class="campo">
        <label for="modal-glo-retro"><strong>Retroalimentación *</strong></label>
        <input type="text" id="modal-glo-retro" required value="${ui.escapar(terminoObj?.retroalimentacion || '')}" placeholder="Mensaje al acertar el término..." />
        <span class="campo__error oculto" id="err-glo-retro"></span>
      </div>

      <div class="fila" style="justify-content: flex-end; gap: var(--espaciado-s); margin-top: var(--espaciado-xs);">
        <button type="button" class="btn btn--secundario" id="btn-cancelar-termino">Cancelar</button>
        <button type="submit" class="btn btn--primario" id="btn-guardar-termino">
          ${esEdicion ? 'Guardar Cambios' : 'Agregar Término'}
        </button>
      </div>
    </form>
  `;

  const inputTerm = div.querySelector('#modal-glo-termino');
  const inputDef = div.querySelector('#modal-glo-def');
  const inputPista = div.querySelector('#modal-glo-pista');
  const inputRetro = div.querySelector('#modal-glo-retro');

  const errTerm = div.querySelector('#err-glo-termino');
  const errDef = div.querySelector('#err-glo-def');
  const errPista = div.querySelector('#err-glo-pista');
  const errRetro = div.querySelector('#err-glo-retro');

  const contDef = div.querySelector('#cont-glo-def');
  const contPista = div.querySelector('#cont-glo-pista');

  function actualizarContadores() {
    const cantDef = contarPalabras(inputDef.value);
    contDef.textContent = `Palabras: ${cantDef} / 25`;
    contDef.style.color = cantDef > 25 ? 'var(--color-error)' : 'inherit';

    const cantPista = contarPalabras(inputPista.value);
    contPista.textContent = `Palabras: ${cantPista} / 10`;
    contPista.style.color = cantPista > 10 ? 'var(--color-error)' : 'inherit';
  }

  inputDef.addEventListener('input', actualizarContadores);
  inputPista.addEventListener('input', actualizarContadores);
  actualizarContadores();

  div.querySelector('#form-modal-termino').addEventListener('submit', async (e) => {
    e.preventDefault();

    let valido = true;
    const rawTerm = inputTerm.value.trim();
    const terminoNorm = util.normalizar(rawTerm);
    const def = inputDef.value.trim();
    const pista = inputPista.value.trim();
    const retro = inputRetro.value.trim();

    // Validar término: no vacío y de una sola palabra
    if (!terminoNorm) {
      errTerm.textContent = 'El término es obligatorio';
      errTerm.classList.remove('oculto');
      valido = false;
    } else if (/\s/.test(terminoNorm)) {
      errTerm.textContent = 'El término debe ser de una sola palabra (sin espacios)';
      errTerm.classList.remove('oculto');
      valido = false;
    } else {
      errTerm.textContent = '';
      errTerm.classList.add('oculto');
    }

    // Validar definición
    const cantDef = contarPalabras(def);
    if (!def) {
      errDef.textContent = 'La definición es obligatoria';
      errDef.classList.remove('oculto');
      valido = false;
    } else if (cantDef > 25) {
      errDef.textContent = 'Máximo 25 palabras permitidas';
      errDef.classList.remove('oculto');
      valido = false;
    } else {
      errDef.textContent = '';
      errDef.classList.add('oculto');
    }

    // Validar pista
    const cantPista = contarPalabras(pista);
    if (!pista) {
      errPista.textContent = 'La pista es obligatoria';
      errPista.classList.remove('oculto');
      valido = false;
    } else if (cantPista > 10) {
      errPista.textContent = 'Máximo 10 palabras permitidas';
      errPista.classList.remove('oculto');
      valido = false;
    } else {
      errPista.textContent = '';
      errPista.classList.add('oculto');
    }

    // Validar retroalimentación
    if (!retro) {
      errRetro.textContent = 'La retroalimentación es obligatoria';
      errRetro.classList.remove('oculto');
      valido = false;
    } else {
      errRetro.textContent = '';
      errRetro.classList.add('oculto');
    }

    if (!valido) return;

    const payload = {
      temaId: tema.id,
      termino: terminoNorm,
      definicion: def,
      pista,
      retroalimentacion: retro,
      origen: 'docente',
      estado: 'aprobado'
    };

    try {
      ui.cargando(true);
      if (esEdicion) {
        await api.actualizar('glosario', terminoObj.id, payload);
        ui.aviso('Término actualizado con éxito', 'exito');
      } else {
        await api.crear('glosario', payload);
        ui.aviso('Término agregado al glosario', 'exito');
      }

      document.querySelector('.modal-fondo')?.remove();
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar término', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  div.querySelector('#btn-cancelar-termino').addEventListener('click', () => {
    document.querySelector('.modal-fondo')?.remove();
  });

  ui.modal({
    titulo: esEdicion ? 'Editar Término del Glosario' : 'Nuevo Término del Glosario',
    contenido: div,
    acciones: []
  });

  setTimeout(() => inputTerm.focus(), 50);
}

cargarDatos();

