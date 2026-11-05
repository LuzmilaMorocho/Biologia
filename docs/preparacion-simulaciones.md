# Preparación del sprint de simulaciones

El Product Owner eligió las dos situaciones siguientes el 4 de noviembre de 2026. Corresponden a Biología de Bachillerato y a los temas activos de la unidad «Recursos naturales y biodiversidad». Son casos educativos hipotéticos basados en problemas del entorno; no describen hechos comprobados de una localidad o personas reales.

## Situación 1 · Uso responsable del agua

Tema: `tem_000001` · Recursos naturales: definición, importancia y clasificación.

Situación para el generador:

> Una comunidad educativa comparte una fuente de agua con actividades domésticas y agrícolas. Se han observado fugas y existe desacuerdo sobre cómo reducir el desperdicio sin desatender necesidades. El estudiante participa en un comité que debe proponer un plan: identificar la información que falta, priorizar acciones de ahorro, considerar la recuperación de la fuente y acordar un indicador de seguimiento. Las decisiones deben justificarse con el contenido del tema, sin inventar mediciones ni asumir que un recurso renovable es ilimitado.

Contenidos: recursos renovables y sus límites; ciclo del agua; cuenca, vegetación y suelo; uso sostenible y acciones medibles.

Para la futura práctica de rol, el personaje puede ser una persona del comité preocupada por mantener el abastecimiento. El objetivo del estudiante será acordar una acción viable y un indicador, explicando sus razones y escuchando esa preocupación.

## Situación 2 · Conservación de una ribera

Tema: `tem_000002` · Importancia de la biodiversidad: beneficios, amenazas y conservación.

Situación para el generador:

> Una comunidad educativa analiza una propuesta para ampliar una zona de uso común junto a un río. La propuesta incluye retirar vegetación de la ribera; otra parte de la comunidad plantea conservarla y recuperar sectores degradados. El estudiante debe comparar alternativas que consideren el hábitat, la biodiversidad y las necesidades de las personas, solicitar evidencias y proponer una acción de conservación con seguimiento. No se deben inventar especies, observaciones, cifras ni resultados; si falta información, debe reconocerse y decidir cómo obtenerla.

Contenidos: diversidad y hábitat; relaciones ecológicas; beneficios y amenazas; conservación in situ, restauración y evaluación de propuestas.

Para la futura práctica de rol, el personaje puede ser una persona que apoya la ampliación y tiene dudas sobre conservar la vegetación. El objetivo del estudiante será dialogar y justificar una alternativa de conservación viable utilizando el tema.

## Prompts preparados

- `servidor/prompts/generar-escenario.txt`: Anexo B.4, para P12.3; variables `asignatura`, `nivel`, `tema`, `contenido`, `situacion`, `escenas`.
- `servidor/prompts/rol-simulacion.txt`: Anexo B.5, para P12.4; variables `personaje`, `contexto`, `objetivo`, `historial`, `mensaje`.
- `servidor/prompts/evaluar-rol.txt`: Anexo B.6, para P12.4; variables `personaje`, `objetivo`, `rubrica`, `transcripcion`.

Cada archivo contiene una única línea `### USUARIO`, sin escape, compatible con el cargador de `servidor/ia.js`. Se conservaron las instrucciones del anexo y se normalizaron espacios y saltos de línea. Los ejemplos de salida usan números JSON válidos; las reglas explican el intervalo de puntos y el cálculo de las sumas. Las escenas finales tienen cero opciones; el requisito de dos o tres opciones corresponde a las demás escenas.

La preparación aportó los prompts y estas situaciones. P12.1 y P12.2 implementaron el motor y el editor; P12.3 añadió el borrador con IA (ver `docs/escenario-ia.md`), sin guardado automático; P12.4 incorporó la configuración, conversación y evaluación de roles (ver `docs/rol-simulacion.md`). Se reutiliza la configuración de IA administrada por el sistema. No se actualizó el ZIP.
