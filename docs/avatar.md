# P11.3 · Avatar guía

`publico/js/nucleo/avatar.js` exporta `montarAvatar()`, `decir(texto)` y `cambiarEstado(estado)`. El montaje es único por página y no realiza peticiones a servicios externos. Lumo es un personaje original dibujado en un solo SVG inline de menos de 80 líneas: casco, chispa, libro, ojos, boca y brazos. Los colores proceden de `tokens.css`; tamaños de interfaz, fuentes y espaciado utilizan los tokens del proyecto.

El personaje aparece en la esquina inferior derecha con un globo de texto y controles de teclado. La página reserva espacio inferior para poder desplazar el contenido que quede detrás de la guía. El globo tiene altura limitada, desplazamiento y ajuste de texto; recibe contenido mediante `textContent`, sin interpretar HTML.

## Estados y movimiento

Las clases `avatar-guia--reposo`, `avatar-guia--hablando`, `avatar-guia--pensando` y `avatar-guia--celebrando` controlan ojos, boca y brazos. En reposo parpadea; al hablar mueve la boca y un brazo; al pensar desplaza la mirada y cambia la postura; al celebrar levanta los brazos y da pequeños saltos. Las reglas están al final de `componentes.css`.

La [preferencia de movimiento reducido](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) desactiva animaciones y transiciones, conservando texto, controles y poses estáticas. Los cambios de estado cancelan el temporizador y la lectura anteriores. Los callbacks antiguos no alteran un estado más reciente.

## Voz y preferencias

La voz empieza desactivada. **Activar voz** habilita la [síntesis de voz del navegador](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) y lee el texto actual; **Silenciar** detiene la locución. `decir()` siempre actualiza el globo y solo lee si la voz está activa y la guía visible. Prefiere una voz `es-EC`, después cualquier voz española disponible; si la lista aún está vacía utiliza el idioma `es-EC`. Consulta las voces disponibles en cada lectura, sin fijar la selección inicial para toda la sesión.

Al terminar o fallar la locución vuelve a reposo. Si no se usa voz, la animación de habla dura tres segundos. La ausencia o el fallo de síntesis no impide leer el globo ni usar las actividades. Las voces instaladas y la reproducción automática dependen del navegador y del dispositivo; no se configura un proveedor de voz en el servidor.

**Ocultar** detiene la lectura y muestra **Mostrar guía**, desde donde se puede restaurar. No se reabre automáticamente al recibir una respuesta o una insignia. La clave `avatar-guia-preferencias` de localStorage contiene solo `{ voz, oculto }`, sin textos, historial ni identificadores del estudiante. Si el almacenamiento falla, los controles funcionan en memoria. Al salir de la página se detiene la lectura.

## Integración

`plantilla.js` busca un elemento con `data-avatar`, monta la guía y llama a `decir()` con su valor. Los `<main>` de ahorcado, pareja, sopa de letras, quiz y tutor contienen instrucciones breves. Las preferencias se aplican antes de mostrar o leer esas instrucciones.

No existía crucigrama en el proyecto. Según la elección explícita del usuario, se añadieron `paginas/crucigrama.html`, `css/modulos/crucigrama.css` y `js/modulos/crucigrama.js` como página provisional con avatar y un aviso claro de que el juego está pendiente. Ofrece volver al tema, si la URL incluye `temaId`, o elegir otra actividad. No implementa el juego ni lo anuncia como disponible en el catálogo.

La página del tutor cambia a **pensando** mientras espera la IA y llama a `decir()` con la respuesta recibida. Un error o una conversación nueva devuelve el avatar a reposo. Las respuestas invalidadas por un reinicio no se muestran ni se leen. El componente anterior del tutor por asignatura también utiliza estos hooks cuando existe un avatar, sin montarlo en páginas que no lo declaran.

`mostrarLogros()` conserva los avisos y modales existentes. Si hay una guía y una insignia nueva, activa **celebrando** durante tres segundos. El temporizador solo vuelve a reposo si la guía sigue celebrando, para no interrumpir una pregunta posterior del tutor. Ganar puntos sin insignia no inicia la celebración.

## Validación

`node --test pruebas/avatar.test.js pruebas/tutor-pagina.test.js pruebas/tutor-chat.test.js`

Las pruebas utilizan DOM, voz y temporizadores simulados. Verifican montaje único, presupuesto del SVG, texto seguro, activación y selección de voz, cancelación, preferencias, modo sin almacenamiento o sin voz, restauración con foco, callbacks obsoletos, integración de plantilla, tutor y logros. La revisión visual a 360 px, las animaciones con movimiento reducido y las voces reales en navegador siguen pendientes. No se actualiza ningún ZIP.

Resultado final de P11.3: 227 pruebas aprobadas en la suite completa, sin fallos; incluye diez pruebas nuevas del avatar y comprobaciones de sus hooks en ambos tutores.
