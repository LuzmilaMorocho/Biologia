// Modelo compartido: valida el grafo y calcula el mejor camino hasta un final.
const error = (mensaje) => Object.assign(new Error(mensaje), { estado: 400 });
const texto = (valor, limite) => typeof valor === 'string' && valor.trim() && valor.length <= limite;

export function imagenEscenario(valor) {
  if (!texto(valor, 2048) || /[\s\\\u0000-\u001f]/.test(valor)) return null;
  if (!/^https?:\/\//i.test(valor) && !/^\/(?!\/)/.test(valor)) return null;
  try {
    const url = new URL(valor, 'https://plataforma.invalid');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? valor : null;
  } catch { return null; }
}

export function erroresEscenario(simulacion, { publicar = true } = {}) {
  const errores = [];
  const agregar = (escenaId, mensaje) => errores.push({ escenaId: escenaId || null, mensaje });
  const escenas = simulacion?.escenas;
  if (!Array.isArray(escenas) || escenas.length > 100 || (publicar && !escenas.length)) {
    agregar(null, 'El escenario debe tener entre 1 y 100 escenas para publicarse'); return errores;
  }
  const porId = new Map();
  for (const escena of escenas) {
    if (!escena || typeof escena.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(escena.id) || porId.has(escena.id)) {
      agregar(escena?.id, 'Cada escena debe tener un identificador único válido'); continue;
    }
    porId.set(escena.id, escena);
    if (typeof escena.texto !== 'string' || escena.texto.length > 5000 || (publicar && !escena.texto.trim())) agregar(escena.id, 'Escribe el texto de la escena (hasta 5.000 caracteres)');
    if (escena.imagen != null && escena.imagen !== '' && !imagenEscenario(escena.imagen)) agregar(escena.id, 'La imagen debe ser una URL http(s) o una ruta del sitio');
    if (!Array.isArray(escena.opciones) || escena.opciones.length > 4 || (publicar && escena.opciones.length === 1)) {
      agregar(escena.id, 'Usa de dos a cuatro opciones, o ninguna si la escena es final'); continue;
    }
    for (const [indice, opcion] of escena.opciones.entries()) {
      const prefijo = `Opción ${indice + 1}: `;
      if (!opcion || typeof opcion !== 'object') { agregar(escena.id, prefijo + 'datos no válidos'); continue; }
      if (typeof opcion.texto !== 'string' || opcion.texto.length > 500 || (publicar && !opcion.texto.trim())) agregar(escena.id, prefijo + 'escribe la decisión (hasta 500 caracteres)');
      if (typeof opcion.consecuencia !== 'string' || opcion.consecuencia.length > 2000 || (publicar && !opcion.consecuencia.trim())) agregar(escena.id, prefijo + 'escribe la consecuencia (hasta 2.000 caracteres)');
      if (typeof opcion.destino !== 'string' || opcion.destino.length > 50) agregar(escena.id, prefijo + 'destino no válido');
      if (!Number.isFinite(opcion.puntos) || opcion.puntos < -10 || opcion.puntos > 10) agregar(escena.id, prefijo + 'los puntos deben estar entre -10 y 10');
    }
  }
  if (!publicar) return errores;
  if (!porId.has(simulacion.escenaInicial)) agregar(null, 'Selecciona una escena inicial existente');
  for (const escena of porId.values()) for (const [indice, opcion] of (Array.isArray(escena.opciones) ? escena.opciones : []).entries()) {
    if (!porId.has(opcion?.destino)) agregar(escena.id, `Opción ${indice + 1}: el destino no existe`);
  }
  const alcanzables = new Set();
  function visitar(id) {
    if (!porId.has(id) || alcanzables.has(id)) return;
    alcanzables.add(id);
    for (const o of Array.isArray(porId.get(id).opciones) ? porId.get(id).opciones : []) visitar(o?.destino);
  }
  visitar(simulacion.escenaInicial);
  for (const id of porId.keys()) if (!alcanzables.has(id)) agregar(id, 'Esta escena no es alcanzable desde la inicial');
  const estados = new Map();
  function detectarCiclos(id) {
    if (!porId.has(id) || estados.get(id) === 2) return;
    if (estados.get(id) === 1) { agregar(id, 'El escenario contiene un ciclo que vuelve a esta escena'); return; }
    estados.set(id, 1);
    for (const o of Array.isArray(porId.get(id).opciones) ? porId.get(id).opciones : []) detectarCiclos(o?.destino);
    estados.set(id, 2);
  }
  for (const id of porId.keys()) detectarCiclos(id);
  if (![...porId.values()].some((e) => Array.isArray(e.opciones) && e.opciones.length === 0)) agregar(simulacion.escenaInicial, 'El escenario necesita al menos un final');
  if (!errores.length && mejorCamino(porId, simulacion.escenaInicial) <= 0) agregar(simulacion.escenaInicial, 'El mejor camino debe tener un puntaje positivo para registrar la actividad');
  return errores;
}

function mejorCamino(porId, inicial) {
  const mejores = new Map();
  function recorrer(id) {
    if (mejores.has(id)) return mejores.get(id);
    const opciones = porId.get(id).opciones;
    const mejor = opciones.length ? Math.max(...opciones.map((o) => o.puntos + recorrer(o.destino))) : 0;
    mejores.set(id, mejor); return mejor;
  }
  return recorrer(inicial);
}

export function analizarEscenario(simulacion) {
  const errores = erroresEscenario(simulacion);
  if (errores.length) throw Object.assign(error(errores[0].mensaje), { errores });
  const porId = new Map(simulacion.escenas.map((e) => [e.id, e]));
  return { porId, maximo: mejorCamino(porId, simulacion.escenaInicial) };
}

export function erroresRol(simulacion, { publicar = true } = {}) {
  const errores = [], personaje = simulacion?.personaje;
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  for (const [campo, limite] of [['nombre', 100], ['descripcion', 1000], ['contexto', 1800], ['objetivo', 1000]]) {
    const valor = personaje?.[campo];
    if (typeof valor !== 'string' || valor.length > limite || (publicar && !valor.trim())) agregar(`personaje.${campo}`, `Completa ${campo} del personaje (hasta ${limite} caracteres)`);
  }
  if (!Number.isInteger(simulacion?.maxTurnos) || simulacion.maxTurnos < 4 || simulacion.maxTurnos > 12) agregar('maxTurnos', 'El máximo de turnos debe ser un entero entre 4 y 12');
  const rubrica = simulacion?.rubrica;
  if (!Array.isArray(rubrica) || rubrica.length > 5 || (publicar && rubrica.length < 3)) {
    agregar('rubrica', 'La rúbrica debe tener de tres a cinco criterios para publicarse'); return errores;
  }
  const nombres = new Set();
  rubrica.forEach((c, i) => {
    for (const [campo, limite] of [['criterio', 120], ['descripcion', 700]]) {
      if (typeof c?.[campo] !== 'string' || c[campo].length > limite || (publicar && !c[campo].trim())) agregar(`rubrica.${i}.${campo}`, `Completa ${campo} del criterio ${i + 1} (hasta ${limite} caracteres)`);
    }
    const nombre = typeof c?.criterio === 'string' ? c.criterio.trim().normalize('NFC').toLocaleLowerCase('es') : '';
    if (nombre && nombres.has(nombre)) agregar(`rubrica.${i}.criterio`, 'Cada criterio debe tener un nombre distinto');
    nombres.add(nombre);
    if (!Number.isFinite(c?.puntos) || c.puntos <= 0 || c.puntos > Number.MAX_SAFE_INTEGER / 5) agregar(`rubrica.${i}.puntos`, 'Los puntos máximos de cada criterio deben ser positivos y finitos');
  });
  return errores;
}

export function normalizarEvaluacionRol(valor, rubrica) {
  if (!valor || typeof valor !== 'object' || typeof valor.comentarioGeneral !== 'string' || !valor.comentarioGeneral.trim() || valor.comentarioGeneral.length > 2000 ||
      !Array.isArray(valor.criterios) || valor.criterios.length < 3 || valor.criterios.length > 5 || !Number.isFinite(valor.puntaje) || !Number.isFinite(valor.maximo)) throw error('La evaluación no tiene un formato válido');
  const normalizar = (s) => typeof s === 'string' ? s.trim().normalize('NFC').toLocaleLowerCase('es') : '';
  const usados = new Set();
  const criterios = valor.criterios.map((c) => {
    const nombre = normalizar(c?.criterio);
    const configurado = rubrica?.find((r) => normalizar(r.criterio) === nombre);
    if (!nombre || nombre.length > 120 || usados.has(nombre) || !Number.isFinite(c.puntos) || c.puntos < 0 || typeof c.comentario !== 'string' || !c.comentario.trim() || c.comentario.length > 700 ||
        (rubrica && (!configurado || c.puntos > configurado.puntos))) throw error('La evaluación debe respetar todos los criterios y sus puntos máximos');
    usados.add(nombre);
    return { criterio: configurado?.criterio || c.criterio.trim(), puntos: c.puntos, comentario: c.comentario.trim() };
  });
  if (rubrica && criterios.length !== rubrica.length) throw error('La evaluación debe incluir cada criterio de la rúbrica');
  const maximo = rubrica ? rubrica.reduce((n, c) => n + c.puntos, 0) : valor.maximo;
  const puntaje = criterios.reduce((n, c) => n + c.puntos, 0);
  if (!Number.isFinite(maximo) || maximo <= 0 || puntaje > maximo) throw error('El puntaje de la evaluación no es válido');
  return { puntaje, maximo, criterios, comentarioGeneral: valor.comentarioGeneral.trim() };
}

export class PartidaEscenario {
  constructor(simulacion) {
    const { porId, maximo } = analizarEscenario(simulacion);
    this.escenas = porId; this.maximo = maximo; this.actual = simulacion.escenaInicial;
    this.puntos = 0; this.recorrido = []; this.pendiente = null;
  }
  get escena() { return this.escenas.get(this.actual); }
  get finalizada() { return this.escena.opciones.length === 0; }
  elegir(indice) {
    if (this.pendiente || this.finalizada || !Number.isInteger(indice) || !this.escena.opciones[indice]) throw error('Esta decisión no está disponible');
    const opcion = this.escena.opciones[indice];
    this.pendiente = { escenaId: this.actual, opcion: indice, decision: opcion.texto, destino: opcion.destino, puntos: opcion.puntos, consecuencia: opcion.consecuencia };
    this.recorrido.push({ ...this.pendiente }); this.puntos += opcion.puntos;
    return { ...this.pendiente };
  }
  continuar() {
    if (!this.pendiente) throw error('Primero elige una decisión');
    this.actual = this.pendiente.destino; this.pendiente = null;
  }
  informe() {
    if (!this.finalizada) throw error('Debes llegar a un final para registrar el intento');
    return { puntos: this.puntos, puntaje: Math.max(0, this.puntos), maximo: this.maximo, recorrido: this.recorrido.map((p) => ({ ...p })) };
  }
}
