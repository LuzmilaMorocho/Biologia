import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { publicacion, vincularAcciones, paginador } from '../nucleo/foros.js';

await montarPlantilla({ titulo: 'Conversación del foro', roles: ['sesion'] });
const contenido = document.getElementById('contenido');
const id = util.parametro('id');
let hilo = null, respuestas = null, pagina = 1, borrador = '', ocupado = false;

async function cargar() {
  const nuevoHilo = await api.obtener('foros-hilos', id);
  const nuevas = await api.llamar('GET', `/api/foros-hilos/${encodeURIComponent(id)}/respuestas?pagina=${pagina}`);
  hilo = nuevoHilo; respuestas = nuevas;
  if (pagina > nuevas.paginas) { pagina = nuevas.paginas; return cargar(); }
}

function renderizar() {
  contenido.innerHTML = `<div class="hilo"><header><a href="/paginas/foros.html?asignaturaId=${encodeURIComponent(hilo.asignaturaId)}">← Volver a los foros</a><h1>Conversación del foro</h1></header>
    ${publicacion('foros-hilos', hilo)}<section class="hilo__respuestas" aria-labelledby="hilo-respuestas"><h2 id="hilo-respuestas" tabindex="-1">Respuestas (${respuestas.total})</h2>
    ${respuestas.items.length ? respuestas.items.map((r) => publicacion('foros-respuestas', r)).join('') : '<p>Todavía no hay respuestas. Puedes iniciar la conversación.</p>'}</section>
    ${paginador(pagina, respuestas.paginas, respuestas.total)}<p id="hilo-error" class="campo__error" role="alert"></p>
    ${hilo.cerrado ? '<div class="tarjeta"><p role="status">Este hilo está cerrado y no admite nuevas respuestas.</p></div>' : `<form id="hilo-formulario" class="tarjeta pila hilo__respuesta"><div class="campo"><label for="hilo-texto">Tu respuesta (máximo 5.000 caracteres)</label>
      <textarea id="hilo-texto" required maxlength="5000" rows="6">${ui.escapar(borrador)}</textarea></div><button type="submit" class="btn btn--primario">Publicar respuesta</button></form>`}
    <div id="retroalimentacion"></div></div>`;
  vincularAcciones(contenido, [{ ...hilo, coleccion: 'foros-hilos' }, ...respuestas.items.map((r) => ({ ...r, coleccion: 'foros-respuestas' }))], () => trabajar(cargar));
  contenido.querySelectorAll('[data-pagina]').forEach((boton) => boton.addEventListener('click', () => trabajar(async () => {
    pagina = Number(boton.dataset.pagina); await cargar();
  }, true)));
  document.getElementById('hilo-texto')?.addEventListener('input', (evento) => { borrador = evento.target.value; });
  document.getElementById('hilo-formulario')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!evento.target.reportValidity() || ocupado) return;
    borrador = document.getElementById('hilo-texto').value;
    return trabajar(async () => {
      const reg = await api.crear('foros-respuestas', { hiloId: id, texto: borrador });
      borrador = '';
      // La respuesta ya existe: un fallo de recarga no debe permitir enviarla de nuevo.
      document.getElementById('hilo-texto').value = '';
      ui.aviso('Respuesta publicada.', 'exito');
      if (reg.avisos?.length) reg.avisos.forEach((aviso) => ui.aviso(aviso, 'info'));
      if (reg.gamificacion) await mostrarLogros(reg.gamificacion);
      pagina = Math.ceil((respuestas.total + 1) / 20);
      await cargar();
      if (pagina !== respuestas.paginas) { pagina = respuestas.paginas; await cargar(); }
      return { publicada: true };
    });
  });
}

async function trabajar(accion, enfocar = false) {
  if (ocupado) return;
  const paginaAnterior = pagina;
  ocupado = true;
  const deshabilitados = [...contenido.querySelectorAll('button')].filter((el) => el.disabled);
  contenido.querySelectorAll('button, textarea').forEach((el) => { el.disabled = true; });
  document.getElementById('hilo-error').textContent = '';
  try {
    const resultado = await accion();
    renderizar();
    if (resultado?.publicada) mostrarRetro({ correcto: true, explicacion: 'Tu respuesta se publicó en el foro.', sugerencia: 'Continúa el diálogo con respeto y argumentos.' });
    if (enfocar) document.getElementById('hilo-respuestas').focus();
  }
  catch (error) { pagina = paginaAnterior; document.getElementById('hilo-error').textContent = error.message; }
  finally {
    ocupado = false;
    contenido.querySelectorAll('button, textarea').forEach((el) => { el.disabled = false; });
    deshabilitados.forEach((el) => { el.disabled = true; });
    contenido.querySelectorAll('[data-pagina]').forEach((el) => { el.disabled = Number(el.dataset.pagina) < 1 || Number(el.dataset.pagina) > respuestas.paginas; });
  }
}

async function iniciar() {
  ui.cargando(true);
  try { if (!id) throw new Error('Selecciona un hilo desde los foros.'); await cargar(); renderizar(); }
  catch (error) {
    contenido.innerHTML = `<div class="tarjeta pila"><h1>Conversación del foro</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" class="btn btn--secundario" id="hilo-recargar">Reintentar carga</button><a href="/paginas/foros.html">Volver a los foros</a></div>`;
    document.getElementById('hilo-recargar').addEventListener('click', iniciar);
  } finally { ui.cargando(false); }
}
if (usuarioActual()) await iniciar();
