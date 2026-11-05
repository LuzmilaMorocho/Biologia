import * as ui from './ui.js';

// Mantiene el formulario y sus errores abiertos hasta guardar correctamente.
export async function formularioModal(titulo, html, guardar, preparar = () => {}) {
  const form = document.createElement('form');
  form.className = 'pila';
  form.innerHTML = `${html}<p class="campo__error" role="alert" data-error></p><button type="submit" class="btn btn--primario">Guardar</button>`;
  let resultado = null;
  let pendiente = Promise.resolve();
  let ocupado = false;
  preparar(form);
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (ocupado || !form.reportValidity()) return;
    ocupado = true;
    pendiente = (async () => {
      const datos = Object.fromEntries(new FormData(form));
      const controles = [...form.querySelectorAll('button, input, textarea, select')];
      const estados = controles.map((el) => el.disabled);
      controles.forEach((el) => { el.disabled = true; });
      form.querySelector('[data-error]').textContent = '';
      try {
        resultado = await guardar(datos);
        form.closest('.modal-dialogo')?.querySelector('.modal-pie button')?.click();
      } catch (error) {
        form.querySelector('[data-error]').textContent = error.message;
      } finally {
        ocupado = false;
        controles.forEach((el, i) => { el.disabled = estados[i]; });
      }
    })();
  });
  await ui.modal({ titulo, contenido: form, acciones: [{ texto: 'Cancelar', valor: null, clase: 'btn--secundario' }] });
  await pendiente;
  return resultado;
}
