const mongoose = require('mongoose');
const Room = require('../src/models/Room');
const encryptionService = require('../src/services/encryptionService');

/**
 * Script de migración: Encriptar roomCodes existentes
 */
async function migrateRoomCodes() {
  try {
    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat-system';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB conectado');

    // Obtener todas las salas
    const rooms = await Room.find({});
    console.log(`\n📊 Salas encontradas: ${rooms.length}`);

    if (rooms.length === 0) {
      console.log('ℹ️  No hay salas para migrar');
      process.exit(0);
    }

    let migrated = 0;
    let skipped = 0;

    for (const room of rooms) {
      try {
        // Verificar si el roomCode parece ser texto plano (6 caracteres alfanuméricos)
        const isPlainText = /^[A-Z0-9]{6}$/.test(room.roomCode);
        
        if (isPlainText) {
          // roomCode está en texto plano, necesita encriptarse
          const plainRoomCode = room.roomCode;
          const encryptedRoomCode = encryptionService.encryptRoomCode(plainRoomCode);
          
          room.roomCode = encryptedRoomCode;
          await room.save();
          
          console.log(`✅ Migrado: ${plainRoomCode} → [ENCRIPTADO]`);
          migrated++;
        } else {
          // Ya está encriptado (no coincide con patrón de texto plano)
          const decrypted = encryptionService.decryptRoomCode(room.roomCode);
          console.log(`⏭️  Saltado: [YA ENCRIPTADO] → ${decrypted || 'N/A'}`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error procesando sala ${room._id}:`, error.message);
      }
    }

    console.log('\n📈 Resumen:');
    console.log(`   Migradas: ${migrated}`);
    console.log(`   Saltadas: ${skipped}`);
    console.log(`   Total: ${rooms.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrateRoomCodes();
