const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Servicio de Autenticación 2FA con TOTP
 * Implementa autenticación de dos factores opcional para administradores
 */
class TwoFactorAuthService {
  /**
   * Genera un secreto TOTP para un usuario
   * @param {string} username - Nombre de usuario
   * @returns {Object} Secret y URL para generar QR
   */
  generateSecret(username) {
    const secret = speakeasy.generateSecret({
      name: `ChatSystem (${username})`,
      issuer: 'ChatSystem Secure',
      length: 32
    });

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url
    };
  }

  /**
   * Genera un código QR en base64 para escanear con Google Authenticator
   * @param {string} otpauth_url - URL OTP del secret
   * @returns {Promise<string>} QR code en base64
   */
  async generateQRCode(otpauth_url) {
    try {
      const qrCode = await QRCode.toDataURL(otpauth_url);
      return qrCode;
    } catch (error) {
      console.error('Error generando QR code:', error);
      throw new Error('No se pudo generar el código QR');
    }
  }

  /**
   * Verifica un token TOTP
   * @param {string} secret - Secret base32 del usuario
   * @param {string} token - Token de 6 dígitos ingresado por el usuario
   * @returns {boolean} True si el token es válido
   */
  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Permite 2 pasos de tiempo (±60 segundos)
    });
  }

  /**
   * Genera un código de respaldo (backup code) para emergencias
   * @returns {string} Código de respaldo de 8 caracteres
   */
  generateBackupCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Genera múltiples códigos de respaldo
   * @param {number} count - Cantidad de códigos a generar (default: 10)
   * @returns {string[]} Array de códigos de respaldo
   */
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }
}

module.exports = new TwoFactorAuthService();
