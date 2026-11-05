// Cliente API para comunicación con el servidor (módulos ES nativos)

function obtenerToken() {
  try {
    return sessionStorage.getItem('token');
  } catch {
    return null;
  }
}

function manejarNoAutorizado() {
  try {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
  } catch {
    // Entornos sin sessionStorage
  }

  if (typeof window !== 'undefined' && window.location) {
    const ruta = window.location.pathname || '';
    if (!ruta.endsWith('ingreso.html') && !ruta.endsWith('registro.html')) {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

export async function llamar(metodo, ruta, cuerpo) {
  const url = ruta.startsWith('http') || ruta.startsWith('/') ? ruta : `/${ruta}`;
  const opciones = {
    method: metodo.toUpperCase(),
    headers: {}
  };

  const token = obtenerToken();
  if (token) {
    opciones.headers['Authorization'] = `Bearer ${token}`;
  }

  if (cuerpo instanceof FormData) {
    opciones.body = cuerpo;
  } else if (cuerpo !== undefined && cuerpo !== null) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);

  if (respuesta.status === 401) {
    manejarNoAutorizado();
  }

  const esJson = respuesta.headers.get('content-type')?.includes('application/json');
  const datos = esJson ? await respuesta.json() : null;

  if (!respuesta.ok) {
    const mensaje = datos?.error || `Error ${respuesta.status}: ${respuesta.statusText}`;
    throw Object.assign(new Error(mensaje), { estado: respuesta.status });
  }

  return datos;
}

export async function listar(col, filtros = {}) {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) {
      parametros.append(clave, valor);
    }
  }
  const consulta = parametros.toString() ? `?${parametros.toString()}` : '';
  return await llamar('GET', `/api/${col}${consulta}`);
}

export async function obtener(col, id) {
  return await llamar('GET', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return await llamar('POST', `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return await llamar('PUT', `/api/${col}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return await llamar('DELETE', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  return await llamar('POST', '/api/subidas', formulario);
}

export async function ia(tarea, datos) {
  return await llamar('POST', `/api/ia/${tarea}`, datos);
}
