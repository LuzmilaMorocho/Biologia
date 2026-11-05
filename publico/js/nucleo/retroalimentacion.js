// Cliente: retroalimentación inmediata y resumen de actividades (§A contratos.md)
import * as ui from './ui.js';

// Muestra un panel de retroalimentación inmediata para una respuesta o intento
export function mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema }) {
  let panel = document.getElementById('panel-retroalimentacion');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel-retroalimentacion';
  }

  const claseEstado = correcto ? 'retro--correcto' : 'retro--incorrecto';
  panel.className = `retro ${claseEstado}`;
  panel.setAttribute('aria-live', 'polite');

  const icono = correcto ? '✓' : '✕';
  const textoTitulo = correcto ? '¡Correcto!' : '¡Incorrecto!';

  panel.innerHTML = `
    <div class="retro__icono" aria-hidden="true">${icono}</div>
    <div class="retro__contenido pila" style="gap: var(--espaciado-xs);">
      <strong>${textoTitulo}</strong>
      ${explicacion ? `<p class="retro__explicacion">${ui.escapar(explicacion)}</p>` : ''}
      ${sugerencia ? `<p class="retro__sugerencia"><em>Sugerencia:</em> ${ui.escapar(sugerencia)}</p>` : ''}
      ${
        enlaceTema
          ? `
        <div style="margin-top: var(--espaciado-xs);">
          <a href="${ui.escapar(enlaceTema)}" class="btn btn--texto btn--pequeno" style="padding-left: 0;">
            Repasar el tema →
          </a>
        </div>
      `
          : ''
      }
    </div>
  `;

  const contenedorDestino = document.getElementById('retroalimentacion') || document.getElementById('contenido');
  if (contenedorDestino && !contenedorDestino.contains(panel)) {
    contenedorDestino.appendChild(panel);
  }

  return panel;
}

// Muestra modal con resumen de desempeño y resuelve "repetir" o "salir"
export async function mostrarResumen({ titulo, aciertos, errores, recomendaciones, enlaceTema }) {
  const contenido = document.createElement('div');
  contenido.className = 'resumen-actividad pila';
  contenido.style.gap = 'var(--espaciado-m)';

  contenido.innerHTML = `
    <div class="fila" style="justify-content: space-around; margin: var(--espaciado-s) 0;">
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-3xl); font-weight: var(--peso-extranegrita); color: var(--color-exito);">
          ${Number(aciertos || 0)}
        </span>
        <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">Aciertos</p>
      </div>
      <div style="text-align: center;">
        <span style="font-size: var(--tamano-3xl); font-weight: var(--peso-extranegrita); color: var(--color-error);">
          ${Number(errores || 0)}
        </span>
        <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">Errores</p>
      </div>
    </div>

    ${
      recomendaciones
        ? `
      <div class="alerta alerta--info">
        <p style="margin: 0; font-size: var(--tamano-s);">${ui.escapar(recomendaciones)}</p>
      </div>
    `
        : ''
    }

    ${
      enlaceTema
        ? `
      <div style="text-align: center; margin-top: var(--espaciado-xs);">
        <a href="${ui.escapar(enlaceTema)}" class="btn btn--secundario" style="width: 100%;">
          Repasar el tema
        </a>
      </div>
    `
        : ''
    }
  `;

  const respuesta = await ui.modal({
    titulo: titulo || 'Resumen de la actividad',
    contenido,
    acciones: [
      { texto: 'Salir', valor: 'salir', clase: 'btn--secundario' },
      { texto: 'Jugar de nuevo', valor: 'repetir', clase: 'btn--primario' }
    ]
  });

  return respuesta === 'repetir' ? 'repetir' : 'salir';
}

