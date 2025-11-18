require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const Admin = require('../src/models/Admin');

async function createAdmin() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');

    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'admin123';

    // Verificar si ya existe
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      console.log('❌ El usuario ya existe');
      process.exit(1);
    }

    // Hash de contraseña usando bcrypt directamente
    const passwordHash = await bcrypt.hash(password, 10);

    // Generar 2FA automáticamente
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

    // Crear admin con 2FA habilitado
    const admin = new Admin({
      username,
      passwordHash,
      twoFactorEnabled: true,
      twoFactorSecret: secret.base32,
      backupCodes: hashedBackupCodes
    });

    await admin.save();

    // Generar código QR
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    console.log('✅ Admin creado exitosamente con 2FA obligatorio');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   ID: ${admin._id}`);
    console.log('\n📱 2FA CONFIGURADO:');
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

createAdmin();
