const encryptionService = require('../src/services/encryptionService');

describe('EncryptionService', () => {
  describe('generateRoomKey()', () => {
    it('debería generar una clave y IV válidos', () => {
      const { key, iv } = encryptionService.generateRoomKey();
      
      expect(key).toBeDefined();
      expect(iv).toBeDefined();
      expect(key).toHaveLength(64); // 32 bytes en hex = 64 caracteres
      expect(iv).toHaveLength(32); // 16 bytes en hex = 32 caracteres
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(iv).toMatch(/^[a-f0-9]{32}$/);
    });

    it('debería generar claves únicas en cada llamada', () => {
      const key1 = encryptionService.generateRoomKey();
      const key2 = encryptionService.generateRoomKey();
      
      expect(key1.key).not.toBe(key2.key);
      expect(key1.iv).not.toBe(key2.iv);
    });
  });

  describe('encryptMessage() y decryptMessage()', () => {
    it('debería cifrar y descifrar un mensaje correctamente', () => {
      const plaintext = 'Este es un mensaje secreto';
      const { key, iv } = encryptionService.generateRoomKey();
      
      const { encrypted, tag } = encryptionService.encryptMessage(plaintext, key, iv);
      const decrypted = encryptionService.decryptMessage(encrypted, key, iv, tag);
      
      expect(decrypted).toBe(plaintext);
    });

    it('debería generar diferentes ciphertexts para el mismo mensaje con IV diferente', () => {
      const plaintext = 'Mensaje de prueba';
      const key = encryptionService.generateRoomKey().key;
      const iv1 = encryptionService.generateRoomKey().iv;
      const iv2 = encryptionService.generateRoomKey().iv;
      
      const encrypted1 = encryptionService.encryptMessage(plaintext, key, iv1);
      const encrypted2 = encryptionService.encryptMessage(plaintext, key, iv2);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });

    it('debería fallar al descifrar con clave incorrecta', () => {
      const plaintext = 'Mensaje secreto';
      const { key: correctKey, iv } = encryptionService.generateRoomKey();
      const wrongKey = encryptionService.generateRoomKey().key;
      
      const { encrypted, tag } = encryptionService.encryptMessage(plaintext, correctKey, iv);
      
      expect(() => {
        encryptionService.decryptMessage(encrypted, wrongKey, iv, tag);
      }).toThrow();
    });

    it('debería fallar al descifrar con tag incorrecto', () => {
      const plaintext = 'Mensaje secreto';
      const { key, iv } = encryptionService.generateRoomKey();
      
      const { encrypted } = encryptionService.encryptMessage(plaintext, key, iv);
      const wrongTag = 'a'.repeat(32);
      
      expect(() => {
        encryptionService.decryptMessage(encrypted, key, iv, wrongTag);
      }).toThrow();
    });
  });

  describe('encryptFile() y decryptFile()', () => {
    it('debería cifrar y descifrar un buffer de archivo', () => {
      const fileData = Buffer.from('Contenido del archivo de prueba');
      const { key } = encryptionService.generateRoomKey();
      
      const { encrypted, iv, tag } = encryptionService.encryptFile(fileData, key);
      const decrypted = encryptionService.decryptFile(encrypted, key, iv, tag);
      
      expect(decrypted.toString()).toBe(fileData.toString());
    });

    it('debería manejar archivos binarios correctamente', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
      const { key } = encryptionService.generateRoomKey();
      
      const { encrypted, iv, tag } = encryptionService.encryptFile(binaryData, key);
      const decrypted = encryptionService.decryptFile(encrypted, key, iv, tag);
      
      expect(Buffer.compare(decrypted, binaryData)).toBe(0);
    });
  });

  describe('generateHash()', () => {
    it('debería generar un hash SHA-256 válido', () => {
      const content = 'Contenido para hashear';
      const hash = encryptionService.generateHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('debería generar hashes consistentes para el mismo contenido', () => {
      const content = 'Contenido consistente';
      const hash1 = encryptionService.generateHash(content);
      const hash2 = encryptionService.generateHash(content);
      
      expect(hash1).toBe(hash2);
    });

    it('debería generar hashes diferentes para contenido diferente', () => {
      const hash1 = encryptionService.generateHash('contenido1');
      const hash2 = encryptionService.generateHash('contenido2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateHMAC() y verifyHMAC()', () => {
    it('debería generar y verificar HMAC correctamente', () => {
      const data = 'Datos a firmar';
      const secret = 'clave-secreta';
      
      const hmac = encryptionService.generateHMAC(data, secret);
      const isValid = encryptionService.verifyHMAC(data, hmac, secret);
      
      expect(isValid).toBe(true);
    });

    it('debería rechazar HMAC con datos modificados', () => {
      const originalData = 'Datos originales';
      const modifiedData = 'Datos modificados';
      const secret = 'clave-secreta';
      
      const hmac = encryptionService.generateHMAC(originalData, secret);
      const isValid = encryptionService.verifyHMAC(modifiedData, hmac, secret);
      
      expect(isValid).toBe(false);
    });

    it('debería rechazar HMAC con secreto incorrecto', () => {
      const data = 'Datos a firmar';
      const correctSecret = 'secreto-correcto';
      const wrongSecret = 'secreto-incorrecto';
      
      const hmac = encryptionService.generateHMAC(data, correctSecret);
      const isValid = encryptionService.verifyHMAC(data, hmac, wrongSecret);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Seguridad de AES-256-GCM', () => {
    it('debería usar authentication tags para integridad', () => {
      const plaintext = 'Mensaje con integridad';
      const { key, iv } = encryptionService.generateRoomKey();
      
      const { encrypted, tag } = encryptionService.encryptMessage(plaintext, key, iv);
      
      expect(tag).toBeDefined();
      expect(tag).toHaveLength(32); // 16 bytes en hex
      expect(tag).toMatch(/^[a-f0-9]{32}$/);
    });

    it('debería detectar modificación del ciphertext', () => {
      const plaintext = 'Mensaje a proteger';
      const { key, iv } = encryptionService.generateRoomKey();
      
      const { encrypted, tag } = encryptionService.encryptMessage(plaintext, key, iv);
      
      // Modificar el ciphertext
      const modified = 'ff' + encrypted.substring(2);
      
      expect(() => {
        encryptionService.decryptMessage(modified, key, iv, tag);
      }).toThrow();
    });
  });
});
