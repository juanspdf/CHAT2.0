const crypto = require('crypto');
const CryptoJS = require('crypto-js');

/**
 * Servicio de Cifrado End-to-End (E2E)
 * Implementa cifrado AES-256 para mensajes y archivos
 */
class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.saltLength = 64;
    this.tagLength = 16;
  }

  /**
   * Genera una clave efímera para una sala
   * @returns {Object} { key: string, iv: string }
   */
  generateRoomKey() {
    const key = crypto.randomBytes(this.keyLength).toString('hex');
    const iv = crypto.randomBytes(this.ivLength).toString('hex');
    
    return { key, iv };
  }

  /**
   * Cifra un mensaje con AES-256-GCM
   * @param {string} plaintext - Texto plano a cifrar
   * @param {string} keyHex - Clave en hexadecimal
   * @param {string} ivHex - Vector de inicialización en hexadecimal
   * @returns {Object} { encrypted: string, tag: string }
   */
  encryptMessage(plaintext, keyHex, ivHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag().toString('hex');
      
      return {
        encrypted,
        tag
      };
    } catch (error) {
      console.error('Error cifrando mensaje:', error);
      throw new Error('Error en el cifrado');
    }
  }

  /**
   * Descifra un mensaje con AES-256-GCM
   * @param {string} encryptedHex - Texto cifrado en hexadecimal
   * @param {string} keyHex - Clave en hexadecimal
   * @param {string} ivHex - Vector de inicialización en hexadecimal
   * @param {string} tagHex - Tag de autenticación en hexadecimal
   * @returns {string} Texto plano descifrado
   */
  decryptMessage(encryptedHex, keyHex, ivHex, tagHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error descifrando mensaje:', error);
      throw new Error('Error en el descifrado');
    }
  }

  /**
   * Cifra un archivo (buffer)
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} keyHex - Clave en hexadecimal
   * @returns {Object} { encrypted: Buffer, iv: string, tag: string }
   */
  encryptFile(fileBuffer, keyHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Error cifrando archivo:', error);
      throw new Error('Error en el cifrado del archivo');
    }
  }

  /**
   * Descifra un archivo
   * @param {Buffer} encryptedBuffer - Buffer cifrado
   * @param {string} keyHex - Clave en hexadecimal
   * @param {string} ivHex - Vector de inicialización en hexadecimal
   * @param {string} tagHex - Tag de autenticación en hexadecimal
   * @returns {Buffer} Buffer descifrado
   */
  decryptFile(encryptedBuffer, keyHex, ivHex, tagHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      console.error('Error descifrando archivo:', error);
      throw new Error('Error en el descifrado del archivo');
    }
  }

  /**
   * Genera un hash SHA-256 de un contenido
   * @param {string|Buffer} content - Contenido a hashear
   * @returns {string} Hash en hexadecimal
   */
  generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Genera una firma HMAC para integridad
   * @param {string} data - Datos a firmar
   * @param {string} secret - Clave secreta
   * @returns {string} Firma HMAC en hexadecimal
   */
  generateHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verifica una firma HMAC
   * @param {string} data - Datos originales
   * @param {string} signature - Firma a verificar
   * @param {string} secret - Clave secreta
   * @returns {boolean} True si la firma es válida
   */
  verifyHMAC(data, signature, secret) {
    const expectedSignature = this.generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Cifra una clave de sala con la clave maestra del servidor
   * @param {string} roomKey - Clave de sala a proteger
   * @param {string} masterKey - Clave maestra del servidor
   * @returns {string} Clave cifrada
   */
  encryptRoomKey(roomKey, masterKey) {
    return CryptoJS.AES.encrypt(roomKey, masterKey).toString();
  }

  /**
   * Descifra una clave de sala
   * @param {string} encryptedKey - Clave cifrada
   * @param {string} masterKey - Clave maestra del servidor
   * @returns {string} Clave descifrada
   */
  decryptRoomKey(encryptedKey, masterKey) {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, masterKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Crea hash de roomCode para almacenamiento seguro
   * Usa HMAC-SHA256 determinístico para poder buscar
   * @param {string} roomCode - Código de sala en texto plano
   * @returns {string} Hash del código
   */
  hashRoomCode(roomCode) {
    const secret = process.env.ROOM_CODE_HASH_SECRET || 'default-room-code-secret-change-in-production';
    return crypto
      .createHmac('sha256', secret)
      .update(roomCode.toUpperCase())
      .digest('hex');
  }
}

module.exports = new EncryptionService();
