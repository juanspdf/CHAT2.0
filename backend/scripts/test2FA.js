/**
 * Script de prueba para 2FA
 * Simula el flujo completo de configuración y uso de 2FA
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const twoFactorAuth = require('../src/services/twoFactorAuth');
const bcrypt = require('bcrypt');

async function test2FA() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Buscar admin
    const admin = await Admin.findOne({ username: 'admin' });
    
    if (!admin) {
      console.log('❌ Admin no encontrado. Primero crea un admin.');
      process.exit(1);
    }

    console.log('👤 Admin encontrado:', admin.username);
    console.log('🔐 2FA habilitado:', admin.twoFactorEnabled);
    console.log('');

    // ============================================
    // PASO 1: Generar secreto y QR code
    // ============================================
    console.log('📱 PASO 1: Configurando 2FA...');
    console.log('─'.repeat(50));
    
    const { secret, otpauth_url } = twoFactorAuth.generateSecret(admin.username);
    const qrCode = await twoFactorAuth.generateQRCode(otpauth_url);
    
    // Guardar secreto temporalmente
    admin.twoFactorSecret = secret;
    await admin.save();
    
    console.log('✅ Secreto generado:', secret);
    console.log('\n📊 Código QR (copia esta URL y ábrela en tu navegador):');
    console.log(qrCode);
    console.log('\n💡 INSTRUCCIONES:');
    console.log('   1. Abre Google Authenticator en tu móvil');
    console.log('   2. Escanea el código QR de arriba (ábrelo en navegador)');
    console.log('   3. Espera a que se genere un código de 6 dígitos');
    console.log('   4. Ingresa ese código cuando se te pida\n');
    
    // Esperar input del usuario
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // ============================================
    // PASO 2: Verificar token y activar 2FA
    // ============================================
    await new Promise((resolve) => {
      readline.question('🔑 Ingresa el código de 6 dígitos de Google Authenticator: ', async (token) => {
        console.log('\n🔍 PASO 2: Verificando token...');
        console.log('─'.repeat(50));
        
        const isValid = twoFactorAuth.verifyToken(admin.twoFactorSecret, token);
        
        if (isValid) {
          console.log('✅ Token válido! Activando 2FA...');
          
          // Activar 2FA
          admin.twoFactorEnabled = true;
          
          // Generar códigos de respaldo
          const backupCodes = twoFactorAuth.generateBackupCodes();
          admin.backupCodes = backupCodes.map(code => 
            bcrypt.hashSync(code, 10)
          );
          
          await admin.save();
          
          console.log('\n🎉 2FA ACTIVADO EXITOSAMENTE!\n');
          console.log('🔐 CÓDIGOS DE RESPALDO (guárdalos en un lugar seguro):');
          console.log('─'.repeat(50));
          backupCodes.forEach((code, index) => {
            console.log(`   ${index + 1}. ${code}`);
          });
          console.log('─'.repeat(50));
          console.log('⚠️  IMPORTANTE: Estos códigos solo se muestran UNA VEZ');
          console.log('   Úsalos si pierdes acceso a Google Authenticator\n');
          
          // ============================================
          // PASO 3: Probar verificación
          // ============================================
          readline.question('\n🔑 Ingresa un NUEVO código de Google Authenticator para probar: ', async (testToken) => {
            console.log('\n🧪 PASO 3: Probando autenticación...');
            console.log('─'.repeat(50));
            
            const testValid = twoFactorAuth.verifyToken(admin.twoFactorSecret, testToken);
            
            if (testValid) {
              console.log('✅ ¡AUTENTICACIÓN EXITOSA!');
              console.log('   El sistema 2FA está funcionando correctamente\n');
            } else {
              console.log('❌ Token inválido');
              console.log('   Asegúrate de usar el código actual de Google Authenticator\n');
            }
            
            // ============================================
            // Resumen final
            // ============================================
            console.log('\n📋 RESUMEN DE CONFIGURACIÓN:');
            console.log('═'.repeat(50));
            console.log(`👤 Usuario: ${admin.username}`);
            console.log(`🔐 2FA habilitado: ${admin.twoFactorEnabled ? '✅ SÍ' : '❌ NO'}`);
            console.log(`🔑 Códigos de respaldo: ${admin.backupCodes?.length || 0}`);
            console.log('═'.repeat(50));
            
            console.log('\n💡 SIGUIENTE PASO:');
            console.log('   Ahora cuando hagas login como admin, se te pedirá');
            console.log('   el código de Google Authenticator además de la contraseña.\n');
            
            console.log('🌐 PRUEBA EL LOGIN:');
            console.log('   1. Ve a: http://localhost:5173/admin (o tu URL de frontend)');
            console.log('   2. Login con usuario: admin');
            console.log('   3. Después de la contraseña, ingresa el código 2FA\n');
            
            readline.close();
            await mongoose.connection.close();
            console.log('👋 Desconectado de MongoDB');
            process.exit(0);
          });
          
        } else {
          console.log('❌ Token inválido');
          console.log('   Por favor, intenta de nuevo con el código actual\n');
          readline.close();
          await mongoose.connection.close();
          process.exit(1);
        }
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar test
test2FA();
