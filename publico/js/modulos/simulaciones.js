import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Simulaciones', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
const puedeEditar = ['docente', 'admin'].includes(usuarioActual()?.rol);

async function iniciar() {
  ui.cargando(true);
  try {
    const [simulaciones, temas] = await Promise.all([api.listar('simulaciones'), api.listar('temas')]);
    const temaParam = util.parametro('temaId');
    const mapa = new Map(temas.map((t) => [t.id, t.titulo]));
    contenido.innerHTML = `<header class="simulaciones-cabecera"><div><h1>Simulaciones</h1><p>Explora situaciones y aprende de las consecuencias de tus decisiones.</p></div>
      ${puedeEditar ? '<a id="simulacion-nueva" class="btn btn--primario">Nueva</a>' : ''}</header>
      <div class="campo"><label for="simulaciones-tema">Tema</label><select id="simulaciones-tema"><option value="">Todos los temas</option>
      ${temas.map((t) => `<option value="${ui.escapar(t.id)}">${ui.escapar(t.titulo)}</option>`).join('')}</select></div>
      <div id="simulaciones-lista" class="simulaciones-lista" aria-live="polite"></div>`;
    const selector = document.getElementById('simulaciones-tema');
    if (temas.some((t) => t.id === temaParam)) selector.value = temaParam;
    function dibujar() {
      const temaId = selector.value;
      if (puedeEditar) document.getElementById('simulacion-nueva').href = '/paginas/editor-simulacion.html' + (temaId ? `?temaId=${encodeURIComponent(temaId)}` : '');
      const lista = simulaciones.filter((s) => !temaId || s.temaId === temaId);
      document.getElementById('simulaciones-lista').innerHTML = lista.length ? lista.map((s) => `<article class="tarjeta">
        <p class="texto-secundario">${ui.escapar(mapa.get(s.temaId) || 'Tema no disponible')}</p><h2>${ui.escapar(s.titulo)}</h2>
        <p>Modo: ${s.modo === 'rol' ? 'Rol con IA' : 'Escenarios'}${puedeEditar ? ` · ${ui.escapar(s.estado)}` : ''}</p>
        <div class="simulaciones-acciones"><a class="btn btn--primario" href="/paginas/simulador.html?id=${encodeURIComponent(s.id)}">Iniciar<span class="sr-only"> ${ui.escapar(s.titulo)}</span></a>
        ${puedeEditar ? `<a class="btn btn--secundario" href="/paginas/editor-simulacion.html?id=${encodeURIComponent(s.id)}">Editar<span class="sr-only"> ${ui.escapar(s.titulo)}</span></a>
        <a class="btn btn--texto" href="/paginas/simulador.html?id=${encodeURIComponent(s.id)}&amp;vista=previa">Vista previa</a>` : ''}</div></article>`).join('')
        : '<p class="vacio">Todavía no hay simulaciones disponibles para este tema.</p>';
    }
    selector.addEventListener('change', dibujar); dibujar();
  } catch (error) {
    contenido.innerHTML = `<p role="alert">${ui.escapar(error.message || 'No se pudieron cargar las simulaciones.')}</p><button type="button" id="simulaciones-reintentar" class="btn btn--secundario">Reintentar</button>`;
    document.getElementById('simulaciones-reintentar').addEventListener('click', iniciar);
  } finally { ui.cargando(false); }
}

if (usuarioActual()) await iniciar();
