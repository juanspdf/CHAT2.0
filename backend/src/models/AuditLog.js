const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Schema de Audit Log con blockchain inmutable
 * Cada registro es un bloque en una cadena hash
 */
const auditLogSchema = new mongoose.Schema({
  blockNumber: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_LOGIN',
      'USER_LOGOUT',
      'ADMIN_LOGIN',
      'ADMIN_LOGIN_SUCCESS',
      'ADMIN_LOGIN_FAILED',
      'ADMIN_LOGOUT',
      'ADMIN_2FA_REQUIRED',
      'ADMIN_2FA_SETUP_INITIATED',
      'ADMIN_2FA_ENABLED',
      'ADMIN_2FA_DISABLED',
      'ADMIN_2FA_VERIFIED',
      'ADMIN_2FA_FAILED',
      'ADMIN_2FA_BACKUP_CODE_USED',
      '2FA_ENABLED',
      '2FA_DISABLED',
      'ROOM_CREATED',
      'ROOM_DELETED',
      'MESSAGE_SENT',
      'MESSAGE_DELETED',
      'FILE_UPLOAD',
      'FILE_UPLOAD_APPROVED',
      'FILE_UPLOAD_FLAGGED',
      'FILE_UPLOAD_REJECTED',
      'ADMIN_ALERT_SENT',
      'STEGANOGRAPHY_DETECTED',
      'SESSION_CREATED',
      'SESSION_DESTROYED',
      'SYSTEM_INIT',
      'SECURITY_ALERT',
      'CONFIG_CHANGED',
      'RATE_LIMIT_EXCEEDED',
      'REFRESH_TOKEN_CREATED',
      'REFRESH_TOKEN_ROTATED',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_NOT_FOUND',
      'REFRESH_TOKEN_INVALID',
      'TOKEN_REUSE_DETECTED',
      'TOKEN_FAMILY_REVOKED',
      'ALL_TOKENS_REVOKED'
    ]
  },
  actor: {
    type: String,
    required: true,
    index: true
  },
  target: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  deviceFingerprint: {
    type: String,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  previousHash: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: false // Usamos nuestro propio timestamp
});

/**
 * Método para calcular el hash de este bloque
 */
auditLogSchema.methods.recalculateHash = function() {
  const data = [
    this.blockNumber,
    this.timestamp.toISOString(),
    this.action,
    this.actor,
    this.target || '',
    this.ipAddress || '',
    JSON.stringify(this.details),
    this.previousHash
  ].join('|');
  
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Hook pre-save: Inmutabilidad (solo INSERT, no UPDATE)
 */
auditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(new Error('Los registros de auditoría son inmutables'));
  }
  next();
});

/**
 * Hook pre-remove: Prevenir eliminación
 */
auditLogSchema.pre('remove', function(next) {
  next(new Error('Los registros de auditoría no pueden eliminarse'));
});

/**
 * Hook pre-deleteOne: Prevenir eliminación
 */
auditLogSchema.pre('deleteOne', function(next) {
  next(new Error('Los registros de auditoría no pueden eliminarse'));
});

/**
 * Hook pre-deleteMany: Prevenir eliminación
 */
auditLogSchema.pre('deleteMany', function(next) {
  next(new Error('Los registros de auditoría no pueden eliminarse'));
});

/**
 * Índices para búsquedas rápidas
 */
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
