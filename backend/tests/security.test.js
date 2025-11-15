const bcrypt = require('bcrypt');

describe('Security - Password Hashing', () => {
  describe('bcrypt hashing', () => {
    test('debería hashear PIN correctamente', async () => {
      const pin = '1234';
      const hash = await bcrypt.hash(pin, 10);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(pin);
      expect(hash.length).toBeGreaterThan(20);
    });

    test('debería verificar PIN correctamente', async () => {
      const pin = '1234';
      const hash = await bcrypt.hash(pin, 10);
      
      const isValid = await bcrypt.compare(pin, hash);
      expect(isValid).toBe(true);
    });

    test('debería rechazar PIN incorrecto', async () => {
      const pin = '1234';
      const wrongPin = '4321';
      const hash = await bcrypt.hash(pin, 10);
      
      const isValid = await bcrypt.compare(wrongPin, hash);
      expect(isValid).toBe(false);
    });

    test('hashes diferentes para el mismo PIN', async () => {
      const pin = '1234';
      const hash1 = await bcrypt.hash(pin, 10);
      const hash2 = await bcrypt.hash(pin, 10);
      
      expect(hash1).not.toBe(hash2);
      
      // Pero ambos deberían validar correctamente
      expect(await bcrypt.compare(pin, hash1)).toBe(true);
      expect(await bcrypt.compare(pin, hash2)).toBe(true);
    });
  });
});
