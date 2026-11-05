export const TIPOS_AGENDA = { tarea: 'Tarea', reunion: 'Reunión', 'fecha-limite': 'Fecha límite', recordatorio: 'Recordatorio' };

export function sumarDias(fecha, cantidad) {
  const dia = new Date(fecha + 'T12:00:00Z');
  dia.setUTCDate(dia.getUTCDate() + cantidad);
  return dia.toISOString().slice(0, 10);
}

export function fechaLocal(valor = new Date()) {
  const fecha = new Date(valor);
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function limitesEvento(evento) {
  return { inicio: new Date(evento.todoElDia ? evento.inicio + 'T00:00:00' : evento.inicio),
    fin: new Date(evento.todoElDia ? evento.fin + 'T00:00:00' : evento.fin) };
}

export function estaVencido(evento, ahora = new Date()) {
  return ['tarea', 'fecha-limite'].includes(evento.tipo) && !evento.completado && limitesEvento(evento).fin <= ahora;
}

export function miSemana(eventos, ahora = new Date()) {
  const hasta = new Date(ahora); hasta.setDate(hasta.getDate() + 7);
  return eventos.filter((evento) => {
    const fechas = limitesEvento(evento);
    return estaVencido(evento, ahora) || fechas.fin > ahora && fechas.inicio < hasta;
  }).sort((a, b) => Number(estaVencido(b, ahora)) - Number(estaVencido(a, ahora)) || limitesEvento(a).inicio - limitesEvento(b).inicio);
}

export function eventoCalendario(evento, ahora = new Date()) {
  return { id: evento.id, title: `${evento.completado ? '✓ ' : ''}${evento.titulo}`, start: evento.inicio, end: evento.fin, allDay: evento.todoElDia,
    backgroundColor: `var(--agenda-${evento.tipo})`, borderColor: `var(--agenda-${evento.tipo})`, textColor: 'var(--color-texto-inverso)',
    classNames: estaVencido(evento, ahora) ? ['agenda__evento--vencido'] : [], extendedProps: { evento } };
}

export function etiquetaFecha(evento) {
  const formato = new Intl.DateTimeFormat('es-EC', evento.todoElDia ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' });
  const fechas = limitesEvento(evento);
  if (evento.todoElDia) return `${formato.format(fechas.inicio)} – ${formato.format(new Date(sumarDias(evento.fin, -1) + 'T00:00:00'))} · Todo el día`;
  return `${formato.format(fechas.inicio)} – ${formato.format(fechas.fin)}`;
}
