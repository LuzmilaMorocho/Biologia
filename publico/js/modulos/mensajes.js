import { montarPlantilla, actualizarNoLeidosMensajes } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { montarMensajeria } from '../nucleo/mensajeria.js';

await montarPlantilla({ titulo: 'Mensajes', roles: ['sesion'] });
if (usuarioActual()) montarMensajeria(document.getElementById('contenido'), usuarioActual(), actualizarNoLeidosMensajes);
