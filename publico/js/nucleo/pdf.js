// Cliente: generación y descarga de diplomas en PDF (§A contratos.md)
import { llamar } from './api.js';
import * as util from './util.js';

// Asegura que la librería jsPDF esté cargada desde CDN si no existe previamente
async function asegurarJsPdf() {
  if (typeof window === 'undefined') {
    throw new Error('jsPDF solo puede ejecutarse en el navegador');
  }

  if (window.jspdf?.jsPDF || window.jsPDF) {
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const scriptExistente = document.querySelector('script[src*="jspdf"]');
    if (scriptExistente) {
      scriptExistente.addEventListener('load', () => {
        resolve(window.jspdf?.jsPDF || window.jsPDF);
      });
      scriptExistente.addEventListener('error', () => {
        reject(new Error('Error al cargar la librería jsPDF'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      resolve(window.jspdf?.jsPDF || window.jsPDF);
    };
    script.onerror = () => {
      reject(new Error('No se pudo cargar jsPDF desde cdnjs'));
    };
    document.head.appendChild(script);
  });
}

// Convierte un color hex a [R, G, B]
function hexToRgb(hex) {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// Genera y descarga el diploma en formato A4 horizontal
export async function generarDiploma({ tipo = 'cumplimiento', temaId = null, nivel = null } = {}) {
  // 1. Solicitar o recuperar el certificado desde la API
  const certificado = await llamar('POST', '/api/certificados', { tipo, temaId, nivel });

  // 2. Cargar jsPDF
  const JsPDFClass = await asegurarJsPdf();
  const doc = new JsPDFClass({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // 3. Obtener colores del design system (tokens.css)
  let rgbPrimario = [0, 46, 69];      // #002e45
  let rgbSecundario = [38, 71, 99];   // #264763
  let rgbAcento = [255, 105, 0];      // #ff6900
  let rgbTexto = [24, 45, 62];        // #182d3e

  if (typeof document !== 'undefined') {
    const estilos = getComputedStyle(document.documentElement);
    const prim = estilos.getPropertyValue('--color-primario').trim();
    const sec = estilos.getPropertyValue('--color-secundario').trim();
    const acento = estilos.getPropertyValue('--color-acento').trim();
    const texto = estilos.getPropertyValue('--color-texto').trim();

    if (prim) rgbPrimario = hexToRgb(prim);
    if (sec) rgbSecundario = hexToRgb(sec);
    if (acento) rgbAcento = hexToRgb(acento);
    if (texto) rgbTexto = hexToRgb(texto);
  }

  // Dimensiones A4 horizontal: 297 mm x 210 mm
  const centroX = 297 / 2;

  // Fondo sutil
  doc.setFillColor(250, 252, 253);
  doc.rect(0, 0, 297, 210, 'F');

  // Marco exterior
  doc.setDrawColor(...rgbPrimario);
  doc.setLineWidth(2.5);
  doc.rect(10, 10, 277, 190);

  // Marco interior fino
  doc.setDrawColor(...rgbAcento);
  doc.setLineWidth(0.8);
  doc.rect(14, 14, 269, 182);

  // Encabezado institucional
  doc.setTextColor(...rgbPrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ECOSISTEMA EDUCATIVO DIGITAL', centroX, 35, { align: 'center' });

  doc.setTextColor(...rgbSecundario);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Plataforma para el Desarrollo de Competencias Digitales', centroX, 43, { align: 'center' });

  // Distintivo de diploma
  doc.setTextColor(...rgbAcento);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CERTIFICADO DE LOGRO', centroX, 60, { align: 'center' });

  doc.setTextColor(...rgbSecundario);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Otorgado con honor a:', centroX, 72, { align: 'center' });

  // Nombre del estudiante
  doc.setTextColor(...rgbPrimario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(certificado.nombreCompleto || 'Estudiante', centroX, 88, { align: 'center' });

  // Línea decorativa bajo el nombre
  doc.setDrawColor(...rgbAcento);
  doc.setLineWidth(0.6);
  doc.line(65, 93, 232, 93);

  // Detalle del mérito o acreditación
  doc.setTextColor(...rgbTexto);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  const textoDetalle = certificado.detalle || 'Por haber demostrado excelencia y dedicación en sus actividades académicas.';
  const lineasDetalle = doc.splitTextToSize(textoDetalle, 210);
  doc.text(lineasDetalle, centroX, 108, { align: 'center' });

  // Fecha de expedición
  const fechaTexto = certificado.fecha ? util.fechaLarga(certificado.fecha) : '2026';
  doc.setTextColor(...rgbSecundario);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Milagro, Ecuador · Emitido el ${fechaTexto}`, centroX, 142, { align: 'center' });

  // Firmas simbólicas
  doc.setDrawColor(...rgbPrimario);
  doc.setLineWidth(0.4);
  doc.line(40, 165, 110, 165);
  doc.line(187, 165, 257, 165);

  doc.setFontSize(9);
  doc.setTextColor(...rgbSecundario);
  doc.text('Docente Tutor / Coordinación', 75, 170, { align: 'center' });
  doc.text('Ecosistema Educativo Digital', 222, 170, { align: 'center' });

  // Código y verificación
  const urlOrigen = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const urlVerificacion = `${urlOrigen}/paginas/verificar.html?codigo=${encodeURIComponent(certificado.codigo)}`;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...rgbPrimario);
  doc.text(`Código de Certificación: ${certificado.codigo}`, centroX, 185, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...rgbSecundario);
  doc.text(`Verifica la autenticidad en: ${urlVerificacion}`, centroX, 190, { align: 'center' });

  // Descarga del documento PDF
  doc.save(`diploma-${certificado.codigo}.pdf`);

  return { codigo: certificado.codigo };
}

