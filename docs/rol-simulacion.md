# P12.4 · Práctica de rol con IA

## Configuración docente

El modo rol de `editor-simulacion.html` permite definir nombre y descripción del personaje, contexto del caso y objetivo del estudiante. La rúbrica tiene de tres a cinco criterios, cada uno con nombre único, descripción y puntos máximos positivos. `maxTurnos` es un entero de cuatro a doce. Los datos se conservan al cambiar entre modos.

`erroresRol()` comparte la validación entre navegador y gancho del servidor. Los borradores admiten campos de texto incompletos; para publicar o previsualizar se requiere la configuración completa. El gancho conserva `puedeEditarAsignatura()` para temas anterior y nuevo. Los errores enlazan al campo correspondiente del editor.

Los límites de texto son 100 caracteres para nombre, 1.000 para descripción y objetivo, 1.800 para contexto, 120 para nombre de criterio y 700 para su descripción. No se añade un proveedor o modelo: se reutiliza la configuración administrativa de IA.

## Conversación y turnos

`simulador.html?id=` presenta el personaje, la situación, el objetivo y la rúbrica. Un turno es un mensaje del estudiante más la respuesta del personaje. El chat conserva en memoria de la página `historial: [{ rol: "estudiante" | "personaje", texto }]`, sin localStorage de conversaciones. Admite textos de hasta 1.000 caracteres, Enter para enviar y Mayús+Enter para nueva línea. La composición IME no envía por accidente.

`servidor/preparadores/rol-simulacion.js` recibe exclusivamente `{ simulacionId, historial }`. Comprueba acceso a la simulación y modo, carga personaje/contexto/objetivo del servidor y exige historial alternado que termine con un mensaje del estudiante. Devuelve personaje (nombre y descripción), contexto, objetivo, historial previo y mensaje final del estudiante. No duplica ese mensaje en el historial del prompt. Rechaza un turno adicional después de `maxTurnos` antes de invocar al proveedor.

`POST /api/ia/rol-simulacion` devuelve `{ respuesta }` de hasta 1.000 caracteres, usando la plantilla de personaje y el cupo `limiteTutorDiario`. La clave y la configuración del modelo permanecen en el servidor. Las rutas fijas y la ruta dinámica con nombre codificado usan el mismo controlador.

Si falla un envío, se conservan el mensaje escrito y los turnos confirmados; no se incrementa el contador de la práctica. El consumo de IA mantiene las reglas habituales del servicio, que pueden contar una consulta fallida enviada al proveedor. Durante una petición no se envía otro turno ni se termina la práctica. El avatar Lumo pasa a pensando y hablando; `decir()` respeta la preferencia de voz existente.

## Evaluación y puntaje

«Terminar» se habilita después del primer turno completado; al alcanzar el máximo se evalúa automáticamente. El preparador `evaluar-rol.js` verifica el mismo acceso y forma personaje, objetivo, rúbrica con descripciones/máximos y transcripción. Solo considera los primeros `maxTurnos` pares. Ambos preparadores acotan cada mensaje y distribuyen el espacio de historial/transcripción para conservar todos los turnos dentro del límite de 6.000 caracteres del servicio.

`POST /api/ia/evaluar-rol` usa JSON y `limiteIADiario`. La respuesta debe contener exactamente los criterios configurados, sin duplicados, con comentarios y puntos entre cero y el máximo de cada criterio. El esquema usa `normalizarEvaluacionRol()`; el controlador recalcula puntaje y máximo desde criterios/rúbrica, sin confiar en las sumas generales propuestas por el modelo. Un JSON o criterios inválidos reciben el reintento habitual antes del error 502.

El informe muestra tabla por criterio, puntos y comentario general con formato seguro, llama a `mostrarRetro()` y permite reintentar un registro fallido conservando la evaluación. La vista previa también conversa y evalúa mediante IA, pero no llama a `registrarIntento()` y no concede puntos.

## Comprobante y privacidad

La evaluación devuelve un `evaluacionId` adicional. El servidor crea `datos/evaluaciones-rol.json` cuando se necesita: comprobantes con ID, fecha, usuarioId, simulacionId, huella de configuración, puntaje y máximo. Es una colección solo servidor; ni estudiante, docente ni admin la leen o escriben mediante la API genérica. No contiene mensajes, transcripciones, nombres, descripciones ni comentarios del modelo.

El navegador registra `{ actividad: "simulacion", temaId, puntaje, maximo, detalle: { simulacionId, modo: "rol", evaluacionId } }`. `/api/intentos` exige un comprobante del mismo usuario y simulación, comprueba que la configuración siga vigente y sustituye puntaje/máximo por los guardados en servidor. Un cliente no puede asignarse puntos mandando cifras inventadas.

El motor de gamificación reutiliza su bloqueo por usuario y guarda `resultadoGamificacion` en intentos de rol para devolver el mismo resultado al reintentar el mismo comprobante, sin crear otro intento ni conceder puntos de nuevo. Se mantienen las reglas generales de premios únicos por simulación. Los comprobantes persisten aunque se reinicie Node.js.

Las evaluaciones simultáneas o reintentos con idéntico usuario, simulación, configuración e historial comparten una promesa/informe durante dos horas en memoria del servidor. Esto evita repetir consumo de IA en un fallo de respuesta de red. El informe completo y sus comentarios no se escriben en el comprobante; las bitácoras de IA siguen guardando solo conteos y metadatos. El chat normal no persiste conversaciones.

## Pruebas

`node --test pruebas/rol-simulacion.test.js pruebas/editor-simulacion.test.js pruebas/simulador-pagina.test.js`

Se comprueban configuración, permisos y publicación, límite de turnos, rúbrica del servidor, rechazo de instrucciones ajenas, errores de proveedor, acotación del contexto, puntajes por criterio, comprobantes propios/ajenos, idempotencia y separación de cuotas. La interfaz verifica edición, mapa existente, chat seguro, evaluación automática y anticipada, errores recuperables, avatar y vista previa sin registro. La API usa Express real con datos temporales y proveedor simulado; la interfaz usa dobles DOM.

La suite completa terminó con 289 pruebas aprobadas, ninguna fallida, el 4 de noviembre de 2026. También aprobaron las comprobaciones de sintaxis y de acceso a datos mediante api.js.

No se modifica `server.js`, no se añaden dependencias y no se actualiza el ZIP. Quedan pendientes la revisión visual real y una conversación/evaluación manual con el modelo configurado por administración.
