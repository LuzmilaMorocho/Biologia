import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Configuración de IA', roles: ['admin'] });

const contenido = document.getElementById('contenido');
let configuracion;
let ocupado = false;
let hayCambios = false;
const sugeridos = [
  { id: 'gemini-3.5-flash-lite', nombre: 'Gemini 3.5 Flash-Lite · rápido y económico', grupo: 'Estables' },
  { id: 'gemini-3.6-flash', nombre: 'Gemini 3.6 Flash · uso general', grupo: 'Estables' },
  { id: 'gemini-3.1-flash-lite', nombre: 'Gemini 3.1 Flash-Lite · ligero', grupo: 'Estables' },
  { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash', grupo: 'Otros modelos' },
  { id: 'gemini-4-argon', nombre: 'Gemini 4 Argon', grupo: 'Otros modelos' }
];

function opcionesModelos(proveedor, actual) {
  const lista = proveedor === 'gemini' ? sugeridos : [];
  const grupos = [...new Set(lista.map((modelo) => modelo.grupo))];
  const adicionales = actual && !lista.some((modelo) => modelo.id === actual)
    ? `<optgroup label="Modelo configurado"><option value="${ui.escapar(actual)}" selected>${ui.escapar(actual)}</option></optgroup>` : '';
  return '<option value="">Selecciona un modelo</option>' + grupos.map((grupo) => `<optgroup label="${grupo}">${lista.filter((modelo) => modelo.grupo === grupo).map((modelo) => `<option value="${modelo.id}" ${actual === modelo.id ? 'selected' : ''}>${modelo.nombre}</option>`).join('')}</optgroup>`).join('') + adicionales;
}

async function iniciar() {
  ui.cargando(true);
  try {
    configuracion = await api.llamar('GET', '/api/admin/ia');
    renderizar();
  } catch (error) {
    contenido.innerHTML = `<section class="tarjeta"><h1>Configuración de IA</h1><p role="alert">${ui.escapar(error.message)}</p><button type="button" class="btn btn--secundario" id="ia-reintentar">Reintentar</button></section>`;
    document.getElementById('ia-reintentar').addEventListener('click', iniciar);
  } finally {
    ui.cargando(false);
  }
}

function renderizar() {
  contenido.innerHTML = `<section class="admin-ia">
    <header><h1>Configuración de IA</h1><p>Configura el proveedor que usarán «Generar con IA» en el glosario y el banco de preguntas.</p></header>
    <form id="form-ia" class="tarjeta pila">
      <div class="campo"><label for="ia-proveedor">Proveedor</label><select id="ia-proveedor" name="proveedor">
        <option value="gemini" ${configuracion.proveedor === 'gemini' ? 'selected' : ''}>Gemini (Google)</option>
        <option value="openai" ${configuracion.proveedor === 'openai' ? 'selected' : ''}>OpenAI</option>
      </select></div>
      <div class="campo"><label for="ia-modelo">Modelo</label><select id="ia-modelo" name="modelo" required aria-describedby="ia-ayuda-modelo">${opcionesModelos(configuracion.proveedor, configuracion.modelo)}</select>
        <p id="ia-ayuda-modelo">Elige una opción del listado. Para tareas de glosario y preguntas puedes empezar con Flash-Lite. La disponibilidad depende de la cuenta, la cuota y la demanda; ningún modelo está garantizado permanentemente.</p>
      </div>
      <div class="campo"><label for="ia-clave">Clave de API completa</label><input id="ia-clave" name="clave" type="password" autocomplete="new-password" spellcheck="false" maxlength="4096" aria-describedby="ia-ayuda-clave">
        <p id="ia-ayuda-clave">La clave guardada no se muestra. Deja este campo vacío para conservarla. Si cambias de proveedor, introduce su clave completa.</p>
      </div>
      <p id="ia-estado-clave" role="status"></p>
      <button type="submit" class="btn btn--primario">Guardar configuración</button>
    </form>
    <section class="tarjeta pila" aria-labelledby="ia-titulo-comprobar">
      <h2 id="ia-titulo-comprobar">Comprobar configuración guardada</h2>
      <p>Guarda los cambios antes de comprobar. La prueba envía una solicitud breve al proveedor y puede consumir cuota.</p>
      <div class="admin-ia__acciones"><button type="button" class="btn btn--secundario" id="ia-listar">Consultar modelos disponibles</button><button type="button" class="btn btn--secundario" id="ia-probar">Probar conexión</button></div>
    </section>
    <p id="ia-resultado" class="admin-ia__resultado" role="status" aria-live="polite"></p>
  </section>`;
  const form = document.getElementById('form-ia');
  const resultado = document.getElementById('ia-resultado');
  const selectorModelo = form.elements.modelo;

  function marcarCambio() {
    hayCambios = true;
    resultado.textContent = 'Hay cambios pendientes de guardar.';
    actualizar();
  }

  function actualizar() {
    const mismoProveedor = form.elements.proveedor.value === configuracion.proveedor;
    document.getElementById('ia-estado-clave').textContent = mismoProveedor && configuracion.claveConfigurada ? 'Hay una clave configurada para este proveedor.' : 'Introduce la clave completa de este proveedor.';
    document.getElementById('ia-listar').disabled = ocupado || hayCambios || !configuracion.claveConfigurada || configuracion.proveedor !== 'gemini';
    document.getElementById('ia-probar').disabled = ocupado || hayCambios || !configuracion.claveConfigurada;
    form.querySelector('button').disabled = ocupado;
  }

  async function operar(accion) {
    if (ocupado) return;
    ocupado = true;
    resultado.textContent = 'Procesando…';
    form.querySelectorAll('input, select').forEach((control) => { control.disabled = true; });
    actualizar();
    ui.cargando(true);
    try {
      await accion();
    } catch (error) {
      resultado.textContent = error.message || 'No se pudo completar la operación.';
    } finally {
      ocupado = false;
      form.querySelectorAll('input, select').forEach((control) => { control.disabled = false; });
      actualizar();
      ui.cargando(false);
    }
  }

  form.addEventListener('input', marcarCambio);
  selectorModelo.addEventListener('change', marcarCambio);
  form.elements.proveedor.addEventListener('change', () => {
    const proveedor = form.elements.proveedor.value;
    selectorModelo.innerHTML = opcionesModelos(proveedor, proveedor === configuracion.proveedor ? configuracion.modelo : proveedor === 'gemini' ? sugeridos[0].id : '');
    form.elements.clave.value = '';
    hayCambios = true;
    actualizar();
  });
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!form.reportValidity()) return;
    const datos = { proveedor: form.elements.proveedor.value, modelo: form.elements.modelo.value.trim(), clave: form.elements.clave.value.trim() };
    operar(async () => {
      configuracion = await api.llamar('PUT', '/api/admin/ia', datos);
      form.elements.clave.value = '';
      form.elements.modelo.value = configuracion.modelo;
      hayCambios = false;
      resultado.textContent = 'Configuración guardada. Se aplicará a las próximas generaciones sin reiniciar el servidor.';
    });
  });
  document.getElementById('ia-probar').addEventListener('click', () => operar(async () => {
    const prueba = await api.llamar('GET', '/api/ia/prueba');
    if (prueba.resultado?.trim() !== 'OK') throw new Error('El proveedor respondió, pero no devolvió OK. Revisa el modelo e intenta nuevamente.');
    resultado.textContent = `Conexión correcta con ${configuracion.proveedor}, modelo ${configuracion.modelo}: OK`;
  }));
  document.getElementById('ia-listar').addEventListener('click', () => operar(async () => {
    const modelos = await api.llamar('GET', '/api/admin/ia/modelos');
    const ids = new Set(modelos.map((modelo) => modelo.id));
    const opcionesConocidas = sugeridos.filter((modelo) => ids.has(modelo.id));
    const otros = modelos.filter((modelo) => !sugeridos.some((sugerido) => sugerido.id === modelo.id));
    const opciones = [...opcionesConocidas, ...otros];
    selectorModelo.innerHTML = '<option value="">Selecciona un modelo</option>' + opciones.map((modelo) => `<option value="${ui.escapar(modelo.id)}" ${modelo.id === configuracion.modelo ? 'selected' : ''}>${ui.escapar(modelo.nombre)} (${ui.escapar(modelo.id)})</option>`).join('');
    if (!ids.has(configuracion.modelo)) {
      selectorModelo.value = '';
      hayCambios = true;
    }
    resultado.textContent = modelos.length ? `${modelos.length} modelos compatibles devueltos por tu clave. Elige uno y guarda si cambias de modelo. Esto no comprueba la capacidad disponible en este momento.` : 'Esta clave no devolvió modelos compatibles con generación de contenido.';
  }));
  actualizar();
}

window.addEventListener('beforeunload', (evento) => {
  if (hayCambios) { evento.preventDefault(); evento.returnValue = ''; }
});
await iniciar();
