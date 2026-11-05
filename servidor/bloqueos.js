const colas = new Map();

// Serializa operaciones relacionadas y libera la cola incluso si fallan.
export async function conBloqueo(clave, operacion) {
  const previa = colas.get(clave) || Promise.resolve();
  const actual = previa.catch(() => {}).then(operacion);
  colas.set(clave, actual);
  try {
    return await actual;
  } finally {
    if (colas.get(clave) === actual) colas.delete(clave);
  }
}
