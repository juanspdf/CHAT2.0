const {
  sanitizeText,
  validatePin,
  validateNickname,
  generateRoomCode,
  validateMimeType
} = require('../src/utils/validators');

describe('Validators', () => {
  describe('sanitizeText', () => {
    test('debería sanitizar texto con HTML', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeText(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    test('debería eliminar espacios al inicio y final', () => {
      const input = '  hola mundo  ';
      const result = sanitizeText(input);
      expect(result).toBe('hola mundo');
    });

    test('debería manejar texto vacío', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });
  });

  describe('validatePin', () => {
    test('debería aceptar PIN válido de 4 dígitos', () => {
      expect(validatePin('1234')).toBe(true);
      expect(validatePin(1234)).toBe(true);
    });

    test('debería aceptar PIN de más de 4 dígitos', () => {
      expect(validatePin('12345')).toBe(true);
      expect(validatePin('123456')).toBe(true);
    });

    test('debería rechazar PIN menor a 4 dígitos', () => {
      expect(validatePin('123')).toBe(false);
      expect(validatePin('12')).toBe(false);
    });

    test('debería rechazar PIN con caracteres no numéricos', () => {
      expect(validatePin('12a4')).toBe(false);
      expect(validatePin('abcd')).toBe(false);
      expect(validatePin('12-34')).toBe(false);
    });

    test('debería rechazar PIN vacío o null', () => {
      expect(validatePin('')).toBe(false);
      expect(validatePin(null)).toBe(false);
      expect(validatePin(undefined)).toBe(false);
    });
  });

  describe('validateNickname', () => {
    test('debería aceptar nickname válido', () => {
      expect(validateNickname('Juan')).toBe(true);
      expect(validateNickname('Usuario123')).toBe(true);
      expect(validateNickname('El Gato')).toBe(true);
    });

    test('debería rechazar nickname muy corto', () => {
      expect(validateNickname('ab')).toBe(false);
      expect(validateNickname('a')).toBe(false);
    });

    test('debería rechazar nickname muy largo', () => {
      const longName = 'a'.repeat(21);
      expect(validateNickname(longName)).toBe(false);
    });

    test('debería rechazar nickname solo con espacios', () => {
      expect(validateNickname('   ')).toBe(false);
      expect(validateNickname('')).toBe(false);
    });

    test('debería rechazar valores no string', () => {
      expect(validateNickname(null)).toBe(false);
      expect(validateNickname(undefined)).toBe(false);
      expect(validateNickname(123)).toBe(false);
    });
  });

  describe('generateRoomCode', () => {
    test('debería generar código de 6 caracteres', () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
    });

    test('debería generar solo caracteres alfanuméricos mayúsculas', () => {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    test('debería generar códigos diferentes', () => {
      const code1 = generateRoomCode();
      const code2 = generateRoomCode();
      const code3 = generateRoomCode();
      
      // Es extremadamente improbable que sean iguales
      const allDifferent = code1 !== code2 || code2 !== code3 || code1 !== code3;
      expect(allDifferent).toBe(true);
    });
  });

  describe('validateMimeType', () => {
    test('debería aceptar tipos de imagen válidos', () => {
      expect(validateMimeType('image/png')).toBe(true);
      expect(validateMimeType('image/jpeg')).toBe(true);
      expect(validateMimeType('image/jpg')).toBe(true);
      expect(validateMimeType('image/gif')).toBe(true);
    });

    test('debería aceptar PDF', () => {
      expect(validateMimeType('application/pdf')).toBe(true);
    });

    test('debería aceptar documentos de Office', () => {
      expect(validateMimeType('application/msword')).toBe(true);
      expect(validateMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    test('debería rechazar tipos no permitidos', () => {
      expect(validateMimeType('application/x-executable')).toBe(false);
      expect(validateMimeType('application/x-msdownload')).toBe(false);
      expect(validateMimeType('video/mp4')).toBe(false);
    });
  });
});
