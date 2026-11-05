import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { errorPregunta } from '../nucleo/preguntas.js';

await montarPlantilla({ titulo: 'Banco de preguntas', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const niveles = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];
const tipos = { opcion: 'Opción múltiple', vf: 'Verdadero o falso', completar: 'Completar' };
let temas = [];
let etiquetasTemas = new Map();
let temaId = '';
let nivel = 1;
let preguntas = [];
let propuestas = [];
let siguientePropuesta = 0;
let ocupado = false;
let errorCarga = '';

function cerrarModal(div) {
  div.closest('.modal-dialogo')?.querySelector('.modal-pie button')?.click();
}

function modal(titulo, div) {
  const resultado = ui.modal({ titulo, contenido: div, acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn--secundario' }] });
  div.closest('.modal-dialogo')?.classList.add('modal-dialogo--amplio');
  return resultado;
}

async function cargarPreguntas() {
  preguntas = temaId ? await api.listar('preguntas', { temaId }) : [];
  errorCarga = '';
}

async function trabajar(accion) {
  if (ocupado) return;
  ocupado = true;
  contenido.querySelectorAll('button, select').forEach((control) => { control.disabled = true; });
  ui.cargando(true);
  try {
    await accion();
  } catch (error) {
    ui.aviso(error.message || 'No se pudo completar la operación.', 'error');
  } finally {
    ocupado = false;
    ui.cargando(false);
    renderizar();
  }
}

function detalle(pregunta) {
  const correcta = pregunta.tipo === 'opcion' ? pregunta.opciones?.[pregunta.correcta]
    : pregunta.tipo === 'vf' ? (pregunta.correcta ? 'Verdadero' : 'Falso') : pregunta.correcta;
  return `<details><summary>Revisar respuesta y retroalimentación</summary>
    <ol class="banco-preguntas__opciones">${(pregunta.opciones || []).map((opcion) => `<li>${ui.escapar(opcion)}</li>`).join('')}</ol>
    <p><strong>Respuesta correcta:</strong> ${ui.escapar(correcta)}</p>
    <p><strong>Retroalimentación:</strong> ${ui.escapar(pregunta.retroalimentacion)}</p></details>`;
}

function renderizar() {
  const focoAnterior = contenido.contains(document.activeElement) ? document.activeElement.id : '';
  const actuales = preguntas.filter((item) => Number(item.nivel) === nivel);
  const aprobadas = actuales.filter((item) => item.estado === 'aprobado').length;
  const pendientes = propuestas.filter((item) => item.temaId === temaId && item.nivel === nivel);
  contenido.innerHTML = `<div class="banco-preguntas">
    <header><h1>Banco de preguntas</h1><p>Crea y revisa las preguntas de cada nivel cognitivo antes de utilizarlas en las evaluaciones.</p></header>
    <div class="campo"><label for="banco-tema">Tema</label>
      <select id="banco-tema" ${ocupado ? 'disabled' : ''}>
        ${temas.length ? '' : '<option value="">No hay temas disponibles</option>'}
        ${temas.map((tema) => `<option value="${ui.escapar(tema.id)}" ${tema.id === temaId ? 'selected' : ''}>${ui.escapar(etiquetasTemas.get(tema.id))}</option>`).join('')}
      </select>
    </div>
    <div class="pestanas" role="tablist" aria-label="Nivel cognitivo">
      ${niveles.map((nombre, indice) => {
        const numero = indice + 1;
        const total = preguntas.filter((item) => Number(item.nivel) === numero && item.estado === 'aprobado').length;
        return `<button type="button" class="pestanas__boton" role="tab" id="nivel-${numero}" data-nivel="${numero}" aria-controls="panel-preguntas" aria-selected="${numero === nivel}" tabindex="${numero === nivel ? 0 : -1}" ${ocupado ? 'disabled' : ''}>Nivel ${numero} · ${nombre} (${total} aprobadas)</button>`;
      }).join('')}
    </div>
    <section id="panel-preguntas" role="tabpanel" aria-labelledby="nivel-${nivel}" tabindex="0" class="banco-preguntas__lista">
      <h2>Nivel ${nivel}: ${niveles[nivel - 1]}</h2>
      <p role="status">${aprobadas} preguntas aprobadas.${aprobadas < 20 ? ' Se recomienda completar al menos 20 preguntas aprobadas para este nivel.' : ''}</p>
      ${errorCarga ? `<p class="campo__error" role="alert">${ui.escapar(errorCarga)}</p><button type="button" class="btn btn--secundario" id="banco-reintentar">Reintentar carga</button>` : ''}
      <div class="banco-preguntas__acciones">
        <button type="button" class="btn btn--primario" id="banco-nueva" ${!temaId || ocupado || errorCarga ? 'disabled' : ''}>Crear pregunta manual</button>
        <button type="button" class="btn btn--secundario" id="banco-generar" ${!temaId || ocupado || errorCarga ? 'disabled' : ''}>Generar con IA</button>
      </div>
      ${actuales.length ? actuales.map((pregunta) => `<article class="tarjeta">
        <h3>${ui.escapar(pregunta.enunciado)}</h3>
        <p>${ui.escapar(tipos[pregunta.tipo] || pregunta.tipo)} · ${ui.escapar(pregunta.estado)} · Origen: ${ui.escapar(pregunta.origen)}</p>
        ${detalle(pregunta)}
        <button type="button" class="btn btn--secundario" data-editar="${ui.escapar(pregunta.id)}" ${ocupado ? 'disabled' : ''}>Editar pregunta</button>
      </article>`).join('') : '<p>No hay preguntas guardadas en este nivel.</p>'}
    </section>
    <section aria-labelledby="titulo-propuestas" class="banco-preguntas__lista">
      <h2 id="titulo-propuestas">Propuestas de IA pendientes (${pendientes.length})</h2>
      <p>Las propuestas se conservan en esta página hasta que las apruebes o descartes. Al salir o recargar se perderán las pendientes.</p>
      ${pendientes.map((propuesta) => `<article class="tarjeta">
        <h3>${ui.escapar(propuesta.datos.enunciado)}</h3><p>${ui.escapar(tipos[propuesta.datos.tipo])} · Pendiente de revisión</p>
        ${detalle(propuesta.datos)}
        <div class="banco-preguntas__acciones">
          <button type="button" class="btn btn--primario" data-aprobar="${propuesta.clave}" ${ocupado ? 'disabled' : ''}>Aprobar propuesta</button>
          <button type="button" class="btn btn--secundario" data-propuesta="${propuesta.clave}" ${ocupado ? 'disabled' : ''}>Editar propuesta</button>
          <button type="button" class="btn btn--peligro" data-descartar="${propuesta.clave}" ${ocupado ? 'disabled' : ''}>Descartar propuesta</button>
        </div></article>`).join('')}
    </section></div>`;
  vincularEventos();
  if (focoAnterior) document.getElementById(focoAnterior)?.focus();
}

function seleccionarNivel(numero) {
  if (ocupado) return;
  nivel = numero;
  renderizar();
  document.getElementById(`nivel-${nivel}`)?.focus();
}

function vincularEventos() {
  document.getElementById('banco-tema').addEventListener('change', (evento) => trabajar(async () => {
    temaId = evento.target.value;
    preguntas = [];
    try { await cargarPreguntas(); } catch (error) { errorCarga = error.message; }
  }));
  document.getElementById('banco-reintentar')?.addEventListener('click', () => trabajar(async () => {
    try { await cargarPreguntas(); } catch (error) { errorCarga = error.message; }
  }));
  contenido.querySelectorAll('[data-nivel]').forEach((boton) => {
    boton.addEventListener('click', () => seleccionarNivel(Number(boton.dataset.nivel)));
    boton.addEventListener('keydown', (evento) => {
      const teclas = { ArrowRight: nivel % 5 + 1, ArrowLeft: (nivel + 3) % 5 + 1, Home: 1, End: 5 };
      if (Object.hasOwn(teclas, evento.key)) { evento.preventDefault(); seleccionarNivel(teclas[evento.key]); }
    });
  });
  document.getElementById('banco-nueva').addEventListener('click', () => editarPregunta({ temaId, nivel, tipo: 'opcion', opciones: ['', '', '', ''], correcta: 0, origen: 'docente', estado: 'aprobado' }));
  document.getElementById('banco-generar').addEventListener('click', generarPreguntas);
  contenido.querySelectorAll('[data-editar]').forEach((boton) => boton.addEventListener('click', () => editarPregunta(preguntas.find((item) => item.id === boton.dataset.editar))));
  contenido.querySelectorAll('[data-propuesta]').forEach((boton) => boton.addEventListener('click', () => {
    const propuesta = propuestas.find((item) => item.clave === Number(boton.dataset.propuesta));
    editarPregunta({ ...propuesta.datos, temaId: propuesta.temaId, nivel: propuesta.nivel }, propuesta);
  }));
  contenido.querySelectorAll('[data-descartar]').forEach((boton) => boton.addEventListener('click', () => {
    propuestas = propuestas.filter((item) => item.clave !== Number(boton.dataset.descartar));
    renderizar();
    document.getElementById('titulo-propuestas').setAttribute('tabindex', '-1');
    document.getElementById('titulo-propuestas').focus();
  }));
  contenido.querySelectorAll('[data-aprobar]').forEach((boton) => boton.addEventListener('click', () => trabajar(async () => {
    const propuesta = propuestas.find((item) => item.clave === Number(boton.dataset.aprobar));
    const mensaje = errorPregunta(propuesta.datos);
    if (mensaje) throw new Error(mensaje);
    const repetida = preguntas.some((item) => Number(item.nivel) === propuesta.nivel && util.normalizar(item.enunciado) === util.normalizar(propuesta.datos.enunciado));
    if (repetida) throw new Error('Ya existe una pregunta con ese enunciado en este nivel. Edita o descarta la propuesta.');
    const creada = await api.crear('preguntas', { ...propuesta.datos, temaId: propuesta.temaId, nivel: propuesta.nivel, origen: 'ia', estado: 'aprobado' });
    preguntas.push(creada);
    propuestas = propuestas.filter((item) => item !== propuesta);
    ui.aviso('Pregunta aprobada y guardada.', 'exito');
  })));
}

function editarPregunta(pregunta, propuesta = null) {
  const div = document.createElement('div');
  div.innerHTML = `<form class="pila">
    <div class="campo"><label for="pregunta-tipo">Tipo</label><select id="pregunta-tipo" name="tipo">${Object.entries(tipos).map(([valor, texto]) => `<option value="${valor}" ${pregunta.tipo === valor ? 'selected' : ''}>${texto}</option>`).join('')}</select></div>
    <div class="campo"><label for="pregunta-enunciado">Enunciado</label><textarea id="pregunta-enunciado" name="enunciado" rows="3" required>${ui.escapar(pregunta.enunciado || '')}</textarea></div>
    <div data-respuesta></div>
    <div class="campo"><label for="pregunta-retro">Retroalimentación</label><textarea id="pregunta-retro" name="retroalimentacion" rows="3" required>${ui.escapar(pregunta.retroalimentacion || '')}</textarea></div>
    ${propuesta ? '<p>Guardar los cambios no aprueba la propuesta.</p>' : `<div class="campo"><label for="pregunta-estado">Estado</label><select id="pregunta-estado" name="estado"><option value="aprobado" ${pregunta.estado === 'aprobado' ? 'selected' : ''}>Aprobado</option><option value="borrador" ${pregunta.estado === 'borrador' ? 'selected' : ''}>Borrador</option></select></div>`}
    <p class="campo__error" role="alert"></p>
    <button type="submit" class="btn btn--primario">${propuesta ? 'Guardar propuesta' : 'Guardar pregunta'}</button>
  </form>`;
  const form = div.querySelector('form');
  const respuesta = div.querySelector('[data-respuesta]');
  const boton = form.querySelector('button');
  let guardando = false;
  function mostrarRespuesta(datos) {
    const tipo = form.elements.tipo.value;
    if (tipo === 'opcion') {
      respuesta.innerHTML = `<div class="pila">${[0, 1, 2, 3].map((indice) => `<div class="campo"><label for="pregunta-opcion-${indice}">Opción ${indice + 1}</label><input id="pregunta-opcion-${indice}" name="opcion${indice}" required value="${ui.escapar(datos.opciones?.[indice] || '')}"></div>`).join('')}
        <div class="campo"><label for="pregunta-correcta">Respuesta correcta</label><select id="pregunta-correcta" name="correcta">${[0, 1, 2, 3].map((indice) => `<option value="${indice}" ${datos.correcta === indice ? 'selected' : ''}>Opción ${indice + 1}</option>`).join('')}</select></div></div>`;
    } else if (tipo === 'vf') {
      respuesta.innerHTML = `<div class="campo"><label for="pregunta-correcta">Respuesta correcta</label><select id="pregunta-correcta" name="correcta"><option value="true" ${datos.correcta === true ? 'selected' : ''}>Verdadero</option><option value="false" ${datos.correcta === false ? 'selected' : ''}>Falso</option></select></div>`;
    } else {
      respuesta.innerHTML = `<p>Incluye ____ en el enunciado para indicar el espacio a completar.</p><div class="campo"><label for="pregunta-correcta">Palabra o frase correcta</label><input id="pregunta-correcta" name="correcta" required value="${ui.escapar(typeof datos.correcta === 'string' ? datos.correcta : '')}"></div>`;
    }
  }
  mostrarRespuesta(pregunta);
  form.elements.tipo.addEventListener('change', () => mostrarRespuesta({}));
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardando || ocupado || !form.reportValidity()) return;
    const tipo = form.elements.tipo.value;
    const datos = {
      tipo, enunciado: form.elements.enunciado.value.trim(), retroalimentacion: form.elements.retroalimentacion.value.trim(),
      opciones: tipo === 'opcion' ? [0, 1, 2, 3].map((indice) => form.elements[`opcion${indice}`].value.trim()) : tipo === 'vf' ? ['Verdadero', 'Falso'] : [],
      correcta: tipo === 'opcion' ? Number(form.elements.correcta.value) : tipo === 'vf' ? form.elements.correcta.value === 'true' : form.elements.correcta.value.trim()
    };
    const mensaje = errorPregunta(datos);
    if (mensaje) { form.querySelector('[role="alert"]').textContent = mensaje; return; }
    guardando = true;
    boton.disabled = true;
    form.querySelector('[role="alert"]').textContent = '';
    try {
      if (propuesta) {
        propuesta.datos = datos;
      } else {
        ocupado = true;
        contenido.querySelectorAll('button, select').forEach((control) => { control.disabled = true; });
        ui.cargando(true);
        const registro = { ...datos, temaId: pregunta.temaId, nivel: pregunta.nivel, origen: pregunta.origen || 'docente', estado: form.elements.estado.value };
        const guardada = pregunta.id ? await api.actualizar('preguntas', pregunta.id, registro) : await api.crear('preguntas', registro);
        if (temaId === pregunta.temaId) {
          preguntas = pregunta.id ? preguntas.map((item) => item.id === pregunta.id ? guardada : item) : [...preguntas, guardada];
        }
      }
      cerrarModal(div);
      renderizar();
      ui.aviso(propuesta ? 'Propuesta editada. Todavía requiere aprobación.' : 'Pregunta guardada.', 'exito');
    } catch (error) {
      form.querySelector('[role="alert"]').textContent = error.message || 'No se pudo guardar la pregunta.';
    } finally {
      guardando = false;
      boton.disabled = false;
      if (!propuesta) {
        ocupado = false;
        renderizar();
      }
      ui.cargando(false);
    }
  });
  modal(propuesta ? 'Editar propuesta de IA' : pregunta.id ? 'Editar pregunta' : 'Crear pregunta manual', div);
}

function generarPreguntas() {
  const temaGeneracion = temaId;
  const nivelGeneracion = nivel;
  const div = document.createElement('div');
  div.innerHTML = `<form class="pila"><p>Nivel ${nivelGeneracion}: ${niveles[nivelGeneracion - 1]}. Las preguntas generadas requieren revisión y aprobación.</p>
    <div class="campo"><label for="cantidad-preguntas">Cantidad</label><input id="cantidad-preguntas" name="cantidad" type="number" min="5" max="15" step="1" value="10" required></div>
    <p class="campo__error" role="alert"></p><button type="submit" class="btn btn--primario">Generar propuestas</button></form>`;
  const form = div.querySelector('form');
  let generando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (generando || ocupado || !form.reportValidity()) return;
    generando = true;
    ocupado = true;
    form.querySelector('button').disabled = true;
    form.querySelector('[role="alert"]').textContent = '';
    renderizar();
    ui.cargando(true);
    try {
      const lista = await api.ia('generar-preguntas', { temaId: temaGeneracion, nivel: nivelGeneracion, cantidad: Number(form.elements.cantidad.value) });
      if (!Array.isArray(lista) || lista.length === 0) throw new Error('La IA no devolvió preguntas para revisar.');
      lista.forEach((item) => {
        const mensaje = errorPregunta(item);
        if (mensaje) throw new Error(mensaje);
      });
      propuestas.push(...lista.map((item) => ({ clave: ++siguientePropuesta, temaId: temaGeneracion, nivel: nivelGeneracion, datos: {
        tipo: item.tipo, enunciado: item.enunciado, opciones: item.opciones, correcta: item.correcta, retroalimentacion: item.retroalimentacion
      } })));
      cerrarModal(div);
      ui.aviso(`${lista.length} propuestas listas para revisar.`, 'exito');
    } catch (error) {
      form.querySelector('[role="alert"]').textContent = error.message || 'No se pudieron generar preguntas.';
      if (!div.isConnected) ui.aviso(error.message, 'error');
    } finally {
      generando = false;
      ocupado = false;
      form.querySelector('button').disabled = false;
      ui.cargando(false);
      renderizar();
    }
  });
  modal('Generar preguntas con IA', div);
}

window.addEventListener('beforeunload', (evento) => {
  if (propuestas.length) { evento.preventDefault(); evento.returnValue = ''; }
});

await trabajar(async () => {
  const [listaTemas, unidades, asignaturas] = await Promise.all([api.listar('temas'), api.listar('unidades'), api.listar('asignaturas')]);
  temas = listaTemas;
  etiquetasTemas = new Map(temas.map((tema) => {
    const unidad = unidades.find((item) => item.id === tema.unidadId);
    const asignatura = asignaturas.find((item) => item.id === unidad?.asignaturaId);
    return [tema.id, [asignatura?.nombre, unidad?.titulo, tema.titulo].filter(Boolean).join(' · ')];
  }));
  const parametro = util.parametro('temaId');
  temaId = temas.some((tema) => tema.id === parametro) ? parametro : temas[0]?.id || '';
  try { await cargarPreguntas(); } catch (error) { errorCarga = error.message; }
});
