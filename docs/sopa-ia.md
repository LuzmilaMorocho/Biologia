# Sopa de letras con IA

En la sopa de letras, el estudiante puede pulsar **Generar con IA** junto a **Cambiar tema**. La acción inicia una partida con palabras del tema seleccionado y de sus objetivos, resumen, ejemplos y palabras clave. También está disponible cuando no hay términos jugables en el glosario.

El botón usa `api.ia('sopa-letras', { temaId, dificultad, excluir })`. No solicita una clave o modelo al estudiante: `ejecutarTarea()` utiliza la configuración privada guardada por el administrador, con el mismo proveedor, plazo máximo, reintento JSON y bitácora de conteos existentes.

## Permisos y contexto

- `POST /api/ia/sopa-letras` exige sesión de estudiante, matrícula en la asignatura, tema publicado y unidad visible. Rechaza instrucciones, contexto o modelos enviados por el navegador.
- `servidor/preparadores/sopa-letras.js` arma el contexto desde los JSON del servidor; incluye solo el glosario aprobado del tema y recorta el contenido a 5.700 caracteres. No consulta recursos externos, archivos PDF ni temas de otras unidades.
- El esquema exige al menos tres palabras distintas, entre tres letras y el tamaño del tablero: fácil 10, media 12 y difícil 15. Admite hasta 8, 10 o 12 palabras respectivamente.
- Cada término debe ser una palabra completa presente en una cita literal del contenido. Se validan duplicados y exclusiones mediante `normalizar()`, conservando la ñ y unificando tildes y mayúsculas. Estas comprobaciones acotan las palabras al material disponible; las definiciones siguen siendo propuestas de IA.
- La generación usa `ajustes.limiteIADiario`. El tutor conserva su cupo independiente. No se amplían los permisos de `generar-glosario` ni de escritura del glosario.

## Partidas y errores

Las palabras generadas son temporales y no crean registros en el glosario compartido ni pasan a otros juegos. Se conservan las retroalimentaciones, el resumen y el registro de intentos del juego existente; los puntos siguen calculándose en el servidor.

Durante la página abierta se recuerdan, por tema, hasta 200 palabras realmente incluidas en los tableros. La siguiente petición las excluye. Al recargar la página se descarta ese historial y se vuelve al glosario aprobado. Como el contenido y la longitud de las palabras son finitos, no se garantiza una cantidad ilimitada de partidas distintas: si la IA indica que no quedan tres palabras válidas, la API devuelve 409 con una invitación a cambiar de dificultad o tema.

Una solicitud bloquea temporalmente los controles y pausa el cronómetro. Si falla la conexión, el cupo o la validación, conserva tablero y aciertos, y reanuda el tiempo descontando la espera. Si ya hay aciertos, se confirma el reinicio antes de consumir IA. El estado se anuncia con `role="status"`, se restaura el foco al botón y el HTML de los contenidos se escapa.

## Verificación

`node --test pruebas/sopa-ia.test.js pruebas/sopa-pagina.test.js`

Las pruebas usan datos temporales, proveedor Gemini simulado y DOM mínimo. Comprueban permisos, contenido autorizado, configuración del administrador, formato, citas, exclusiones, errores, cupos, integridad del glosario, inicio sin palabras, doble envío, cancelación y conservación de partida y tiempo. No consumen la API real. La revisión visual y la prueba con la clave real se realizan desde el navegador.
