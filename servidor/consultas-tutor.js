import * as almacen from './almacen.js';
import { conBloqueo } from './bloqueos.js';

export async function registrarConsultaTutor(usuarioId, temaId, fecha = Date.now()) {
  if (!usuarioId || !temaId) return;
  const dia = new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  return conBloqueo('consultas-tutor', async () => {
    const anterior = (await almacen.leer('consultas-tutor')).find((c) => c.usuarioId === usuarioId && c.temaId === temaId && c.dia === dia);
    if (anterior) return almacen.actualizar('consultas-tutor', anterior.id, { mensajes: anterior.mensajes + 1 });
    return almacen.agregar('consultas-tutor', { usuarioId, temaId, dia, mensajes: 1 });
  });
}
