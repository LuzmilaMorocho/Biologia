import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Mi perfil', roles: ['sesion'] });

const contenido = document.getElementById('contenido');

async function inicializar() {
  if (!contenido) return;

  ui.cargando(true);
  let usuario = sesion.usuarioActual();

  try {
    const usuarioFresco = await api.llamar('GET', '/api/auth/yo');
    if (usuarioFresco) {
      usuario = usuarioFresco;
      sessionStorage.setItem('usuario', JSON.stringify(usuario));
    }
  } catch (error) {
    console.warn('Usando datos de sesión local:', error.message);
  } finally {
    ui.cargando(false);
  }

  const iniciales = (
    (usuario?.nombre?.[0] || '') + (usuario?.apellido?.[0] || 'U')
  ).toUpperCase();
  let fotoActual = usuario?.foto || '';

  contenido.innerHTML = `
    <header class="pila" style="gap: var(--espaciado-xs); margin-bottom: var(--espaciado-m);">
      <h1>Mi perfil</h1>
      <p>Administra tu información personal, tu avatar y tus credenciales de acceso.</p>
    </header>

    <div class="perfil-grid">
      <!-- Tarjeta de Foto y Resumen -->
      <aside class="tarjeta perfil-avatar-seccion">
        <div class="perfil-avatar-marco" id="marco-avatar">
          ${
            fotoActual
              ? `<img src="${fotoActual}" alt="Foto de perfil de ${ui.escapar(usuario.nombre)}" class="perfil-avatar-img" id="img-avatar">`
              : `<span class="perfil-avatar-placeholder" id="placeholder-avatar">${iniciales}</span>`
          }
        </div>

        <div class="pila" style="gap: var(--espaciado-xs);">
          <h2 style="font-size: var(--tamano-l); margin: 0;">${ui.escapar(usuario.nombre)} ${ui.escapar(usuario.apellido)}</h2>
          <div>
            <span class="insignia insignia--acento">${ui.escapar(usuario.rol)}</span>
          </div>
          <span style="font-size: var(--tamano-s); color: var(--color-texto); opacity: 0.8;">${ui.escapar(usuario.correo)}</span>
        </div>

        <div style="width: 100%;">
          <input type="file" id="input-foto" accept="image/jpeg,image/png,image/webp" class="sr-only">
          <label for="input-foto" class="btn btn--secundario btn--pequeno" style="width: 100%; cursor: pointer;">
            Cambiar foto de perfil
          </label>
          <span class="campo__error oculto" id="error-foto" style="margin-top: var(--espaciado-xs); display: block;"></span>
        </div>
      </aside>

      <!-- Formularios de Información y Contraseña -->
      <div class="pila" style="gap: var(--espaciado-l);">
        <!-- Formulario Datos Personales -->
        <section class="tarjeta pila">
          <header class="pila" style="gap: var(--espaciado-xs);">
            <h2>Datos personales</h2>
            <p style="font-size: var(--tamano-s);">Actualiza tu nombre y apellido visibles en la plataforma.</p>
          </header>

          <form id="form-perfil" class="pila" novalidate>
            <div class="campo">
              <label for="campo-nombre">Nombre *</label>
              <input type="text" id="campo-nombre" name="nombre" value="${ui.escapar(usuario.nombre || '')}" required autocomplete="given-name">
              <span class="campo__error oculto" id="error-nombre"></span>
            </div>

            <div class="campo">
              <label for="campo-apellido">Apellido *</label>
              <input type="text" id="campo-apellido" name="apellido" value="${ui.escapar(usuario.apellido || '')}" required autocomplete="family-name">
              <span class="campo__error oculto" id="error-apellido"></span>
            </div>

            <div class="campo">
              <label for="campo-correo">Correo electrónico</label>
              <input type="email" id="campo-correo" value="${ui.escapar(usuario.correo || '')}" disabled>
              <small style="font-size: var(--tamano-xs); color: var(--color-texto); opacity: 0.7;">El correo institucional no puede ser modificado directamente.</small>
            </div>

            <div>
              <button type="submit" class="btn btn--primario" id="btn-guardar-perfil">
                Guardar cambios
              </button>
            </div>
          </form>
        </section>

        <!-- Formulario Cambio de Contraseña -->
        <section class="tarjeta pila">
          <header class="pila" style="gap: var(--espaciado-xs);">
            <h2>Seguridad y contraseña</h2>
            <p style="font-size: var(--tamano-s);">Cambia tu contraseña para mantener tu cuenta protegida.</p>
          </header>

          <form id="form-clave" class="perfil-campos-clave" novalidate>
            <div class="campo">
              <label for="campo-clave-actual">Contraseña actual *</label>
              <input type="password" id="campo-clave-actual" name="actual" placeholder="Tu contraseña actual" required autocomplete="current-password">
              <span class="campo__error oculto" id="error-clave-actual"></span>
            </div>

            <div class="campo">
              <label for="campo-clave-nueva">Nueva contraseña *</label>
              <input type="password" id="campo-clave-nueva" name="nueva" placeholder="Mínimo 8 caracteres con letras y números" required autocomplete="new-password">
              <span class="campo__error oculto" id="error-clave-nueva"></span>
            </div>

            <div class="campo">
              <label for="campo-clave-repetir">Repetir nueva contraseña *</label>
              <input type="password" id="campo-clave-repetir" name="repetir" placeholder="Vuelve a escribir la nueva contraseña" required autocomplete="new-password">
              <span class="campo__error oculto" id="error-clave-repetir"></span>
            </div>

            <div>
              <button type="submit" class="btn btn--secundario" id="btn-guardar-clave">
                Actualizar contraseña
              </button>
            </div>
          </form>
        </section>

        <!-- Sección de Logros vacía (Sprint 5) -->
        <section id="logros"></section>
      </div>
    </div>
  `;

  // Elementos del DOM
  const formPerfil = document.getElementById('form-perfil');
  const inputNombre = document.getElementById('campo-nombre');
  const inputApellido = document.getElementById('campo-apellido');
  const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
  const errorNombre = document.getElementById('error-nombre');
  const errorApellido = document.getElementById('error-apellido');

  const inputFoto = document.getElementById('input-foto');
  const errorFoto = document.getElementById('error-foto');
  const marcoAvatar = document.getElementById('marco-avatar');

  const formClave = document.getElementById('form-clave');
  const inputClaveActual = document.getElementById('campo-clave-actual');
  const inputClaveNueva = document.getElementById('campo-clave-nueva');
  const inputClaveRepetir = document.getElementById('campo-clave-repetir');
  const btnGuardarClave = document.getElementById('btn-guardar-clave');
  const errorClaveActual = document.getElementById('error-clave-actual');
  const errorClaveNueva = document.getElementById('error-clave-nueva');
  const errorClaveRepetir = document.getElementById('error-clave-repetir');

  function mostrarError(elError, elInput, mensaje) {
    if (mensaje) {
      elError.textContent = mensaje;
      elError.classList.remove('oculto');
      if (elInput?.setAttribute) elInput.setAttribute('aria-invalid', 'true');
      return false;
    } else {
      elError.textContent = '';
      elError.classList.add('oculto');
      if (elInput?.removeAttribute) elInput.removeAttribute('aria-invalid');
      return true;
    }
  }

  // Subida de foto
  inputFoto?.addEventListener('change', async () => {
    const archivo = inputFoto.files?.[0];
    if (!archivo) return;

    mostrarError(errorFoto, inputFoto, null);

    const tiposValidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposValidos.includes(archivo.type)) {
      mostrarError(errorFoto, inputFoto, 'Solo se permiten imágenes JPG, PNG o WEBP');
      inputFoto.value = '';
      return;
    }

    if (archivo.size > 2 * 1024 * 1024) {
      mostrarError(errorFoto, inputFoto, 'La imagen supera el límite de 2 MB');
      inputFoto.value = '';
      return;
    }

    try {
      ui.cargando(true);
      const respuesta = await api.subir(archivo);
      if (respuesta && respuesta.url) {
        fotoActual = respuesta.url;
        marcoAvatar.innerHTML = `<img src="${fotoActual}" alt="Foto de perfil" class="perfil-avatar-img" id="img-avatar">`;
        ui.aviso('Foto subida con éxito. Guarda los cambios para conservarla.', 'info');
      }
    } catch (err) {
      mostrarError(errorFoto, inputFoto, err.message || 'Error al subir imagen');
    } finally {
      ui.cargando(false);
      inputFoto.value = '';
    }
  });

  // Guardar datos del perfil
  formPerfil?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombreVal = inputNombre.value.trim();
    const apellidoVal = inputApellido.value.trim();

    let esValido = true;
    if (!nombreVal) {
      mostrarError(errorNombre, inputNombre, 'El nombre es obligatorio');
      esValido = false;
    } else {
      mostrarError(errorNombre, inputNombre, null);
    }

    if (!apellidoVal) {
      mostrarError(errorApellido, inputApellido, 'El apellido es obligatorio');
      esValido = false;
    } else {
      mostrarError(errorApellido, inputApellido, null);
    }

    if (!esValido) return;

    try {
      btnGuardarPerfil.disabled = true;
      ui.cargando(true);

      const actualizado = await api.llamar('PUT', '/api/auth/perfil', {
        nombre: nombreVal,
        apellido: apellidoVal,
        foto: fotoActual || null
      });

      const usuarioSesion = sesion.usuarioActual() || {};
      const usuarioFusionado = { ...usuarioSesion, ...actualizado };
      sessionStorage.setItem('usuario', JSON.stringify(usuarioFusionado));

      ui.aviso('Perfil actualizado correctamente', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar el perfil', 'error');
    } finally {
      btnGuardarPerfil.disabled = false;
      ui.cargando(false);
    }
  });

  // Cambio de contraseña
  formClave?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const actual = inputClaveActual.value;
    const nueva = inputClaveNueva.value;
    const repetir = inputClaveRepetir.value;

    let esValido = true;

    if (!actual) {
      mostrarError(errorClaveActual, inputClaveActual, 'Ingresa tu contraseña actual');
      esValido = false;
    } else {
      mostrarError(errorClaveActual, inputClaveActual, null);
    }

    const regexClave = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!nueva) {
      mostrarError(errorClaveNueva, inputClaveNueva, 'Ingresa la nueva contraseña');
      esValido = false;
    } else if (!regexClave.test(nueva)) {
      mostrarError(errorClaveNueva, inputClaveNueva, 'Debe tener al menos 8 caracteres con letras y números');
      esValido = false;
    } else {
      mostrarError(errorClaveNueva, inputClaveNueva, null);
    }

    if (!repetir) {
      mostrarError(errorClaveRepetir, inputClaveRepetir, 'Confirma la nueva contraseña');
      esValido = false;
    } else if (repetir !== nueva) {
      mostrarError(errorClaveRepetir, inputClaveRepetir, 'Las contraseñas no coinciden');
      esValido = false;
    } else {
      mostrarError(errorClaveRepetir, inputClaveRepetir, null);
    }

    if (!esValido) return;

    try {
      btnGuardarClave.disabled = true;
      ui.cargando(true);

      await api.llamar('POST', '/api/auth/clave', { actual, nueva });

      inputClaveActual.value = '';
      inputClaveNueva.value = '';
      inputClaveRepetir.value = '';

      ui.aviso('Contraseña actualizada correctamente', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al actualizar contraseña', 'error');
    } finally {
      btnGuardarClave.disabled = false;
      ui.cargando(false);
    }
  });

  // Si es estudiante, cargar vitrina de logros y certificado de cumplimiento (P05.3)
  if (usuario?.rol === 'estudiante') {
    await cargarSeccionLogros(usuario);
  }
}

async function cargarSeccionLogros(usuario) {
  const seccionLogros = document.getElementById('logros');
  if (!seccionLogros || usuario?.rol !== 'estudiante') return;

  try {
    const [logros, todasInsignias, estadoCert] = await Promise.all([
      logrosDe('yo').catch(() => ({ puntos: 0, insignias: [] })),
      api.listar('insignias').catch(() => []),
      api.llamar('GET', '/api/certificados/estado').catch(() => ({ condiciones: [], cumple: false }))
    ]);

    const puntosTotales = logros?.puntos || 0;
    const mapaObtenidas = new Map(
      (logros?.insignias || []).map((ins) => [ins.id, ins.fecha])
    );

    // Insignias obtenidas y bloqueadas
    const insigniasHtml = (todasInsignias || []).map((ins) => {
      const fechaObtencion = mapaObtenidas.get(ins.id);
      const estaObtenida = Boolean(fechaObtencion);

      if (estaObtenida) {
        const fechaTexto = util.fechaRelativa(fechaObtencion) || util.fechaLarga(fechaObtencion);
        return `
          <article class="tarjeta-insignia" role="region" aria-label="Insignia obtenida: ${ui.escapar(ins.nombre)}">
            <div class="tarjeta-insignia__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏆')}</div>
            <h4 class="tarjeta-insignia__nombre">${ui.escapar(ins.nombre)}</h4>
            <span class="insignia insignia--exito" style="font-size: 10px; padding: 2px 6px;">Obtenida</span>
            <time class="tarjeta-insignia__fecha">${ui.escapar(fechaTexto)}</time>
          </article>
        `;
      } else {
        return `
          <article class="tarjeta-insignia tarjeta-insignia--bloqueada" role="region" aria-label="Insignia bloqueada: ${ui.escapar(ins.nombre)}">
            <div class="tarjeta-insignia__icono" aria-hidden="true">${ui.escapar(ins.icono || '🔒')}</div>
            <h4 class="tarjeta-insignia__nombre">${ui.escapar(ins.nombre)}</h4>
            <span class="insignia" style="font-size: 10px; padding: 2px 6px; opacity: 0.8;">Bloqueada</span>
            <p class="tarjeta-insignia__desc">${ui.escapar(ins.descripcion || 'Condición pendiente')}</p>
          </article>
        `;
      }
    }).join('');

    // Condiciones para el certificado de cumplimiento
    const condiciones = estadoCert?.condiciones || [];
    const puedeCertificar = Boolean(estadoCert?.cumple);

    const condicionesHtml = condiciones.map((c) => {
      const pct = c.requerido > 0 ? Math.min(100, Math.round((c.actual / c.requerido) * 100)) : 0;
      return `
        <div class="certificado-condicion-item">
          <div class="fila" style="justify-content: space-between; font-size: var(--tamano-s);">
            <span>
              <strong>${ui.escapar(c.nombre)}</strong>: ${c.actual} de ${c.requerido}
            </span>
            <span class="${c.cumple ? 'insignia insignia--exito' : 'insignia'}">
              ${c.cumple ? 'Cumplido ✓' : `${pct}%`}
            </span>
          </div>
          <div class="progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${ui.escapar(c.nombre)}">
            <div class="progreso__barra" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    seccionLogros.innerHTML = `
      <div class="pila" style="gap: var(--espaciado-l);">
        <!-- Puntos Totales -->
        <div class="logros-puntos-tarjeta">
          <div class="pila" style="gap: var(--espaciado-xs);">
            <span style="font-size: var(--tamano-xs); text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">Puntos acumulados</span>
            <h3 style="font-size: var(--tamano-3xl); margin: 0; color: var(--color-texto-inverso); font-weight: var(--peso-extranegrita);">
              ${puntosTotales} <span style="font-size: var(--tamano-m); font-weight: var(--peso-regular);">pts</span>
            </h3>
          </div>
          <div class="fila" style="gap: var(--espaciado-s);">
            <a href="/paginas/actividades.html" class="btn btn--secundario btn--pequeno" style="color: var(--color-texto-inverso); border-color: var(--color-texto-inverso);">
              Ir a actividades →
            </a>
          </div>
        </div>

        <!-- Vitrina de Insignias -->
        <section class="tarjeta pila" style="gap: var(--espaciado-m);" aria-labelledby="titulo-vitrina">
          <header class="pila" style="gap: var(--espaciado-xs);">
            <h3 id="titulo-vitrina" style="color: var(--color-primario); margin: 0;">Vitrina de insignias</h3>
            <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">
              Descubre y desbloquea insignias formativas al completar retos, mantener rachas y alcanzar metas.
            </p>
          </header>

          <div class="logros-vitrina-grid">
            ${insigniasHtml}
          </div>
        </section>

        <!-- Certificado de Cumplimiento -->
        <section class="tarjeta pila" style="gap: var(--espaciado-m);" aria-labelledby="titulo-cert-cumplimiento">
          <header class="pila" style="gap: var(--espaciado-xs);">
            <h3 id="titulo-cert-cumplimiento" style="color: var(--color-primario); margin: 0;">Certificado de cumplimiento</h3>
            <p style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0;">
              Alcanza los tres requisitos académicos para descargar tu diploma oficial emitido por la plataforma.
            </p>
          </header>

          <div class="pila" style="gap: var(--espaciado-m);">
            ${condicionesHtml}
          </div>

          <div style="margin-top: var(--espaciado-s);">
            <button type="button"
                    class="btn btn--primario"
                    id="btn-descargar-cert"
                    ${puedeCertificar ? '' : 'disabled'}>
              ${puedeCertificar ? '🎓 Descargar certificado' : '🔒 Requisitos pendientes'}
            </button>
          </div>
        </section>
      </div>
    `;

    // Vincular botón de descarga
    const btnDescargar = document.getElementById('btn-descargar-cert');
    if (btnDescargar && puedeCertificar) {
      btnDescargar.addEventListener('click', async () => {
        try {
          btnDescargar.disabled = true;
          ui.cargando(true);
          ui.aviso('Generando tu diploma oficial en PDF...', 'info');
          await generarDiploma({ tipo: 'cumplimiento' });
          ui.aviso('Diploma descargado exitosamente', 'exito');
        } catch (err) {
          ui.aviso(err.message || 'Error al generar el certificado', 'error');
        } finally {
          btnDescargar.disabled = false;
          ui.cargando(false);
        }
      });
    }
  } catch (err) {
    console.error('Error al cargar la sección de logros:', err);
  }
}

inicializar();
