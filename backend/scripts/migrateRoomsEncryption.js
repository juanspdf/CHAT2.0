/**
 * Script de migración: Añadir claves de cifrado a salas existentes
 * 
 * Ejecutar con: node scripts/migrateRoomsEncryption.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Room = require('../src/models/Room');
const encryptionService = require('../src/services/encryptionService');

async function migrateRooms() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar salas sin claves de cifrado
    const roomsWithoutKeys = await Room.find({
      $or: [
        { encryptionKey: { $exists: false } },
        { encryptionKey: null },
        { encryptionIV: { $exists: false } },
        { encryptionIV: null }
      ]
    });

    console.log(`🔍 Encontradas ${roomsWithoutKeys.length} salas sin claves de cifrado`);

    if (roomsWithoutKeys.length === 0) {
      console.log('✅ Todas las salas ya tienen claves de cifrado');
      process.exit(0);
    }

    // Generar claves para cada sala
    for (const room of roomsWithoutKeys) {
      const { key, iv } = encryptionService.generateRoomKey();
      
      room.encryptionKey = key;
      room.encryptionIV = iv;
      
      await room.save();
      
      console.log(`✅ Claves generadas para sala: ${room.roomCode}`);
    }

    console.log(`\n🎉 Migración completada: ${roomsWithoutKeys.length} salas actualizadas`);
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('👋 Desconectado de MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrateRooms();
