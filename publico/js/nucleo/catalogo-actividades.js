// Catálogo de actividades interactivas de la plataforma
// Cada actividad tendrá la forma: { id, texto, descripcion, href } (href sin parámetros)
export const ACTIVIDADES = [
  { id: 'simulador', texto: 'Simulador', descripcion: 'Practica situaciones reales', href: '/paginas/simulaciones.html' },
  { id: 'tutor', texto: 'Tutor IA', descripcion: 'Resuelve dudas razonando', href: '/paginas/tutor.html' },
  {
    id: 'quiz',
    texto: 'Quiz por niveles',
    descripcion: 'Supera 5 niveles y gana diplomas',
    href: '/paginas/quiz.html'
  },
  {
    id: 'canciones',
    texto: 'Canciones del tema',
    descripcion: 'Aprende con música',
    href: '/paginas/canciones.html'
  },
  {
    id: 'ahorcado',
    texto: 'Ahorcado',
    descripcion: 'Adivina la palabra del tema',
    href: '/paginas/ahorcado.html'
  },
  {
    id: 'pareja',
    texto: 'Encuentra la pareja',
    descripcion: 'Relaciona conceptos y definiciones',
    href: '/paginas/pareja.html'
  },
  {
    id: 'sopa-letras',
    texto: 'Sopa de letras',
    descripcion: 'Encuentra los conceptos del tema',
    href: '/paginas/sopa-letras.html'
  }
];

// El catálogo usa el nombre de la página; los intentos conservan el contrato.
export function actividadDelIntento(id) {
  return id === 'simulador' ? 'simulacion' : id;
}
