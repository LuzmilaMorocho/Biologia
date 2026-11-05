// Validación común del banco y de las propuestas de IA.
export function errorPregunta(pregunta) {
  if (!pregunta || typeof pregunta !== 'object') return 'La pregunta no es válida.';
  const texto = (valor) => typeof valor === 'string' && valor.trim().length > 0;
  if (!texto(pregunta.enunciado) || !texto(pregunta.retroalimentacion)) {
    return 'Completa el enunciado y la retroalimentación.';
  }
  if (!Array.isArray(pregunta.opciones)) return 'Las opciones deben ser una lista.';
  if (pregunta.tipo === 'opcion') {
    if (pregunta.opciones.length !== 4 || !pregunta.opciones.every(texto)) return 'Escribe las cuatro opciones.';
    if (new Set(pregunta.opciones.map((opcion) => opcion.trim().toLocaleLowerCase('es'))).size !== 4) return 'Las cuatro opciones deben ser diferentes.';
    if (!Number.isInteger(pregunta.correcta) || pregunta.correcta < 0 || pregunta.correcta > 3) return 'Selecciona la opción correcta.';
  } else if (pregunta.tipo === 'vf') {
    if (pregunta.opciones.length !== 2 || pregunta.opciones[0] !== 'Verdadero' || pregunta.opciones[1] !== 'Falso' || typeof pregunta.correcta !== 'boolean') {
      return 'Verdadero o falso requiere las opciones Verdadero y Falso y una respuesta booleana.';
    }
  } else if (pregunta.tipo === 'completar') {
    if (!pregunta.enunciado.includes('____')) return 'Incluye ____ en el enunciado para completar.';
    if (pregunta.opciones.length !== 0 || !texto(pregunta.correcta)) return 'Completar requiere una respuesta de texto y ninguna opción.';
  } else {
    return 'Selecciona un tipo de pregunta válido.';
  }
  return '';
}
