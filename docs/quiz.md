# P08.2 · Motor del quiz

Las cuatro rutas requieren una sesión de estudiante y acceso a un tema publicado, de una unidad visible y una asignatura asignada. No se modificó `server.js`: las rutas se cargan automáticamente al iniciar.

## Estado e inicio

- `GET /api/quiz/estado?temaId=ID` devuelve los cinco niveles (Recordar, Comprender, Aplicar, Analizar, Evaluar), su estado y el mejor porcentaje de los intentos o sesiones finalizadas del estudiante. Los niveles aprobados pueden repetirse; el siguiente al máximo aprobado está disponible. El nivel 1 puede iniciarse siempre que haya banco suficiente.
- `POST /api/quiz/iniciar` recibe `{ "temaId": "ID", "nivel": 1 }`. Valida el desbloqueo y selecciona `quiz.preguntasPorNivel` preguntas aprobadas y válidas. Prioriza las no vistas y completa con las de exposición más antigua, considerando la última sesión donde apareció cada pregunta.
- Si faltan preguntas no vistas, notifica a los docentes de los grupos del estudiante para esa asignatura. Se deduplica por docente, tema, nivel y día de Ecuador usando las notificaciones persistidas; también se controla la concurrencia entre estudiantes.
- Si el total del banco aprobado no alcanza, devuelve 409 y no crea una sesión incompleta ni repite una pregunta dentro del mismo quiz.
- Al iniciar solo se devuelve `{ sesionId, preguntas: [{ id, tipo, enunciado, opciones }] }`. No se envían respuestas correctas ni retroalimentaciones.

## Respuesta y cierre

- `POST /api/quiz/responder` recibe `{ "sesionId": "ID", "preguntaId": "ID", "respuesta": 0 }`. Para opción múltiple, la respuesta es un índice entero de 0 a 3; para vf, un booleano; para completar, texto. Reutiliza `normalizar()` del núcleo para comparar texto, conservando la diferencia entre N y Ñ.
- Solo se puede responder una vez cada pregunta asignada. Una respuesta duplicada, una sesión cerrada o en proceso de cierre devuelve 409. La respuesta devuelve `{ correcto, retroalimentacion, correcta }`; `correcta` siempre es texto.
- `POST /api/quiz/finalizar` recibe `{ "sesionId": "ID" }`. Las preguntas sin responder cuentan como errores y sus retroalimentaciones se incluyen en `repasar`. Devuelve porcentaje con dos decimales, aprobado, aciertos, total, repasar, puntosGanados e insigniasNuevas.
- El umbral se compara sin redondear y se aprueba al alcanzarlo exactamente. Se conserva el umbral vigente al inicio de la sesión.
- Si aprueba, se actualiza primero el máximo de `logros.nivelQuiz[temaId]`. Luego, en aprobados y reprobados, se llama al motor existente `procesarIntento`. Se mantienen sus reglas de puntos únicos, bonificaciones e insignias.
- Repetir la finalización devuelve el resultado ya guardado sin generar otro intento ni asignar puntos de nuevo. Dos solicitudes simultáneas del estudiante se serializan.

## Datos privados y consistencia

`quiz-sesiones` solo permite leer y escribir al servidor. Además de los campos del contrato, conserva `preguntas` (copia privada con las claves y retroalimentaciones), `porcentajeAprobacion`, `cerrando` y `resultado`. La copia evita que una modificación o eliminación posterior en el banco cambie la corrección de una sesión iniciada.

El detalle del intento añade `quizSesionId` a `aprobado` para identificar su origen. El motor conserva `resultadoGamificacion` en ese intento y lo reutiliza si hay que completar un cierre que ya fue puntuado. Si detecta un intento parcialmente procesado sin ese resultado, devuelve 503 y requiere revisión en vez de asignar puntos nuevamente.

La ruta pública `/api/intentos` rechaza la actividad quiz para impedir puntajes y desbloqueos enviados por el navegador. La gamificación se serializa por usuario para conservar los aportes de actividades concurrentes. El almacén reintenta bloqueos temporales de Windows/OneDrive al reemplazar archivos, conservando la escritura mediante temporal y rename.

## Cómo probar

Ejecutar `node --test pruebas/quiz.test.js`: 19 pruebas aprobadas, incluyendo el grupo principal. La suite completa `node --test pruebas/quiz.test.js pruebas/quiz-pagina.test.js pruebas/ia.test.js pruebas/preguntas.test.js pruebas/configuracion-ia.test.js` pasó 55 pruebas. Se usan copias temporales, sesiones ficticias y proveedores simulados; no se modifican datos de producción ni se consume IA real.

Para probar manualmente, reiniciar con `npm start`, preparar al menos `preguntasPorNivel` preguntas aprobadas del tema/nivel e ingresar como estudiante asignado.

## P08.3 · Página y diplomas

La actividad **Quiz por niveles** del catálogo abre `/paginas/quiz.html`. Acepta `?temaId=ID` o usa `obtenerTemaActividad()` para seleccionar tema. Solo se inicia para estudiantes. Cinco tarjetas muestran nombre de Bloom, estado y mejor porcentaje enviados por el servidor. Los niveles bloqueados no permiten iniciar; los aprobados permiten repetir y descargar nuevamente el diploma.

Cada sesión presenta una sola pregunta: radios con etiquetas amplias para opción múltiple, dos botones con `aria-pressed` para verdadero/falso y un campo de texto para completar. El progreso refleja respuestas confirmadas. El estudiante debe responder antes de avanzar; los controles quedan bloqueados durante el envío y después de recibir la retroalimentación. La corrección usa únicamente `/api/quiz/responder` y `mostrarRetro()`.

La última pregunta lleva a `/api/quiz/finalizar` y `mostrarResumen()` con el porcentaje y las ideas para repasar. El resultado permanece en pantalla. Al aprobar, se llama a `mostrarLogros(resultado)` y se habilita **Descargar diploma**, que reutiliza `generarDiploma({ tipo: 'nivel-quiz', temaId, nivel })`. Si no aprueba, **Reintentar** solicita otra sesión al servidor; este aplica la selección de preguntas no vistas y la reutilización prevista en P08.2. **Ver niveles** refresca la progresión desde el servidor.

Los errores de inicio/envío/cierre/descarga se muestran en la página y los controles vuelven a habilitarse. Hay una advertencia del navegador si se intenta salir durante una sesión sin finalizar. Los textos del banco y de las respuestas se escapan con el núcleo. El CSS usa tokens, cuadrícula adaptable y controles de teclado; la revisión visual a 360 px queda pendiente porque el acceso al navegador no estuvo disponible.

`pruebas/quiz-pagina.test.js` ejecuta el módulo real con dobles DOM y del núcleo; sus cuatro pruebas cubren tarjetas, tipos de respuesta (incluido false), avance, bloqueo de doble envío, resumen, llamadas al diploma, reintentos y errores. No comprueban el diseño ni la descarga PDF real. Las pruebas HTTP adicionales comprueban que el diploma exige aprobación, conserva el mismo código al solicitarlo otra vez y puede verificarse públicamente. Se rechazan niveles no enteros o fuera de 1–5 para evitar certificados con niveles inválidos.

## Banco de Biología completado · 2026-11-04

La configuración activa exige 10 preguntas aprobadas por partida. El banco tenía únicamente 10 preguntas de recursos naturales: cinco en Recordar y cinco en Analizar. Biodiversidad no tenía preguntas. Esto provocaba el mensaje de banco insuficiente al iniciar.

Se añadieron 200 preguntas, 20 por tema y nivel, redactadas con base en los contenidos activos de `datos/temas.json`. Las 10 preguntas anteriores conservan íntegros sus registros. El banco contiene ahora 210 preguntas aprobadas:

| Tema | Recordar | Comprender | Aplicar | Analizar | Evaluar | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Recursos naturales | 25 | 20 | 20 | 25 | 20 | 110 |
| Biodiversidad | 20 | 20 | 20 | 20 | 20 | 100 |

Las preguntas nuevas incluyen opción múltiple, verdadero/falso y completar. En Evaluar se utilizan decisiones entre alternativas y valoraciones de afirmaciones; los niveles anteriores incorporan también completar. Las respuestas de opción múltiple se distribuyen entre las cuatro posiciones. Los ejercicios de completar incluyen indicaciones o palabras candidatas cuando resultaría ambiguo exigir un único sinónimo.

La cobertura de recursos naturales incluye origen y transformación, importancia, renovación, recursos fósiles y minerales, energía solar y viento, ciclo del agua, cuencas, erosión, reciclaje y decisiones de uso sostenible. Biodiversidad incluye los tres niveles, hábitat y redes alimentarias, polinización y descomposición, beneficios y valores, amenazas, especies nativas/endémicas/invasoras, conservación in situ/ex situ, restauración y observación del entorno.

Los niveles nuevos progresan desde identificación y comprensión hacia situaciones prácticas, análisis de relaciones y evaluación con criterios. Se registraron con origen `ia` y estado `aprobado` para habilitar la actividad solicitada. La elaboración se hizo desde el asistente y los materiales locales, sin llamadas a la API configurada ni consumo de su cuota. Cada pregunta tiene retroalimentación y utiliza los formatos existentes del motor.

Se guardó el banco anterior en `datos/respaldos/quiz-biologia-2026-11-04T16-39-17-291Z/preguntas.json`. La colección sigue siendo privada para el estudiante: el inicio de sesión entrega únicamente id, tipo, enunciado y opciones; las respuestas se revelan por la ruta de corrección existente.

Verificación: `node --test pruebas/quiz-contenidos.test.js pruebas/quiz.test.js pruebas/quiz-pagina.test.js`, 29 pruebas aprobadas. Con una copia del banco real y sesiones ficticias se completaron los cinco niveles de ambos temas, dos partidas por nivel sin preguntas repetidas entre ellas, progresión y emisión de diploma. Se comprobó también que el estudiante no accede al banco completo. Los puntos, intentos, sesiones y diplomas de esa prueba se crearon en un directorio temporal, no en los datos del estudiante real. La revisión visual y la descarga PDF desde el navegador mantienen la limitación descrita arriba.

Para probar desde la plataforma basta con recargar el quiz y pulsar **Iniciar nivel**. Los niveles posteriores siguen desbloqueándose al aprobar el anterior con el umbral configurado, 70 %; no se otorgan aprobaciones automáticamente.

## Revisión P08.3 · 2026-11-04

Se contrastaron la página, sus módulos y el catálogo con §A y §C del contrato. Se mantiene el acceso de estudiante, el selector del núcleo, las cinco tarjetas con datos de estado, las preguntas una a una con sus tres tipos, progreso, retroalimentación, resumen con porcentaje e ideas para repasar, reintento, logros y descarga del diploma por tema y nivel. La entrada del catálogo coincide con el id, texto, descripción y enlace solicitados.

Al aprobar se consulta `logrosDe()` y se entrega su total de puntos a `mostrarLogros(resultado)`, de modo que el indicador del encabezado se actualice con el valor calculado por el servidor. Si falla esa consulta complementaria se conserva la aprobación y la disponibilidad del diploma. El registro del intento continúa a cargo del cierre del servidor.

La descarga permite reintentar sobre el mismo tema y nivel, limpia el error del intento anterior y devuelve el foco al botón. La cuadrícula utiliza un mínimo menor, definido con los tokens existentes, para dar cabida a las cinco tarjetas cuando el espacio lo permite y conservar el ajuste a pantallas estrechas. La página tiene título HTML y versiones de sus recursos para renovar la carga de JS y CSS.

La verificación `node --test pruebas/quiz-pagina.test.js pruebas/quiz.test.js pruebas/quiz-contenidos.test.js` aprobó 35 pruebas. Las diez pruebas de interfaz incluyen los tres tipos de respuesta, progresión, porcentaje del resumen, consulta de puntos, reintento del cierre con la misma sesión, descarga fallida, carga recuperable, cancelación del selector, repetición desde resumen y restricción de otros roles. Las restantes usan servidor y almacenamiento temporal e incluyen los contenidos reales del banco. El flujo de descarga se comprueba con un doble del generador; la revisión visual del PDF y del diseño en navegador sigue pendiente.
