// Módulo de verificación pública de certificados (P05.2)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Verificar Certificado', roles: ['publico'] });

const contenido = document.getElementById('contenido');

function renderizarFormulario(codigoInicial = '') {
  if (!contenido) return;

  contenido.innerHTML = `
    <div class="verificar-contenedor">
      <header class="verificar-cabecera pila" style="gap: var(--espaciado-xs);">
        <h1 style="color: var(--color-primario); margin: 0;">Verificación de Autenticidad</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-m); margin: 0;">
          Consulta y valida la autenticidad de diplomas y certificados expedidos por el Ecosistema Educativo Digital.
        </p>
      </header>

      <div class="verificar-formulario-tarjeta">
        <form id="form-verificar" class="pila" style="gap: var(--espaciado-xs);" novalidate>
          <label for="codigo-certificado" style="font-size: var(--tamano-s); font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            Código del certificado (ej. EE-2026-X7K9P2)
          </label>
          <div class="verificar-input-grupo">
            <input type="text"
                   id="codigo-certificado"
                   name="codigo"
                   value="${ui.escapar(codigoInicial)}"
                   placeholder="EE-AAAA-XXXXXX"
                   required
                   autocomplete="off"
                   spellcheck="false" />
            <button type="submit" class="btn btn--primario" id="btn-consultar">
              Verificar
            </button>
          </div>
        </form>
      </div>

      <!-- Contenedor del resultado de la verificación -->
      <div id="resultado-verificacion" aria-live="polite"></div>
    </div>
  `;

  const form = document.getElementById('form-verificar');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('codigo-certificado');
    const codigo = input?.value.trim() || '';
    if (!codigo) {
      ui.aviso('Por favor ingresa un código de certificado', 'advertencia');
      input?.focus();
      return;
    }

    // Actualizar URL sin recargar para facilitar compartir el enlace
    const url = new URL(window.location.href);
    url.searchParams.set('codigo', codigo);
    window.history.replaceState({}, '', url.toString());

    await realizarVerificacion(codigo);
  });
}

async function realizarVerificacion(codigo) {
  const contenedorResultado = document.getElementById('resultado-verificacion');
  if (!contenedorResultado) return;

  ui.cargando(true);
  try {
    const respuesta = await api.llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

    if (respuesta && respuesta.valido) {
      const fechaTexto = respuesta.fecha ? util.fechaLarga(respuesta.fecha) : 'Fecha registrada';

      contenedorResultado.innerHTML = `
        <article class="tarjeta-resultado-valido" role="region" aria-label="Resultado: Certificado Válido">
          <div class="fila" style="align-items: center; gap: var(--espaciado-m);">
            <div class="resultado-icono" aria-hidden="true">✅</div>
            <div>
              <span class="insignia insignia--exito" style="font-size: var(--tamano-xs);">Documento Auténtico</span>
              <h2 style="color: var(--color-exito); margin: var(--espaciado-xs) 0 0; font-size: var(--tamano-xl);">
                Certificado Válido
              </h2>
            </div>
          </div>

          <p style="font-size: var(--tamano-s); color: var(--color-texto); line-height: var(--interlineado-base); margin: 0;">
            El presente certificado ha sido verificado con éxito en los registros oficiales del Ecosistema Educativo Digital.
          </p>

          <div class="pila" style="gap: var(--espaciado-s); margin-top: var(--espaciado-s);">
            <div class="resultado-campo">
              <span class="resultado-campo__etiqueta">Otorgado a</span>
              <strong class="resultado-campo__valor" style="font-size: var(--tamano-l); color: var(--color-primario);">
                ${ui.escapar(respuesta.nombreCompleto)}
              </strong>
            </div>

            <div class="resultado-campo">
              <span class="resultado-campo__etiqueta">Mérito o Acreditación</span>
              <span class="resultado-campo__valor">
                ${ui.escapar(respuesta.detalle)}
              </span>
            </div>

            <div class="resultado-campo">
              <span class="resultado-campo__etiqueta">Fecha de expedición</span>
              <span class="resultado-campo__valor">
                ${ui.escapar(fechaTexto)}
              </span>
            </div>

            <div class="resultado-campo">
              <span class="resultado-campo__etiqueta">Código de registro</span>
              <span class="resultado-campo__valor" style="font-family: monospace; letter-spacing: 0.05em;">
                ${ui.escapar(codigo.toUpperCase())}
              </span>
            </div>
          </div>
        </article>
      `;
    } else {
      contenedorResultado.innerHTML = `
        <article class="tarjeta-resultado-invalido" role="region" aria-label="Resultado: Certificado no válido">
          <div class="resultado-icono" aria-hidden="true">❌</div>
          <h2 style="color: var(--color-error); margin: 0; font-size: var(--tamano-xl);">
            Certificado no encontrado
          </h2>
          <p style="font-size: var(--tamano-s); color: var(--color-texto); line-height: var(--interlineado-base); margin: 0;">
            El código "<strong>${ui.escapar(codigo.toUpperCase())}</strong>" no coincide con ningún certificado emitido o registrado en la plataforma.
          </p>
          <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">
            Verifica que los caracteres hayan sido ingresados correctamente tal como constan en el documento.
          </p>
        </article>
      `;
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al conectar con el servicio de verificación', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function iniciar() {
  const codigoUrl = util.parametro('codigo') || '';
  renderizarFormulario(codigoUrl);

  if (codigoUrl) {
    await realizarVerificacion(codigoUrl);
  }
}

iniciar();

