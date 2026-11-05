const estados = ['reposo', 'hablando', 'pensando', 'celebrando'];
const clavePreferencias = 'avatar-guia-preferencias';
let elemento = null, globo = null, ultimoTexto = '', vozActiva = false, oculto = false;
let locucion = null, temporizador = null, version = 0;

const vozDisponible = () => typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === 'function';

function guardarPreferencias() {
  try { localStorage.setItem(clavePreferencias, JSON.stringify({ voz: vozActiva, oculto })); } catch { /* Preferencias solo en memoria si no hay almacenamiento. */ }
}

function detenerLectura() {
  if (!locucion) return;
  locucion.onend = null; locucion.onerror = null; locucion = null;
  try { window.speechSynthesis.cancel(); } catch { /* El globo sigue disponible. */ }
}

export function cambiarEstado(estado) {
  if (!elemento || !estados.includes(estado)) return false;
  clearTimeout(temporizador); detenerLectura(); version++;
  elemento.classList.remove(...estados.map((e) => `avatar-guia--${e}`));
  elemento.classList.add(`avatar-guia--${estado}`);
  elemento.dataset.estado = estado;
  return true;
}

export function decir(texto) {
  if (!elemento) return;
  ultimoTexto = String(texto || '').trim();
  globo.textContent = ultimoTexto;
  cambiarEstado(ultimoTexto && !oculto ? 'hablando' : 'reposo');
  if (!ultimoTexto || oculto) return;
  const actual = version;
  const terminar = () => {
    if (actual === version && elemento.dataset.estado === 'hablando') { locucion = null; cambiarEstado('reposo'); }
  };
  if (!vozActiva || !vozDisponible()) { temporizador = setTimeout(terminar, 3000); return; }
  try {
    const mensaje = new window.SpeechSynthesisUtterance(ultimoTexto);
    const voces = window.speechSynthesis.getVoices();
    const voz = voces.find((v) => v.lang.toLowerCase() === 'es-ec') || voces.find((v) => /^es(?:-|$)/i.test(v.lang));
    if (voz) mensaje.voice = voz;
    mensaje.lang = voz?.lang || 'es-EC';
    mensaje.onend = terminar; mensaje.onerror = terminar;
    locucion = mensaje;
    window.speechSynthesis.speak(mensaje);
  } catch { terminar(); }
}

function aplicarPreferencias() {
  elemento.classList.toggle('avatar-guia--oculto', oculto);
  document.body.classList.toggle('con-avatar-guia', !oculto);
  document.getElementById('avatar-mostrar').hidden = !oculto;
  const boton = document.getElementById('avatar-voz');
  boton.disabled = !vozDisponible();
  boton.textContent = !vozDisponible() ? 'Voz no disponible' : vozActiva ? 'Silenciar' : 'Activar voz';
  boton.setAttribute('aria-pressed', String(vozActiva));
}

export function montarAvatar() {
  if (typeof document === 'undefined') return null;
  if (elemento) return elemento;
  try {
    const preferencias = JSON.parse(localStorage.getItem(clavePreferencias) || '{}');
    vozActiva = preferencias?.voz === true; oculto = preferencias?.oculto === true;
  } catch { vozActiva = false; oculto = false; }
  elemento = document.createElement('aside');
  elemento.id = 'avatar-guia'; elemento.className = 'avatar-guia avatar-guia--reposo'; elemento.dataset.estado = 'reposo';
  elemento.setAttribute('aria-label', 'Lumo, guía de aprendizaje');
  elemento.innerHTML = `<div class="avatar-guia__panel">
    <p class="avatar-guia__nombre">Lumo · Tu guía</p><p id="avatar-globo" class="avatar-guia__globo" role="status" tabindex="0"></p>
    <div class="avatar-guia__acciones"><button type="button" id="avatar-voz" class="btn btn--texto btn--pequeno">Activar voz</button>
    <button type="button" id="avatar-ocultar" class="btn btn--texto btn--pequeno">Ocultar</button></div></div>
    <svg class="avatar-guia__dibujo" viewBox="0 0 160 180" role="img" aria-label="Lumo, un pequeño explorador de ideas">
      <ellipse class="avatar-guia__sombra" cx="80" cy="165" rx="43" ry="8"/>
      <g class="avatar-guia__cuerpo">
        <g class="avatar-guia__brazo avatar-guia__brazo--izquierdo"><path d="M42 104 Q15 98 18 124"/><circle cx="18" cy="126" r="8"/></g>
        <g class="avatar-guia__brazo avatar-guia__brazo--derecho"><path d="M118 104 Q145 98 142 124"/><circle cx="142" cy="126" r="8"/></g>
        <path class="avatar-guia__bota" d="M53 142 L49 158 Q61 165 72 158 L72 144 Z M88 144 L88 158 Q100 165 111 158 L107 142 Z"/>
        <rect class="avatar-guia__traje" x="38" y="86" width="84" height="65" rx="24"/>
        <path class="avatar-guia__libro" d="M60 107 Q70 103 80 110 Q90 103 100 107 L100 133 Q90 129 80 136 Q70 129 60 133 Z"/>
        <path class="avatar-guia__costura" d="M80 110 L80 136"/>
        <path class="avatar-guia__antena" d="M80 29 L80 15"/>
        <path class="avatar-guia__chispa" d="M80 3 L84 10 L92 12 L85 17 L84 25 L78 20 L70 22 L73 14 L69 8 L77 9 Z"/>
        <rect class="avatar-guia__casco" x="31" y="27" width="98" height="70" rx="31"/>
        <rect class="avatar-guia__rostro" x="41" y="37" width="78" height="50" rx="21"/>
        <g class="avatar-guia__ojos"><ellipse cx="62" cy="57" rx="5" ry="7"/><ellipse cx="98" cy="57" rx="5" ry="7"/></g>
        <ellipse class="avatar-guia__boca" cx="80" cy="75" rx="10" ry="3"/>
        <circle class="avatar-guia__mejilla" cx="51" cy="71" r="4"/><circle class="avatar-guia__mejilla" cx="109" cy="71" r="4"/>
      </g>
    </svg>
    <button type="button" id="avatar-mostrar" class="btn btn--secundario avatar-guia__mostrar" hidden>Mostrar guía</button>`;
  document.body.appendChild(elemento);
  globo = document.getElementById('avatar-globo');
  document.getElementById('avatar-voz').addEventListener('click', () => {
    if (!vozDisponible()) return;
    vozActiva = !vozActiva; guardarPreferencias(); aplicarPreferencias();
    if (!vozActiva) { detenerLectura(); if (elemento.dataset.estado === 'hablando') cambiarEstado('reposo'); }
    else if (!['pensando', 'celebrando'].includes(elemento.dataset.estado)) decir(ultimoTexto);
  });
  document.getElementById('avatar-ocultar').addEventListener('click', () => {
    oculto = true; cambiarEstado('reposo'); guardarPreferencias(); aplicarPreferencias(); document.getElementById('avatar-mostrar').focus();
  });
  document.getElementById('avatar-mostrar').addEventListener('click', () => {
    oculto = false; guardarPreferencias(); aplicarPreferencias(); decir(ultimoTexto);
    (document.getElementById('avatar-voz').disabled ? globo : document.getElementById('avatar-voz')).focus();
  });
  window.addEventListener('pagehide', () => cambiarEstado('reposo'));
  aplicarPreferencias();
  return elemento;
}
