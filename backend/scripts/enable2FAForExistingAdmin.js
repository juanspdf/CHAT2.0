require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const Admin = require('../src/models/Admin');

async function enable2FA() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');

    const username = process.argv[2] || 'admin';

    // Buscar admin
    const admin = await Admin.findOne({ username });
    if (!admin) {
      console.log('❌ Usuario no encontrado');
      process.exit(1);
    }

    if (admin.twoFactorEnabled) {
      console.log('⚠️  Este usuario ya tiene 2FA habilitado');
      process.exit(0);
    }

    // Generar 2FA
    const secret = speakeasy.generateSecret({
      name: `ChatSystem - ${username}`,
      length: 32
    });

    // Generar códigos de respaldo
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      backupCodes.push(code);
    }

    // Hash de códigos de respaldo
    const hashedBackupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    // Actualizar admin
    admin.twoFactorEnabled = true;
    admin.twoFactorSecret = secret.base32;
    admin.backupCodes = hashedBackupCodes;
    await admin.save();

    // Generar código QR
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    console.log('✅ 2FA habilitado exitosamente para:', username);
    console.log('\n📱 CONFIGURACIÓN 2FA:');
    console.log('   Escanea este código QR con Google Authenticator, Microsoft Authenticator o Authy:');
    console.log(`\n   ${qrCode}\n`);
    console.log('🔑 Códigos de respaldo (guárdalos en un lugar seguro):');
    backupCodes.forEach((code, i) => {
      console.log(`   ${i + 1}. ${code}`);
    });
    console.log('\n⚠️  IMPORTANTE: Estos códigos no se mostrarán de nuevo!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

enable2FA();
