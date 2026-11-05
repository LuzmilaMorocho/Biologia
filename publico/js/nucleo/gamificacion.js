// Cliente: motor de gamificación y logros (§A contratos.md)
import { llamar } from './api.js';
import * as ui from './ui.js';
import { cambiarEstado } from './avatar.js';

let celebracionAvatar = null;

// Registra un intento de actividad en el servidor y muestra los logros obtenidos
export async function registrarIntento(datos) {
  const resultado = await llamar('POST', '/api/intentos', datos);
  await mostrarLogros(resultado);
  return resultado;
}

// Muestra avisos de puntos y modales de celebración por insignias nuevas
export async function mostrarLogros(resultado) {
  if (!resultado) return;

  // 1. Notificación de puntos ganados si son más de 0
  if (resultado.puntosGanados > 0) {
    ui.aviso(`¡Ganaste +${resultado.puntosGanados} puntos!`, 'exito');
  }

  // 2. Actualizar indicador #puntos-usuario en el encabezado si existe
  if (typeof resultado.puntosTotales === 'number') {
    const elPuntos = document.getElementById('puntos-usuario');
    if (elPuntos) {
      elPuntos.textContent = `${resultado.puntosTotales} pts`;
    }
  }

  // 3. Modal de celebración por cada insignia nueva obtenida
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    const avatar = document.getElementById('avatar-guia');
    if (avatar && cambiarEstado('celebrando')) {
      clearTimeout(celebracionAvatar);
      celebracionAvatar = setTimeout(() => { if (avatar.dataset.estado === 'celebrando') cambiarEstado('reposo'); }, 3000);
    }
    for (const insignia of resultado.insigniasNuevas) {
      const cuerpoModal = document.createElement('div');
      cuerpoModal.className = 'celebracion';
      cuerpoModal.innerHTML = `
        <div class="celebracion__icono" aria-hidden="true">${ui.escapar(insignia.icono || '🏆')}</div>
        <div class="celebracion__cuerpo">
          <p class="celebracion__subtitulo">¡Nueva insignia desbloqueada!</p>
          <h3 class="celebracion__nombre">${ui.escapar(insignia.nombre)}</h3>
        </div>
      `;

      await ui.modal({
        titulo: '¡Felicitaciones!',
        contenido: cuerpoModal,
        acciones: [{ texto: '¡Continuar!', valor: true, clase: 'btn--primario' }]
      });
    }
  }
}

// Consulta los logros de un usuario ("yo" por defecto)
export async function logrosDe(usuarioId = 'yo') {
  return await llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
}

