# P09.1 · Foros y moderación

## Uso

El menú **Foros** abre `/paginas/foros.html` para usuarios con sesión. El selector muestra asignaturas accesibles y permite filtrar por un tema opcional. Los hilos fijados aparecen primero; cada tarjeta muestra número de respuestas visibles y último movimiento. **Nuevo hilo** abre un modal con título, texto y tema opcional.

`/paginas/hilo.html?id=ID` muestra la publicación inicial, respuestas ordenadas por fecha y páginas de 20. Todos los textos de publicaciones y motivos se presentan con `util.formatoBasico()`, que escapa HTML antes de aplicar formato. El formulario conserva el borrador cuando falla una publicación y se retira al cerrar el hilo. Las respuestas publicadas muestran retroalimentación y los logros que devuelve el servidor.

El menú de cada publicación permite **Reportar**. El autor puede **Editar** durante los primeros 15 minutos. Docentes de la asignatura y administradores pueden editar y moderar: **Fijar**, **Cerrar/Reabrir** y **Ocultar/Mostrar** hilos; **Destacar/Quitar destacado** y **Ocultar/Mostrar** respuestas. Los permisos mostrados se calculan en el servidor y se comprueban nuevamente al guardar.

**Reportes**, solo para administración, abre `/paginas/admin-reportes.html`. Presenta reportes pendientes, motivo y contenido actual, con **Ocultar contenido** o **Descartar**. Ambas acciones dejan el reporte resuelto. La ocultación corresponde a la publicación concreta; ocultar una respuesta no oculta su hilo.

## Reglas del servidor

- Permisos de `foros-hilos` y `foros-respuestas`: lectura y escritura con sesión; en `reportes`, lectura solo admin y creación con sesión.
- Los ganchos filtran por asignaturas accesibles. Una publicación oculta solo se entrega a docentes con acceso a esa asignatura y admin; un hilo oculto también restringe sus respuestas.
- La autoría y la fecha de creación se fijan en el servidor. La asignatura, el hilo de una respuesta y la autoría no se reasignan al editar. Se admiten textos de hasta 5.000 caracteres y títulos de hasta 180. Los campos de moderación deben ser booleanos y requieren docente o admin.
- Los estudiantes solo pueden vincular temas publicados de unidades visibles de su asignatura. Los hilos generales usan `temaId: null`.
- Un hilo cerrado no admite respuestas nuevas, ni siquiera de moderadores; primero debe reabrirse. Las ediciones existentes siguen sus permisos y plazo.
- Crear una respuesta actualiza `ultimoMovimiento`, notifica al autor del hilo cuando sea otra persona y llama a `procesarIntento(usuario, { actividad: 'foro', puntaje: 1, maximo: 1 })`. Editar o moderar una publicación no genera otra participación ni notificación.
- Puntos, bonos y límites diarios se obtienen de las reglas de gamificación. El navegador muestra el resultado; el endpoint público de intentos rechaza la actividad `foro` para impedir registros sin publicación real.
- Si un efecto secundario falla después de guardar, la API devuelve la publicación guardada y un aviso, de modo que no se invite a duplicarla por un error de puntos o notificación. El aviso de puntos no implica una asignación diferida automática.

Las mutaciones se serializan en una cola compartida de foros. Esto mantiene coherentes la comprobación de cierre y la creación de respuestas, y evita reportes pendientes duplicados simultáneos del mismo usuario y publicación. Como el resto del almacén JSON, requiere una sola instancia del servidor.

## Rutas y datos adicionales

`servidor/rutas/foros.js` implementa las rutas de las tres colecciones antes de la API genérica y reutiliza sus permisos, ganchos y almacén. También protege lectura por ID y rechaza eliminación directa: las publicaciones se moderan ocultándolas. Los nombres de colección codificados o subcolecciones se rechazan para evitar que eludan estas comprobaciones. No se modificó `server.js`.

- `GET /api/foros-hilos?asignaturaId=ID&temaId=ID`: arreglo de hilos accesibles, fijados primero.
- `GET /api/foros-hilos/:id` y `GET /api/foros-respuestas/:id`: contenido accesible con autor público y permisos calculados.
- `GET /api/foros-respuestas?hiloId=ID`: arreglo filtrado, conservando el contrato de `api.listar()`.
- `GET /api/foros-hilos/:id/respuestas?pagina=N`: `{ items, pagina, total, paginas, tamano: 20 }`, usando `api.llamar()` para paginación en servidor.
- `POST` y `PUT` de las colecciones: validación mediante sus ganchos.
- `GET /api/reportes?estado=pendiente`: solo admin; incluye `publicacion` con contenido actual para revisión.
- `POST /api/reportes/:id/resolver`, solo admin: `{ accion: 'ocultar' | 'descartar' }`. La resolución conserva `resolucion`, `resueltoPor` y `resueltoEn`; repetir la resolución es idempotente.

Los hilos y respuestas pueden recibir el mismo identificador `for_000001` porque el almacén calcula el prefijo por colección. Por eso un reporte de foro añade `coleccion: 'foros-hilos' | 'foros-respuestas'`, junto con `tipo: 'foro'`, `referenciaId` y `motivo`. El gancho fija `reportadoPor` y `estado: 'pendiente'`. El tipo `mensaje` queda reservado para integrar su autorización cuando se implemente esa funcionalidad; P09.1 admite reportes de publicaciones de foro.

Las respuestas de lectura añaden `autorNombre`, `puedeEditar` y `puedeModerar`; los hilos añaden `numeroRespuestas`. Estos campos son de presentación y no se aceptan como campos editables. Solo se incluyen nombre y apellido del autor, nunca correo o credenciales. Las rutas usan `Cache-Control: no-store`.

## Verificación y publicación

`node --test pruebas/foros.test.js pruebas/foros-pagina.test.js pruebas/quiz.test.js pruebas/preguntas.test.js`

Resultado: 47 pruebas aprobadas, usando servidor con datos temporales y DOM simulado. Cubren aislamiento por asignatura, contenido oculto, ventana de edición, validación de campos, cierre y respuesta concurrentes, notificaciones, participación única al crear, reportes privados, colisiones de ID entre colecciones, resolución, orden y páginas de 20, protección de rutas alternativas, formato seguro y flujos de las tres páginas. También comprueban regresiones de quiz y banco de preguntas. La revisión visual a 360 px en un navegador real sigue pendiente.

Las colecciones se inicializan vacías únicamente si no existían. El generador del ZIP incluye el código y permisos de foros, pero inicializa hilos, respuestas y reportes vacíos: las conversaciones y los reportes de una instalación local no se distribuyen. Para probar localmente, reiniciar el servidor para cargar las rutas y ganchos nuevos.
