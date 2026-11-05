# P12.2 · Editor de escenarios

`publico/paginas/editor-simulacion.html` y sus módulos CSS/JS permiten crear y editar simulaciones con roles docente y admin. Los enlaces «Nueva» y «Editar» del listado de P12.1 abren esta página. `?id=` carga una simulación existente y `?temaId=` preselecciona el tema de una nueva.

## Datos y permisos

El formulario contiene título, tema, modo y estado. El docente solo recibe opciones de temas de sus asignaturas; admin puede seleccionar todos. La consulta de una simulación ajena y cualquier escritura siguen protegidas por las rutas y ganchos de P12.1, incluso al cambiar `temaId`. Se mantienen `api.listar`, `api.obtener`, `api.crear`, `api.actualizar` y `api.subir`; no hay peticiones fetch en el módulo.

Desde P12.4 el modo rol permite editar personaje, contexto, objetivo, rúbrica y máximo de turnos; detalles en `docs/rol-simulacion.md`. Cambiar de modo conserva las escenas y la configuración de rol cargadas y sus ediciones. El guardado actualiza ambos conjuntos de campos.

## Escenas y opciones

Las tarjetas muestran identificadores estables E1, E2…; se pueden agregar y eliminar escenas. Eliminar una escena no renumera las demás ni corrige automáticamente sus referencias: los destinos inexistentes permanecen señalados en el selector. Al cargar también se reservan los identificadores de destinos rotos, para que agregar una escena no reconecte esos caminos por accidente.

Cada escena admite texto, imagen opcional y de dos a cuatro opciones, con decisión, destino, puntos entre -10 y 10 y consecuencia. Sin opciones es una escena final. «Agregar dos opciones» convierte un final en decisión; después se agregan opciones individuales hasta cuatro. Es posible dejar temporalmente una sola opción y guardarla en borrador, pero no publicarla.

Las imágenes JPG, PNG y WEBP se suben mediante `api.subir()`, con el límite de tamaño y permisos del servidor existente. La URL recibida se valida antes de incorporarla. Una subida fallida conserva la imagen anterior y el resto de la edición. Mientras se sube una imagen se bloquean guardado, vista previa y modificaciones estructurales; los cambios de texto se conservan. «Quitar imagen» retira la referencia, sin borrar archivos que podrían usar otras páginas.

## Validación y mapa

`erroresEscenario()` en el modelo compartido devuelve todos los errores con `{ escenaId, mensaje }`. Navegador y servidor usan esta misma validación. Desde P12.2 se permiten hasta cuatro opciones y al menos un final; esto amplía la validación inicial de P12.1, que exigía dos o tres opciones y dos finales. Los ejemplos y los prompts de generación mantienen sus propios requisitos.

Para publicar se exige texto en escenas y opciones, consecuencias, destinos existentes, escena inicial válida, todas las escenas alcanzables y ausencia de ciclos. Se comprueban también los ciclos de partes desconectadas. Se mantienen los límites de tamaño e imágenes seguras y el requisito de un mejor camino positivo, necesario para registrar el intento con la gamificación existente. Los errores se listan con enlaces que enfocan su escena o el campo general correspondiente.

Los borradores admiten texto y consecuencias vacíos, destinos pendientes, escenas desconectadas y ciclos de trabajo. Se conservan los límites estructurales: hasta 100 escenas, máximo cuatro opciones, identificadores únicos, longitudes, imágenes seguras y puntos válidos. El título y un tema editable siguen siendo obligatorios.

El mapa se genera desde el estado actual y se actualiza al escribir, cambiar destinos y agregar o eliminar elementos. Presenta una lista indentada «E1 → E2 (opción)», enlaces a tarjetas, finales y escenas desconectadas. Cada escena se expande una vez; las referencias compartidas y los ciclos del borrador no provocan recursión infinita. Todo texto se escapa.

## Guardado y vista previa

Solo hay una petición de guardado a la vez. El formulario se bloquea durante esa petición y se conserva ante errores. Al crear se actualiza la URL con el ID nuevo; el siguiente guardado usa `api.actualizar()`. Se avisa al intentar abandonar una edición sin guardar o con una subida pendiente.

«Vista previa» se habilita después de guardar y mientras no haya nuevos cambios. Valida una configuración completa del modo seleccionado, aunque su estado siga siendo borrador, y abre `/paginas/simulador.html?id=...&vista=previa` en otra pestaña con `noopener`. Un borrador incompleto muestra sus errores sin abrir el simulador. La vista previa de rol permite conversar y evaluar con IA. Ningún modo registra intentos ni puntos en vista previa.

## Verificación

Desde P12.3 el editor incluye «Generar borrador con IA». La propuesta se carga y valida sin guardarse, conservando ID y tema. La validación completa sigue visible mientras se corrige el borrador; los avisos lógicos no impiden guardarlo como borrador. Flujo, límites, recuperación y pruebas adicionales en `docs/escenario-ia.md`.

`node --test pruebas/editor-simulacion.test.js pruebas/simulaciones.test.js pruebas/simulador-pagina.test.js`

En P12.2 aprobaron 24 pruebas específicas: creación, actualización, publicación, borrador, cuatro opciones y un final, acceso por rol/asignatura, error enlazado, mapa y HTML seguro, eliminación e identificadores, carga de imagen y fallo, edición durante subida, guardado único, recuperación y vista previa. Las pruebas de API usan Express real y datos temporales aislados; las de interfaz usan dobles DOM.

La suite completa aprobó 260 pruebas. Tras el ajuste de reserva de IDs al recargar, volvieron a aprobar las siete pruebas del editor. También se comprobó sintaxis. Queda pendiente la revisión visual en navegador real y a 360 px. No se modificaron datos académicos activos ni `server.js`; no se actualizó el ZIP.
