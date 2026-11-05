// Catálogo de actividades interactivas y formativas (P04.3)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as ui from '../nucleo/ui.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: 'Actividades', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');

function iniciar() {
  if (!contenido) return;

  const iconosPorId = {
    ahorcado: '🎈',
    canciones: '🎵',
    pareja: '🃏',
    'sopa-letras': '🔍',
    crucigrama: '✏️',
    quiz: '❓',
    simulacion: '🎭'
  };

  contenido.innerHTML = `
    <header class="actividades-cabecera pila" style="gap: var(--espaciado-xs);">
      <h1 style="color: var(--color-primario); margin: 0;">Actividades formativas</h1>
      <p style="color: var(--color-texto-suave); font-size: var(--tamano-m); margin: 0;">
        Pon en práctica tus conocimientos, afianza conceptos clave y acumula puntos e insignias.
      </p>
    </header>

    ${
      !ACTIVIDADES || ACTIVIDADES.length === 0
        ? `
      <div class="tarjeta vacio">
        <p>No hay actividades disponibles en este momento.</p>
      </div>
    `
        : `
      <div class="actividades-grid">
        ${ACTIVIDADES.map((act) => {
          const icono = iconosPorId[act.id] || '🎮';
          return `
          <article class="tarjeta-actividad-catalogo">
            <div class="pila" style="gap: var(--espaciado-s);">
              <div class="tarjeta-actividad-catalogo__icono" aria-hidden="true">${icono}</div>
              <h2 class="tarjeta-actividad-catalogo__titulo">${ui.escapar(act.texto)}</h2>
              <p class="tarjeta-actividad-catalogo__desc">${ui.escapar(act.descripcion)}</p>
            </div>
            <div style="margin-top: var(--espaciado-m);">
              <a href="${ui.escapar(act.href)}" class="btn btn--primario" style="width: 100%;">
                Jugar
              </a>
            </div>
          </article>
        `;
        }).join('')}
      </div>
    `
    }
  `;
}

iniciar();

