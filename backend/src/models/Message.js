const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  senderNickname: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['TEXT', 'FILE'],
    required: true,
    default: 'TEXT'
  },
  content: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileMimeType: {
    type: String,
    default: null
  },
  fileSizeBytes: {
    type: Number,
    default: null
  },
  // Cifrado y seguridad
  encrypted: {
    type: Boolean,
    default: false
  },
  encryptionTag: {
    type: String,
    default: null
  },
  contentHash: {
    type: String,
    default: null
  },
  signature: {
    type: String,
    default: null
  },
  // Análisis de esteganografía (para archivos)
  steganographyAnalysis: {
    verdict: {
      type: String,
      enum: ['APROBADO', 'ADVERTENCIA', 'ALERTA', 'RECHAZADO', null],
      default: null
    },
    riskScore: {
      type: Number,
      default: null
    },
    analysisTime: {
      type: Number,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
