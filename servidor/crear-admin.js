import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('=== Crear Usuario Administrador ===\n');

    const nombre = (await rl.question('Nombre: ')).trim();
    if (!nombre) {
      console.error('Error: El nombre es obligatorio.');
      process.exit(1);
    }

    const apellido = (await rl.question('Apellido: ')).trim();
    if (!apellido) {
      console.error('Error: El apellido es obligatorio.');
      process.exit(1);
    }

    const correo = (await rl.question('Correo electrónico: ')).trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      console.error('Error: El formato de correo no es válido.');
      process.exit(1);
    }

    const usuarios = await almacen.leer('usuarios');
    if (usuarios.some((u) => u.correo && u.correo.toLowerCase() === correo)) {
      console.error('Error: El correo ya se encuentra registrado.');
      process.exit(1);
    }

    const clave = (await rl.question('Contraseña: ')).trim();
    const regexClave = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!regexClave.test(clave)) {
      console.error(
        'Error: La contraseña debe tener al menos 8 caracteres y contener letras y números.'
      );
      process.exit(1);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoAdmin = {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: 'admin',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoAdmin);

    console.log('\n✓ Administrador creado con éxito:');
    console.log(`  ID: ${creado.id}`);
    console.log(`  Nombre: ${creado.nombre} ${creado.apellido}`);
    console.log(`  Correo: ${creado.correo}`);
    console.log(`  Rol: ${creado.rol}`);
  } catch (error) {
    console.error('Error al crear el administrador:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
