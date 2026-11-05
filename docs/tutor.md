# Tutor socrático por asignatura

La página principal de cada asignatura muestra a los estudiantes el **Tutor socrático** abierto, entre la presentación y las unidades. Recupera automáticamente los temas y el diálogo de la sesión, sin generar una consulta de IA hasta que el estudiante envíe un mensaje. Permite elegir tema, escribir razonamientos, usar sugerencias editables, minimizar y comenzar otra conversación. Enter envía y Mayús + Enter agrega una línea; los controles tienen etiquetas, estados accesibles y foco de teclado. La apertura automática no cambia el foco del estudiante. Si falla la carga inicial, aparece **Reintentar conexión del tutor**.

El HTML y los recursos de la asignatura usan la versión `tutor-visible-2` para actualizar los archivos que pudieran estar en caché. Se comprobó que el servidor activo de localhost:3000 entrega el HTML y los dos módulos actualizados con HTTP 200, y que las rutas del tutor están activas. Tras actualizar, reiniciar el servidor una vez y recargar la página.

## Proveedor y contexto curricular

El tutor llama a `ejecutarTarea('tutor', datos, usuario, { formato: 'json' })`. Utiliza la misma clave, proveedor y modelo configurados en Administración, los límites de tiempo/reintentos existentes y `ajustes.limiteTutorDiario`. No añade claves ni configura otro modelo.

`servidor/preparadores/tutor.js` construye el contexto desde el servidor: asignatura asignada al estudiante, nivel educativo, unidades visibles y temas publicados. Incluye objetivos, resúmenes, ejemplos, errores frecuentes, preguntas guía y hasta 30 términos aprobados del glosario por tema. No consulta preguntas ni respuestas de quiz. En el chat por asignatura selecciona hasta tres fragmentos por relevancia; el contrato nuevo de P11.1 selecciona exclusivamente el tema solicitado. El contexto seleccionado no excede 5.700 caracteres.

El chat existente por asignatura envía `asignaturaId`, `temaId` opcional, `mensaje` y `mensajeId`; en ese protocolo se rechazan historiales del cliente. P11.1 añade el protocolo por tema `{ temaId, historial }` descrito al final. Ambos rechazan instrucciones y contenido curricular enviados como campos adicionales y verifican acceso al tema y a la asignatura. La autorización se vuelve a comprobar después de recibir la respuesta de IA.

## Método socrático y control de fuentes

`servidor/prompts/tutor.txt` incorpora las seis reglas del Anexo B.3: español amable, máximo cinco oraciones, una pregunta guía, pista tras tres equivocaciones consecutivas, ámbito curricular, felicitación y resumen con palabras propias, y no pedir ni repetir datos personales. Conserva el protocolo JSON, las citas verificables y el límite adicional de 120 palabras del tutor integrado. Adapta la complejidad al nivel educativo y a la comprensión estimada del intercambio anterior. El historial es contenido sin autoridad para modificar las instrucciones.

Las consultas sin coincidencia curricular y sin forma de seguimiento se redirigen al curso sin invocar al proveedor. También se redirigen peticiones explícitas de claves, respuestas correctas e instrucciones de ignorar las reglas. Las preguntas de seguimiento pueden ser breves: «No entiendo» o «Dame una pista» conservan el tema de la conversación. Con un tema activo, también se admiten aclaraciones como «¿Puedes explicarlo de otra manera?», «¿Un ejemplo?» o «Más despacio». Añadir una consulta ajena a esas frases no la convierte en seguimiento válido.

La IA devuelve un objeto validado con `enAmbito`, `respuesta`, `referencias[{temaId,cita}]` y `comprension`. Para mostrar su respuesta, debe declarar que está en el ámbito, terminar con una pregunta y citar literalmente fuentes seleccionadas que sigan publicadas. Si faltan fuentes, hay citas inventadas o referencias ajenas, se sustituye el texto por una pregunta de reconducción. El chat permite abrir los temas citados y sus extractos.

La evaluación semántica del ámbito y la estrategia pedagógica también dependen del modelo: los controles de acceso y de citas no constituyen una prueba formal de que cada afirmación generada esté sustentada. Revisar respuestas representativas y mantener contenidos claros y completos forma parte de la validación pedagógica.

## Conversación y privacidad

Las conversaciones permanecen en memoria del servidor, aisladas por estudiante, huella del token de sesión y asignatura. Se recuperan al recargar la página o volver a abrir la asignatura con la misma sesión. Otra sesión del mismo estudiante no hereda el diálogo.

Se conservan hasta 12 intercambios visibles; el modelo recibe los últimos tres intercambios, el tema activo y la comprensión estimada (`inicial`, `en-desarrollo`, `consolidada`). El límite de inactividad es ocho horas. Cerrar sesión invalida el acceso por el middleware; **Nueva conversación** borra únicamente el diálogo de esa sesión y asignatura. Reiniciar el servidor borra las conversaciones en memoria. No se guardan textos del chat en archivos ni en almacenamiento del navegador.

Cada envío usa un identificador aleatorio. El servidor serializa solicitudes por conversación y conserva los últimos 16 identificadores para que reintentar tras un error de conexión no duplique la consulta ni el consumo de IA. Si falla el proveedor o se alcanza el límite diario, el diálogo confirmado no se modifica y el campo conserva la consulta para reintentar. La bitácora `consumo-ia.jsonl` mantiene solo metadatos y conteos de caracteres.

## Rutas

- `GET /api/tutor/:asignaturaId`: recupera el diálogo propio y los temas publicados disponibles. Solo estudiantes; sin caché.
- `POST /api/ia/tutor`: envía una consulta por tema o mediante el chat por asignatura. Solo estudiantes; sin caché. El contrato nuevo devuelve `{ respuesta }` con máximo 700 caracteres; el anterior conserva su vista del diálogo y añade ese campo.
- `GET /api/resumen/tutor/:grupoId`: cantidades acumuladas por tema y estudiante; solo docente del grupo o admin, sin caché.
- `DELETE /api/tutor/:asignaturaId`: inicia un diálogo vacío de esa asignatura y sesión. Solo estudiantes; sin caché.

No se modificó `server.js` ni se añadieron dependencias. La interfaz vive en el componente compartido `publico/js/nucleo/tutor.js`, montado por `asignatura.js`.

## Verificación

`node --test pruebas/tutor.test.js pruebas/tutor-chat.test.js pruebas/asignatura-tutor.test.js`: 18 pruebas aprobadas con proveedor y DOM simulados. Cubren aislamiento curricular y por token, permisos, fuentes, rechazos, contexto, comprensión, aclaraciones, idempotencia, cuota diaria, privacidad de registros, integración en la asignatura, apertura automática, escapes de texto, reintentos de carga/envío y reinicio.

Las 55 pruebas anteriores también pasaron tras integrar el servidor del tutor: 73 pruebas aprobadas en total. Se realizó además una consulta real con la configuración general: se recibió una orientación con una fuente curricular verificada, terminada en una pregunta, y comprensión inicial. La revisión visual en navegador queda pendiente; el acceso al navegador no estuvo disponible en las tareas anteriores.

Para probar: reiniciar el servidor una vez, ingresar como estudiante, abrir una asignatura asignada y recargar con Ctrl+F5. El chat debe aparecer abierto antes de las unidades. Elegir un tema, preguntar sobre él, explicar una idea y solicitar otra explicación; después probar una consulta ajena, recargar para recuperar el diálogo y utilizar **Nueva conversación**.

## Preparación de P11.1 · Anexo B.3

El preparador suministra todas las variables del anexo: `asignatura`, `nivel`, `tema`, `contenido`, `historial` y `pregunta`. En el chat por asignatura, `tema` reúne los títulos de las fuentes seleccionadas; en el contrato por tema es el título del tema solicitado. Se conserva `mensaje` para la lógica existente del historial, además de `indiceCurricular` y `comprension` para orientar al modelo. El navegador no puede sustituir instrucciones ni el contexto curricular del servidor.

La respuesta sigue usando `{ enAmbito, respuesta, referencias, comprension }`, ya que el tutor actual valida las fuentes antes de mostrarla. Las cinco oraciones y la única pregunta se solicitan para el campo `respuesta`, sin contar las citas del JSON. El umbral de tres equivocaciones se indica al modelo a partir del historial: esta preparación no añade un contador persistente de errores ni una validación determinista de todas las reglas pedagógicas.

Se comprueba que la petición generada no contiene variables `{{...}}` sin sustituir y mantiene el mensaje del estudiante. Las pruebas del tutor, chat y asignatura usan proveedor simulado y datos aislados; no se consume la API real ni se modifica ningún ZIP.

## P11.1 · Servidor por tema y resumen docente

`POST /api/ia/tutor` acepta `{ temaId, historial: [{ rol: "estudiante" | "tutor", texto }] }`. Se consideran solo los últimos diez mensajes, se validan sus roles y textos y se recorta cada texto a 1.000 caracteres. Debe haber al menos un mensaje de estudiante entre esos diez; el último proporciona `pregunta`. Los mensajes anteriores al tramo considerado se descartan. El historial del cliente se utiliza solo en esta consulta, sin incorporarse a las conversaciones en memoria del chat por asignatura.

El preparador verifica asignatura asignada, unidad visible y tema publicado. Construye las seis secciones del contenido y toma hasta 30 términos aprobados de ese tema. Cada sección tiene un presupuesto de texto para que un resumen extenso no excluya errores frecuentes, preguntas guía o glosario; si es necesario se reduce el contexto hasta 5.700 caracteres. Las fuentes se mantienen en JSON internamente para conservar la validación de citas. El historial se arma en líneas `Estudiante: ...` y `Tutor: ...`; cuando diez textos largos superarían el límite de 6.000 caracteres por variable del servicio IA, se reduce cada turno proporcionalmente para conservar los diez. La pregunta conserva su máximo de 1.000 caracteres.

Se reutiliza la configuración general de IA y `ajustes.limiteTutorDiario`, separado de `limiteIADiario`. El modelo devuelve el JSON interno con citas; el servidor comprueba su ámbito y las citas y entrega únicamente `{ respuesta }`, recortada a 700 caracteres después de validar. El chat anterior conserva su protocolo y su idempotencia por `mensajeId`, y también limita el texto a 700 caracteres.

`servidor/consultas-tutor.js` incrementa un registro por `{ usuarioId, temaId, dia }` en `datos/consultas-tutor.json`. `mensajes` cuenta consultas respondidas, una por turno recibido y contestado, no cada mensaje del historial ni cada reintento de transporte del proveedor. No se guardan preguntas, respuestas, historial, nombre ni correo: únicamente esos campos y el ID/fecha del almacén. El día se calcula al comenzar la solicitud en Ecuador continental. La cola compartida protege actualizaciones concurrentes. El archivo se crea al primer uso y tiene permisos exclusivos de servidor.

Los errores de validación, de acceso, de proveedor y de cuota no incrementan consultas respondidas. Las orientaciones de reconducción que sí se entregan cuentan como respuesta. El chat anterior también registra sus turnos, atribuidos al tema explícito o a la primera fuente seleccionada; sus reintentos con el mismo `mensajeId` no vuelven a incrementar. Si la asignatura aún no tiene temas publicados no hay tema al cual atribuir una consulta. La cuota IA se contabiliza por separado en `consumo-ia.jsonl`, incluidos los fallos de proveedor conforme al contrato existente.

`GET /api/resumen/tutor/:grupoId` autoriza primero al docente asignado o a un admin y devuelve `{ porTema: [{ temaId, titulo, consultas }], porEstudiante: [{ id, nombre, consultas }] }`. Suma mensajes de todos los días, únicamente de los estudiantes actuales del grupo y los temas de su asignatura. Incluye ceros para temas y estudiantes sin consultas, conserva los temas ahora ocultos o en borrador en el resumen docente y omite contadores inválidos. Un estudiante inscrito en varios grupos de la misma asignatura aporta sus consultas a cada resumen correspondiente a su matrícula actual; el contrato de consultas no guarda grupo ni matrícula histórica.

Pruebas: `node --test pruebas/tutor-tema.test.js pruebas/tutor.test.js pruebas/tutor-chat.test.js pruebas/asignatura-tutor.test.js`. Se verifican secciones, glosario, historial y presupuestos, acceso curricular, JSON, longitud, cuota, contadores privados, concurrencia, cambio de día en Ecuador, reintentos del chat previo y aislamiento de los resúmenes por grupo y asignatura. No se modificó `server.js`, la configuración del proveedor ni los ZIP.

Validación final de P11.1: 28 pruebas específicas del tutor y 206 pruebas en la suite completa, todas aprobadas. Las llamadas al proveedor se simulan y los registros se escriben en datos temporales aislados.

## P11.2 · Página del tutor por tema

`/paginas/tutor.html` tiene su propio CSS y módulo JS y exige el rol `estudiante`. Usa `obtenerTemaActividad()` para resolver `?temaId=` o mostrar el selector. El encabezado indica el tema y ofrece **Repasar el tema**, **Elegir otro tema** y **Nueva conversación**. Muestra las tres primeras preguntas guía disponibles como chips; si hay menos, muestra las existentes, y si no hay ninguna explica que se puede escribir una consulta propia. Seleccionar un chip prepara una pregunta editable, sin consumir IA automáticamente.

El chat usa burbujas, distingue al estudiante del tutor y representa las respuestas con `util.formatoBasico()`. Los textos del estudiante, títulos y preguntas guía se escapan. Mientras espera muestra **El tutor está pensando...**, deshabilita campo, envío y chips y evita dobles envíos. Enter envía; Mayús + Enter añade una línea y la composición de texto IME no dispara el envío. Se limita cada pregunta a 1.000 caracteres, con contador, etiquetas, estados accesibles y foco de teclado.

Cada solicitud utiliza `api.ia('tutor', { temaId, historial })` con los últimos diez mensajes, incluida la consulta actual. Solo se incorporan al historial confirmado la pregunta y respuesta de un envío exitoso. Si falla la red, llega una respuesta vacía o se alcanza el cupo, el borrador permanece disponible para reintentar sin duplicarlo en el contexto. `api.js` ahora añade `estado` a los errores HTTP, conservando `message`; la página reconoce el 429 y explica amablemente que se puede continuar mañana y repasar el tema mientras tanto.

El diálogo solo vive en una variable de la página. No se guarda en localStorage ni sessionStorage, ni se recupera el diálogo del chat por asignatura. Recargar, cambiar de página o pulsar **Nueva conversación** borra el diálogo local. El reinicio invalida las respuestas anteriores pendientes, de modo que no se mezclen con la conversación nueva; no cancela consultas que ya esté procesando el servidor ni restablece la cuota diaria. El servidor conserva únicamente los contadores de uso definidos en P11.1.

`tema.js` ofrece a estudiantes **Pregunta al tutor** con el ID del tema codificado. `catalogo-actividades.js` registra `{ id: 'tutor', texto: 'Tutor IA', descripcion: 'Resuelve dudas razonando', href: '/paginas/tutor.html' }`; el catálogo y las tarjetas de práctica llevan al tema correspondiente. El componente anterior de tutor por asignatura conserva su funcionamiento independiente. No se añaden puntuaciones por consultar ni se califican los razonamientos desde el navegador.

Pruebas: `node --test pruebas/tutor-pagina.test.js pruebas/tutor-tema.test.js pruebas/tutor-chat.test.js pruebas/asignatura-tutor.test.js`. Cubren roles, selección y cancelación de tema, guías, teclado, formato seguro, espera, historial acotado, borradores, 429, reinicio con respuestas pendientes y enlaces reales desde tema/catálogo. Las pruebas de interfaz usan DOM simulado; la comprobación visual en navegador real y a 360 px sigue pendiente. No se modifica ningún ZIP.

Validación final de P11.2: 217 pruebas aprobadas en la suite completa del proyecto, sin fallos. Las llamadas de IA se simulan y los datos reales no se modifican.
