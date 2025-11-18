const FingerprintService = require('../src/services/fingerprintService');

describe('FingerprintService', () => {
  describe('hash()', () => {
    it('debería generar un hash SHA-256 válido', () => {
      const data = 'test data';
      const hash = FingerprintService.hash(data);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('debería generar hashes diferentes para datos diferentes', () => {
      const hash1 = FingerprintService.hash('data1');
      const hash2 = FingerprintService.hash('data2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('debería generar el mismo hash para los mismos datos', () => {
      const data = 'consistent data';
      const hash1 = FingerprintService.hash(data);
      const hash2 = FingerprintService.hash(data);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('generateFingerprint()', () => {
    it('debería generar fingerprint único basado en IP + UserAgent', () => {
      const ip = '192.168.1.100';
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      
      const fingerprint = FingerprintService.generateFingerprint(ip, ua);
      
      expect(fingerprint).toHaveLength(64);
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it('debería generar fingerprints diferentes para IPs diferentes', () => {
      const ua = 'Mozilla/5.0';
      const fp1 = FingerprintService.generateFingerprint('192.168.1.1', ua);
      const fp2 = FingerprintService.generateFingerprint('192.168.1.2', ua);
      
      expect(fp1).not.toBe(fp2);
    });

    it('debería generar fingerprints diferentes para UserAgents diferentes', () => {
      const ip = '192.168.1.1';
      const fp1 = FingerprintService.generateFingerprint(ip, 'Chrome');
      const fp2 = FingerprintService.generateFingerprint(ip, 'Firefox');
      
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('hashNickname()', () => {
    it('debería generar un hash corto de 16 caracteres', () => {
      const hash = FingerprintService.hashNickname('testuser');
      
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('debería generar hashes diferentes con salt diferente', () => {
      const nickname = 'user';
      const hash1 = FingerprintService.hashNickname(nickname, 'salt1');
      const hash2 = FingerprintService.hashNickname(nickname, 'salt2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('extractRealIP()', () => {
    it('debería extraer IP de x-forwarded-for', () => {
      const headers = { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' };
      const ip = FingerprintService.extractRealIP(headers, '10.0.0.1');
      
      expect(ip).toBe('203.0.113.1');
    });

    it('debería extraer IP de x-real-ip', () => {
      const headers = { 'x-real-ip': '203.0.113.50' };
      const ip = FingerprintService.extractRealIP(headers, '10.0.0.1');
      
      expect(ip).toBe('203.0.113.50');
    });

    it('debería priorizar cf-connecting-ip (Cloudflare)', () => {
      const headers = {
        'cf-connecting-ip': '203.0.113.100',
        'x-real-ip': '203.0.113.50',
        'x-forwarded-for': '203.0.113.1'
      };
      const ip = FingerprintService.extractRealIP(headers, '10.0.0.1');
      
      expect(ip).toBe('203.0.113.100');
    });

    it('debería usar remoteAddress si no hay headers de proxy', () => {
      const headers = {};
      const ip = FingerprintService.extractRealIP(headers, '10.0.0.1');
      
      expect(ip).toBe('10.0.0.1');
    });
  });

  describe('isValidFingerprint()', () => {
    it('debería validar un fingerprint válido', () => {
      const validFingerprint = 'a'.repeat(64);
      expect(FingerprintService.isValidFingerprint(validFingerprint)).toBe(true);
    });

    it('debería rechazar fingerprints con longitud incorrecta', () => {
      expect(FingerprintService.isValidFingerprint('abc123')).toBe(false);
    });

    it('debería rechazar fingerprints con caracteres inválidos', () => {
      const invalidFingerprint = 'g'.repeat(64);
      expect(FingerprintService.isValidFingerprint(invalidFingerprint)).toBe(false);
    });
  });

  describe('generateSessionFingerprint()', () => {
    it('debería generar todos los campos de fingerprint', () => {
      const mockSocket = {
        handshake: {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '192.168.1.100'
          },
          address: '10.0.0.1'
        }
      };

      const result = FingerprintService.generateSessionFingerprint(mockSocket);

      expect(result).toHaveProperty('ipAddress');
      expect(result).toHaveProperty('userAgent');
      expect(result).toHaveProperty('userAgentHash');
      expect(result).toHaveProperty('deviceId');
      expect(result).toHaveProperty('deviceFingerprint');
      
      expect(result.ipAddress).toBe('192.168.1.100');
      expect(result.userAgent).toBe('Mozilla/5.0');
      expect(result.deviceId).toBe('device_192.168.1.100');
      expect(result.userAgentHash).toHaveLength(64);
      expect(result.deviceFingerprint).toHaveLength(64);
    });
  });
});
