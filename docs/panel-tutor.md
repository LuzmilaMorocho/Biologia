# P11.4 · Uso del tutor en el panel docente

`publico/js/modulos/panel-docente.js` añade la tarjeta **Uso del tutor**, vinculada al selector de grupo existente. Consulta `GET /api/resumen/tutor/:grupoId` mediante `api.llamar()`. La autorización docente/admin y el aislamiento del grupo siguen a cargo de la ruta implementada en P11.1; no se cambia el servidor.

La tarjeta utiliza exclusivamente `porTema[{ titulo, consultas }]` y `porEstudiante[{ nombre, consultas }]`. No consulta conversaciones, historiales ni mensajes del tutor. Los títulos y nombres se escapan antes de incorporarlos al HTML. Las cantidades se normalizan a enteros no negativos.

## Gráfico y tabla

El gráfico muestra hasta cinco temas con consultas positivas, ordenados por cantidad descendente y por título cuando hay empate. Usa [barras horizontales de Chart.js con `indexAxis: 'y'`](https://www.chartjs.org/docs/latest/charts/bar.html), colores y familia tipográfica obtenidos de los tokens, eje de cantidades desde cero y marcas enteras. Las etiquetas largas se abrevian en el eje; las cifras alternativas conservan los títulos completos. La tabla de estudiantes incluye los ceros y se ordena por nombre.

El canvas tiene nombre accesible y una lista equivalente de temas/cantidades asociada por `aria-describedby`, siguiendo las [consideraciones de accesibilidad de Chart.js](https://www.chartjs.org/docs/latest/general/accessibility.html). Con movimiento reducido se desactiva la animación del gráfico nuevo. El contenedor usa [dimensiones relativas y `maintainAspectRatio: false`](https://www.chartjs.org/docs/latest/configuration/responsive.html) para adaptarse al espacio disponible. La tarjeta pasa a una columna cuando no cabe el gráfico junto a la tabla; el selector de grupo también ajusta su ancho.

## Carga y recuperación

Al cambiar de grupo se destruyen los gráficos anteriores y se limpian los datos previos. Las versiones de las solicitudes impiden que una respuesta antigua, de la API o de la carga de Chart.js, sobrescriba el grupo actual. La tarjeta del tutor se carga independientemente del resumen de rendimiento y tiene un botón de reintento propio cuando falla su API.

Se reutiliza Chart.js 4.4.1 desde el CDN que ya utilizaba el panel. La carga compartida evita insertar un script por cada gráfico simultáneo; un error o un plazo de 15 segundos rechaza la carga y permite un intento posterior. La revisión de P11.4 corrigió la búsqueda del script para ignorar mayúsculas: reconoce la ruta `Chart.js`, retira el script fallido antes de reintentar y evita acumular etiquetas al recuperar el CDN. Si el gráfico del tutor no se puede crear, la tarjeta conserva la tabla y presenta la lista de cifras por tema como alternativa visible. Si no hay consultas, muestra un estado vacío y no dibuja barras con ceros. Si no hay estudiantes, la tabla lo indica.

Se conservan la tabla de rendimiento, su ordenación, los modales existentes y la exportación CSV. La tarjeta no añade textos del tutor al CSV. Estudiantes y usuarios sin sesión no inician las consultas de este panel.

## Verificación

`node --test pruebas/panel-tutor.test.js pruebas/tutor-tema.test.js`

La revisión terminó con 17 pruebas específicas aprobadas y ninguna fallida; la comprobación de sintaxis también aprobó. Utilizan DOM y Chart.js simulados para verificar orden y límite de cinco temas, barras horizontales, nombres escapados, ceros, ausencia de textos privados, cambios rápidos de grupo, destrucción de gráficos, reintentos independientes, fallo y recuperación del CDN sin scripts duplicados, roles y movimiento reducido. La prueba nueva reprodujo el defecto antes de corregirlo. Las pruebas del servidor comprueban el resumen por grupo/asignatura y sus permisos. Como antecedente, la suite completa terminó con 233 pruebas aprobadas el 4 de noviembre de 2026, antes de añadir esta regresión. La revisión visual con Chart.js real y a 360 px sigue pendiente. No se actualiza ningún ZIP.
