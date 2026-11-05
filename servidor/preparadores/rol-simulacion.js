import { datosConversacionRol, textoHistorialRol } from '../rol-simulacion.js';

export default async function preparar(cuerpo, usuario) {
  const { simulacion, historial } = await datosConversacionRol(cuerpo, usuario);
  const p = simulacion.personaje;
  return { personaje: `${p.nombre}: ${p.descripcion}`, contexto: p.contexto, objetivo: p.objetivo,
    historial: textoHistorialRol(historial.slice(0, -1), p.nombre), mensaje: historial.at(-1).texto };
}
