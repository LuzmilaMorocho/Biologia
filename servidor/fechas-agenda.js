// Los eventos de todo el día comienzan a medianoche de Ecuador continental.
export function instanteAgenda(evento, campo) {
  const valor = evento[campo];
  if (typeof valor !== 'string' || !valor) return NaN;
  return Date.parse(evento.todoElDia && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? `${valor}T00:00:00-05:00` : valor);
}
