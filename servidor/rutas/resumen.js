// Servidor: rutas de resúmenes de progreso (§C, §D contratos.md)
import { Router } from 'express';
import * as almacen from '../almacen.js';
import { evaluarInactividad } from '../alertas.js';
import { exigirRol } from '../auth.js';

const router = Router();

router.get('/resumen/tutor/:grupoId', exigirRol('docente', 'admin'), async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const grupo = (await almacen.leer('distributivo')).find((g) => g.id === req.params.grupoId);
    if (!grupo) throw Object.assign(new Error('Grupo no encontrado'), { estado: 404 });
    if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) throw Object.assign(new Error('No tienes acceso al resumen de este grupo'), { estado: 403 });
    const [unidades, temas, usuarios, consultas] = await Promise.all([
      almacen.leer('unidades'), almacen.leer('temas'), almacen.leer('usuarios'), almacen.leer('consultas-tutor')
    ]);
    const unidadesId = new Set(unidades.filter((u) => u.asignaturaId === grupo.asignaturaId).map((u) => u.id));
    const temasGrupo = temas.filter((t) => unidadesId.has(t.unidadId));
    const temasId = new Set(temasGrupo.map((t) => t.id));
    const estudiantes = usuarios.filter((u) => u.rol === 'estudiante' && grupo.estudiantes?.includes(u.id));
    const estudiantesId = new Set(estudiantes.map((u) => u.id));
    const validas = consultas.filter((c) => estudiantesId.has(c.usuarioId) && temasId.has(c.temaId) && Number.isSafeInteger(c.mensajes) && c.mensajes > 0);
    res.json({
      porTema: temasGrupo.map((t) => ({ temaId: t.id, titulo: t.titulo, consultas: validas.filter((c) => c.temaId === t.id).reduce((n, c) => n + c.mensajes, 0) })),
      porEstudiante: estudiantes.map((u) => ({ id: u.id, nombre: [u.nombre, u.apellido].filter(Boolean).join(' ') || u.id,
        consultas: validas.filter((c) => c.usuarioId === u.id).reduce((n, c) => n + c.mensajes, 0) }))
    });
  } catch (error) { next(error); }
});

// Calcula la media de puntaje / maximo * 10 con un decimal, omitiendo "tema-revisado"
function calcularPromedio(intentos) {
  if (!Array.isArray(intentos)) return 0;
  const evaluables = intentos.filter(
    (i) =>
      i.actividad !== 'tema-revisado' &&
      typeof i.puntaje === 'number' &&
      typeof i.maximo === 'number' &&
      i.maximo > 0
  );

  if (evaluables.length === 0) return 0;
  const suma = evaluables.reduce((acc, i) => acc + (i.puntaje / i.maximo) * 10, 0);
  const media = suma / evaluables.length;
  return Number(media.toFixed(1));
}

// Obtiene la etiqueta de la semana (Lunes YYYY-MM-DD) para agrupar evolución
function obtenerEtiquetaSemana(isoFecha) {
  if (!isoFecha) return null;
  const d = new Date(isoFecha);
  if (isNaN(d.getTime())) return null;

  // Lunes de esa semana en UTC
  const diaSemana = d.getUTCDay(); // 0 domingo, 1 lunes...
  const diff = d.getUTCDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
  const lunes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));

  const anio = lunes.getUTCFullYear();
  const mes = String(lunes.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(lunes.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// GET /api/resumen/estudiante/:id -> Resumen detallado de progreso individual
router.get('/resumen/estudiante/:id', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const estudianteId = req.params.id === 'yo' ? req.usuario.id : req.params.id;

    // Lectura única de todas las colecciones y bitácora
    const [
      usuarios,
      distributivo,
      asignaturas,
      unidades,
      temas,
      progresos,
      intentos,
      logros,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('asignaturas'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leer('logros'),
      almacen.leerLineas('bitacora.jsonl')
    ]);

    const estudiante = usuarios.find((u) => u.id === estudianteId);
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Validación de permisos: propio estudiante, docente de sus grupos o admin
    let permitido = false;
    if (req.usuario.id === estudianteId || req.usuario.rol === 'admin') {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const gruposDelDocente = distributivo.filter((g) => g.docenteId === req.usuario.id);
      permitido = gruposDelDocente.some(
        (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
      );
    }

    if (!permitido) {
      return res.status(403).json({ error: 'Acceso denegado al resumen del estudiante' });
    }

    // 1. Logros y puntos
    const logro = logros.find((l) => l.usuarioId === estudianteId) || {};
    const puntos = Number(logro.puntos || 0);

    const nivelesQuiz = Object.values(logro.nivelQuiz || {});
    const nivelQuizMax = nivelesQuiz.length > 0 ? Math.max(...nivelesQuiz.map(Number)) : 0;

    // 2. Temas de las asignaturas del estudiante
    const gruposEstudiante = distributivo.filter(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
    );
    const idsAsignaturas = new Set(gruposEstudiante.map((g) => g.asignaturaId));

    const unidadesVisibles = unidades.filter(
      (u) => idsAsignaturas.has(u.asignaturaId) && u.visible !== false
    );
    const idsUnidades = new Set(unidadesVisibles.map((u) => u.id));

    const temasPublicados = temas.filter(
      (t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado'
    );

    const misProgresos = progresos.filter((p) => p.usuarioId === estudianteId);
    const idsTemasRevisados = new Set(misProgresos.map((p) => p.temaId));

    const revisadosCount = temasPublicados.filter((t) => idsTemasRevisados.has(t.id)).length;
    const pctTemas =
      temasPublicados.length > 0 ? Math.round((revisadosCount / temasPublicados.length) * 100) : 0;

    const pendientes = temasPublicados
      .filter((t) => !idsTemasRevisados.has(t.id))
      .map((t) => ({ temaId: t.id, titulo: t.titulo }));

    // 3. Intentos del estudiante
    const misIntentos = intentos.filter((i) => i.usuarioId === estudianteId);

    // Promedio general
    const promedio = calcularPromedio(misIntentos);

    // Desglose por actividad
    const actividadesMap = new Map();
    for (const intento of misIntentos) {
      if (intento.actividad === 'tema-revisado') continue;
      if (!actividadesMap.has(intento.actividad)) {
        actividadesMap.set(intento.actividad, []);
      }
      actividadesMap.get(intento.actividad).push(intento);
    }

    const porActividad = Array.from(actividadesMap.entries()).map(([act, list]) => ({
      actividad: act,
      promedio: calcularPromedio(list),
      intentos: list.length
    }));

    // Desglose por tema
    const mapaTitulosTemas = new Map(temas.map((t) => [t.id, t.titulo]));
    const temasMap = new Map();
    for (const intento of misIntentos) {
      if (!intento.temaId) continue;
      if (!temasMap.has(intento.temaId)) {
        temasMap.set(intento.temaId, []);
      }
      temasMap.get(intento.temaId).push(intento);
    }

    const porTema = Array.from(temasMap.entries()).map(([tId, list]) => ({
      temaId: tId,
      titulo: mapaTitulosTemas.get(tId) || 'Tema',
      promedio: calcularPromedio(list),
      intentos: list.length
    }));

    // Evolución de las últimas 8 semanas con datos
    const semanasMap = new Map();
    for (const intento of misIntentos) {
      if (intento.actividad === 'tema-revisado') continue;
      const sem = obtenerEtiquetaSemana(intento.fecha);
      if (!sem) continue;
      if (!semanasMap.has(sem)) {
        semanasMap.set(sem, []);
      }
      semanasMap.get(sem).push(intento);
    }

    const todasSemanas = Array.from(semanasMap.keys()).sort();
    const ultimas8Semanas = todasSemanas.slice(-8);
    const evolucion = ultimas8Semanas.map((sem) => ({
      semana: sem,
      promedio: calcularPromedio(semanasMap.get(sem))
    }));

    // Última conexión (de bitácora)
    const eventosUsuario = bitacora.filter((b) => b.usuarioId === estudianteId);
    let ultimaConexion = null;
    if (eventosUsuario.length > 0) {
      const fechas = eventosUsuario.map((e) => e.fecha).filter(Boolean).sort();
      if (fechas.length > 0) {
        ultimaConexion = fechas[fechas.length - 1];
      }
    }

    // Tiempo total en minutos (duracionSeg de los intentos)
    const duracionTotalSeg = misIntentos.reduce(
      (acc, i) => acc + (Number(i.duracionSeg) || 0),
      0
    );
    const tiempoMin = Math.round(duracionTotalSeg / 60);

    // Últimos 20 intentos
    const ultimosIntentos = [...misIntentos]
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
      .slice(0, 20);

    res.json({
      puntos,
      nivelQuizMax,
      pctTemas,
      promedio,
      porActividad,
      porTema,
      evolucion,
      pendientes,
      ultimaConexion,
      tiempoMin,
      ultimosIntentos
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al obtener resumen del estudiante' });
  }
});

// GET /api/resumen/grupo/:grupoId -> Resumen de grupo para el docente o admin
router.get('/resumen/grupo/:grupoId', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }

    const { grupoId } = req.params;

    // Lectura única de colecciones y bitácora
    const [
      usuarios,
      distributivo,
      asignaturas,
      unidades,
      temas,
      progresos,
      intentos,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('asignaturas'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leerLineas('bitacora.jsonl')
    ]);

    const grupo = distributivo.find((g) => g.id === grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // Verificación de permisos: docente del grupo o admin
    if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) {
      return res.status(403).json({ error: 'Acceso denegado a este grupo' });
    }

    // Evaluar después de autorizar y consultar las alertas recién generadas.
    try {
      await evaluarInactividad(grupoId);
    } catch (errInact) {
      console.error('Error al evaluar inactividad o vencidas:', errInact);
    }
    const alertas = await almacen.leer('alertas');

    // Temas publicados de la asignatura del grupo
    const unidadesGrupo = unidades.filter(
      (u) => u.asignaturaId === grupo.asignaturaId && u.visible !== false
    );
    const idsUnidadesGrupo = new Set(unidadesGrupo.map((u) => u.id));
    const temasGrupo = temas.filter(
      (t) => idsUnidadesGrupo.has(t.unidadId) && t.estado === 'publicado'
    );
    const totalTemasGrupo = temasGrupo.length;

    // Mapa de usuarios
    const usuariosMap = new Map(usuarios.map((u) => [u.id, u]));

    // Mapa de última conexión por usuario a partir de bitácora
    const ultimaConexionPorUsuario = new Map();
    for (const b of bitacora) {
      if (!b.usuarioId || !b.fecha) continue;
      const actual = ultimaConexionPorUsuario.get(b.usuarioId);
      if (!actual || new Date(b.fecha) > new Date(actual)) {
        ultimaConexionPorUsuario.set(b.usuarioId, b.fecha);
      }
    }

    // Resumen por cada estudiante del grupo
    const idsEstudiantesGrupo = new Set(grupo.estudiantes || []);
    const estudiantes = [];

    for (const estId of idsEstudiantesGrupo) {
      const u = usuariosMap.get(estId);
      if (!u) continue;

      const intentosEst = intentos.filter((i) => i.usuarioId === estId);
      const promedio = calcularPromedio(intentosEst);

      const progresosEst = progresos.filter((p) => p.usuarioId === estId);
      const idsRevisados = new Set(progresosEst.map((p) => p.temaId));
      const revisados = temasGrupo.filter((t) => idsRevisados.has(t.id)).length;
      const pctTemas = totalTemasGrupo > 0 ? Math.round((revisados / totalTemasGrupo) * 100) : 0;

      const alertasActivas = alertas.filter(
        (a) => a.estudianteId === estId && a.grupoId === grupo.id && a.estado === 'activa'
      ).length;

      estudiantes.push({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        promedio,
        actividades: intentosEst.length,
        pctTemas,
        ultimaConexion: ultimaConexionPorUsuario.get(u.id) || null,
        alertasActivas
      });
    }

    // Desglose por tema en el grupo
    const porTema = temasGrupo.map((tema) => {
      const intentosTema = intentos.filter(
        (i) => idsEstudiantesGrupo.has(i.usuarioId) && i.temaId === tema.id
      );

      return {
        temaId: tema.id,
        titulo: tema.titulo,
        promedio: calcularPromedio(intentosTema),
        intentos: intentosTema.length
      };
    });

    res.json({
      grupo,
      estudiantes,
      porTema
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al obtener resumen del grupo' });
  }
});

export default router;

