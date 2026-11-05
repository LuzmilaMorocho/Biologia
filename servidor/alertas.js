// Servidor: alertas tempranas y mensajes de apoyo (§B contratos.md)
import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { notificar } from './notificar.js';
import { conBloqueo } from './bloqueos.js';
import { instanteAgenda } from './fechas-agenda.js';
import { actividadDelIntento } from '../publico/js/nucleo/catalogo-actividades.js';

/**
 * Notifica al docente del grupo y a los administradores (si está configurado)
 * sobre una alerta activa generada en tono de apoyo.
 */
async function notificarDocenteYAdmin(docenteId, mensaje) {
  if (docenteId) {
    try {
      await notificar(docenteId, {
        tipo: 'alerta',
        mensaje,
        enlace: '/paginas/panel-docente.html'
      });
    } catch (err) {
      console.error('Error al notificar al docente:', err);
    }
  }

  try {
    const ajustes = await almacen.leerConfig('ajustes');
    if (ajustes?.alertasAdmin) {
      const usuarios = await almacen.leer('usuarios');
      const admins = usuarios.filter((u) => u.rol === 'admin' && u.activo !== false);
      for (const adm of admins) {
        await notificar(adm.id, {
          tipo: 'alerta',
          mensaje: `[Alerta institucional] ${mensaje}`,
          enlace: '/paginas/panel-docente.html'
        });
      }
    }
  } catch (err) {
    console.error('Error al notificar a administradores:', err);
  }
}

/**
 * Evalúa alertas basadas en el rendimiento reciente del estudiante al registrar un intento:
 * - "promedioBajo": promedio de los últimos N intentos < umbral (excluyendo tema-revisado)
 * - "fallosQuiz": N intentos de quiz seguidos no aprobados en el mismo tema y nivel
 *
 * @param {Object} intento
 * @param {Object} usuario
 */
export async function evaluarAlertas(intento, usuario) {
  if (!intento || !usuario || usuario.rol !== 'estudiante') return null;

  const reglas = await almacen.leerConfig('reglas-alertas');
  if (!reglas) return null;

  // Obtener grupo y docente del estudiante
  let grupoId = null;
  let docenteId = null;

  const distributivo = await almacen.leer('distributivo');
  if (intento.temaId) {
    const asignatura = await acceso.asignaturaDeTema(intento.temaId);
    if (asignatura) {
      const g = distributivo.find(
        (item) => item.asignaturaId === asignatura.id && Array.isArray(item.estudiantes) && item.estudiantes.includes(usuario.id)
      );
      if (g) {
        grupoId = g.id;
        docenteId = g.docenteId;
      }
    }
  }

  if (!grupoId) {
    const g = distributivo.find(
      (item) => Array.isArray(item.estudiantes) && item.estudiantes.includes(usuario.id)
    );
    if (g) {
      grupoId = g.id;
      docenteId = g.docenteId;
    }
  }

  if (!grupoId || !docenteId) return null;

  const todosIntentos = await almacen.leer('intentos');
  const todasAlertas = await almacen.leer('alertas');
  const nombreEstudiante = `${usuario.nombre} ${usuario.apellido}`.trim();

  // 1. Regla "promedioBajo"
  if (reglas.promedioBajo?.activa) {
    const umbral = Number(reglas.promedioBajo.umbral) || 7;
    const ultimosN = Number(reglas.promedioBajo.ultimos) || 3;

    const intentosCalificados = todosIntentos.filter(
      (i) =>
        i.usuarioId === usuario.id &&
        i.actividad !== 'tema-revisado' &&
        typeof i.puntaje === 'number' &&
        typeof i.maximo === 'number' &&
        i.maximo > 0
    );

    intentosCalificados.sort(
      (a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
    );

    if (intentosCalificados.length >= ultimosN) {
      const muestra = intentosCalificados.slice(0, ultimosN);
      const suma = muestra.reduce((acc, i) => acc + (i.puntaje / i.maximo) * 10, 0);
      const promedio = Math.round((suma / muestra.length) * 10) / 10;

      if (promedio < umbral) {
        // Verificar duplicados: alerta activa por estudiante + regla
        const existe = todasAlertas.some(
          (a) => a.estudianteId === usuario.id && a.regla === 'promedioBajo' && a.estado === 'activa'
        );

        if (!existe) {
          const nuevaAlerta = {
            estudianteId: usuario.id,
            docenteId,
            grupoId,
            regla: 'promedioBajo',
            temaId: intento.temaId || null,
            detalle: `Promedio reciente de ${promedio.toFixed(1)}/10 en las últimas ${ultimosN} actividades evaluadas.`,
            estado: 'activa'
          };
          const guardada = await almacen.agregar('alertas', nuevaAlerta);
          todasAlertas.push(guardada);

          const mensaje = `${nombreEstudiante} presenta un promedio reciente de ${promedio.toFixed(1)}/10 en sus últimas actividades. Podría necesitar orientación pedagógica.`;
          await notificarDocenteYAdmin(docenteId, mensaje);
        }
      }
    }
  }

  // 2. Regla "fallosQuiz"
  if (reglas.fallosQuiz?.activa && intento.actividad === 'quiz' && intento.temaId) {
    const veces = Number(reglas.fallosQuiz.veces) || 3;
    const reglasGamif = await almacen.leerConfig('reglas-gamificacion');
    const pctAprobacion = Number(reglasGamif?.quiz?.porcentajeAprobacion) || 70;

    const nivelActual = intento.nivel !== undefined ? intento.nivel : null;

    const intentosQuiz = todosIntentos.filter(
      (i) =>
        i.usuarioId === usuario.id &&
        i.actividad === 'quiz' &&
        i.temaId === intento.temaId &&
        (nivelActual === null || i.nivel === nivelActual) &&
        typeof i.puntaje === 'number' &&
        typeof i.maximo === 'number' &&
        i.maximo > 0
    );

    intentosQuiz.sort(
      (a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
    );

    if (intentosQuiz.length >= veces) {
      const ultimosQuiz = intentosQuiz.slice(0, veces);
      const todosReprobados = ultimosQuiz.every(
        (i) => ((i.puntaje / i.maximo) * 100) < pctAprobacion
      );

      if (todosReprobados) {
        // Verificar duplicados: alerta activa por estudiante + regla (+ tema)
        const existe = todasAlertas.some(
          (a) =>
            a.estudianteId === usuario.id &&
            a.regla === 'fallosQuiz' &&
            a.temaId === intento.temaId &&
            a.estado === 'activa'
        );

        if (!existe) {
          const nuevaAlerta = {
            estudianteId: usuario.id,
            docenteId,
            grupoId,
            regla: 'fallosQuiz',
            temaId: intento.temaId,
            detalle: `${veces} intentos seguidos sin superar el quiz de nivel ${nivelActual || 1}.`,
            estado: 'activa'
          };
          const guardada = await almacen.agregar('alertas', nuevaAlerta);
          todasAlertas.push(guardada);

          const mensaje = `${nombreEstudiante} ha intentado el cuestionario ${veces} veces consecutivas sin alcanzar el umbral requerido. Un mensaje de apoyo le vendría muy bien.`;
          await notificarDocenteYAdmin(docenteId, mensaje);
        }
      }
    }
  }

  return true;
}

/**
 * Evalúa estudiantes inactivos de un grupo (sin eventos en bitácora en X días).
 * Se llama desde GET /resumen/grupo antes de calcular los datos.
 *
 * @param {string} grupoId
 */
export async function evaluarInactividad(grupoId) {
  if (!grupoId) return null;
  return conBloqueo(`alertas-agenda:${grupoId}`, () => evaluarGrupo(grupoId));
}

async function evaluarGrupo(grupoId) {
  const reglas = await almacen.leerConfig('reglas-alertas');
  if (!reglas?.inactividad?.activa && !reglas?.vencidas?.activa) return null;

  const diasInactividad = Number(reglas.inactividad?.dias) || 7;
  const distributivo = await almacen.leer('distributivo');
  const grupo = distributivo.find((g) => g.id === grupoId);

  if (!grupo || !Array.isArray(grupo.estudiantes) || grupo.estudiantes.length === 0) {
    return null;
  }

  const docenteId = grupo.docenteId;
  const bitacora = await almacen.leerLineas('bitacora.jsonl');
  const todasAlertas = await almacen.leer('alertas');
  const usuarios = await almacen.leer('usuarios');

  const ahora = Date.now();
  const limiteMs = ahora - (diasInactividad * 24 * 60 * 60 * 1000);
  const gracia = Number(reglas.vencidas?.diasGracia ?? 1);
  const diasGracia = Number.isFinite(gracia) && gracia >= 0 ? gracia : 1;
  const pendientes = reglas.vencidas?.activa ? (await almacen.leer('agenda')).filter((e) =>
    e.grupoId === grupoId && e.tipo === 'fecha-limite' && e.actividad && e.temaId &&
    Number.isFinite(Date.parse(e.fecha)) && ahora - instanteAgenda(e, 'fin') > diasGracia * 86400000
  ) : [];
  const intentos = pendientes.length ? await almacen.leer('intentos') : [];

  for (const estudianteId of grupo.estudiantes) {
    const estudiante = usuarios.find((u) => u.id === estudianteId && u.rol === 'estudiante' && u.activo !== false);
    if (!estudiante) continue;
    for (const evento of pendientes) {
      const realizado = intentos.some((i) => i.usuarioId === estudianteId && i.temaId === evento.temaId &&
        i.actividad === actividadDelIntento(evento.actividad) && Date.parse(i.fecha) > Date.parse(evento.fecha));
      const existe = todasAlertas.some((a) => a.estudianteId === estudianteId && a.grupoId === grupoId &&
        a.regla === 'vencidas' && a.eventoId === evento.id && a.estado === 'activa');
      if (realizado || existe) continue;
      const guardada = await almacen.agregar('alertas', {
        estudianteId, docenteId, grupoId, regla: 'vencidas', eventoId: evento.id, temaId: evento.temaId,
        detalle: `Actividad pendiente: ${evento.titulo}. La fecha límite terminó hace más de ${diasGracia} días y no hay un intento posterior a su asignación.`,
        estado: 'activa'
      });
      todasAlertas.push(guardada);
      const nombre = [estudiante.nombre, estudiante.apellido].filter(Boolean).join(' ') || 'Un estudiante';
      await notificarDocenteYAdmin(docenteId, `${nombre} tiene pendiente «${evento.titulo}». Una orientación y un recordatorio amable pueden ayudarle a retomarla.`);
    }
    if (!reglas.inactividad?.activa) continue;
    const eventos = bitacora.filter((b) => b && b.usuarioId === estudianteId && b.fecha);
    let ultimaFechaMs = 0;

    for (const ev of eventos) {
      const t = new Date(ev.fecha).getTime();
      if (!isNaN(t) && t > ultimaFechaMs) {
        ultimaFechaMs = t;
      }
    }

    if (ultimaFechaMs === 0 || ultimaFechaMs < limiteMs) {
      // Verificar duplicados activos
      const existe = todasAlertas.some(
        (a) => a.estudianteId === estudianteId && a.regla === 'inactividad' && a.estado === 'activa'
      );

      if (!existe) {
        const diasTranscurridos =
          ultimaFechaMs > 0
            ? Math.floor((ahora - ultimaFechaMs) / (24 * 60 * 60 * 1000))
            : diasInactividad;

        const estUsuario = usuarios.find((u) => u.id === estudianteId);
        const nombreEst = estUsuario
          ? `${estUsuario.nombre} ${estUsuario.apellido}`.trim()
          : 'Un estudiante';

        const nuevaAlerta = {
          estudianteId,
          docenteId,
          grupoId,
          regla: 'inactividad',
          temaId: null,
          detalle: `Sin actividad registrada en la plataforma desde hace ${diasTranscurridos} días (umbral: ${diasInactividad} días).`,
          estado: 'activa'
        };

        const guardada = await almacen.agregar('alertas', nuevaAlerta);
        todasAlertas.push(guardada);

        const mensaje = `${nombreEst} no registra actividad en los últimos ${diasTranscurridos} días. Un mensaje de bienvenida le motivará a retomar sus estudios.`;
        await notificarDocenteYAdmin(docenteId, mensaje);
      }
    }
  }

  return true;
}

export default {
  evaluarAlertas,
  evaluarInactividad
};
