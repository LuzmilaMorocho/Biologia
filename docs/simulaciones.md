# P12.1 · Motor de escenarios

`publico/paginas/simulaciones.html` lista las simulaciones accesibles, permite filtrar por tema y conserva `?temaId=` desde el catálogo. Cada tarjeta muestra título, modo e inicio. Docente y admin tienen enlaces de creación y edición hacia `editor-simulacion.html`, implementado en P12.2 (ver `docs/editor-simulacion.md`), y un acceso directo a vista previa. Los estudiantes no reciben estos controles.

`publico/paginas/simulador.html?id=` presenta una escena por turno, texto mediante `util.formatoBasico()`, imagen opcional y botones de decisión. Una elección bloquea las demás y muestra `mostrarRetro({ correcto: puntos > 0, explicacion: consecuencia })`. La escena siguiente solo aparece al pulsar «Continuar». El foco acompaña el avance y los botones admiten teclado. Los textos de títulos, decisiones y atributos se escapan; las imágenes solo admiten rutas del sitio y URL http(s), sin credenciales ni protocolos ejecutables.

Al llegar a un final se muestra el texto final, decisiones, consecuencias, balance de puntos y puntaje con mínimo cero. El máximo es la mayor suma desde la escena inicial hasta un final, no la suma de todas las opciones ni una selección voraz. `registrarIntento()` utiliza la gamificación existente. Se registra una vez por finalización en la página; si falla la petición, el informe permanece y permite reintentar. Las reglas existentes impiden volver a conceder puntos por la misma simulación una vez premiada. Un fallo de red después de persistir puede dejar otro registro al reintentar, sin duplicar el premio; no se introduce una sesión de simulación en P12.1.

Con `?vista=previa` se muestra el informe sin llamar a `registrarIntento()`. Desde P12.4 el modo `rol` tiene conversación con personaje y evaluación por rúbrica (ver `docs/rol-simulacion.md`), también con vista previa sin registro. La página requiere sesión en ambos modos. La vista previa conserva los mismos permisos de lectura; no permite abrir borradores de otra asignatura.

## Permisos y consistencia

- `datos/config/permisos.json`: simulaciones admite lectura con sesión y escritura docente/admin.
- `servidor/ganchos/simulaciones.js`: estudiante ve simulaciones publicadas de temas publicados en unidades visibles de sus asignaturas; docente ve sus asignaturas; admin ve todas. La escritura exige `puedeEditarAsignatura()` para el tema anterior y el nuevo.
- `servidor/rutas/simulaciones.js`: protege la lectura por ID y la eliminación, ya que la API genérica no ejecuta esos ganchos. Bloquea variantes codificadas de la colección para evitar eludir el control.
- `publico/js/nucleo/simulaciones.js`: modelo compartido por navegador y servidor. Para publicar rechaza identificadores repetidos, destinos inexistentes, escenas inalcanzables, ciclos, opciones incompletas, puntos fuera de -10 a 10 y grafos sin final. Desde P12.2 admite dos a cuatro opciones y al menos un final; hasta 100 escenas. El mejor camino debe ser positivo para ser compatible con la gamificación. Los borradores pueden estar incompletos y usan la validación estructural del editor.
- `servidor/rutas/gamificacion.js`: para actividad `simulacion`, verifica acceso, tema y modo; reconstruye el recorrido completo desde la escena inicial y recalcula puntos, máximo, errores y consecuencias a partir de las opciones guardadas. No confía en las cifras ni los textos enviados por el navegador. Rechaza recorridos incompletos o con saltos.

`detalle.recorrido` contiene `{ escenaId, opcion, decision, destino, puntos, consecuencia }`, con `opcion` como índice desde cero. El servidor conserva su versión canónica. No se modifica `server.js`, el servicio de IA ni el cálculo de premios del núcleo.

El catálogo utiliza `id: "simulador"` y los intentos `actividad: "simulacion"`, como pide la tarea. `actividadDelIntento()` en el catálogo comparte esa equivalencia con la agenda y las alertas: un intento posterior del estudiante marca el evento como realizado y evita una alerta de vencimiento incorrecta.

## Ejemplos

- `datos/semilla/simulaciones.json`: «Una muestra celular en el aula», del primer tema de la semilla, Estructura y Función Celular. Publicado, seis escenas, dos finales, mejor camino de 10 puntos.
- `datos/simulaciones.json`: colección nueva con «Un acuerdo para cuidar el agua», del primer tema activo, Recursos naturales. Publicado, seis escenas, dos finales, mejor camino de 10 puntos. Se utiliza una de las situaciones elegidas por el Product Owner; el contenido activo de Biología es distinto al de la semilla original. No se reemplazaron temas ni otras colecciones.

Los casos son ejercicios educativos hipotéticos. La segunda situación elegida, conservación de una ribera, permanece documentada para la creación de escenarios en las siguientes tareas. No se generan escenarios con IA en P12.1.

## Verificación

`node --test pruebas/simulaciones.test.js pruebas/simulador-pagina.test.js`

14 pruebas aprobadas: cálculo de caminos ramificados, negativos, bloqueo de decisiones repetidas, vista previa sin registro, modo rol, texto seguro, imagen, filtrado del listado, fallos de acceso y guardado, permisos con Express real y datos aislados, escrituras y eliminaciones ajenas, rutas codificadas, publicación, y reconstrucción del puntaje en servidor. Los dobles DOM comprueban comportamiento; la revisión visual a 360 px y con navegador real sigue pendiente.

La suite completa aprobó 248 pruebas antes del ajuste de equivalencia en agenda. Después de ese ajuste se ejecutaron los cinco archivos de simulación y agenda: 39 pruebas aprobadas, incluidas dos regresiones nuevas que verifican la marca de completado y la ausencia de alertas falsas para un intento `simulacion` asociado a un evento `simulador`. También aprobaron las comprobaciones de sintaxis y la validación de ambos ejemplos y sus enlaces de menú/catálogo.

Las pruebas existentes que copian una selección del núcleo a un directorio temporal incluyen ahora el modelo compartido. No se añade ninguna dependencia npm o CDN. No se crea ni actualiza el ZIP.
