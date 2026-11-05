import { montarPlantilla } from '../nucleo/plantilla.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Crucigrama', roles: ['estudiante', 'docente', 'admin'] });
const temaId = parametro('temaId');
document.getElementById('contenido').innerHTML = `<section class="tarjeta crucigrama-pendiente"><h1>Crucigrama</h1>
  <p>Esta página es provisional. El juego de crucigrama está pendiente de implementación.</p>
  <p>Ya puedes conocer a Lumo y ajustar sus controles de voz y visibilidad.</p>
  <div class="fila">${temaId ? `<a class="btn btn--secundario" href="/paginas/tema.html?id=${encodeURIComponent(temaId)}">Repasar el tema</a>` : ''}
  <a class="btn btn--primario" href="/paginas/actividades.html">Elegir otra actividad</a></div></section>`;
