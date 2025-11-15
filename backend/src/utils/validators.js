const validator = require('validator');

// Sanitizar texto para prevenir XSS
const sanitizeText = (text) => {
  if (!text) return '';
  return validator.escape(text.trim());
};

// Validar PIN (mínimo 4 dígitos)
const validatePin = (pin) => {
  if (!pin) return false;
  const pinStr = String(pin);
  return /^\d{4,}$/.test(pinStr);
};

// Validar nickname (3-20 caracteres, no solo espacios)
const validateNickname = (nickname) => {
  if (!nickname || typeof nickname !== 'string') return false;
  const trimmed = nickname.trim();
  return trimmed.length >= 3 && trimmed.length <= 20;
};

// Generar código de sala único (6-8 caracteres alfanuméricos)
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Validar tipo MIME permitido
const validateMimeType = (mimeType) => {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  return allowedTypes.includes(mimeType);
};

// Generar nombre de archivo seguro
const generateSafeFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const extension = originalName.split('.').pop();
  return `${timestamp}-${random}.${extension}`;
};

module.exports = {
  sanitizeText,
  validatePin,
  validateNickname,
  generateRoomCode,
  validateMimeType,
  generateSafeFilename
};
