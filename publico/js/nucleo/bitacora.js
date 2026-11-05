import { llamar } from './api.js';

// Registra eventos de telemetría y auditoría en bitacora.jsonl
export async function registrarEvento(tipo, recurso) {
  try {
    return await llamar('POST', '/api/eventos', { tipo, recurso });
  } catch (error) {
    // Falla silenciosa para no interrumpir el flujo de usuario
    console.debug('No se pudo registrar evento de bitácora:', error.message);
    return null;
  }
}
