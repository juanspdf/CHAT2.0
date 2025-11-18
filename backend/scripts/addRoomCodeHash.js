const mongoose = require('mongoose');
const Room = require('../src/models/Room');
const encryptionService = require('../src/services/encryptionService');

/**
 * Migración: Agregar roomCodeHash a salas existentes
 */
async function addRoomCodeHash() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat-system';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB conectado');

    // Buscar salas sin roomCodeHash o con roomCode en texto plano
    const rooms = await Room.find({}).select('+roomCode');
    console.log(`\n📊 Salas encontradas: ${rooms.length}`);

    if (rooms.length === 0) {
      console.log('ℹ️  No hay salas para migrar');
      process.exit(0);
    }

    let migrated = 0;
    let errors = 0;

    for (const room of rooms) {
      try {
        if (!room.roomCodeHash && room.roomCode) {
          // Generar hash del roomCode existente
          const hash = encryptionService.hashRoomCode(room.roomCode);
          
          room.roomCodeHash = hash;
          await room.save();
          
          console.log(`✅ Hash agregado: ${room.roomCode} → ${hash.substring(0, 16)}...`);
          migrated++;
        } else if (room.roomCodeHash) {
          console.log(`⏭️  Saltado: ${room.roomCode || '[HASH EXISTE]'} (ya tiene hash)`);
        } else {
          console.log(`⚠️  Advertencia: Sala ${room._id} sin roomCode`);
          errors++;
        }
      } catch (error) {
        console.error(`❌ Error procesando sala ${room._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Resumen:');
    console.log(`   Migradas: ${migrated}`);
    console.log(`   Errores: ${errors}`);
    console.log(`   Total: ${rooms.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

addRoomCodeHash();
