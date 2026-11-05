// Ganchos para la colección usuarios

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  return lista.map(({ claveHash, ...resto }) => resto);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!datos || typeof datos !== 'object') return datos;

  // Ignorar campos sensibles o inmutables por la API genérica
  delete datos.claveHash;
  delete datos.correo;

  // Evitar que un administrador se quite el rol o se desactive a sí mismo
  if (anterior && usuario && anterior.id === usuario.id) {
    if (datos.rol !== undefined && datos.rol !== anterior.rol) {
      const error = new Error('No puedes cambiar tu propio rol');
      error.estado = 400;
      throw error;
    }

    if (datos.activo !== undefined && datos.activo === false) {
      const error = new Error('No puedes desactivar tu propia cuenta');
      error.estado = 400;
      throw error;
    }
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
