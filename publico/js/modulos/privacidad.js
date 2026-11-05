import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: 'Aviso de Privacidad', roles: ['publico'] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <article class="tarjeta pila privacidad-seccion">
      <header class="pila">
        <span class="insignia insignia--acento">UNEMI · Marco Legal LOPDP</span>
        <h1>Aviso de Privacidad y Tratamiento de Datos Personales</h1>
        <p>
          En cumplimiento con la <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> de la República del Ecuador,
          la Universidad Estatal de Milagro (UNEMI) informa a la comunidad educativa sobre las políticas aplicables a este entorno digital.
        </p>
      </header>

      <section class="pila">
        <h2>1. Finalidad del Tratamiento</h2>
        <p>
          Los datos personales recabados en el Ecosistema Educativo Digital son utilizados exclusivamente para la gestión académica,
          la evaluación diagnóstica y formativa de competencias digitales, el seguimiento del aprendizaje mediante tutoría inteligente
          y la emisión de certificaciones o diplomas de aprobación.
        </p>

        <h2>2. Datos Personales Tratados</h2>
        <ul style="padding-left: var(--espaciado-l); line-height: var(--interlineado-base);">
          <li><strong>Identificación:</strong> Nombres y apellidos completos.</li>
          <li><strong>Contacto:</strong> Dirección de correo electrónico institucional o personal.</li>
          <li><strong>Actividad en la plataforma:</strong> Registro de sesiones, avance temático, respuestas en actividades, puntajes y eventos en bitácora.</li>
        </ul>

        <h2>3. Derechos del Titular</h2>
        <p>
          Conforme a la LOPDP, usted cuenta con el derecho de acceder a su información personal, solicitar la rectificación de datos inexactos,
          la actualización o la eliminación de aquellos que no sean indispensables para el cumplimiento de las obligaciones educativas y legales.
        </p>

        <h2>4. Contacto y Consultas</h2>
        <p>
          Para ejercer sus derechos o resolver dudas relacionadas con el tratamiento de su información, puede comunicarse con el equipo responsable a través del correo de contacto:
        </p>
        <div class="alerta alerta--info">
          <strong>Correo de contacto:</strong> privacidad@unemi.edu.ec
        </div>
      </section>

      <footer class="fila" style="margin-top: var(--espaciado-l);">
        <a href="/paginas/registro.html" class="btn btn--primario">Volver al Registro</a>
        <a href="/index.html" class="btn btn--secundario">Ir al Inicio</a>
      </footer>
    </article>
  `;
}
