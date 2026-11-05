import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { formularioModal } from '../nucleo/formularios.js';
import { TIPOS_AGENDA, sumarDias, fechaLocal, estaVencido, miSemana, eventoCalendario, etiquetaFecha } from '../nucleo/agenda.js';

await montarPlantilla({ titulo: 'Agenda', roles: ['sesion'] });
const contenido = document.getElementById('contenido');
const docente = ['docente', 'admin'].includes(usuarioActual()?.rol);
let eventos = [], grupos = [], temas = [], calendario = null, ocupado = false, mostrandoSemana = false;

function enlaceActividad(evento) {
  const actividad = ACTIVIDADES.find((a) => a.id === evento.actividad);
  return actividad && evento.temaId ? `<a class="btn btn--texto" href="${actividad.href}?temaId=${encodeURIComponent(evento.temaId)}">Abrir ${ui.escapar(actividad.texto)}</a>` : '';
}

function listaSemana(lista, destino) {
  destino.innerHTML = lista.length ? lista.map((evento) => `<article class="tarjeta agenda__evento agenda__tipo--${evento.tipo} ${estaVencido(evento) ? 'agenda__evento--pendiente' : ''}">
    <h3>${ui.escapar(evento.titulo)}</h3><p>${TIPOS_AGENDA[evento.tipo]} · ${ui.escapar(etiquetaFecha(evento))}</p>
    <p>${evento.grupoId ? ui.escapar(evento.grupoNombre || 'Evento de grupo') : 'Evento personal'}</p>
    ${evento.completado ? '<p class="agenda__completado">✓ Actividad realizada</p>' : estaVencido(evento) ? '<p class="agenda__vencido">Vencido · Pendiente</p>' : ''}
    <div class="agenda__acciones"><button type="button" class="btn btn--secundario" data-evento="${ui.escapar(evento.id)}">${evento.puedeEditar ? 'Ver o editar' : 'Ver evento'}</button>${enlaceActividad(evento)}</div></article>`).join('')
    : '<div class="tarjeta vacio"><p>No tienes eventos para los próximos siete días ni plazos pendientes vencidos.</p></div>';
  destino.querySelectorAll('[data-evento]').forEach((boton) => boton.addEventListener('click', () => verEvento(eventos.find((e) => e.id === boton.dataset.evento))));
}

function actualizarVista() {
  listaSemana(miSemana(eventos), document.getElementById('agenda-lista-semana'));
  if (calendario) {
    calendario.batchRendering(() => { calendario.removeAllEvents(); calendario.addEventSource(eventos.map((e) => eventoCalendario(e))); });
  } else iniciarCalendario();
}

function iniciarCalendario() {
  const destino = document.getElementById('agenda-calendario');
  if (!window.FullCalendar?.Calendar) {
    destino.innerHTML = '<p role="alert">No se pudo cargar el calendario. Puedes usar esta lista y «Mi semana».</p><div id="agenda-lista-alternativa" class="agenda__semana"></div>';
    listaSemana(eventos, document.getElementById('agenda-lista-alternativa'));
    return;
  }
  destino.innerHTML = '';
  calendario = new window.FullCalendar.Calendar(destino, {
    locale: 'es', firstDay: 1, initialView: 'dayGridMonth', timeZone: 'local', height: 'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
    buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' },
    allDayText: 'Todo el día', noEventsText: 'No hay eventos para mostrar', nowIndicator: true, editable: false, eventDisplay: 'block',
    events: eventos.map((e) => eventoCalendario(e)),
    dateClick: (info) => editarEvento(null, info.dateStr, info.allDay),
    eventClick: (info) => { info.jsEvent.preventDefault(); return verEvento(info.event.extendedProps.evento); },
    eventContent: (info) => {
      const texto = document.createElement('span');
      texto.textContent = `${info.timeText ? info.timeText + ' · ' : ''}${TIPOS_AGENDA[info.event.extendedProps.evento.tipo]} · ${info.event.title}`;
      return { domNodes: [texto] };
    },
    eventDidMount: (info) => {
      info.el.tabIndex = 0; info.el.setAttribute('role', 'button'); info.el.setAttribute('aria-label', info.event.title);
      info.el.addEventListener('keydown', (evento) => { if (['Enter', ' '].includes(evento.key)) { evento.preventDefault(); verEvento(info.event.extendedProps.evento); } });
    }
  });
  calendario.render();
}

async function cargarEventos() {
  if (ocupado) return;
  ocupado = true;
  document.getElementById('agenda-actualizar').disabled = true;
  try { eventos = await api.listar('agenda'); actualizarVista(); document.getElementById('agenda-error').textContent = ''; }
  catch (error) { document.getElementById('agenda-error').textContent = error.message; }
  finally { ocupado = false; document.getElementById('agenda-actualizar').disabled = false; }
}

async function verEvento(evento) {
  if (ocupado || !evento) return;
  ocupado = true;
  try {
    const detalle = document.createElement('div'); detalle.className = 'pila';
    detalle.innerHTML = `<p>${TIPOS_AGENDA[evento.tipo]} · ${ui.escapar(etiquetaFecha(evento))}</p>
      <p>${evento.grupoId ? ui.escapar(evento.grupoNombre || 'Evento de grupo') : 'Evento personal'}</p>
      ${evento.temaNombre ? `<p>Tema: ${ui.escapar(evento.temaNombre)}</p>` : ''}
      ${evento.completado ? '<p class="agenda__completado">✓ Actividad realizada después de crear el evento.</p>' : ''}
      <p>Recordatorios: ${(evento.recordatorios || []).map((m) => m === 1440 ? '1 día antes' : '1 hora antes').join(' y ') || 'Sin recordatorios'}</p>
      ${enlaceActividad(evento)}${!evento.puedeEditar ? '<p>Solo el propietario puede modificar este evento.</p>' : ''}`;
    const accion = await ui.modal({ titulo: evento.titulo, contenido: detalle, acciones: [
      { texto: 'Cerrar', valor: null, clase: 'btn--secundario' },
      ...(evento.puedeEditar ? [{ texto: 'Editar', valor: 'editar', clase: 'btn--primario' }, { texto: 'Eliminar', valor: 'eliminar', clase: 'btn--peligro' }] : [])
    ] });
    ocupado = false;
    if (evento.puedeEditar && accion === 'editar') await editarEvento(evento);
    else if (evento.puedeEditar && accion === 'eliminar' && await ui.confirmar('¿Eliminar este evento de la agenda?')) {
      ocupado = true;
      await api.eliminar('agenda', evento.id);
      ocupado = false; await cargarEventos();
    }
  } catch (error) { ui.aviso(error.message, 'error'); }
  finally { ocupado = false; }
}

async function editarEvento(evento = null, fecha = null, todoElDia = false) {
  if (ocupado) return;
  ocupado = true;
  const inicio = evento?.inicio || (todoElDia ? fecha.slice(0, 10) : fecha ? new Date(fecha).toISOString() : new Date().toISOString());
  const fin = evento?.fin || (todoElDia ? sumarDias(inicio, 1) : new Date(Date.parse(inicio) + 3600000).toISOString());
  const esDia = evento?.todoElDia ?? todoElDia;
  try {
    const reg = await formularioModal(evento ? 'Editar evento' : 'Nuevo evento', `
      <div class="campo"><label for="agenda-titulo">Título</label><input id="agenda-titulo" name="titulo" required maxlength="200" value="${ui.escapar(evento?.titulo || '')}"></div>
      <div class="campo"><label for="agenda-tipo">Tipo</label><select id="agenda-tipo" name="tipo">${Object.entries(TIPOS_AGENDA).map(([valor, texto]) => `<option value="${valor}" ${valor === (evento?.tipo || 'tarea') ? 'selected' : ''}>${texto}</option>`).join('')}</select></div>
      <label for="agenda-dia"><input id="agenda-dia" name="todoElDia" type="checkbox" ${esDia ? 'checked' : ''}> Todo el día</label>
      <div class="agenda__form-fechas"><div class="campo"><label for="agenda-inicio">Inicio</label><input id="agenda-inicio" name="inicio" type="${esDia ? 'date' : 'datetime-local'}" required value="${esDia ? inicio : fechaLocal(inicio)}"></div>
      <div class="campo"><label for="agenda-fin" id="agenda-fin-etiqueta">${esDia ? 'Último día' : 'Fin'}</label><input id="agenda-fin" name="fin" type="${esDia ? 'date' : 'datetime-local'}" required value="${esDia ? sumarDias(fin, -1) : fechaLocal(fin)}"></div></div>
      <fieldset class="agenda__recordatorios"><legend>Recordatorios</legend>
        <label for="agenda-recordatorio-dia"><input id="agenda-recordatorio-dia" name="dia" type="checkbox" ${(evento?.recordatorios || []).includes(1440) ? 'checked' : ''}> 1 día antes</label>
        <label for="agenda-recordatorio-hora"><input id="agenda-recordatorio-hora" name="hora" type="checkbox" ${(evento?.recordatorios || []).includes(60) ? 'checked' : ''}> 1 hora antes</label></fieldset>
      ${docente ? `<div class="campo"><label for="agenda-grupo">Grupo</label><select id="agenda-grupo" name="grupoId"><option value="">Evento personal</option>${grupos.map((g) => `<option value="${ui.escapar(g.id)}" ${g.id === evento?.grupoId ? 'selected' : ''}>${ui.escapar(g.nombre)}</option>`).join('')}</select></div>
        <div class="campo"><label for="agenda-actividad">Actividad vinculada (opcional)</label><select id="agenda-actividad" name="actividad"><option value="">Sin actividad</option>${ACTIVIDADES.map((a) => `<option value="${a.id}" ${a.id === evento?.actividad ? 'selected' : ''}>${ui.escapar(a.texto)}</option>`).join('')}</select></div>
        <div class="campo"><label for="agenda-tema">Tema de la actividad</label><select id="agenda-tema" name="temaId"></select></div>` : ''}`,
    async (datos) => {
      const cuerpo = { titulo: datos.titulo, tipo: datos.tipo, todoElDia: Boolean(datos.todoElDia),
        inicio: datos.todoElDia ? datos.inicio : new Date(datos.inicio).toISOString(),
        fin: datos.todoElDia ? sumarDias(datos.fin, 1) : new Date(datos.fin).toISOString(),
        recordatorios: [...(datos.dia ? [1440] : []), ...(datos.hora ? [60] : [])],
        ...(docente ? { grupoId: datos.grupoId || null, actividad: datos.actividad || null, temaId: datos.temaId || null } : {}) };
      return evento ? api.actualizar('agenda', evento.id, cuerpo) : api.crear('agenda', cuerpo);
    }, (form) => {
      const dia = form.querySelector('#agenda-dia');
      dia.addEventListener('change', () => {
        for (const clave of ['inicio', 'fin']) {
          const campo = form.querySelector('#agenda-' + clave);
          const valor = campo.value;
          campo.type = dia.checked ? 'date' : 'datetime-local';
          campo.value = dia.checked ? valor.slice(0, 10) : valor + (clave === 'inicio' ? 'T09:00' : 'T10:00');
        }
        form.querySelector('#agenda-fin-etiqueta').textContent = dia.checked ? 'Último día' : 'Fin';
      });
      if (docente) {
        const grupo = form.querySelector('#agenda-grupo'); const actividad = form.querySelector('#agenda-actividad'); const tema = form.querySelector('#agenda-tema');
        const actualizarTemas = () => {
          const seleccion = tema.value || evento?.temaId;
          const asignaturaId = grupos.find((g) => g.id === grupo.value)?.asignaturaId;
          tema.innerHTML = `<option value="">Selecciona un tema</option>${temas.filter((t) => !asignaturaId || t.asignaturaId === asignaturaId).map((t) => `<option value="${ui.escapar(t.id)}" ${t.id === seleccion ? 'selected' : ''}>${ui.escapar(t.titulo)}</option>`).join('')}`;
          tema.disabled = !actividad.value; tema.required = Boolean(actividad.value);
          if (!actividad.value) tema.value = '';
        };
        grupo.addEventListener('change', actualizarTemas); actividad.addEventListener('change', actualizarTemas); actualizarTemas();
      }
    });
    ocupado = false;
    if (reg) { await cargarEventos(); ui.aviso('Evento guardado.', 'exito'); }
  } catch (error) { ui.aviso(error.message, 'error'); }
  finally { ocupado = false; }
}

function montarVista() {
  if (calendario) { calendario.destroy(); calendario = null; }
  contenido.innerHTML = `<div class="agenda"><header><h1>Agenda</h1><p>Organiza tus tareas, reuniones y plazos. Las actividades realizadas muestran ✓.</p></header>
    <div class="agenda__acciones"><button type="button" class="btn btn--primario" id="agenda-nuevo">Nuevo evento</button><button type="button" class="btn btn--secundario" id="agenda-actualizar">Actualizar</button>
      <div class="agenda__acciones" role="group" aria-label="Vista de la agenda"><button type="button" class="btn btn--secundario" id="agenda-vista-calendario" aria-pressed="true">Calendario</button><button type="button" class="btn btn--secundario" id="agenda-vista-semana" aria-pressed="false">Mi semana</button></div></div>
    <ul class="agenda__leyenda" aria-label="Tipos de evento">${Object.entries(TIPOS_AGENDA).map(([tipo, texto]) => `<li class="agenda__tipo--${tipo}">${texto}</li>`).join('')}</ul>
    <p id="agenda-error" class="campo__error" role="alert"></p><div id="agenda-calendario" class="agenda__calendario"></div>
    <section id="agenda-semana" class="agenda__semana" hidden aria-labelledby="agenda-semana-titulo"><h2 id="agenda-semana-titulo">Mi semana</h2><p>Los próximos siete días y los pendientes vencidos de tareas y fechas límite.</p><div id="agenda-lista-semana" class="agenda__semana"></div></section></div>`;
  document.getElementById('agenda-nuevo').addEventListener('click', () => editarEvento());
  document.getElementById('agenda-actualizar').addEventListener('click', cargarEventos);
  for (const vista of ['calendario', 'semana']) document.getElementById('agenda-vista-' + vista).addEventListener('click', () => {
    mostrandoSemana = vista === 'semana';
    document.getElementById('agenda-calendario').hidden = mostrandoSemana; document.getElementById('agenda-semana').hidden = !mostrandoSemana;
    document.getElementById('agenda-vista-semana').setAttribute('aria-pressed', String(mostrandoSemana)); document.getElementById('agenda-vista-calendario').setAttribute('aria-pressed', String(!mostrandoSemana));
    if (mostrandoSemana) listaSemana(miSemana(eventos), document.getElementById('agenda-lista-semana'));
    else calendario?.updateSize();
  });
  actualizarVista();
}

async function iniciar() {
  ui.cargando(true);
  try {
    eventos = await api.listar('agenda');
    if (docente) {
      const [g, asignaturas, unidades, listaTemas] = await Promise.all([api.listar('distributivo'), api.listar('asignaturas'), api.listar('unidades'), api.listar('temas')]);
      grupos = g.map((grupo) => ({ ...grupo, nombre: [asignaturas.find((a) => a.id === grupo.asignaturaId)?.nombre, grupo.paralelo, grupo.periodo].filter(Boolean).join(' · ') }));
      const unidadesVisibles = new Map(unidades.filter((u) => u.visible !== false).map((u) => [u.id, u.asignaturaId]));
      temas = listaTemas.filter((t) => t.estado === 'publicado' && unidadesVisibles.has(t.unidadId)).map((t) => ({ ...t, asignaturaId: unidadesVisibles.get(t.unidadId) }));
    }
    montarVista();
  } catch (error) {
    contenido.innerHTML = `<div class="tarjeta pila"><h1>Agenda</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" class="btn btn--secundario" id="agenda-recargar">Reintentar carga</button></div>`;
    document.getElementById('agenda-recargar').addEventListener('click', iniciar);
  } finally { ui.cargando(false); }
}
if (usuarioActual()) {
  await iniciar();
  window.addEventListener('focus', () => { if (document.getElementById('agenda-actualizar')) cargarEventos(); });
}
