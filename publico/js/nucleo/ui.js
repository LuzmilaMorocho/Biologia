// Utilidades de interfaz de usuario y accesibilidad (módulos ES nativos)

export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function limpiar(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

function asegurarContenedorAvisos() {
  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    contenedor.setAttribute('aria-atomic', 'true');
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

export function aviso(texto, tipo = 'info') {
  if (typeof document === 'undefined') return;

  const contenedor = asegurarContenedorAvisos();
  const elementoAviso = document.createElement('div');
  elementoAviso.className = `aviso aviso-${tipo}`;
  elementoAviso.setAttribute('role', 'alert');
  elementoAviso.textContent = texto;

  contenedor.appendChild(elementoAviso);

  setTimeout(() => {
    elementoAviso.remove();
  }, 4000);
}

export function cargando(bool) {
  if (typeof document === 'undefined') return;

  let indicador = document.querySelector('.cargando');
  if (bool) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-live', 'polite');
      indicador.setAttribute('aria-label', 'Cargando');
      indicador.innerHTML = '<span class="cargando-spinner" aria-hidden="true"></span><span class="sr-only">Cargando...</span>';
      document.body.appendChild(indicador);
    }
  } else if (indicador) {
    indicador.remove();
  }
}

export function modal({ titulo, contenido, acciones = [] }) {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const elementoPrevio = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-fondo';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal-dialogo';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    dialogo.setAttribute('tabindex', '-1');

    const idTitulo = `modal-titulo-${Date.now()}`;
    dialogo.setAttribute('aria-labelledby', idTitulo);

    let htmlAcciones = '';
    const listaAcciones = acciones && acciones.length > 0 ? acciones : [{ texto: 'Cerrar', valor: null, clase: 'btn-secundario' }];

    dialogo.innerHTML = `
      <div class="modal-cabecera">
        <h2 id="${idTitulo}" class="modal-titulo">${escapar(titulo)}</h2>
      </div>
      <div class="modal-cuerpo"></div>
      <div class="modal-pie"></div>
    `;

    const cuerpoEl = dialogo.querySelector('.modal-cuerpo');
    if (typeof contenido === 'string') {
      cuerpoEl.textContent = contenido;
    } else if (contenido instanceof HTMLElement) {
      cuerpoEl.appendChild(contenido);
    }

    const pieEl = dialogo.querySelector('.modal-pie');
    listaAcciones.forEach((accion, indice) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `btn ${accion.clase || ''}`.trim();
      boton.textContent = accion.texto;
      boton.dataset.indice = String(indice);
      pieEl.appendChild(boton);
    });

    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    const selectorFoco = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function obtenerElementosFoco() {
      return Array.from(dialogo.querySelectorAll(selectorFoco)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
    }

    function cerrar(valor) {
      document.removeEventListener('keydown', manejarTeclado);
      overlay.remove();
      if (elementoPrevio && typeof elementoPrevio.focus === 'function') {
        elementoPrevio.focus();
      }
      resolve(valor);
    }

    function manejarTeclado(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar(null);
        return;
      }

      if (evento.key === 'Tab') {
        const elementosFoco = obtenerElementosFoco();
        if (elementosFoco.length === 0) {
          evento.preventDefault();
          return;
        }

        const primerElemento = elementosFoco[0];
        const ultimoElemento = elementosFoco[elementosFoco.length - 1];

        if (evento.shiftKey) {
          if (document.activeElement === primerElemento || document.activeElement === dialogo) {
            evento.preventDefault();
            ultimoElemento.focus();
          }
        } else {
          if (document.activeElement === ultimoElemento) {
            evento.preventDefault();
            primerElemento.focus();
          }
        }
      }
    }

    pieEl.addEventListener('click', (evento) => {
      const boton = evento.target.closest('button[data-indice]');
      if (boton) {
        const accion = listaAcciones[Number(boton.dataset.indice)];
        cerrar(accion.valor !== undefined ? accion.valor : null);
      }
    });

    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) {
        cerrar(null);
      }
    });

    document.addEventListener('keydown', manejarTeclado);

    const focos = obtenerElementosFoco();
    if (focos.length > 0) {
      focos[0].focus();
    } else {
      dialogo.focus();
    }
  });
}

export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmar acción',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });
  return resultado === true;
}
