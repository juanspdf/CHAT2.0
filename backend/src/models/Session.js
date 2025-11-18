const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  // Fingerprint completo del dispositivo
  deviceFingerprint: {
    type: String,
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgentHash: {
    type: String,
    required: true
  },
  nickname: {
    type: String,
    required: true,
    trim: true
  },
  // Nickname hasheado para mostrar en frontend (privacidad)
  nicknameHash: {
    type: String,
    required: true
  },
  socketId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Index compuesto para búsquedas rápidas
sessionSchema.index({ deviceId: 1, isActive: 1 });
sessionSchema.index({ deviceFingerprint: 1, isActive: 1 });
sessionSchema.index({ roomId: 1, isActive: 1 });

module.exports = mongoose.model('Session', sessionSchema);
