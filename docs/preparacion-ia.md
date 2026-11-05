# Configuración de IA para glosario y banco de preguntas

Proveedor elegido: Gemini. El desplegable incluye los modelos estables `gemini-3.5-flash-lite`, `gemini-3.6-flash` y `gemini-3.1-flash-lite`, además de `gemini-3.8-flash` y `gemini-4-argon`. Se mantiene compatibilidad con la configuración previa de OpenAI. Ningún modelo tiene disponibilidad permanente garantizada; depende de la cuenta, la cuota y la demanda.

## Configuración desde el administrador

1. Tras incorporar estos archivos, reiniciar el servidor una vez con `npm start`.
2. Ingresar como admin y abrir **Configuración de IA** (`/paginas/admin-ia.html`).
3. Seleccionar Gemini, introducir la clave completa y elegir el modelo del desplegable; guardar. No es necesario escribir su identificador.
4. Usar **Consultar modelos disponibles** para actualizar el mismo desplegable con los modelos devueltos por esa clave, ordenando primero las opciones conocidas. Elegir otro modelo y guardar si corresponde. La lista no prueba capacidad ni cuota en ese momento.
5. Pulsar **Probar conexión**. La prueba usa la configuración guardada y debe devolver OK. Luego usar Generar con IA en el glosario o banco.

Los cambios guardados se aplican a las siguientes solicitudes sin reiniciar. Dejar la clave vacía conserva la anterior del mismo proveedor. Cambiar de proveedor requiere su clave completa. Un fragmento no permite establecer la conexión.

La configuración administrativa tiene prioridad sobre `.env` y se guarda mediante el almacén en `datos/config/ia.json`, excluido de Git. Ninguna ruta devuelve la clave; GET solo informa proveedor, modelo, claveConfigurada y fuente. Las rutas GET/PUT `/api/admin/ia` y GET `/api/admin/ia/modelos` requieren admin y deshabilitan caché. No se guarda la clave en el almacenamiento del navegador.

## Configuración local

Si aún no hay configuración administrativa, se usan estas variables de `.env`:

```dotenv
IA_PROVEEDOR=gemini
IA_CLAVE=
IA_MODELO=gemini-3.8-flash
```

`IA_CLAVE` debe contener una clave real del proveedor. `.env` ya está excluido de Git; no copiar claves a `.env.ejemplo` ni a archivos públicos. Si falta la clave, el servicio devuelve 503. La configuración administrativa permite completar este dato sin editar el archivo.

## Cuenta del proveedor

Crear o usar una cuenta de Google AI Studio y obtener una clave de Gemini API para el proyecto. La cuenta debe tener acceso al modelo seleccionado. La consulta de modelos y la prueba del administrador permiten comprobarlo con la clave completa.

Los cupos diarios del proyecto cuentan solicitudes por usuario; la cuenta y facturación del proveedor se gestionan por separado. Este cambio no crea cuentas ni configura pagos.

## Prompt y alcance

`servidor/prompts/generar-glosario.txt` contiene el Anexo B.1 proporcionado, con espacios y saltos de línea normalizados. Conserva los siete parámetros: `asignatura`, `nivel`, `tema`, `contenido`, `existentes`, `cantidad` y `minimoSeisLetras`.

El servicio P07.1 sustituye los parámetros, une listas con saltos de línea, recorta cada valor a 6.000 caracteres y valida los campos y tipos de la respuesta. Si el JSON o su esquema falla, reintenta una vez. En P07.2 el docente revisa la cantidad y el contenido antes de aprobar. El editor señala duplicados normalizados y exige campos completos, término de una palabra, definición de máximo 25 palabras y pista de máximo 10. Los contadores muestran los términos de seis letras; las instrucciones del prompt no garantizan esa cantidad.

## Uso del servicio P07.1

- `POST /api/ia/generar-glosario`, con sesión de docente o admin: cuerpo `{ "temaId": "ID_REAL_DEL_TEMA", "cantidad": 5 }`. Devuelve la lista generada sin guardarla como glosario. El docente debe poder editar el tema; solo se aceptan esas dos propiedades.
- `POST /api/ia/generar-preguntas`, con sesión de docente o admin: cuerpo `{ "temaId": "ID_REAL_DEL_TEMA", "nivel": 1, "cantidad": 10 }`. Nivel cognitivo de 1 a 5 y cantidad de 5 a 15; el nivel educativo del prompt se obtiene de la asignatura. Incluye contenido, glosario y enunciados existentes del tema/nivel desde el servidor. Las propuestas solo se guardan al aprobarlas desde `/paginas/banco-preguntas.html`.
- `GET /api/ia/prueba`, con sesión de admin: devuelve `{ "resultado": "OK" }` si el proveedor responde lo solicitado. Consume una petición real.
- Los demás preparadores y prompts se incorporarán en sus tareas correspondientes; si no existe el preparador, la ruta devuelve 404.
- `ejecutarTarea(tarea, datos, usuario, { formato })` usa fetch nativo y un plazo total de 60 segundos para todos los intentos. Con proveedores/modelos que permiten personalizar temperatura usa 0,4; tutor y rol-simulacion usan 0,7. Gemini 3 y posteriores conservan el muestreo predeterminado recomendado por Google.
- Cupos por usuario y día de Ecuador: tutor y rol-simulacion comparten `limiteTutorDiario`; generar-*, evaluar-rol y la prueba usan `limiteIADiario`. Cada ejecución enviada al proveedor cuenta una vez, aunque falle o necesite reintento. Los reintentos suman caracteres al registro de la misma ejecución.
- `datos/consumo-ia.jsonl` guarda exclusivamente usuarioId, tarea, entrada y salida en caracteres, ok y fecha. No guarda las instrucciones ni las respuestas.

La clave se lee solo en el servidor. El navegador recibe el identificador del modelo y envía la clave al guardar, sin recuperarla posteriormente. No se agregaron dependencias ni se modificó `server.js`.

## Gemini: petición HTTP

El servicio usa `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`, encabezado `x-goog-api-key`, `systemInstruction`, `contents` y `generationConfig`. Para JSON solicita `responseMimeType: application/json`, filtra partes de pensamiento y valida la respuesta con los esquemas existentes. Conserva el plazo total de 60 segundos y un reintento de formato.

En Gemini 3 y posteriores se omite temperatura siguiendo las recomendaciones de Google. Los fallos transitorios HTTP 408/500/502/503/504 tienen hasta dos reintentos adicionales con espera exponencial de 1 y 2 segundos y una variación aleatoria breve, dentro del plazo total. Errores de clave, permisos o cuota no se reintentan automáticamente. Cada envío suma sus caracteres al registro de la ejecución. Un HTTP 503 persistente informa saturación y propone seleccionar otro modelo; no se cambia de modelo automáticamente.

Diagnóstico del 2026-11-03: la prueba real de `gemini-3.8-flash` devolvió HTTP 503 UNAVAILABLE por alta demanda. `gemini-3.5-flash-lite` respondió HTTP 200/OK; quedó guardado conservando la clave. La prueba integrada mediante `ejecutarTarea` también devolvió OK.

## Compatibilidad: petición de referencia a OpenAI

Ejemplo de Chat Completions adaptado a las variables del proyecto (shell Bash; no ejecutar sin configurar facturación):

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $IA_CLAVE" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$IA_MODELO\",\"messages\":[{\"role\":\"system\",\"content\":\"Comprueba la conexión.\"},{\"role\":\"user\",\"content\":\"Responde solo: OK\"}],\"temperature\":0.4,\"reasoning_effort\":\"none\",\"store\":false}"
```

Se usa `reasoning_effort: none` con el modelo configurado `gpt-5.4-mini`. Si se cambia `IA_MODELO`, comprobar que admita ese parámetro y temperatura. No se fuerza `json_object` porque los prompts de glosario y preguntas devuelven listas como raíz; el servidor extrae y valida el JSON.

## Verificación

`node --test pruebas/ia.test.js`: pruebas con fetch simulado, datos temporales y sin llamadas facturables. Cubren permisos, preparación, esquemas, reintentos, timeout, cupos concurrentes y privacidad de los registros. La conexión real requiere configurar `IA_CLAVE` y ejecutar la prueba como admin.

`node --test pruebas/ia.test.js pruebas/preguntas.test.js`: 19 pruebas aprobadas. Incluyen preparación de preguntas, acceso por rol/asignatura, lectura y eliminación por ID, los tres tipos de respuesta, edición parcial y generación sin guardado automático. Usan la aplicación Express real con sesiones y datos temporales y proveedor de IA simulado.

`node --test pruebas/ia.test.js pruebas/preguntas.test.js pruebas/configuracion-ia.test.js`: 32 pruebas aprobadas, con Gemini y claves ficticias. Verifican acceso exclusivo de admin, conservación de clave, prioridad de configuración, cambio de modelo sin reiniciar, paginación de modelos, petición Gemini, JSON y reintentos de saturación, conteo de envíos, ausencia de reintentos ante claves/cuotas, errores sin secretos y protección del archivo privado. La prueba real descrita arriba se realizó separadamente.

`node pruebas/editor-ia.js`: abre un servidor de verificación en `http://127.0.0.1:3107/prueba?id=t1`. Al abrir la URL, el navegador ejecuta el editor real con API simulada y comprueba cantidad, duplicados, validación de textos, aprobación parcial, reintento y contadores. Los resultados aparecen en la página y en la terminal. Usa datos en memoria; no requiere clave ni modifica `datos/`. Cerrar la pestaña y detener el servidor con Ctrl+C al terminar.

## Referencias oficiales

- Gemini 3.8 Flash: https://aistudio.google.com/docs/models/gemini-3.8-flash
- Gemini 4 Argon: https://aistudio.google.com/docs/models/gemini-4-argon
- Generación de contenido: https://aistudio.google.com/api-reference/generate-content
- Consulta de modelos: https://aistudio.google.com/api-reference/models
- Catálogo y modelos estables: https://aistudio.google.com/docs/models
- Fallos transitorios y reintentos: https://aistudio.google.com/docs/troubleshooting

- Modelo: https://developers.openai.com/api/docs/models/gpt-5.4-mini
- Límites de gasto: https://developers.openai.com/api/docs/guides/spend-limits
- Petición HTTP: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
