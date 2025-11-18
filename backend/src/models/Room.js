const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    trim: true,
    select: false // No incluir por defecto (solo para admin)
  },
  roomCodeHash: {
    type: String,
    required: true,
    unique: true,
    index: true // Indexar para búsqueda rápida
  },
  pinHash: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['TEXT', 'MULTIMEDIA'],
    required: true,
    default: 'TEXT'
  },
  maxFileSizeMB: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  // Cifrado End-to-End
  encryptionEnabled: {
    type: Boolean,
    default: false
  },
  encryptionKey: {
    type: String,
    default: null
  },
  encryptionIV: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'CLOSED'],
    default: 'ACTIVE'
  }
});

module.exports = mongoose.model('Room', roomSchema);
