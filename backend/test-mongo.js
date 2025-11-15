/**
 * Script para probar la conexión a MongoDB
 * Uso: node test-mongo.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Probando conexión a MongoDB...\n');
console.log('URI:', process.env.MONGODB_URI);
console.log('');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ ¡Conexión exitosa a MongoDB!');
    console.log('Base de datos:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ Error de conexión:');
    console.log(error.message);
    console.log('\n💡 Soluciones:');
    console.log('1. Si usas MongoDB local: ejecuta "mongod" en otra terminal');
    console.log('2. Si usas MongoDB Atlas: verifica tu cadena de conexión en .env');
    console.log('3. Verifica que el usuario y contraseña sean correctos');
    console.log('4. En Atlas, verifica que tu IP esté en la whitelist');
    process.exit(1);
  });
