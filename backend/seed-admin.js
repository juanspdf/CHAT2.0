/**
 * Script para crear administrador directamente en MongoDB
 * Uso: node seed-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./src/models/Admin');

const createAdmin = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Datos del admin
    const username = 'admin';
    const password = 'admin123';

    // Verificar si ya existe
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      console.log('⚠️  El administrador ya existe');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Crear hash de contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear admin
    const admin = new Admin({
      username,
      passwordHash
    });

    await admin.save();

    console.log('\n✅ Administrador creado exitosamente!');
    console.log('Usuario:', username);
    console.log('Contraseña:', password);
    console.log('\nPuedes iniciar sesión en http://localhost:5173/admin/login');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

createAdmin();
