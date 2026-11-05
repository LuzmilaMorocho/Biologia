# Almacenamiento persistente en Render

Servicio: Biologia (srv-dbluv7ou01pc73frp8c0). Una sola instancia.

## Activacion
1. Antes de cualquier redespliegue, exportar los datos y subidas creados en la instancia gratuita si los hubiera. El repositorio solo contiene el material inicial; no contiene la actividad de esa instancia.
2. Contratar el plan Starter y un disco de 1 GB, previa autorizacion del costo.
3. Montar el disco en /var/data y configurar RAIZ_PERSISTENTE=/var/data. Conservar PUERTO=10000, npm ci --omit=dev y npm start.
4. El primer arranque copia datos/ y publico/recursos/subidas/ al disco sin reemplazar archivos existentes. Los siguientes arranques conservan el contenido del disco. Importar los datos exportados antes de abrir el servicio a usuarios.
5. Mantener una sola instancia. No ejecutar npm run semilla en produccion: es una utilidad para datos locales.

El disco almacena colecciones, configuracion, cuentas, bitacoras, respaldos y subidas. La URL de las subidas se mantiene en /recursos/subidas/.
Sin RAIZ_PERSISTENTE, la aplicacion mantiene las rutas locales anteriores. La variable por si sola no garantiza persistencia: se debe comprobar el montaje real en Render.

## Como probar
Crear una cuenta y subir un archivo de prueba. Redesplegar, comprobar que ambos siguen disponibles y que el material inicial carga. Descargar respaldos a otro lugar ademas de conservar las copias del disco.
