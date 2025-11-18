const mongoose = require('mongoose');
const Room = require('../src/models/Room');
const CryptoJS = require('crypto-js');

/**
 * Script para restaurar roomCodes de encriptados a texto plano
 */
async function restoreRoomCodes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chat-system';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB conectado');

    const rooms = await Room.find({});
    console.log(`\n📊 Salas encontradas: ${rooms.length}`);

    if (rooms.length === 0) {
      console.log('ℹ️  No hay salas');
      process.exit(0);
    }

    let restored = 0;
    const masterKey = process.env.ROOM_CODE_ENCRYPTION_KEY || 'default-room-code-key-change-in-production';

    for (const room of rooms) {
      try {
        // Intentar desencriptar con CryptoJS
        const bytes = CryptoJS.AES.decrypt(room.roomCode, masterKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        
        if (decrypted && /^[A-Z0-9]{6}$/.test(decrypted)) {
          // Éxito al desencriptar
          room.roomCode = decrypted;
          await room.save();
          console.log(`✅ Restaurado: [ENCRIPTADO] → ${decrypted}`);
          restored++;
        } else {
          console.log(`⏭️  Saltado: Ya en texto plano → ${room.roomCode}`);
        }
      } catch (error) {
        console.log(`⏭️  Saltado: Ya en texto plano → ${room.roomCode}`);
      }
    }

    console.log(`\n📈 Resumen: ${restored} salas restauradas`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

restoreRoomCodes();
