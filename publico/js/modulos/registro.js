import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Registrarse', roles: ['publico'] });

// Si ya tiene sesión activa, redirigir a inicio
if (sesion.usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="registro-contenedor">
      <section class="tarjeta pila">
        <header class="pila" style="gap: var(--espaciado-xs);">
          <h1>Crear cuenta</h1>
          <p>Regístrate en la plataforma para acceder a las actividades y evaluaciones.</p>
        </header>

        <form id="form-registro" class="registro-formulario" novalidate>
          <div class="campo">
            <label for="campo-nombre">Nombre *</label>
            <input type="text" id="campo-nombre" name="nombre" placeholder="Ingresa tu nombre" required autocomplete="given-name">
            <span class="campo__error oculto" id="error-nombre"></span>
          </div>

          <div class="campo">
            <label for="campo-apellido">Apellido *</label>
            <input type="text" id="campo-apellido" name="apellido" placeholder="Ingresa tu apellido" required autocomplete="family-name">
            <span class="campo__error oculto" id="error-apellido"></span>
          </div>

          <div class="campo">
            <label for="campo-correo">Correo electrónico *</label>
            <input type="email" id="campo-correo" name="correo" placeholder="ejemplo@unemi.edu.ec" required autocomplete="email">
            <span class="campo__error oculto" id="error-correo"></span>
          </div>

          <div class="campo">
            <label for="campo-clave">Contraseña *</label>
            <input type="password" id="campo-clave" name="clave" placeholder="Mínimo 8 caracteres con letras y números" required autocomplete="new-password">
            <span class="campo__error oculto" id="error-clave"></span>
          </div>

          <div class="campo">
            <label class="registro-casilla">
              <input type="checkbox" id="campo-privacidad" name="privacidad" required>
              <span>Acepto el <a href="/paginas/privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a> *</span>
            </label>
            <span class="campo__error oculto" id="error-privacidad"></span>
          </div>

          <button type="submit" class="btn btn--primario" id="btn-registro" style="width: 100%;">
            Registrarse
          </button>
        </form>

        <footer style="text-align: center; margin-top: var(--espaciado-s); font-size: var(--tamano-s);">
          ¿Ya tienes cuenta? <a href="/paginas/ingreso.html">Inicia sesión aquí</a>
        </footer>
      </section>
    </div>
  `;

  const form = document.getElementById('form-registro');
  const inputNombre = document.getElementById('campo-nombre');
  const inputApellido = document.getElementById('campo-apellido');
  const inputCorreo = document.getElementById('campo-correo');
  const inputClave = document.getElementById('campo-clave');
  const checkPrivacidad = document.getElementById('campo-privacidad');
  const btnRegistro = document.getElementById('btn-registro');

  const errorNombre = document.getElementById('error-nombre');
  const errorApellido = document.getElementById('error-apellido');
  const errorCorreo = document.getElementById('error-correo');
  const errorClave = document.getElementById('error-clave');
  const errorPrivacidad = document.getElementById('error-privacidad');

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

  // Funciones de validación
  function validarNombre() {
    const val = inputNombre.value.trim();
    if (!val) return mostrarError(errorNombre, inputNombre, 'El nombre es obligatorio');
    return mostrarError(errorNombre, inputNombre, null);
  }

  function validarApellido() {
    const val = inputApellido.value.trim();
    if (!val) return mostrarError(errorApellido, inputApellido, 'El apellido es obligatorio');
    return mostrarError(errorApellido, inputApellido, null);
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
    const regex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!val) return mostrarError(errorClave, inputClave, 'La contraseña es obligatoria');
    if (!regex.test(val)) return mostrarError(errorClave, inputClave, 'Debe tener al menos 8 caracteres e incluir letras y números');
    return mostrarError(errorClave, inputClave, null);
  }

  function validarPrivacidad() {
    if (!checkPrivacidad.checked) {
      return mostrarError(errorPrivacidad, checkPrivacidad, 'Debes aceptar el aviso de privacidad para registrarte');
    }
    return mostrarError(errorPrivacidad, checkPrivacidad, null);
  }

  // Validación en vivo al escribir o interactuar
  inputNombre.addEventListener('input', validarNombre);
  inputApellido.addEventListener('input', validarApellido);
  inputCorreo.addEventListener('input', validarCorreo);
  inputClave.addEventListener('input', validarClave);
  checkPrivacidad.addEventListener('change', validarPrivacidad);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okNombre = validarNombre();
    const okApellido = validarApellido();
    const okCorreo = validarCorreo();
    const okClave = validarClave();
    const okPrivacidad = validarPrivacidad();

    if (!okNombre || !okApellido || !okCorreo || !okClave || !okPrivacidad) {
      ui.aviso('Por favor completa todos los campos correctamente', 'advertencia');
      return;
    }

    try {
      btnRegistro.disabled = true;
      ui.cargando(true);

      await sesion.registrar({
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        correo: inputCorreo.value.trim(),
        clave: inputClave.value,
        consentimiento: true
      });

      sessionStorage.setItem(
        'aviso_pendiente',
        JSON.stringify({ texto: '¡Bienvenido! Tu cuenta ha sido creada exitosamente.', tipo: 'exito' })
      );

      window.location.href = '/index.html';
    } catch (error) {
      ui.aviso(error.message || 'Error al procesar el registro', 'error');
      btnRegistro.disabled = false;
      ui.cargando(false);
    }
  });
}
