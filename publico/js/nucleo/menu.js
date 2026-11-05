// Definición del menú de navegación del sistema
export const MENU = [
  { texto: 'Inicio', href: '/index.html', roles: ['publico'] },
  { texto: 'Noticias', href: '/paginas/noticias.html', roles: ['sesion'] },
  { texto: 'Foros', href: '/paginas/foros.html', roles: ['sesion'] },
  { texto: 'Simulaciones', href: '/paginas/simulaciones.html', roles: ['sesion'] },
  { texto: 'Agenda', href: '/paginas/agenda.html', roles: ['sesion'] },
  { texto: 'Mensajes', href: '/paginas/mensajes.html', roles: ['sesion'] },
  { texto: 'Reportes', href: '/paginas/admin-reportes.html', roles: ['admin'] },
  { texto: 'Canciones', href: '/paginas/canciones.html', roles: ['sesion'] },
  { texto: 'Mis asignaturas', href: '/paginas/asignaturas.html', roles: ['estudiante', 'docente'] },
  { texto: 'Mi progreso', href: '/paginas/mi-progreso.html', roles: ['estudiante'] },
  { texto: 'Actividades', href: '/paginas/actividades.html', roles: ['estudiante', 'docente'] },
  { texto: 'Mi perfil', href: '/paginas/perfil.html', roles: ['sesion'] },
  { texto: 'Contenidos', href: '/paginas/editor-contenidos.html', roles: ['docente', 'admin'] },
  { texto: 'Banco de preguntas', href: '/paginas/banco-preguntas.html', roles: ['docente', 'admin'] },
  { texto: 'Panel docente', href: '/paginas/panel-docente.html', roles: ['docente', 'admin'] },
  { texto: 'Usuarios', href: '/paginas/admin-usuarios.html', roles: ['admin'] },
  { texto: 'Configuración de IA', href: '/paginas/admin-ia.html', roles: ['admin'] },
  { texto: 'Asignaturas', href: '/paginas/admin-asignaturas.html', roles: ['admin'] },
  { texto: 'Distributivo', href: '/paginas/distributivo.html', roles: ['admin'] }
];
