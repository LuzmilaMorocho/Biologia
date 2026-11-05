import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Iniciar sesión', roles: ['publico'] });

// Si ya tiene sesión activa, redirigir a inicio
if (sesion.usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="ingreso-contenedor">
      <section class="tarjeta pila">
        <header class="pila" style="gap: var(--espaciado-xs);">
          <h1>Iniciar sesión</h1>
          <p>Ingresa tus credenciales para acceder a tus contenidos y evaluaciones.</p>
        </header>

        <form id="form-ingreso" class="ingreso-formulario" novalidate>
          <div class="campo">
            <label for="campo-correo">Correo electrónico *</label>
            <input
              type="email"
              id="campo-correo"
              name="correo"
              placeholder="correo@unemi.edu.ec"
              required
              autocomplete="email"
            />
            <span class="campo__error oculto" id="error-correo"></span>
          </div>

          <div class="campo">
            <label for="campo-clave">Contraseña *</label>
            <input
              type="password"
              id="campo-clave"
              name="clave"
              placeholder="Ingresa tu contraseña"
              required
              autocomplete="current-password"
            />
            <span class="campo__error oculto" id="error-clave"></span>
          </div>

          <button type="submit" class="btn btn--primario" id="btn-ingreso" style="width: 100%;">
            Ingresar
          </button>
        </form>

        <footer style="text-align: center; margin-top: var(--espaciado-s); font-size: var(--tamano-s);">
          ¿No tienes una cuenta? <a href="/paginas/registro.html">Regístrate aquí</a>
        </footer>
      </section>
    </div>
  `;

  const form = document.getElementById('form-ingreso');
  const inputCorreo = document.getElementById('campo-correo');
  const inputClave = document.getElementById('campo-clave');
  const btnIngreso = document.getElementById('btn-ingreso');

  const errorCorreo = document.getElementById('error-correo');
  const errorClave = document.getElementById('error-clave');

  function mostrarError(elError, elInput, mensaje) {
    if (mensaje) {
      elError.textContent = mensaje;
      elError.classList.remove('oculto');
      if (elInput && elInput.setAttribute) elInput.setAttribute('aria-invalid', 'true');
      return false;
    } else {
      elError.textContent = '';
      elError.classList.add('oculto');
      if (elInput && elInput.removeAttribute) elInput.removeAttribute('aria-invalid');
      return true;
    }
  }

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) return mostrarError(errorCorreo, inputCorreo, 'El correo electrónico es obligatorio');
    if (!regex.test(val)) return mostrarError(errorCorreo, inputCorreo, 'Ingresa un correo electrónico válido');
    return mostrarError(errorCorreo, inputCorreo, null);
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) return mostrarError(errorClave, inputClave, 'La contraseña es obligatoria');
    return mostrarError(errorClave, inputClave, null);
  }

  inputCorreo.addEventListener('input', validarCorreo);
  inputClave.addEventListener('input', validarClave);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okCorreo = validarCorreo();
    const okClave = validarClave();

    if (!okCorreo || !okClave) {
      ui.aviso('Completa los campos requeridos', 'advertencia');
      return;
    }

    try {
      btnIngreso.disabled = true;
      ui.cargando(true);

      const correo = inputCorreo.value.trim();
      const clave = inputClave.value;

      await sesion.iniciar(correo, clave);

      sessionStorage.setItem(
        'aviso_pendiente',
        JSON.stringify({ texto: 'Sesión iniciada correctamente.', tipo: 'exito' })
      );

      window.location.href = '/index.html';
    } catch (error) {
      ui.aviso(error.message || 'Error al iniciar sesión', 'error');
      btnIngreso.disabled = false;
      ui.cargando(false);
    }
  });
}
