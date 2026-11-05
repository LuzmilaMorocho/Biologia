// Gancho para la colección noticias

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];

  // Los estudiantes solo ven noticias publicadas
  if (usuario.rol === 'estudiante') {
    return lista.filter((n) => n.estado === 'publicado');
  }

  // Docentes y admin ven todas (borrador y publicado)
  return lista;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Se requiere sesión');
    error.estado = 401;
    throw error;
  }

  // Fija autorId al crear
  if (!anterior) {
    datos.autorId = usuario.id;
  }

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  if (datos.estado === 'publicado') {
    if (!anterior || anterior.estado !== 'publicado' || !anterior.fechaPublicacion) {
      datos.fechaPublicacion = new Date().toISOString();
    }
  }

  return datos;
}

export async function despuesDeGuardar(reg, usuario, anterior) {
  if (!reg || reg.estado !== 'publicado') return reg;

  // Solo notifica cuando la noticia pasa a publicado
  const pasoaPublicado = !anterior || anterior.estado !== 'publicado';
  if (!pasoaPublicado) return reg;

  try {
    const { notificar } = await import('../notificar.js');
    const acceso = await import('../acceso.js');
    const almacen = await import('../almacen.js');

    const tituloNoticia = reg.titulo || 'Nueva noticia';
    const enlace = `/paginas/noticia.html?id=${reg.id}`;
    const mensaje = `Nueva noticia publicada: ${tituloNoticia}`;

    const idsEstudiantes = new Set();

    if (reg.temaId) {
      const asignatura = await acceso.asignaturaDeTema(reg.temaId);
      if (asignatura && asignatura.id) {
        const distributivo = await almacen.leer('distributivo');
        const grupos = distributivo.filter((g) => g.asignaturaId === asignatura.id);
        for (const g of grupos) {
          if (Array.isArray(g.estudiantes)) {
            g.estudiantes.forEach((id) => idsEstudiantes.add(id));
          }
        }
      }
    } else {
      const usuarios = await almacen.leer('usuarios');
      usuarios
        .filter((u) => u.rol === 'estudiante' && u.activo !== false)
        .forEach((u) => idsEstudiantes.add(u.id));
    }

    for (const estudianteId of idsEstudiantes) {
      await notificar(estudianteId, {
        tipo: 'noticia',
        mensaje,
        enlace
      });
    }
  } catch (error) {
    console.error('Error al emitir notificaciones de noticia:', error);
  }

  return reg;
}

export default {
  filtrarLista,
  antesDeGuardar,
  despuesDeGuardar
};


