require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Admin = require('../src/models/Admin');

async function showQRCode() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');

    const username = process.argv[2] || 'admin';
    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      console.log('❌ Usuario no encontrado');
      process.exit(1);
    }

    if (!admin.twoFactorEnabled || !admin.twoFactorSecret) {
      console.log('❌ Este usuario no tiene 2FA habilitado');
      process.exit(1);
    }

    // Generar URL OTP auth
    const otpauthUrl = `otpauth://totp/ChatSystem%20-%20${username}?secret=${admin.twoFactorSecret}&issuer=ChatSystem`;
    
    // Generar código QR
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    console.log('\n📱 CONFIGURACIÓN 2FA PARA:', username);
    console.log('\n1. Abre Google Authenticator, Microsoft Authenticator o Authy');
    console.log('2. Selecciona "Escanear código QR" o "Agregar cuenta"');
    console.log('3. Copia el siguiente código y pégalo en tu navegador para ver el QR:\n');
    console.log(qrCode);
    console.log('\n4. Escanea el QR con tu app de autenticación');
    console.log('\n5. La app generará códigos de 6 dígitos cada 30 segundos');
    console.log('\n📝 O puedes agregar manualmente con esta clave:');
    console.log(`   Secret: ${admin.twoFactorSecret}`);
    console.log(`   Cuenta: ChatSystem - ${username}`);
    console.log(`   Tipo: Basado en tiempo (TOTP)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

showQRCode();
