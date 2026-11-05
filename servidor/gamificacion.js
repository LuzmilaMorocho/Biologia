// Servidor: motor de gamificación (§B, §C, §D, §E contratos.md)
import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { evaluarAlertas } from './alertas.js';
import { conBloqueo } from './bloqueos.js';

// Registro en memoria de intentos por usuario para control de tasa (máximo por hora)
const intentosPorHora = new Map();

// Extrae el valor de un campo admitiendo rutas con punto (ej. "detalle.simulacionId")
function obtenerCampo(objeto, ruta) {
  if (!objeto || typeof objeto !== 'object') return undefined;
  const partes = ruta.split('.');
  let actual = objeto;
  for (const parte of partes) {
    if (actual == null || typeof actual !== 'object') return undefined;
    actual = actual[parte];
  }
  return actual;
}

// Procesa un intento de actividad, calcula puntos, actualiza logros y evalúa insignias
export async function procesarIntento(usuario, datos = {}) {
  return await conBloqueo(`gamificacion:${usuario?.id}`, async () => {
    const campoUnico = datos.actividad === 'quiz' ? 'quizSesionId' : datos.actividad === 'simulacion' && datos.detalle?.modo === 'rol' ? 'evaluacionId' : null;
    if (campoUnico && datos.detalle?.[campoUnico] && usuario?.id) {
      const anterior = (await almacen.leer('intentos')).find((intento) =>
        intento.usuarioId === usuario.id && intento.actividad === datos.actividad && intento.detalle?.[campoUnico] === datos.detalle[campoUnico]);
      if (anterior?.resultadoGamificacion) return anterior.resultadoGamificacion;
      if (anterior) {
        throw Object.assign(new Error(`El intento ${datos.actividad === 'quiz' ? 'del quiz' : 'de rol'} está pendiente de revisión. No se volverán a asignar puntos.`), { estado: 503 });
      }
    }
    return await procesarIntentoInterno(usuario, datos);
  });
}

async function procesarIntentoInterno(usuario, datos = {}) {
  if (!usuario) {
    const error = new Error('Se requiere sesión');
    error.estado = 401;
    throw error;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const actividad = datos.actividad;

  // 1. Validar actividad
  if (!actividad || !reglas.puntos || typeof reglas.puntos[actividad] !== 'number') {
    const error = new Error(`Actividad no válida o no permitida: "${actividad}"`);
    error.estado = 400;
    throw error;
  }

  // 2. Validar puntaje y máximo (0 <= puntaje <= maximo y maximo > 0)
  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);
  if (isNaN(puntaje) || isNaN(maximo) || puntaje < 0 || puntaje > maximo || maximo <= 0) {
    const error = new Error('Valores de puntaje o máximo no válidos (0 <= puntaje <= máximo, máximo > 0)');
    error.estado = 400;
    throw error;
  }

  // 3. Validar acceso al tema si viene temaId
  if (datos.temaId) {
    const asignatura = await acceso.asignaturaDeTema(datos.temaId);
    if (!asignatura) {
      const error = new Error('El tema especificado no existe o no tiene asignatura asociada');
      error.estado = 404;
      throw error;
    }
    const permitidas = await acceso.asignaturasDe(usuario);
    const tieneAcceso = permitidas.some((a) => a.id === asignatura.id);
    if (!tieneAcceso) {
      const error = new Error('No tienes acceso a los contenidos de este tema');
      error.estado = 403;
      throw error;
    }
  }

  // 4. Límite de intentos por hora (en memoria) -> 429
  const limiteHora = reglas.limiteIntentosHora || 60;
  const ahoraMs = Date.now();
  const unaHoraAtras = ahoraMs - 60 * 60 * 1000;
  let historialUsuario = intentosPorHora.get(usuario.id) || [];
  historialUsuario = historialUsuario.filter((ts) => ts > unaHoraAtras);

  if (historialUsuario.length >= limiteHora) {
    const error = new Error('Has alcanzado el límite máximo de intentos por hora');
    error.estado = 429;
    throw error;
  }
  historialUsuario.push(ahoraMs);
  intentosPorHora.set(usuario.id, historialUsuario);

  // 5. Cálculo base de puntos: redondeo(reglas.puntos[actividad] * puntaje / maximo) + bonoSinErrores
  const puntosBase = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const errores = Number(datos.errores ?? 0);
  const bono = (errores === 0 && puntaje === maximo) ? (reglas.bonoSinErrores || 0) : 0;
  const puntosCalculados = puntosBase + bono;

  // 6. Condiciones para anular puntos (el intento se guarda con 0 puntos)
  let esSinPuntos = false;
  const intentosExistentes = await almacen.leer('intentos');

  // a) Actividad única: ya existe un intento con puntos con la misma clave
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const camposUnicos = reglas.unicas[actividad];
    const yaExisteUnicoConPuntos = intentosExistentes.some((i) => {
      if (i.usuarioId !== usuario.id || i.actividad !== actividad || (i.puntos || 0) <= 0) {
        return false;
      }
      return camposUnicos.every((campo) => {
        const valExistente = obtenerCampo(i, campo);
        const valNuevo = obtenerCampo(datos, campo);
        return valExistente !== undefined && valExistente === valNuevo;
      });
    });

    if (yaExisteUnicoConPuntos) {
      esSinPuntos = true;
    }
  }

  // b) Requiere aprobado y detalle.aprobado !== true
  if (
    !esSinPuntos &&
    reglas.requiereAprobado &&
    Array.isArray(reglas.requiereAprobado) &&
    reglas.requiereAprobado.includes(actividad)
  ) {
    if (!datos.detalle || datos.detalle.aprobado !== true) {
      esSinPuntos = true;
    }
  }

  // c) Ya alcanzó hoy reglas.maxDiario[actividad] intentos con puntos
  if (
    !esSinPuntos &&
    reglas.maxDiario &&
    typeof reglas.maxDiario[actividad] === 'number'
  ) {
    const maxPermitidoHoy = reglas.maxDiario[actividad];
    const hoyStr = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = intentosExistentes.filter((i) => {
      if (i.usuarioId !== usuario.id || i.actividad !== actividad || (i.puntos || 0) <= 0) {
        return false;
      }
      const fechaIntento = i.fecha ? i.fecha.slice(0, 10) : '';
      return fechaIntento === hoyStr;
    });

    if (intentosHoyConPuntos.length >= maxPermitidoHoy) {
      esSinPuntos = true;
    }
  }

  const puntosGanados = esSinPuntos ? 0 : puntosCalculados;

  // 7. Guardar el intento
  const intentoAGuardar = {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId || null,
    nivel: datos.nivel !== undefined ? datos.nivel : null,
    puntaje,
    maximo,
    errores,
    duracionSeg: datos.duracionSeg !== undefined ? Number(datos.duracionSeg) : null,
    detalle: datos.detalle || null,
    puntos: puntosGanados
  };

  const intentoGuardado = await almacen.agregar('intentos', intentoAGuardar);

  // 8. Actualizar o crear logros del usuario
  const todosLogros = await almacen.leer('logros');
  let registroLogro = todosLogros.find((l) => l.usuarioId === usuario.id);
  let esNuevoLogro = false;

  if (!registroLogro) {
    registroLogro = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
    esNuevoLogro = true;
  } else {
    registroLogro.puntos = Number(registroLogro.puntos || 0);
    registroLogro.insignias = Array.isArray(registroLogro.insignias) ? registroLogro.insignias : [];
    registroLogro.nivelQuiz = registroLogro.nivelQuiz && typeof registroLogro.nivelQuiz === 'object'
      ? registroLogro.nivelQuiz
      : {};
  }

  registroLogro.puntos += puntosGanados;

  // Si es quiz aprobado, actualizar nivelQuiz si es mayor
  if (
    actividad === 'quiz' &&
    datos.detalle?.aprobado === true &&
    datos.temaId &&
    datos.nivel !== undefined
  ) {
    const nivelNum = Number(datos.nivel);
    const nivelActual = registroLogro.nivelQuiz[datos.temaId] || 0;
    if (nivelNum > nivelActual) {
      registroLogro.nivelQuiz[datos.temaId] = nivelNum;
    }
  }

  // 9. Evaluar insignias no obtenidas
  const todasInsignias = await almacen.leer('insignias');
  const idsInsigniasObtenidas = new Set(registroLogro.insignias.map((ins) => ins.id));
  const insigniasPorEvaluar = todasInsignias.filter((ins) => !idsInsigniasObtenidas.has(ins.id));

  // Obtener todos los intentos del usuario incluyendo el recién guardado
  const todosIntentosActualizados = await almacen.leer('intentos');
  const misIntentos = todosIntentosActualizados.filter((i) => i.usuarioId === usuario.id);

  const insigniasNuevas = [];

  for (const insignia of insigniasPorEvaluar) {
    const cond = insignia.condicion;
    if (!cond || !cond.tipo) continue;

    let cumple = false;

    switch (cond.tipo) {
      case 'conteo': {
        const intentosActividad = misIntentos.filter((i) => i.actividad === cond.actividad);
        if (reglas.unicas && Array.isArray(reglas.unicas[cond.actividad])) {
          // En actividades únicas, contar claves distintas
          const campos = reglas.unicas[cond.actividad];
          const claves = new Set();
          for (const item of intentosActividad) {
            const clave = campos.map((c) => String(obtenerCampo(item, c) ?? '')).join('|');
            claves.add(clave);
          }
          cumple = claves.size >= (cond.minimo || 1);
        } else {
          cumple = intentosActividad.length >= (cond.minimo || 1);
        }
        break;
      }

      case 'sinErrores': {
        cumple = misIntentos.some(
          (i) =>
            i.actividad === cond.actividad &&
            Number(i.errores) === 0 &&
            (i.puntaje === i.maximo || (i.puntos || 0) > 0)
        );
        break;
      }

      case 'puntos': {
        cumple = registroLogro.puntos >= (cond.minimo || 0);
        break;
      }

      case 'nivelQuiz': {
        const niveles = Object.values(registroLogro.nivelQuiz || {});
        cumple = niveles.some((n) => Number(n) >= Number(cond.nivel));
        break;
      }

      case 'racha': {
        // Días consecutivos con intentos hasta hoy
        const diasConIntentos = new Set(
          misIntentos
            .map((i) => (i.fecha ? i.fecha.slice(0, 10) : ''))
            .filter(Boolean)
        );
        let racha = 0;
        const ahora = new Date();
        let cursor = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));

        while (true) {
          const fechaStr = cursor.toISOString().slice(0, 10);
          if (diasConIntentos.has(fechaStr)) {
            racha++;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
          } else {
            break;
          }
        }
        cumple = racha >= (cond.dias || 1);
        break;
      }
    }

    if (cumple) {
      const fechaObtencion = new Date().toISOString();
      registroLogro.insignias.push({
        id: insignia.id,
        fecha: fechaObtencion
      });
      insigniasNuevas.push({
        id: insignia.id,
        nombre: insignia.nombre,
        icono: insignia.icono
      });
    }
  }

  // Guardar logros actualizados
  if (esNuevoLogro) {
    await almacen.agregar('logros', registroLogro);
  } else {
    await almacen.actualizar('logros', registroLogro.id, registroLogro);
  }

  // 10. Evaluar alertas
  try {
    await evaluarAlertas(intentoGuardado, usuario);
  } catch (errorAlerta) {
    console.error('Error al evaluar alertas:', errorAlerta);
  }

  const resultado = {
    puntosGanados,
    puntosTotales: registroLogro.puntos,
    insigniasNuevas
  };
  if ((actividad === 'quiz' && datos.detalle?.quizSesionId) || (actividad === 'simulacion' && datos.detalle?.modo === 'rol' && datos.detalle?.evaluacionId)) {
    await almacen.actualizar('intentos', intentoGuardado.id, { resultadoGamificacion: resultado });
  }
  return resultado;
}

