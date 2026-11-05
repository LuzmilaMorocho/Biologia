// Utilidades generales para manipulación de datos y formatos en el cliente
import { escapar } from './ui.js';

// Convierte a mayúsculas, elimina tildes y diéresis, conserva la Ñ y retira espacios en los extremos
export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let cadena = String(texto).trim().toUpperCase();
  cadena = cadena.replace(/Ñ/g, '__ENIE__');
  cadena = cadena.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  cadena = cadena.replace(/__ENIE__/g, 'Ñ');
  return cadena;
}

// Algoritmo Fisher-Yates sin mutar el arreglo original
export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Formato de fecha larga en español de Ecuador (ej. 25 de octubre de 2026)
export function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(fecha);
}

// Formato de fecha relativa en español de Ecuador (ej. "hace 5 minutos", "ayer")
export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';

  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });
  const diffMs = fecha.getTime() - Date.now();
  const diffSeg = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSeg / 60);
  const diffHor = Math.round(diffMin / 60);
  const diffDias = Math.round(diffHor / 24);
  const diffSemanas = Math.round(diffDias / 7);
  const diffMeses = Math.round(diffDias / 30);
  const diffAnios = Math.round(diffDias / 365);

  if (Math.abs(diffSeg) < 45) return 'hace un momento';
  if (Math.abs(diffSeg) < 90) return rtf.format(diffSeg, 'second');
  if (Math.abs(diffMin) < 45) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHor) < 22) return rtf.format(diffHor, 'hour');
  if (Math.abs(diffDias) < 7) return rtf.format(diffDias, 'day');
  if (Math.abs(diffDias) < 30) return rtf.format(diffSemanas, 'week');
  if (Math.abs(diffMeses) < 12) return rtf.format(diffMeses, 'month');
  return rtf.format(diffAnios, 'year');
}

// Obtiene el valor de un parámetro de búsqueda en la URL actual
export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get(nombre);
}

// Escapa HTML y convierte **texto** en <strong>, líneas "- " en listas y bloques en párrafos
export function formatoBasico(texto) {
  if (!texto) return '';

  const textoEscapado = escapar(texto).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  const bloques = textoEscapado.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const htmlFinal = bloques.map((bloque) => {
    const lineas = bloque.split('\n');
    const partes = [];
    let listaActual = [];

    for (const linea of lineas) {
      const recortada = linea.trim();
      if (recortada.startsWith('- ')) {
        listaActual.push(`<li>${recortada.slice(2).trim()}</li>`);
      } else {
        if (listaActual.length > 0) {
          partes.push(`<ul>${listaActual.join('')}</ul>`);
          listaActual = [];
        }
        if (recortada) {
          partes.push(recortada);
        }
      }
    }

    if (listaActual.length > 0) {
      partes.push(`<ul>${listaActual.join('')}</ul>`);
    }

    const resultado = [];
    let lineasParrafo = [];

    for (const parte of partes) {
      if (parte.startsWith('<ul>')) {
        if (lineasParrafo.length > 0) {
          resultado.push(`<p>${lineasParrafo.join('<br>')}</p>`);
          lineasParrafo = [];
        }
        resultado.push(parte);
      } else {
        lineasParrafo.push(parte);
      }
    }

    if (lineasParrafo.length > 0) {
      resultado.push(`<p>${lineasParrafo.join('<br>')}</p>`);
    }

    return resultado.join('');
  });

  return htmlFinal.join('');
}
