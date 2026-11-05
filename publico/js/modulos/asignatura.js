import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { montarTutor } from '../nucleo/tutor.js?v=tutor-visible-2';

await montarPlantilla({ titulo: 'Asignatura', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');
const asignaturaId = util.parametro('id');

async function iniciar() {
  if (!asignaturaId) {
    renderizarError('No se especificó la asignatura.');
    return;
  }

  ui.cargando(true);
  try {
    const [asignatura, todasUnidades, todosTemas, progresos] = await Promise.all([
      api.obtener('asignaturas', asignaturaId),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    const usuario = usuarioActual();
    const idsRevisados = new Set(
      progresos
        .filter((p) => !usuario || p.usuarioId === usuario.id)
        .map((p) => p.temaId)
    );

    // Unidades visibles ordenadas
    const unidades = todasUnidades
      .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    contenido.innerHTML = `
      <header class="pila" style="gap: var(--espaciado-xs); margin-bottom: var(--espaciado-l);">
        <nav aria-label="Miga de pan" style="margin-bottom: var(--espaciado-xs);">
          <a href="/paginas/asignaturas.html" style="font-size: var(--tamano-s);">← Volver a Mis Asignaturas</a>
        </nav>
        <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
          <div>
            <span class="insignia insignia--acento">${ui.escapar(asignatura.nivel || '')}</span>
            <h1 style="margin-top: var(--espaciado-xs);">${ui.escapar(asignatura.nombre)}</h1>
            <p>${ui.escapar(asignatura.descripcion || '')}</p>
          </div>
        </div>
      </header>

      ${usuario?.rol === 'estudiante' ? '<div id="tutor-asignatura" class="asignatura-tutor"></div>' : ''}

      ${
        unidades.length === 0
          ? `
          <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
            <p>Aún no hay unidades didácticas visibles en esta asignatura.</p>
          </div>
        `
          : unidades
              .map((u, idxUnidad) => {
                const temasUnidad = todosTemas
                  .filter((t) => t.unidadId === u.id && t.estado === 'publicado')
                  .sort((a, b) => (a.orden || 0) - (b.orden || 0));

                return `
                <section class="unidad-bloque" aria-labelledby="u-${ui.escapar(u.id)}">
                  <header class="fila" style="justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-borde); padding-bottom: var(--espaciado-s);">
                    <h2 id="u-${ui.escapar(u.id)}" style="font-size: var(--tamano-l); margin: 0;">
                      Unidad ${idxUnidad + 1}: ${ui.escapar(u.titulo)}
                    </h2>
                    <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8;">
                      ${temasUnidad.length} tema(s)
                    </span>
                  </header>

                  <div class="temas-lista-estudiante">
                    ${
                      temasUnidad.length === 0
                        ? `<p style="font-size: var(--tamano-s); opacity: 0.7; padding: var(--espaciado-s);">No hay temas disponibles en esta unidad.</p>`
                        : temasUnidad
                            .map((t, idxTema) => {
                              const revisado = idsRevisados.has(t.id);
                              return `
                              <a href="/paginas/tema.html?id=${encodeURIComponent(t.id)}" class="tarjeta-tema-estudiante">
                                <div class="fila" style="align-items: center; gap: var(--espaciado-m);">
                                  <span style="font-weight: var(--peso-negrita); font-size: var(--tamano-m); color: var(--color-primario);">
                                    ${idxTema + 1}.
                                  </span>
                                  <div>
                                    <div style="font-weight: var(--peso-negrita);">${ui.escapar(t.titulo)}</div>
                                    <div style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.8;">
                                      Dificultad: ${ui.escapar(t.dificultad || 'intermedio')}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <span class="estado-revision ${revisado ? 'estado-revision--revisado' : 'estado-revision--pendiente'}">
                                    ${revisado ? '✓ Revisado' : 'Pendiente'}
                                  </span>
                                </div>
                              </a>
                            `;
                            })
                            .join('')
                    }
                  </div>
                </section>
              `;
              })
              .join('')
      }
    `;
    if (usuario?.rol === 'estudiante') {
      montarTutor({ contenedor: document.getElementById('tutor-asignatura'), asignaturaId, nombre: asignatura.nombre });
    }
  } catch (err) {
    renderizarError(err.message || 'Error al cargar la asignatura.');
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
      <a href="/paginas/asignaturas.html" class="btn btn--primario" style="margin-top: var(--espaciado-m);">
        Volver a Mis Asignaturas
      </a>
    </div>
  `;
}

iniciar();

