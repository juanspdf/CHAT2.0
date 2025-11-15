/**
 * Script de diagnóstico de conexión a MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');

console.log('\n🔍 DIAGNÓSTICO DE CONEXIÓN A MONGODB\n');
console.log('='.repeat(50));

// Verificar variables de entorno
console.log('\n1️⃣ Variables de entorno:');
console.log('   MONGODB_URI:', process.env.MONGODB_URI);
console.log('   Puerto detectado:', process.env.MONGODB_URI?.includes('27017') ? '27017 ✅' : '❌ Puerto incorrecto');

// Verificar módulos instalados
console.log('\n2️⃣ Módulos:');
console.log('   mongoose versión:', mongoose.version);
console.log('   dotenv cargado: ✅');

// Intentar conectar
console.log('\n3️⃣ Intentando conectar...');
console.log('='.repeat(50));

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat-system';

mongoose.set('strictQuery', false);

mongoose.connect(uri)
  .then(() => {
    console.log('\n✅ ¡CONEXIÓN EXITOSA!');
    console.log('='.repeat(50));
    console.log('📊 Información de la conexión:');
    console.log('   Base de datos:', mongoose.connection.name);
    console.log('   Host:', mongoose.connection.host);
    console.log('   Puerto:', mongoose.connection.port);
    console.log('   Estado:', mongoose.connection.readyState === 1 ? 'Conectado ✅' : 'Desconectado ❌');
    console.log('='.repeat(50));
    
    mongoose.disconnect();
    console.log('\n✅ Todo funciona correctamente. Puedes iniciar el servidor.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ ERROR DE CONEXIÓN');
    console.log('='.repeat(50));
    console.log('Tipo de error:', error.name);
    console.log('Mensaje:', error.message);
    
    console.log('\n💡 SOLUCIONES POSIBLES:');
    console.log('='.repeat(50));
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('❌ MongoDB no está corriendo o no acepta conexiones');
      console.log('\n   Soluciones:');
      console.log('   1. Verifica que mongod esté corriendo:');
      console.log('      > mongod --version');
      console.log('   2. Inicia MongoDB en otra terminal:');
      console.log('      > mongod');
      console.log('   3. O verifica el servicio de MongoDB:');
      console.log('      > net start MongoDB');
    } else if (error.message.includes('authentication')) {
      console.log('❌ Error de autenticación');
      console.log('\n   Solución:');
      console.log('   - MongoDB local no debería requerir autenticación por defecto');
      console.log('   - Intenta con: mongodb://127.0.0.1:27017/chat-system');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('❌ No se encontró el host');
      console.log('\n   Solución:');
      console.log('   - Cambia localhost por 127.0.0.1 en .env');
    } else {
      console.log('Error completo:', error);
    }
    
    console.log('\n='.repeat(50));
    console.log('\n');
    process.exit(1);
  });

// Timeout de seguridad
setTimeout(() => {
  console.log('\n⏱️  Timeout: La conexión tardó demasiado');
  console.log('Verifica que MongoDB esté corriendo en el puerto 27017\n');
  process.exit(1);
}, 10000);
