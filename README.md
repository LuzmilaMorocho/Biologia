# Ecosistema Educativo Digital · Biología

Aplicación educativa Node.js/Express con interfaz en español y almacenamiento JSON.

## Render

- Tipo: Web Service, rama `main`, entorno Node.js 20 o superior.
- Build Command: `npm ci --omit=dev`.
- Start Command: `npm start`.
- Variable `PUERTO=10000`: la aplicación utiliza PUERTO.
- Ejecutar una sola instancia y conservar `datos/` y `publico/recursos/subidas/` en almacenamiento persistente antes de utilizar cuentas reales.
- Crear el administrador con `npm run crear-admin` desde la consola del servidor.
- Configurar la clave de IA en el servidor; no publicarla en GitHub.

El código preparado incluye los contenidos académicos hasta P12.4. Las cuentas y la actividad se inicializan vacías. No ejecutar la semilla sobre datos de producción.

Subir este repositorio no crea ni verifica por sí solo un servicio de Render. La aplicación sirve también la interfaz desde su propio dominio HTTPS.
