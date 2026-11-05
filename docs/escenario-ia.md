# P12.3 · Borrador de escenario con IA

## Preparación y servicio

`servidor/preparadores/generar-escenario.js` acepta únicamente `{ temaId, situacion, escenas }`. Exige sesión docente/admin, una situación no vacía de hasta 800 caracteres y entre cinco y diez escenas, como entero. Comprueba la existencia del tema y `puedeEditarAsignatura()` antes de leer su contexto para el proveedor.

Devuelve `{ asignatura, nivel, tema, contenido, situacion, escenas }`. `nivel` es el nivel educativo de la asignatura; el contenido reúne objetivos, resumen y ejemplos del tema guardado. No utiliza instrucciones, contenido ni información de asignatura enviados por el navegador. El servicio existente reemplaza las variables del prompt y aplica su recorte de 6.000 caracteres por valor.

La ruta dinámica existente `POST /api/ia/generar-escenario` descubre el preparador sin modificar `server.js`. Reutiliza el proveedor, modelo y clave configurados por administración, el formato JSON, el plazo, los reintentos y el cupo `limiteIADiario` del servicio integrado. El prompt sigue siendo `servidor/prompts/generar-escenario.txt`.

El esquema de respuesta exige título e inicial como textos acotados, exactamente la cantidad de escenas pedida y una estructura editable segura mediante `erroresEscenario(..., { publicar: false })`. Así se rechazan imágenes no permitidas, campos incompatibles y estructuras que romperían el editor. Los defectos lógicos del grafo, como ciclos o destinos pendientes, se entregan como propuesta para que el docente los vea y corrija. El servicio reintenta una vez ante JSON o estructura inválida y luego responde 502.

## Interfaz

El botón «Generar borrador con IA» aparece en la sección de escenarios del editor y requiere un tema editable seleccionado. Abre un modal con situación (hasta 800 caracteres) y número de escenas (5–10, seis por defecto). La copia del modal aclara que el resultado reemplaza las escenas del formulario y que solo se conserva al pulsar Guardar.

El envío usa exclusivamente `api.ia("generar-escenario", { temaId, situacion, escenas })`. El modal muestra el estado de generación, bloquea solicitudes duplicadas y permite reintentar después de un error. Durante la petición se bloquean las ediciones y guardados simultáneos en el formulario. El error 429 tiene un mensaje amable sobre el límite diario.

Al recibir la respuesta se copian solo título, inicial, escenas, imagen opcional y campos de opciones; se conserva el ID y el tema actuales y se fija `modo: "escenarios"`, `estado: "borrador"`. Los metadatos adicionales de la IA no se incorporan. No se llama a `api.crear()` ni `api.actualizar()` durante la generación. Los textos se escapan con el renderizador del editor, incluido el título de la IA.

El mapa se reconstruye y se ejecuta la validación completa de publicación, aun siendo borrador. Los errores quedan enlazados a sus escenas y se recalculan al editar. Es posible guardar ese borrador con defectos lógicos para completarlo después; publicarlo exige resolverlos. Guardar sigue siendo una acción independiente del docente. La vista previa requiere una versión guardada y un escenario completo.

Si falla la solicitud o el formato no es editable, el escenario anterior permanece. Si el modal se cierra antes de terminar, se ignora la respuesta tardía y se permite seguir editando; una generación nueva espera a que termine la anterior. Cerrar no cancela el consumo que ya haya procesado el proveedor. Una comprobación de revisión/tema impide reemplazar cambios posteriores con una respuesta antigua.

## Verificación

`node --test pruebas/escenario-ia.test.js pruebas/editor-simulacion.test.js pruebas/ia.test.js`

30 pruebas aprobadas: permisos y validación antes del proveedor, contexto del tema, extremos 800 caracteres/5–10 escenas, prompt y configuración de Gemini simulados, cantidad exacta, reintento JSON, errores lógicos corregibles, imágenes inseguras, cuotas y bitácora sin textos; carga temporal, metadatos ignorados, guardado independiente, mapa, errores enlazados, recuperación y descarte de respuestas tardías. Se mantiene además la cobertura previa del servicio de IA.

La suite completa terminó con 273 pruebas aprobadas y ninguna fallida el 4 de noviembre de 2026.

La API y las escrituras de las pruebas utilizan datos temporales aislados. No se hicieron llamadas al proveedor real ni se consumió su cuota. La generación no cambia la colección de simulaciones; el servicio solo conserva sus metadatos habituales de consumo. Quedan pendientes la revisión visual real y una generación manual con la configuración administrativa. No se modificaron credenciales, contenidos académicos activos ni el ZIP.
