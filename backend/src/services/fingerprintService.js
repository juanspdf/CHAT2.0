const crypto = require('crypto');

/**
 * Servicio de Fingerprinting de Dispositivos
 * Genera huellas digitales únicas basadas en IP + User Agent
 */
class FingerprintService {
  /**
   * Genera hash SHA-256 de un string
   * @param {string} data - Datos a hashear
   * @returns {string} Hash hexadecimal
   */
  static hash(data) {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Genera fingerprint completo del dispositivo
   * @param {string} ipAddress - Dirección IP del cliente
   * @param {string} userAgent - User Agent del navegador
   * @returns {string} Fingerprint único (SHA-256)
   */
  static generateFingerprint(ipAddress, userAgent) {
    const combined = `${ipAddress}||${userAgent}`;
    return this.hash(combined);
  }

  /**
   * Genera hash del user agent
   * @param {string} userAgent - User Agent del navegador
   * @returns {string} Hash del user agent
   */
  static hashUserAgent(userAgent) {
    return this.hash(userAgent || 'unknown');
  }

  /**
   * Genera hash del nickname para privacidad
   * @param {string} nickname - Nickname del usuario
   * @param {string} salt - Salt adicional (opcional)
   * @returns {string} Hash del nickname
   */
  static hashNickname(nickname, salt = '') {
    return this.hash(`${nickname}||${salt}`).substring(0, 16);
  }

  /**
   * Extrae IP real del cliente considerando proxies
   * @param {Object} headers - Headers de la request
   * @param {string} remoteAddress - Remote address del socket
   * @returns {string} IP real del cliente
   */
  static extractRealIP(headers, remoteAddress) {
    // Verificar headers de proxy
    const forwardedFor = headers['x-forwarded-for'];
    const realIP = headers['x-real-ip'];
    const cfConnectingIP = headers['cf-connecting-ip']; // Cloudflare
    
    if (cfConnectingIP) {
      return cfConnectingIP;
    }
    
    if (realIP) {
      return realIP;
    }
    
    if (forwardedFor) {
      // x-forwarded-for puede contener múltiples IPs: "client, proxy1, proxy2"
      return forwardedFor.split(',')[0].trim();
    }
    
    return remoteAddress;
  }

  /**
   * Genera identificador de dispositivo legacy (solo IP)
   * @param {string} ipAddress - Dirección IP
   * @returns {string} Device ID
   */
  static generateDeviceId(ipAddress) {
    return `device_${ipAddress}`;
  }

  /**
   * Valida si un fingerprint es válido
   * @param {string} fingerprint - Fingerprint a validar
   * @returns {boolean} True si es válido
   */
  static isValidFingerprint(fingerprint) {
    return /^[a-f0-9]{64}$/.test(fingerprint);
  }

  /**
   * Genera datos completos de fingerprint para una sesión
   * @param {Object} socket - Socket de Socket.io
   * @returns {Object} Datos de fingerprinting
   */
  static generateSessionFingerprint(socket) {
    const headers = socket.handshake.headers;
    const ipAddress = this.extractRealIP(headers, socket.handshake.address);
    const userAgent = headers['user-agent'] || 'unknown';
    
    return {
      ipAddress,
      userAgent,
      userAgentHash: this.hashUserAgent(userAgent),
      deviceId: this.generateDeviceId(ipAddress),
      deviceFingerprint: this.generateFingerprint(ipAddress, userAgent)
    };
  }
}

module.exports = FingerprintService;
