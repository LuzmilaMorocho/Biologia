import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Noticias', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const ITEMS_POR_PAGINA = 9;

let todasNoticias = [];
let lecturasIds = new Set();
let temas = [];
let paginaActual = 1;

let filtroCategoria = 'todas';
let filtroTema = 'todos';

async function iniciar() {
  ui.cargando(true);
  try {
    const [listaNoticias, listaLecturas, listaTemas] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    todasNoticias = listaNoticias || [];
    lecturasIds = new Set((listaLecturas || []).map((l) => l.noticiaId));
    temas = listaTemas || [];

    renderizar();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar noticias', 'error');
  } finally {
    ui.cargando(false);
  }
}

function filtrarYOrdenar() {
  let resultado = todasNoticias.filter((n) => {
    if (filtroCategoria !== 'todas' && n.categoria !== filtroCategoria) return false;
    if (filtroTema !== 'todos' && n.temaId !== filtroTema) return false;
    return true;
  });

  // Ordenar: Destacadas primero; luego por fecha de publicación / fecha más reciente
  resultado.sort((a, b) => {
    if (a.destacada && !b.destacada) return -1;
    if (!a.destacada && b.destacada) return 1;
    const fA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fB - fA;
  });

  return resultado;
}

function renderizar() {
  if (!contenido) return;

  const usuario = usuarioActual();
  const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  const filtradas = filtrarYOrdenar();
  const totalPaginas = Math.ceil(filtradas.length / ITEMS_POR_PAGINA) || 1;
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;

  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const itemsPagina = filtradas.slice(inicio, inicio + ITEMS_POR_PAGINA);

  const mapaTemas = new Map(temas.map((t) => [t.id, t.titulo]));

  contenido.innerHTML = `
    <header class="noticias-cabecera">
      <div class="pila" style="gap: var(--espaciado-xs);">
        <h1>Noticias y Novedades</h1>
        <p>Mantente al día con los comunicados institucionales, actividades y logros de la comunidad.</p>
      </div>

      ${
        esDocenteOAdmin
          ? `
        <a href="/paginas/editor-noticia.html" class="btn btn--primario">
          + Nueva Noticia
        </a>
      `
          : ''
      }
    </header>

    <!-- Filtros -->
    <div class="noticias-filtros">
      <div class="campo" style="margin: 0; min-width: 180px;">
        <label for="filtro-categoria" class="sr-only">Categoría</label>
        <select id="filtro-categoria" aria-label="Filtrar por categoría">
          <option value="todas" ${filtroCategoria === 'todas' ? 'selected' : ''}>Todas las categorías</option>
          <option value="Institucional" ${filtroCategoria === 'Institucional' ? 'selected' : ''}>Institucional</option>
          <option value="Académica" ${filtroCategoria === 'Académica' ? 'selected' : ''}>Académica</option>
          <option value="Eventos" ${filtroCategoria === 'Eventos' ? 'selected' : ''}>Eventos</option>
          <option value="Logros" ${filtroCategoria === 'Logros' ? 'selected' : ''}>Logros</option>
        </select>
      </div>

      <div class="campo" style="margin: 0; min-width: 200px;">
        <label for="filtro-tema" class="sr-only">Tema relacionado</label>
        <select id="filtro-tema" aria-label="Filtrar por tema">
          <option value="todos" ${filtroTema === 'todos' ? 'selected' : ''}>Todos los temas</option>
          ${temas
            .map(
              (t) =>
                `<option value="${ui.escapar(t.id)}" ${filtroTema === t.id ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`
            )
            .join('')}
        </select>
      </div>

      <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8; margin-left: auto;">
        ${filtradas.length} noticia(s) encontrada(s)
      </span>
    </div>

    <!-- Lista de tarjetas paginada -->
    ${
      itemsPagina.length === 0
        ? `
      <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
        <p>No se encontraron noticias en esta categoría o filtro.</p>
      </div>
    `
        : `
      <div class="noticias-grid">
        ${itemsPagina
          .map((n) => {
            const yaLeida = lecturasIds.has(n.id);
            const fechaStr = n.fechaPublicacion || n.fecha;
            const fechaFmt = fechaStr ? util.fechaLarga(fechaStr) : '';
            const temaTitulo = n.temaId ? mapaTemas.get(n.temaId) : null;

            return `
            <article class="tarjeta-noticia" data-id="${ui.escapar(n.id)}">
              <div>
                ${
                  n.imagen
                    ? `<img src="${ui.escapar(n.imagen)}" alt="" class="tarjeta-noticia__img" loading="lazy" />`
                    : `<div class="tarjeta-noticia__img" style="display:flex; align-items:center; justify-content:center; opacity:0.3; font-size: 2rem;">📰</div>`
                }
                <div class="tarjeta-noticia__cuerpo">
                  <div class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <div class="fila" style="gap: 4px; align-items: center;">
                      <span class="insignia insignia--acento" style="font-size: 11px;">${ui.escapar(n.categoria)}</span>
                      ${n.destacada ? '<span class="insignia" style="font-size: 11px;">★ Destacada</span>' : ''}
                      ${n.estado === 'borrador' ? '<span class="insignia" style="background:#6c757d; color:#fff; font-size: 11px;">Borrador</span>' : ''}
                    </div>
                    ${!yaLeida && n.estado === 'publicado' ? '<span class="etiqueta-nuevo">Nuevo</span>' : ''}
                  </div>

                  <h2 style="font-size: var(--tamano-m); margin-top: var(--espaciado-xs);">
                    <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" style="color: inherit; text-decoration: none;">
                      ${ui.escapar(n.titulo)}
                    </a>
                  </h2>

                  <p style="font-size: var(--tamano-s); color: var(--color-texto); line-height: var(--interlineado-base); margin: 0;">
                    ${ui.escapar(n.resumen)}
                  </p>

                  ${
                    temaTitulo
                      ? `<div style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.7; margin-top: 4px;">Tema: ${ui.escapar(temaTitulo)}</div>`
                      : ''
                  }
                </div>
              </div>

              <div class="tarjeta-noticia__pie">
                <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.7;">
                  ${fechaFmt}
                </span>

                <div class="fila" style="gap: var(--espaciado-xs);">
                  ${
                    esDocenteOAdmin
                      ? `<a href="/paginas/editor-noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--secundario btn--pequeno">Editar</a>`
                      : ''
                  }
                  <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--primario btn--pequeno">
                    Leer más →
                  </a>
                </div>
              </div>
            </article>
          `;
          })
          .join('')}
      </div>
    `
    }

    <!-- Paginación -->
    ${
      totalPaginas > 1
        ? `
      <nav class="paginacion" aria-label="Paginación de noticias">
        <button type="button" class="btn btn--secundario btn--pequeno" id="btn-ant" ${paginaActual === 1 ? 'disabled' : ''}>
          ← Anterior
        </button>
        <span style="font-size: var(--tamano-s);">Página ${paginaActual} de ${totalPaginas}</span>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btn-sig" ${paginaActual === totalPaginas ? 'disabled' : ''}>
          Siguiente →
        </button>
      </nav>
    `
        : ''
    }
  `;

  vincularEventos(totalPaginas);
}

function vincularEventos(totalPaginas) {
  const selCat = document.getElementById('filtro-categoria');
  const selTema = document.getElementById('filtro-tema');

  selCat?.addEventListener('change', (e) => {
    filtroCategoria = e.target.value;
    paginaActual = 1;
    renderizar();
  });

  selTema?.addEventListener('change', (e) => {
    filtroTema = e.target.value;
    paginaActual = 1;
    renderizar();
  });

  document.getElementById('btn-ant')?.addEventListener('click', () => {
    if (paginaActual > 1) {
      paginaActual--;
      renderizar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('btn-sig')?.addEventListener('click', () => {
    if (paginaActual < totalPaginas) {
      paginaActual++;
      renderizar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

iniciar();

