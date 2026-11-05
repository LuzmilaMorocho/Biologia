# P10.1 · Mensajería del servidor

Las rutas de `servidor/rutas/mensajes.js` se cargan automáticamente bajo `/api`. Todas requieren sesión y responden con `Cache-Control: no-store`. No se modificó `server.js` ni se prepararon archivos ZIP. P10.2 incorpora la interfaz descrita al final de este documento.

## Contactos y conversaciones

- `GET /api/mensajes/contactos` devuelve un arreglo de `{ id, nombre, apellido, rol }`, sin correo, claves ni otros datos privados. Solo usuarios activos distintos del solicitante: estudiante → docentes de sus grupos y compañeros si `ajustes.chatEntreEstudiantes === true`; docente → estudiantes de sus grupos y otros docentes; admin → todos. Los bloqueos en cualquier sentido excluyen el contacto.
- `GET /api/mensajes/conversaciones` devuelve `[{ id, participante, ultimo, noLeidos }]`, ordenado por mensaje más reciente. `participante` es el resumen público del otro usuario. `ultimo` contiene `{ texto, fecha, autorId }` o `null`.
- `POST /api/mensajes/conversaciones { con }` devuelve la conversación existente o creada, únicamente con un contacto permitido. Dos solicitudes concurrentes por la misma pareja reutilizan el mismo registro.
- `GET /api/mensajes/no-leidos` devuelve `{ total }`. Excluye mensajes propios y ocultos.

`conversaciones`, `bloqueos` y la colección base `mensajes` tienen permisos exclusivos de servidor. Esto también protege las subcarpetas y las variantes codificadas consultadas a través de la API genérica. Ni siquiera administración puede leer directamente una conversación de la que no participa; su revisión especial requiere un reporte de mensaje.

## Mensajes, lectura y límites

`GET /api/mensajes/:convId?desde=&antes=` entrega un arreglo cronológico de hasta 50 mensajes visibles. Sin `desde`, entrega los últimos 50 que cumplan el filtro; con `desde`, los primeros 50 posteriores al cursor. Ambos límites son exclusivos. Acepta fechas ISO con zona explícita y, como extensión, IDs de mensajes de esa conversación para paginar sin omisiones cuando varios comparten milisegundo. Un ID ocultado sigue siendo válido como posición del cursor, sin entregar su contenido; así la moderación no bloquea las consultas posteriores del chat. Los parámetros inválidos se rechazan con 400.

`POST /api/mensajes/:convId { texto }` exige participación, texto no vacío de hasta 2.000 caracteres, destinatario activo, ausencia de bloqueo y contacto todavía permitido. Una conversación iniciada por administración permite que el estudiante o docente responda, aunque administración no figure en su lista de contactos. Al desactivar el chat entre estudiantes se impiden nuevos envíos entre ellos; el historial permanece accesible a los participantes.

El autor, fecha y estado `oculto: false` se fijan en servidor. Se guarda en `datos/mensajes/<convId>.json` mediante `almacen.agregar()` y se actualiza `conversaciones.ultimo`. El texto se almacena como texto; la futura interfaz debe representarlo con los helpers de escape/formato básico del núcleo.

El máximo es de 30 mensajes por usuario en una ventana móvil de 60 segundos, considerando todas sus conversaciones e incluyendo mensajes ocultos. Se cuenta el historial persistido, por lo que reiniciar el servidor no restablece el cupo. El exceso devuelve 429 con un mensaje amable.

`POST /api/mensajes/:convId/leido {}` actualiza únicamente la marca del usuario autenticado. Conserva las marcas de los demás participantes. Además de `leidoHasta[usuarioId]`, se guarda internamente `leidoHastaId[usuarioId]` para distinguir mensajes posteriores con la misma fecha exacta, incluso cuando la conversación se marcó vacía.

Las escrituras de mensajería comparten una cola dentro del proceso Node para proteger creación por pareja, envío, lectura, bloqueo, difusión y moderación. Como el resto del almacenamiento JSON del proyecto, se utiliza una instancia del servidor; no es una transacción entre varios archivos ante un apagado abrupto.

## Difusión y bloqueos

`POST /api/mensajes/difusion { grupoId, texto }` solo lo ejecuta el docente asignado al grupo. Reutiliza o crea una conversación por estudiante activo y permitido; omite bloqueados e inactivos. Devuelve `{ enviados, omitidos, conversaciones: [{ id, con, mensajeId }] }`.

Cada destinatario consume un mensaje del cupo de 30 por minuto. Se comprueba el cupo completo antes de empezar: si no alcanza se devuelve 429 sin realizar envíos. Por tanto, un grupo con más de 30 destinatarios permitidos supera el máximo de esta operación. Un fallo de disco a mitad de la difusión puede dejar algunos envíos realizados; la respuesta de error no implica una transacción atómica entre conversaciones.

`POST /api/mensajes/bloquear { usuarioId }` crea o reutiliza el bloqueo propio hacia otro usuario existente. No se permite bloquearse a sí mismo. `DELETE /api/mensajes/bloquear/:usuarioId` elimina solo los bloqueos del solicitante hacia ese usuario. No elimina un bloqueo en sentido contrario ni borra el historial.

## Reportes y moderación

La ruta existente `POST /api/reportes` acepta `{ tipo: "mensaje", referenciaId: "<convId>/<mensajeId>", motivo }`. La colección se fija a `mensajes`, el autor del reporte a la sesión y el estado a `pendiente`. Solo se reportan mensajes visibles de conversaciones propias. Se rechazan referencias malformadas, mensajes ajenos y reportes pendientes repetidos por la misma persona. Los reportes de foros conservan su comportamiento.

- `GET /api/mensajes/reporte/:reporteId`, solo admin, devuelve `{ reporteId, conversacionId, mensaje, anteriores }`. `anteriores` contiene como máximo los cinco mensajes inmediatamente anteriores, incluidos los ocultos como contexto de moderación; no entrega mensajes posteriores ni el resto del historial.
- `POST /api/mensajes/ocultar { referenciaId }`, solo admin, marca el mensaje como oculto y recalcula el último visible. No elimina su contenido de la evidencia del reporte.
- La lista administrativa de reportes incluye la publicación reportada y la ruta existente `POST /api/reportes/:id/resolver { accion: "ocultar" | "descartar" }` también admite mensajes. Ocultar desde ese flujo resuelve el reporte; ocultar directamente por la ruta de mensajes no cambia su estado.

## Comprobación

`node --test pruebas/mensajes.test.js pruebas/foros.test.js pruebas/foros-pagina.test.js`

Los tests usan servidor y datos temporales aislados: permisos por rol, contactos, ajuste, privacidad de campos, conversaciones concurrentes, API genérica, validación, subcarpetas, lectura por milisegundo, bloqueos bidireccionales, cursores, moderación limitada, difusión y cupo persistente con envíos simultáneos.

Validación final: 164 pruebas aprobadas en la suite completa del proyecto, sin fallos. Incluye 14 pruebas de mensajería (contenedor y 13 casos), además de las regresiones de foros, reportes, agenda, avisos, quiz, IA y tutor.

## P10.2 · Interfaz de mensajería

**Mensajes** aparece en el menú de todos los usuarios con sesión y abre `/paginas/mensajes.html`. La página monta el componente de `js/nucleo/mensajeria.js`; los datos pasan exclusivamente por `api.js`.

La columna izquierda tiene buscador por nombre o último texto, conversaciones con hora y no leídos, y **Nueva conversación**. El buscador normaliza tildes y mayúsculas. El formulario de nueva conversación consulta los contactos permitidos del servidor y conserva los errores hasta guardar o cancelar. La lista tiene reintento cuando falla la conexión.

La derecha muestra el interlocutor, mensajes propios a la derecha, separadores por día, hora, **Ver anteriores** y un formulario de hasta 2.000 caracteres con contador. Enter envía; Mayús + Enter introduce una línea; no se envía mientras el usuario compone texto con IME. Los mensajes y nombres se escapan con `ui.escapar()`. Solo se enlazan URL http(s) mediante `<a target="_blank" rel="noopener noreferrer">`, escapando también el atributo. Los saltos de línea y enlaces largos se ajustan dentro de la burbuja.

Los borradores quedan en memoria por conversación. Un fallo de envío conserva el texto y muestra el error sin bloquear el reintento. Los envíos pendientes se controlan por conversación, incluso si se cambia de chat y se regresa antes de recibir confirmación. Las respuestas tardías de otra conversación no sustituyen la vista activa.

Se consultan mensajes nuevos cada 4 segundos mediante `desde=<mensajeId>`, y la lista cada 15 segundos, únicamente con la pestaña visible. Los lotes completos de 50 nuevos se continúan hasta alcanzar el último disponible. Los mensajes se combinan por ID para evitar duplicados. El cursor avanza solo con las consultas, evitando saltarse mensajes ajenos recibidos antes de la confirmación de un envío propio. Los anteriores se piden con `antes=<primerMensajeId>` y mantienen la posición de desplazamiento.

Al abrir o recibir se marca como leído, solo si la página está visible. Si esa marca falla, se reintenta en la siguiente consulta; si entra otro mensaje durante una marca pendiente se conserva una nueva marca por realizar. Al recuperar visibilidad se actualizan lista y chat. `pagehide` detiene los relojes y la restauración desde la caché de navegación los reactiva. No hay peticiones periódicas solapadas por conversación.

Por debajo de 768 px se muestra una columna: lista o conversación. **Volver** regresa a la lista y conserva el borrador. Se utilizan etiquetas, mensajes de estado y error accesibles, foco de teclado y variables del diseño existente. La revisión visual en un navegador real a 360 px sigue pendiente; las pruebas de comportamiento utilizan un DOM simulado.

### Contador del menú

`plantilla.js` añade el contador junto a **Mensajes** y exporta `actualizarNoLeidosMensajes()`, que consulta `GET /api/mensajes/no-leidos`, oculta el cero, muestra `99+` si corresponde y añade una etiqueta accesible con el total. Si falla la conexión conserva el valor anterior. Después de una marca de lectura exitosa el componente solicita su actualización.

`montarCampana({ alConsultar })` admite un callback opcional compatible con sus llamadas anteriores. La plantilla lo usa para consultar el contador en el mismo ciclo inicial/de 60 segundos, apertura de campana y recuperación de visibilidad. No se añade otro intervalo global y un fallo del contador no interrumpe la campana.

Comprobación de interfaz: `node --test pruebas/mensajes-pagina.test.js pruebas/mensajes-contador.test.js pruebas/notificaciones.test.js`. Se cubren escape y enlaces, búsqueda, teclado, borradores, errores, duplicados, cursores, respuestas tardías, lectura concurrente, permisos de página, visibilidad, restauración y contador compartido.

Validación P10.2: suite completa de 181 pruebas aprobadas, sin fallos; incluye 17 comprobaciones nuevas de interfaz, contador e integración con la campana. El foco vuelve al botón al cancelar una conversación y al historial al terminar de cargar anteriores; una restauración de navegación recupera el borrador vigente y elimina del formulario los envíos ya confirmados durante la pausa.

## P10.3 · Difusión, reportes y bloqueo

**Mensaje al curso** se ofrece solo a docentes. El formulario consulta sus grupos y asignaturas, filtra por el docente de la sesión y permite elegir grupo y escribir hasta 2.000 caracteres. Envía `POST /api/mensajes/difusion`; informa cuántos estudiantes recibieron el mensaje y cuántos se omitieron, y actualiza conversaciones y chat. Cancelar no envía. Los errores permanecen en el formulario mediante el helper compartido. Se informa del cupo de 30 mensajes/minuto, que se aplica por destinatario.

La cabecera del chat ofrece **Bloquear** o **Desbloquear**, según el bloqueo propio. El resumen de conversaciones añade `bloqueadoPorMi` y `bloqueado` (en cualquier sentido), calculados solo para sus participantes. No se habilita la lectura de la colección privada de bloqueos. `DELETE /api/mensajes/bloquear/:usuarioId` devuelve además `bloqueado` para indicar si sigue existiendo un bloqueo inverso. Al bloquear se deshabilita el envío, se conserva el borrador y se mantiene el historial. El botón y las marcas se conservan al recargar; las respuestas de lista iniciadas antes de un cambio local de bloqueo se descartan para no revertirlo.

Cada mensaje recibido incluye **Reportar**. El modal muestra una cita escapada y pide un motivo de hasta 5.000 caracteres. Usa `api.crear('reportes', { tipo: 'mensaje', referenciaId: '<convId>/<mensajeId>', motivo })`. La referencia se captura antes del modal, por lo que un cambio de conversación no reporta accidentalmente otro mensaje. Los mensajes propios no ofrecen la acción y los reportados correctamente quedan marcados como **Reportado** durante esa sesión de la página. El servidor rechaza duplicados pendientes incluso después de recargar.

El panel de reportes distingue mensajes y publicaciones de foro. Para cada reporte de mensaje consulta `GET /api/mensajes/reporte/:reporteId` y muestra el mensaje señalado y hasta cinco anteriores. La respuesta añade `autores`, restringido a los autores presentes en ese contexto, con ID, nombre, apellido, rol y estado activo; no incluye correo ni claves. Los textos se escapan. Si falla un contexto, ese reporte ofrece reintento sin impedir revisar los demás.

- **Ocultar mensaje** llama a `POST /api/mensajes/ocultar` con la referencia reportada y después resuelve el reporte mediante la ruta existente con acción `ocultar`. La ocultación de esa ruta de resolución es idempotente. Si falla la resolución tras ocultar, la interfaz conserva el avance, identifica el mensaje como oculto y permite reintentar la resolución sin repetir la llamada inicial a `/mensajes/ocultar`.
- **Desactivar usuario** pide confirmación y usa `api.actualizar('usuarios', contexto.mensaje.autorId, { activo: false })`. Actúa sobre el autor del mensaje, no sobre quien lo reportó. Conserva el reporte pendiente para decidir después si ocultarlo o descartarlo. Deshabilita la acción para usuarios ya desactivados y para la propia cuenta administrativa; el servidor también protege la cuenta propia y rechaza sesiones de usuarios inactivos en solicitudes posteriores.
- **Descartar** resuelve mediante la ruta existente sin ocultar contenido ni desactivar cuentas. Los reportes de foro mantienen sus acciones anteriores.

La revisión visual de estos formularios y del contexto administrativo en navegador real sigue pendiente. Las pruebas usan datos temporales y DOM simulado. El contenido que ya estaba dibujado en otro navegador antes de una ocultación desaparece al reabrir o recargar la conversación; las consultas de nuevos mensajes continúan sin errores aunque su cursor haya sido ocultado.

Pruebas de P10.3: `node --test pruebas/mensajes-pagina.test.js pruebas/mensajes-moderacion-pagina.test.js pruebas/mensajes.test.js pruebas/foros-pagina.test.js`. Incluyen roles, cancelación, grupos propios, bloqueos mutuos, referencias capturadas, contexto escapado, autor correcto, reintentos de moderación, revocación de sesiones y regresiones de foros.

Validación final de P10.3: 196 pruebas aprobadas en la suite completa, sin fallos. Se conservan los datos reales de usuarios, conversaciones y reportes: las pruebas crean y eliminan sus propios directorios temporales aislados.
