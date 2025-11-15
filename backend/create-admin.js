/**
 * Script para crear el primer administrador
 * Uso: node create-admin.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=== Crear Administrador ===\n');

rl.question('Usuario: ', (username) => {
  rl.question('Contraseña: ', (password) => {
    rl.close();

    const data = JSON.stringify({
      username: username.trim(),
      password: password.trim()
    });

    const http = require('http');

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('\n--- Respuesta del servidor ---');
        console.log('Status:', res.statusCode);
        try {
          const parsed = JSON.parse(responseData);
          console.log(JSON.stringify(parsed, null, 2));
          
          if (res.statusCode === 201) {
            console.log('\n✅ Administrador creado exitosamente!');
            console.log('Ahora puedes iniciar sesión en http://localhost:5173/admin/login');
          } else {
            console.log('\n❌ Error al crear administrador');
          }
        } catch (e) {
          console.log(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Error de conexión:', error.message);
      console.log('\nAsegúrate de que el servidor backend esté corriendo:');
      console.log('  cd backend');
      console.log('  npm run dev');
    });

    req.write(data);
    req.end();
  });
});
