import { datosConversacionRol, textoHistorialRol, huellaConfiguracionRol, huellaHistorialRol } from '../rol-simulacion.js';

export default async function preparar(cuerpo, usuario) {
  const { simulacion, historial } = await datosConversacionRol(cuerpo, usuario, true);
  const p = simulacion.personaje;
  return { personaje: `${p.nombre}: ${p.descripcion}`, objetivo: p.objetivo,
    rubrica: simulacion.rubrica.map((c) => `${c.criterio}: ${c.descripcion} (máximo ${c.puntos} puntos)`),
    transcripcion: textoHistorialRol(historial, p.nombre), simulacionId: simulacion.id,
    rubricaCriterios: simulacion.rubrica, huellaConfiguracion: huellaConfiguracionRol(simulacion), huellaHistorial: huellaHistorialRol(historial) };
}
