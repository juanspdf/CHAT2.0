const mongoose = require('mongoose');

/**
 * Schema para Refresh Tokens
 * Permite rotación segura de JWT sin reautenticación
 */
const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  deviceFingerprint: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  // Token family para detectar token reuse (posible ataque)
  family: {
    type: String,
    required: true,
    index: true
  }
});

// Índice compuesto para optimizar búsquedas
refreshTokenSchema.index({ adminId: 1, isRevoked: 1, expiresAt: 1 });

// Método para verificar si el token está válido
refreshTokenSchema.methods.isValid = function() {
  return !this.isRevoked && this.expiresAt > new Date();
};

// Middleware para limpiar tokens expirados automáticamente
// NOTA: Removimos el índice TTL duplicado, Mongoose lo maneja automáticamente con expiresAt
// refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
