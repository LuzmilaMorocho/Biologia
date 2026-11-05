import { leerConfig, escribirConfig } from './almacen.js';

const error = (estado, mensaje) => Object.assign(new Error(mensaje), { estado });
let colaConfiguracion = Promise.resolve();

export async function obtenerConfiguracionIA() {
  const guardada = await leerConfig('ia');
  if (guardada.proveedor) return { ...guardada, fuente: 'administrador' };
  return {
    proveedor: process.env.IA_PROVEEDOR?.trim().toLowerCase() || 'gemini',
    modelo: process.env.IA_MODELO?.trim() || 'gemini-3.8-flash',
    clave: process.env.IA_CLAVE?.trim() || '',
    fuente: 'entorno'
  };
}

export function configuracionPublica(configuracion) {
  return {
    proveedor: configuracion.proveedor, modelo: configuracion.modelo,
    claveConfigurada: Boolean(configuracion.clave), fuente: configuracion.fuente
  };
}

export async function guardarConfiguracionIA(datos) {
  const operacion = colaConfiguracion.catch(() => {}).then(async () => {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos) ||
        Object.keys(datos).some((campo) => !['proveedor', 'modelo', 'clave'].includes(campo))) {
      throw error(400, 'Envía proveedor, modelo y, si deseas reemplazarla, la clave');
    }
    const proveedor = typeof datos.proveedor === 'string' ? datos.proveedor.trim().toLowerCase() : '';
    const modelo = typeof datos.modelo === 'string' ? datos.modelo.trim().replace(/^models\//, '') : '';
    if (!['gemini', 'openai'].includes(proveedor)) throw error(400, 'Selecciona un proveedor válido');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(modelo)) throw error(400, 'Escribe un identificador de modelo válido');
    if (proveedor === 'gemini' && !modelo.startsWith('gemini-')) throw error(400, 'El modelo debe corresponder a Gemini');
    if (datos.clave !== undefined && typeof datos.clave !== 'string') throw error(400, 'La clave no es válida');
    const anterior = await obtenerConfiguracionIA();
    const nuevaClave = datos.clave?.trim() || '';
    if (nuevaClave && (nuevaClave.length < 16 || nuevaClave.length > 4096 || /\s/.test(nuevaClave))) {
      throw error(400, 'Introduce la clave completa, sin espacios; un fragmento no es suficiente');
    }
    const clave = nuevaClave || (proveedor === anterior.proveedor ? anterior.clave : '');
    if (!clave) throw error(400, 'Introduce la clave completa para este proveedor');
    const configuracion = { proveedor, modelo, clave, actualizada: new Date().toISOString() };
    await escribirConfig('ia', configuracion);
    return configuracionPublica({ ...configuracion, fuente: 'administrador' });
  });
  colaConfiguracion = operacion;
  return await operacion;
}

export function errorProveedorIA(estado) {
  if (estado === 400) return error(502, 'El proveedor rechazó la solicitud (HTTP 400). Comprueba la clave completa y selecciona un modelo disponible para tu cuenta.');
  if (estado === 401 || estado === 403) return error(502, 'El proveedor rechazó la clave o sus permisos. Revisa la configuración de IA.');
  if (estado === 404) return error(502, 'El modelo no está disponible para esta clave. Consulta los modelos disponibles.');
  if (estado === 429) return error(502, 'El proveedor alcanzó su cuota o límite de solicitudes. Revisa la cuota y facturación de la cuenta.');
  if (estado === 503) return error(502, 'El modelo está temporalmente saturado por alta demanda (HTTP 503). Selecciona otro modelo del listado o prueba más tarde.');
  if ([408, 504].includes(estado)) return error(502, 'El proveedor agotó el tiempo de respuesta. Prueba otro modelo o inténtalo más tarde.');
  if ([500, 502].includes(estado)) return error(502, `El proveedor tiene un fallo temporal (HTTP ${estado}). Prueba otro modelo o inténtalo más tarde.`);
  return error(502, `El proveedor no pudo completar la solicitud (HTTP ${estado}). Revisa la configuración e inténtalo nuevamente.`);
}

export async function listarModelosGemini() {
  const configuracion = await obtenerConfiguracionIA();
  if (configuracion.proveedor !== 'gemini' || !configuracion.clave) throw error(400, 'Guarda primero la configuración y la clave de Gemini');
  const signal = AbortSignal.timeout(15000);
  const modelos = [];
  let pagina = '';
  try {
    for (let indice = 0; indice < 20; indice++) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '100');
      if (pagina) url.searchParams.set('pageToken', pagina);
      const respuesta = await fetch(url.href, { headers: { 'x-goog-api-key': configuracion.clave }, signal });
      if (!respuesta.ok) throw errorProveedorIA(respuesta.status);
      const datos = await respuesta.json();
      for (const modelo of datos.models || []) {
        if (modelo.supportedGenerationMethods?.includes('generateContent') && /^models\/gemini-[a-zA-Z0-9._-]+$/.test(modelo.name)) {
          modelos.push({ id: modelo.name.replace(/^models\//, ''), nombre: modelo.displayName || modelo.name });
        }
      }
      pagina = datos.nextPageToken;
      if (!pagina) return modelos;
    }
    throw error(502, 'La lista de modelos es demasiado extensa. Inténtalo más tarde.');
  } catch (causa) {
    if (signal.aborted) throw error(504, 'La consulta de modelos tardó demasiado');
    if (causa.estado) throw causa;
    throw error(502, 'No fue posible consultar los modelos de Gemini');
  }
}
