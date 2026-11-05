import fs from 'fs';
import path from 'path';
import readline from 'readline';
import bcrypt from 'bcryptjs';

const DIR_SEMILLA = path.resolve('datos', 'semilla');
const DIR_DATOS = path.resolve('datos');
const CLAVE_DEFECTO = 'Demo12345';

const esForzado = process.argv.includes('--forzar');

function preguntar(texto) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(texto, (respuesta) => {
      rl.close();
      resolve(respuesta.trim().toLowerCase());
    });
  });
}

async function ejecutar() {
  if (!fs.existsSync(DIR_SEMILLA)) {
    console.error('El directorio datos/semilla no existe.');
    process.exit(1);
  }

  if (esForzado) {
    const confirmacion = await preguntar(
      '¿Está seguro de forzar la sobreescritura de los datos existentes? (s/N): '
    );
    if (confirmacion !== 's' && confirmacion !== 'si') {
      console.log('Operación cancelada por el usuario.');
      process.exit(0);
    }
  }

  const archivos = fs
    .readdirSync(DIR_SEMILLA)
    .filter((f) => f.endsWith('.json'));

  let hashCache = null;

  for (const archivo of archivos) {
    const rutaOrigen = path.join(DIR_SEMILLA, archivo);
    const rutaDestino = path.join(DIR_DATOS, archivo);

    const existeDestino = fs.existsSync(rutaDestino);

    if (existeDestino && !esForzado) {
      console.log(`[OMITIDO] ${archivo} ya existe en datos/`);
      continue;
    }

    const contenidoRaw = fs.readFileSync(rutaOrigen, 'utf-8');
    let datos = JSON.parse(contenidoRaw);

    // Si es usuarios.json, generar claveHash para todos los registros
    if (archivo === 'usuarios.json' && Array.isArray(datos)) {
      if (!hashCache) {
        hashCache = await bcrypt.hash(CLAVE_DEFECTO, 10);
      }
      datos = datos.map((u) => ({
        ...u,
        claveHash: hashCache
      }));
    }

    fs.writeFileSync(rutaDestino, JSON.stringify(datos), 'utf-8');
    console.log(`[COPIADO] ${archivo} -> datos/${archivo} ${esForzado && existeDestino ? '(sobreescrito)' : ''}`);
  }

  console.log('\nProceso de carga de semilla finalizado exitosamente.');
}

ejecutar().catch((err) => {
  console.error('Error al ejecutar semilla:', err);
  process.exit(1);
});
