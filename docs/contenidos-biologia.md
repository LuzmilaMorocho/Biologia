# Contenidos de Biología completados

Se revisó el contenido activo de `datos/asignaturas.json`, `datos/unidades.json` y `datos/temas.json`: una asignatura de Biología de Bachillerato, una unidad y dos temas publicados. Las fichas tenían sus campos básicos, pero parte del desarrollo consistía en descripciones generales de lo que se estudiaría. Se amplió ese desarrollo dentro del campo `resumen`, utilizando el formato de negritas, párrafos y listas que ya presenta la plataforma.

## Temas y subtemas desarrollados

| Tema | Desarrollo |
| --- | --- |
| Recursos naturales: definición, importancia y clasificación | 1. Definición y origen. 2. Importancia ecológica y social. 3. Recursos renovables y límites. 4. No renovables. 5. Energía solar y viento. 6. Agua, cuenca y suelo. 7. Uso responsable en el entorno ecuatoriano. 8. Sostenibilidad. 9. Caso hipotético y actividad. |
| Importancia de la biodiversidad: beneficios, amenazas y conservación | 1. Diversidad genética, de especies y de ecosistemas. 2. Relaciones, hábitat y redes alimentarias. 3. Beneficios y valor de la biodiversidad. 4. Amenazas y consecuencias. 5. Caso hipotético de una ribera. 6. Ejemplos del Ecuador y categorías de especies. 7. Conservación in situ, ex situ y restauración. 8. Observación del entorno y autoevaluación. |

| Campo de la ficha | Recursos naturales | Biodiversidad |
| --- | ---: | ---: |
| Objetivos | 5 | 6 |
| Ejemplos | 6 | 6 |
| Errores frecuentes | 6 | 7 |
| Preguntas guía | 6 | 7 |
| Recursos adjuntos y enlaces | 3 | 4 |

Los ejemplos, objetivos, errores, preguntas, palabras clave y recursos que ya estaban guardados se conservaron y se complementaron. Los títulos, identificadores, unidad, orden, nivel de dificultad, fecha original y publicación se conservaron. Los subtemas son apartados de la ficha existente, por lo que sus enlaces y las referencias de las actividades continúan utilizando los mismos temas.

## Fuentes y criterio didáctico

El material local de biodiversidad es una infografía de una página: *Importancia de la biodiversidad*, Luzmila Morocho, segundo de Bachillerato, 9 de octubre de 2026, licencia CC BY-SA 4.0. Se revisó su imagen completa y se conservó el PDF adjunto. La atribución y la licencia del material adaptado aparecen en el resumen ampliado y en `fuentes`.

El enlace de Drive de recursos naturales no pudo verificarse desde la herramienta de consulta. Se conservó y se añadieron referencias públicas de contraste:

- [FAO: visión general sobre los suelos](https://www.fao.org/land-water/soils/es).
- [FAO: apreciar el suelo sobre el que caminamos](https://www.fao.org/newsroom/story/Cherishing-the-ground-we-walk-on/es).
- [EIA: fuentes de energía](https://www.eia.gov/energyexplained/what-is-energy/sources-of-energy.php).
- [CONABIO: qué es la biodiversidad](https://www.biodiversidad.gob.mx/biodiversidad/que_es.html).
- [Argentina: importancia de la biodiversidad](https://www.argentina.gob.ar/ambiente/contenidos/biodiversidad).
- [PNUMA: factores de pérdida de biodiversidad](https://www.unep.org/en/news-and-stories/story/five-drivers-nature-crisis).
- [Convenio sobre la Diversidad Biológica: definiciones](https://www.cbd.int/convention/articles?a=cbd-02).
- [Ministerio del Ambiente y Agua: conservación de los manglares del Ecuador](https://www.ambienteyenergia.gob.ec/ambiente/la-conservacion-del-ecosistema-de-manglar-una-prioridad-para-el-pais/).

La redacción es una ampliación didáctica en español de Ecuador. Los casos numérico y de la ribera están identificados como hipotéticos. Se explica la formación lenta del suelo, la diferencia entre especie introducida e invasora y entre endemismo y amenaza, para prevenir generalizaciones incorrectas. Las actividades piden evidencias, justificación de decisiones e indicadores sencillos, sin inventar observaciones de una localidad concreta.

## Integración y conservación de datos

La página del tema muestra el desarrollo y las actividades dentro de «Resumen del tema». Los objetivos, ejemplos y recursos usan las secciones existentes. Las preguntas guía y errores frecuentes quedan también disponibles para el editor docente.

Los preparadores de IA toman los campos actualizados desde `datos/temas.json`. El contenido formado por objetivos, resumen y ejemplos ocupa 5.257 caracteres para recursos naturales y 5.887 para biodiversidad: ambos caben en el límite de 6.000 del servicio existente. La selección de fragmentos del tutor y el recorte de 5.700 de la sopa mantienen sus límites propios.

Antes de guardar se creó un respaldo independiente del archivo original en `datos/respaldos/contenidos-biologia-2026-11-04T02-35-30-816Z/temas.json`. Se verificaron JSON, identificadores, conservación de elementos anteriores, formato seguro y tamaño del contexto. Las fechas del respaldo utilizan UTC; corresponden al 3 de noviembre en Ecuador.

La semilla original del repositorio contiene ejemplos antiguos de célula y genética. Para reconocer el trabajo actual se tomó como fuente la colección activa. El generador del ZIP de publicación copia los contenidos académicos activos a su propia semilla de instalación.
