import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Inicio', roles: ['publico'] });

const contenido = document.getElementById('contenido');

async function renderizarSinSesion() {
  contenido.innerHTML = `
    <section class="inicio-hero" aria-labelledby="titulo-bienvenida">
      <h1 id="titulo-bienvenida">Ecosistema Educativo Digital</h1>
      <p>
        Plataforma interactiva para el desarrollo de competencias digitales con contenidos modulares,
        gamificación, retos interactivos, canciones educativas y tutoría inteligente.
      </p>
      <div class="inicio-hero__acciones">
        <a href="/paginas/ingreso.html" class="btn btn--primario">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--secundario" style="color: var(--color-texto-inverso); border-color: var(--color-texto-inverso);">Registrarse</a>
      </div>
    </section>

    <section class="inicio-caracteristicas" aria-label="Características de la plataforma">
      <article class="inicio-caracteristica">
        <div class="inicio-caracteristica__icono" aria-hidden="true">📚</div>
        <h2 style="font-size: var(--tamano-l); color: var(--color-primario);">Contenidos Interactivos</h2>
        <p style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
          Unidades y temas organizados pedagógicamente con objetivos claros, resúmenes, ejemplos y recursos multimedia.
        </p>
      </article>

      <article class="inicio-caracteristica">
        <div class="inicio-caracteristica__icono" aria-hidden="true">🎮</div>
        <h2 style="font-size: var(--tamano-l); color: var(--color-primario);">Gamificación y Retos</h2>
        <p style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
          Gana puntos, desbloquea insignias y obtén diplomas de cumplimiento mientras afianzas tus habilidades digitales.
        </p>
      </article>

      <article class="inicio-caracteristica">
        <div class="inicio-caracteristica__icono" aria-hidden="true">🎵</div>
        <h2 style="font-size: var(--tamano-l); color: var(--color-primario);">Canciones y Aprendizaje</h2>
        <p style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
          Aprende conceptos fundamentales a través de música pedagógica y letras sincronizadas interactivas.
        </p>
      </article>
    </section>
  `;
}

async function renderizarConSesion(usuario) {
  ui.cargando(true);

  try {
    // 1. Obtener "ultimoTema" de localStorage
    let ultimoTema = null;
    try {
      const guardado = localStorage.getItem('ultimoTema');
      if (guardado) {
        ultimoTema = JSON.parse(guardado);
      }
    } catch {
      ultimoTema = null;
    }

    // 2. Cargar asignaturas y noticias en paralelo
    const [asignaturas, noticias] = await Promise.all([
      api.listar('asignaturas').catch(() => []),
      api.listar('noticias').catch(() => [])
    ]);

    // 3. Calcular avance para cada asignatura
    const avances = await Promise.all(
      (asignaturas || []).map((asig) => calcularAvance(asig.id))
    );

    // 4. Filtrar y ordenar las 3 noticias publicadas más recientes (destacadas primero)
    const noticiasPublicadas = (noticias || []).filter((n) => n.estado === 'publicado');
    noticiasPublicadas.sort((a, b) => {
      const destA = a.destacada ? 1 : 0;
      const destB = b.destacada ? 1 : 0;
      if (destB !== destA) {
        return destB - destA;
      }
      const fechaA = new Date(a.fechaPublicacion || a.creadoEn || 0).getTime();
      const fechaB = new Date(b.fechaPublicacion || b.creadoEn || 0).getTime();
      return fechaB - fechaA;
    });
    const tresNoticias = noticiasPublicadas.slice(0, 3);

    // Construcción del HTML
    let html = '';

    // Saludo
    html += `
      <section class="inicio-saludo" aria-labelledby="saludo-usuario">
        <div>
          <h1 id="saludo-usuario" style="font-size: var(--tamano-2xl); color: var(--color-primario); margin: 0;">
            ¡Hola, ${ui.escapar(usuario.nombre)}!
          </h1>
          <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin-top: var(--espaciado-xs);">
            Bienvenido a tu panel de aprendizaje.
          </p>
        </div>
        <div>
          <span class="insignia insignia--acento" style="font-size: var(--tamano-s); text-transform: capitalize;">
            Rol: ${ui.escapar(usuario.rol)}
          </span>
        </div>
      </section>
    `;

    // Accesos rápidos para docentes y admin
    if (usuario.rol === 'docente' || usuario.rol === 'admin') {
      html += `
        <section class="inicio-rapidos" aria-label="Accesos rápidos de gestión">
          <div class="fila" style="gap: var(--espaciado-s); align-items: center;">
            <strong style="color: var(--color-primario); font-size: var(--tamano-s);">Accesos rápidos:</strong>
          </div>
          <div class="fila" style="gap: var(--espaciado-s); flex-wrap: wrap;">
            <a href="/paginas/editor-contenidos.html" class="btn btn--secundario btn--pequeno">
              📖 Contenidos
            </a>
            <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">
              📰 Noticias
            </a>
          </div>
        </section>
      `;
    }

    // Continuar donde te quedaste
    if (ultimoTema && ultimoTema.id && ultimoTema.titulo) {
      html += `
        <section class="inicio-continuar" aria-labelledby="titulo-continuar">
          <div class="pila" style="gap: var(--espaciado-xs);">
            <div class="fila" style="gap: var(--espaciado-xs); align-items: center;">
              <span class="insignia insignia--acento">En progreso</span>
              <span id="titulo-continuar" style="font-size: var(--tamano-s); font-weight: var(--peso-seminegrita); color: var(--color-primario);">
                Continuar donde te quedaste
              </span>
            </div>
            <h2 style="font-size: var(--tamano-xl); color: var(--color-primario); margin: 0;">
              ${ui.escapar(ultimoTema.titulo)}
            </h2>
          </div>
          <div>
            <a href="/paginas/tema.html?id=${encodeURIComponent(ultimoTema.id)}" class="btn btn--primario">
              Continuar tema →
            </a>
          </div>
        </section>
      `;
    }

    // Mis Asignaturas
    html += `
      <section class="inicio-seccion" aria-labelledby="titulo-mis-asignaturas">
        <div class="inicio-seccion__cabecera">
          <h2 id="titulo-mis-asignaturas" style="font-size: var(--tamano-xl); color: var(--color-primario); margin: 0;">
            Mis asignaturas
          </h2>
          <a href="/paginas/asignaturas.html" class="btn btn--texto btn--pequeno">
            Ver todas →
          </a>
        </div>
    `;

    if (!asignaturas || asignaturas.length === 0) {
      html += `
        <div class="tarjeta" style="text-align: center; padding: var(--espaciado-xl);">
          <p style="color: var(--color-texto-suave);">No tienes asignaturas inscritas o asignadas en este momento.</p>
        </div>
      `;
    } else {
      html += `
        <div class="inicio-asignaturas-grid">
          ${asignaturas
            .map((asig, i) => {
              const av = avances[i] || { porcentaje: 0, revisados: 0, total: 0 };
              return `
              <article class="tarjeta-asignatura-inicio">
                <div class="pila" style="gap: var(--espaciado-xs);">
                  <div class="fila" style="justify-content: space-between; align-items: flex-start;">
                    <span class="insignia">${ui.escapar(asig.nivel || 'Nivel')}</span>
                    <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
                      ${av.revisados} / ${av.total} temas
                    </span>
                  </div>
                  <h3 style="font-size: var(--tamano-l); margin-top: var(--espaciado-xs); color: var(--color-primario);">
                    ${ui.escapar(asig.nombre)}
                  </h3>
                  <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); line-height: var(--interlineado-base);">
                    ${ui.escapar(asig.descripcion || 'Sin descripción')}
                  </p>

                  <div class="barra-avance-contenedor">
                    <div class="fila" style="justify-content: space-between; font-size: var(--tamano-xs);">
                      <span>Avance</span>
                      <strong>${av.porcentaje}%</strong>
                    </div>
                    <div class="barra-avance" role="progressbar" aria-valuenow="${av.porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance en ${ui.escapar(asig.nombre)}">
                      <div class="barra-avance__relleno" style="width: ${av.porcentaje}%;"></div>
                    </div>
                  </div>
                </div>

                <div style="margin-top: var(--espaciado-m);">
                  <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario" style="width: 100%;">
                    Ver temas
                  </a>
                </div>
              </article>
            `;
            })
            .join('')}
        </div>
      `;
    }
    html += `</section>`;

    // Noticias más recientes (3)
    html += `
      <section class="inicio-seccion" aria-labelledby="titulo-noticias-recientes">
        <div class="inicio-seccion__cabecera">
          <h2 id="titulo-noticias-recientes" style="font-size: var(--tamano-xl); color: var(--color-primario); margin: 0;">
            Noticias recientes
          </h2>
          <a href="/paginas/noticias.html" class="btn btn--texto btn--pequeno">
            Ver todas →
          </a>
        </div>
    `;

    if (tresNoticias.length === 0) {
      html += `
        <div class="tarjeta" style="text-align: center; padding: var(--espaciado-xl);">
          <p style="color: var(--color-texto-suave);">No hay noticias publicadas por el momento.</p>
        </div>
      `;
    } else {
      html += `
        <div class="inicio-noticias-grid">
          ${tresNoticias
            .map((noticia) => {
              const fecha = util.fechaRelativa(noticia.fechaPublicacion || noticia.creadoEn);
              const imagenHtml = noticia.imagen
                ? `<img src="${ui.escapar(noticia.imagen)}" alt="" class="tarjeta-noticia-inicio__img" loading="lazy">`
                : '';
              const destacadaBadge = noticia.destacada
                ? `<span class="insignia insignia--acento">★ Destacada</span>`
                : '';

              return `
              <article class="tarjeta-noticia-inicio">
                ${imagenHtml}
                <div class="tarjeta-noticia-inicio__cuerpo">
                  <div class="fila" style="gap: var(--espaciado-xs); flex-wrap: wrap;">
                    <span class="insignia">${ui.escapar(noticia.categoria || 'General')}</span>
                    ${destacadaBadge}
                  </div>
                  <h3 style="font-size: var(--tamano-m); color: var(--color-primario); margin-top: var(--espaciado-xs);">
                    <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" style="color: inherit; text-decoration: none;">
                      ${ui.escapar(noticia.titulo)}
                    </a>
                  </h3>
                  <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); line-height: var(--interlineado-base);">
                    ${ui.escapar(noticia.resumen || '')}
                  </p>
                </div>
                <div class="tarjeta-noticia-inicio__pie">
                  <time style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">${ui.escapar(fecha)}</time>
                  <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--texto btn--pequeno">
                    Leer más
                  </a>
                </div>
              </article>
            `;
            })
            .join('')}
        </div>
      `;
    }
    html += `</section>`;

    contenido.innerHTML = html;
  } catch (err) {
    console.error('Error al cargar la página de inicio:', err);
    ui.aviso(err.message || 'Error al cargar información de inicio', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function iniciar() {
  if (!contenido) return;
  const usuario = usuarioActual();

  if (!usuario) {
    await renderizarSinSesion();
  } else {
    await renderizarConSesion(usuario);
  }
}

iniciar();
