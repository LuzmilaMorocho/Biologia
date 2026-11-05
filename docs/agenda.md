# P09.2 · Agenda

## Calendario y formularios

El menú **Agenda**, para usuarios con sesión, abre `/paginas/agenda.html`. Utiliza FullCalendar estándar 6.1.22 desde jsDelivr y su traducción al español, con semana desde el lunes y vistas **Mes**, **Semana** y **Lista**. Los colores de tarea, reunión, fecha límite y recordatorio se definen en `tokens.css`. Los eventos incluyen el nombre del tipo, de modo que la información no depende únicamente del color.

**Nuevo evento** o pulsar una fecha abre un modal con título, tipo, inicio, fin, todo el día y las opciones de recordatorio de 1 día y 1 hora antes. Docentes y administradores pueden seleccionar un grupo accesible y vincular una actividad del catálogo con un tema publicado. Al cambiar de grupo, se muestran los temas de su asignatura. Sin grupo, se permite elegir entre los temas publicados accesibles del docente.

Pulsar un evento abre sus detalles y el enlace de la actividad, si está vinculada. **Editar** y **Eliminar** se ofrecen solo al propietario. La eliminación requiere confirmación. Los formularios mantienen sus valores y errores abiertos cuando falla el guardado. El helper `formularioModal()` se comparte en `js/nucleo/formularios.js`; los foros conservan su exportación anterior para compatibilidad.

Las fechas con hora se guardan en ISO con zona y se muestran en la hora local del navegador. Para eventos de todo el día, el usuario indica el primer y último día incluidos; el fin se guarda como el día siguiente, exclusivo, conforme al modelo de FullCalendar. El modal convierte ese fin al último día incluido al editarlo. Las cadenas de fecha completas evitan que un día se desplace por una conversión UTC accidental.

Fuentes técnicas: [inicialización del bundle estándar v6](https://legacy.fullcalendar.io/v6/initialize-globals), [traducción al español](https://legacy.fullcalendar.io/v6/locale) y [modelo de evento y fin exclusivo](https://legacy.fullcalendar.io/v6/event-object).

## Mi semana y actividad realizada

**Mi semana** presenta los próximos siete días desde el momento actual, incluidos eventos en curso. También incluye tareas y fechas límite pendientes cuyo fin ya pasó, aunque estén fuera de esa ventana, para que no desaparezcan los compromisos vencidos. Se resaltan y se identifican con el texto **Vencido · Pendiente**. Reuniones y recordatorios pasados no se acumulan como tareas pendientes.

Para un estudiante, una fecha límite con actividad y tema muestra **✓ Actividad realizada** cuando existe un intento de ese estudiante, de esa actividad y tema, con fecha estrictamente posterior a la creación del evento. La marca indica realización de un intento, no aprobación o porcentaje. Los intentos de otros estudiantes, de otros temas o actividades, o anteriores o simultáneos a la creación, no activan la marca. Editar el evento conserva su fecha de creación.

Al volver a la ventana o pulsar **Actualizar** se consulta de nuevo la agenda y su estado. Si el CDN no está disponible, la página conserva la lista de eventos, los formularios y **Mi semana**, junto a un aviso de que el calendario no pudo cargarse.

## Propiedad, grupos y validación

`agenda` tiene lectura y escritura con sesión en `permisos.json`. `servidor/ganchos/agenda.js` filtra eventos propios o de los grupos del usuario y fija `propietarioId` al crear. Solo docentes y admin pueden asignar un grupo o actividad, y el grupo debe estar entre los obtenidos por `gruposDe()`. Un docente no puede asignar un paralelo ajeno aunque pertenezca a la misma asignatura.

Solo el propietario puede editar o eliminar un evento, incluso frente a un docente o administrador. Los eventos privados de otras personas tampoco se entregan a admin. Admin puede crear eventos en los grupos disponibles para su rol y administrar los eventos que le pertenecen.

El servidor comprueba título de 1 a 200 caracteres, tipos permitidos, modalidad booleana, fechas de calendario reales, zona explícita en fechas con hora, fin posterior al inicio y recordatorios únicos entre 60 y 1.440 minutos. La actividad se valida contra `ACTIVIDADES`; el tema debe estar publicado, en una unidad visible y accesible, y corresponder a la asignatura del grupo cuando exista uno. No se aceptan fechas de creación, marcas de realizado ni `avisados` enviados por el cliente.

`avisados` se inicia vacío y se conserva en cambios de título. Se reinicia al cambiar horario, modalidad, grupo o recordatorios. P09.3 procesa estas preferencias mediante las consultas periódicas de la campana.

## P09.3 · Recordatorios y vencidas

`GET /api/agenda/recordatorios`, con sesión y permiso de lectura de agenda, entrega un arreglo de notificaciones de los recordatorios recién procesados. Solo incluye eventos propios o de los grupos del usuario. Cada minuto configurado se envía cuando `inicio - minutos <= ahora`, también si el usuario vuelve después de esa hora; se registra en `avisados[usuarioId]`. No consume las marcas de otros miembros. La operación comparte la cola de las escrituras de agenda para evitar duplicados y pérdida de marcas entre consultas simultáneas.

`notificar()` acepta una opción interna adicional `clave`: identifica de forma persistente el evento, su programación y el recordatorio para recuperar una notificación ya creada si falla el guardado de `avisados`. Los demás emisores conservan su comportamiento. La clave solo se construye en el servidor.

La campana consulta recordatorios antes de cargar sus notificaciones al montar, cada 60 segundos, al recuperar visibilidad y al abrir el panel. Con permiso concedido muestra el aviso del navegador; si este falla, la notificación interna permanece disponible. **Activar avisos del navegador** solicita permiso únicamente al pulsar. Los estados de permiso bloqueado y navegador incompatible tienen una explicación accesible. La [API de notificaciones requiere contexto seguro y un gesto del usuario para solicitar permiso](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API). No hay push ni proceso autónomo: se necesita la plataforma abierta y visible para consultar; al volver, se recuperan los recordatorios pendientes.

`evaluarInactividad(grupoId)` también evalúa `vencidas`, de manera independiente de `inactividad.activa`. Considera eventos de grupo de tipo `fecha-limite`, con actividad y tema, cuyo fin lleva más de `diasGracia` días vencido. Cero días es válido. Un intento del mismo estudiante, actividad y tema posterior a la creación del evento cuenta como realizado, aunque no esté aprobado. Los eventos de todo el día usan medianoche de Ecuador continental y fin exclusivo. Se crea una alerta activa por estudiante, grupo y evento, añadiendo el campo interno `eventoId`; se avisa al docente y, si corresponde, a los administradores. Las evaluaciones concurrentes del grupo se serializan.

El resumen de grupo comprueba autorización antes de evaluar y cuenta las alertas recién creadas en esa misma respuesta. La evaluación ocurre al consultar dicho resumen; no hay un cron. Las alertas se atienden mediante el flujo existente del docente.

Pruebas de P09.3: `node --test pruebas/agenda-recordatorios.test.js pruebas/notificaciones.test.js`. Cubren tiempos exactos, zona horaria, sesiones, grupos, usuarios concurrentes, persistencia, recuperación, permisos del navegador, consultas periódicas y fallos sin romper la campana. La interfaz nativa del navegador se simula en estas pruebas; queda pendiente comprobarla visualmente con permisos reales.

## Rutas y extensiones

`servidor/rutas/agenda.js` implementa `GET /api/agenda`, `GET /api/agenda/:id`, `POST /api/agenda`, `PUT /api/agenda/:id` y `DELETE /api/agenda/:id`, con sesión, permisos, filtro o control de propiedad y `Cache-Control: no-store`. Se carga automáticamente; no se modificó `server.js`. Las escrituras se serializan en una cola de agenda. Las rutas protegen también lecturas y eliminaciones por ID, porque la API genérica no aplica el filtro de lista en esas operaciones. Los nombres codificados y subcolecciones se rechazan para impedir rutas alternativas.

Las respuestas añaden `puedeEditar`, `completado`, `grupoNombre` y `temaNombre` como campos calculados de presentación. El estado realizado se calcula en el servidor usando solo los intentos del usuario activo; no se entrega el historial de los demás. La lista y el detalle omiten `avisados`, que es seguimiento interno del servidor. Los módulos del navegador usan exclusivamente `api.js` para los datos; FullCalendar recibe un arreglo ya cargado, sin hacer sus propias peticiones a la API.

## Comprobación y publicación

`node --test pruebas/agenda.test.js pruebas/agenda-pagina.test.js`

La agenda tiene 15 pruebas: validación y autorización mediante servidor aislado, funciones de fechas y semana, y flujos de interfaz con DOM y calendario simulados. Se verifican grupos, propiedad estricta, fechas inválidas, días completos, recordatorios, congruencia de actividad/tema, intentos propios posteriores, privacidad de `avisados`, rutas alternativas, formularios por rol, eliminación y alternativa si falla el CDN. La ejecución completa del proyecto aprobó 136 pruebas, incluyendo foros, quiz, tutor, IA y sopa de letras. Ambos archivos del CDN respondieron HTTP 200 en una consulta de cabeceras. La revisión visual del calendario con el CDN real y a 360 px sigue pendiente.

`datos/agenda.json` se inicializa vacío solo si no existía. El ZIP incluye el código y la configuración, pero inicializa la agenda vacía para excluir eventos privados y de grupos de la instalación local. Reiniciar el servidor carga el nuevo gancho y las rutas; después se accede desde **Agenda**.
