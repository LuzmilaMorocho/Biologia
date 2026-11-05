import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

// Exporta la función para calcular el porcentaje de avance (% de temas publicados revisados)
export async function calcularAvance(asignaturaId) {
  try {
    const [todasUnidades, todosTemas, progresos] = await Promise.all([
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    const idsUnidades = todasUnidades
      .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
      .map((u) => u.id);

    const temasPublicados = todosTemas.filter(
      (t) => idsUnidades.includes(t.unidadId) && t.estado === 'publicado'
    );

    if (temasPublicados.length === 0) {
      return { porcentaje: 0, revisados: 0, total: 0 };
    }

    const usuario = usuarioActual();
    const misProgresos = progresos.filter(
      (p) => !usuario || p.usuarioId === usuario.id
    );
    const idsTemasRevisados = new Set(misProgresos.map((p) => p.temaId));

    const revisados = temasPublicados.filter((t) => idsTemasRevisados.has(t.id)).length;
    const porcentaje = Math.round((revisados / temasPublicados.length) * 100);

    return { porcentaje, revisados, total: temasPublicados.length };
  } catch (err) {
    console.error('Error calculando avance:', err);
    return { porcentaje: 0, revisados: 0, total: 0 };
  }
}

async function iniciar() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;
  ui.cargando(true);

  try {
    const asignaturas = await api.listar('asignaturas');

    if (!asignaturas || asignaturas.length === 0) {
      contenido.innerHTML = `
        <div class="tarjeta vacio" style="text-align: center; padding: var(--espaciado-xl);">
          <h1>Mis Asignaturas</h1>
          <p>No tienes asignaturas inscritas actualmente.</p>
        </div>
      `;
      return;
    }

    const avances = await Promise.all(
      asignaturas.map((a) => calcularAvance(a.id))
    );

    contenido.innerHTML = `
      <header class="pila" style="gap: var(--espaciado-xs);">
        <h1>Mis Asignaturas</h1>
        <p>Explora tus asignaturas activas y continúa tu avance en los contenidos pedagógicos.</p>
      </header>

      <div class="asignaturas-lista">
        ${asignaturas
          .map((asig, i) => {
            const av = avances[i];
            return `
            <article class="tarjeta-asignatura-estudiante" data-id="${ui.escapar(asig.id)}">
              <div class="pila" style="gap: var(--espaciado-xs);">
                <div class="fila" style="justify-content: space-between; align-items: flex-start;">
                  <span class="insignia insignia--acento">${ui.escapar(asig.nivel || 'Nivel')}</span>
                  <span style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.7;">
                    ${av.revisados} / ${av.total} temas
                  </span>
                </div>
                <h2 style="font-size: var(--tamano-l); margin-top: var(--espaciado-xs); color: var(--color-primario);">
                  ${ui.escapar(asig.nombre)}
                </h2>
                <p style="font-size: var(--tamano-s); color: var(--color-texto); line-height: var(--interlineado-base);">
                  ${ui.escapar(asig.descripcion || 'Sin descripción')}
                </p>

                <div class="barra-avance-contenedor">
                  <div class="fila" style="justify-content: space-between; font-size: var(--tamano-xs);">
                    <span>Avance</span>
                    <strong>${av.porcentaje}%</strong>
                  </div>
                  <div class="barra-avance" role="progressbar" aria-valuenow="${av.porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Porcentaje de avance en ${ui.escapar(asig.nombre)}">
                    <div class="barra-avance__relleno" style="width: ${av.porcentaje}%;"></div>
                  </div>
                </div>
              </div>

              <div style="margin-top: var(--espaciado-m);">
                <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario" style="width: 100%;">
                  Ver Temas
                </a>
              </div>
            </article>
          `;
          })
          .join('')}
      </div>
    `;
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar asignaturas', 'error');
  } finally {
    ui.cargando(false);
  }
}

if (typeof window !== 'undefined' && window.location.pathname.includes('asignaturas.html')) {
  await montarPlantilla({ titulo: 'Mis asignaturas', roles: ['estudiante', 'docente'] });
  iniciar();
}

