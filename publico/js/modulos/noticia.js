import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Noticia', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const noticiaId = util.parametro('id');

async function registrarLecturaSiNoExiste(id) {
  try {
    const lecturas = await api.listar('lecturas-noticias');
    const yaLeida = lecturas.some((l) => l.noticiaId === id);
    if (!yaLeida) {
      await api.crear('lecturas-noticias', { noticiaId: id });
    }
  } catch {
    // Si falla por duplicado u otro motivo, no bloquear la lectura
  }
}

async function iniciar() {
  if (!noticiaId) {
    renderizarError('No se especificó ninguna noticia.');
    return;
  }

  ui.cargando(true);
  try {
    const [noticia, temas] = await Promise.all([
      api.obtener('noticias', noticiaId),
      api.listar('temas')
    ]);

    // Registrar lectura al abrir
    registrarLecturaSiNoExiste(noticiaId);

    const temaObj = noticia.temaId ? temas.find((t) => t.id === noticia.temaId) : null;
    const fechaStr = noticia.fechaPublicacion || noticia.fecha;
    const fechaFmt = fechaStr ? util.fechaLarga(fechaStr) : '';

    contenido.innerHTML = `
      <article class="noticia-detalle">
        <nav style="margin-bottom: var(--espaciado-xs);">
          <a href="/paginas/noticias.html" style="font-size: var(--tamano-s);">← Volver a Noticias</a>
        </nav>

        <header class="pila" style="gap: var(--espaciado-xs);">
          <div class="fila" style="gap: var(--espaciado-xs); align-items: center; flex-wrap: wrap;">
            <span class="insignia insignia--acento">${ui.escapar(noticia.categoria)}</span>
            ${noticia.destacada ? '<span class="insignia">★ Destacada</span>' : ''}
            <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.7;">
              ${fechaFmt}
            </span>
          </div>

          <h1 style="font-size: var(--tamano-xxl); color: var(--color-primario); margin: var(--espaciado-xs) 0;">
            ${ui.escapar(noticia.titulo)}
          </h1>

          <p style="font-size: var(--tamano-m); font-weight: var(--peso-medio); color: var(--color-texto); line-height: var(--interlineado-base);">
            ${ui.escapar(noticia.resumen)}
          </p>

          ${
            temaObj
              ? `
            <div style="font-size: var(--tamano-s); margin-top: var(--espaciado-xs);">
              <span>Tema vinculado: </span>
              <a href="/paginas/tema.html?id=${encodeURIComponent(temaObj.id)}">
                <strong>${ui.escapar(temaObj.titulo)}</strong> →
              </a>
            </div>
          `
              : ''
          }
        </header>

        ${
          noticia.imagen
            ? `
          <div style="margin: var(--espaciado-m) 0;">
            <img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="noticia-portada-grande" />
          </div>
        `
            : ''
        }

        <div class="noticia-cuerpo-html tarjeta" style="margin-top: var(--espaciado-s);">
          ${util.formatoBasico(noticia.cuerpo || '')}
        </div>

        <footer style="margin-top: var(--espaciado-l); border-top: 1px solid var(--color-borde); padding-top: var(--espaciado-m);">
          <a href="/paginas/noticias.html" class="btn btn--secundario">
            ← Volver al catálogo de noticias
          </a>
        </footer>
      </article>
    `;
  } catch (err) {
    renderizarError(err.message || 'Error al cargar la noticia.');
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
      <a href="/paginas/noticias.html" class="btn btn--primario" style="margin-top: var(--espaciado-m);">
        Volver a Noticias
      </a>
    </div>
  `;
}

iniciar();

