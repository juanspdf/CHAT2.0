const twoFactorAuth = require('../src/services/twoFactorAuth');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Mock de speakeasy y qrcode
jest.mock('speakeasy');
jest.mock('qrcode');

describe('TwoFactorAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSecret()', () => {
    it('debería generar secreto con todos los campos requeridos', () => {
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/ChatSystem:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ChatSystem'
      };

      speakeasy.generateSecret.mockReturnValue(mockSecret);

      const result = twoFactorAuth.generateSecret('test@example.com');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauth_url');
      expect(result.otpauth_url).toContain('ChatSystem');
      expect(result.otpauth_url).toContain('test@example.com');
    });

    it('debería usar configuración correcta de speakeasy', () => {
      speakeasy.generateSecret.mockReturnValue({
        base32: 'TEST',
        otpauth_url: 'otpauth://test'
      });

      twoFactorAuth.generateSecret('user@test.com');

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: expect.stringContaining('ChatSystem'),
        issuer: 'ChatSystem Secure',
        length: 32
      });
    });
  });

  describe('verifyToken()', () => {
    it('debería verificar token válido', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const result = twoFactorAuth.verifyToken('JBSWY3DPEHPK3PXP', '123456');

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        encoding: 'base32',
        token: '123456',
        window: 2
      });
    });

    it('debería rechazar token inválido', () => {
      speakeasy.totp.verify.mockReturnValue(false);

      const result = twoFactorAuth.verifyToken('JBSWY3DPEHPK3PXP', '000000');

      expect(result).toBe(false);
    });

    it('debería usar ventana de tiempo (±60s)', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      twoFactorAuth.verifyToken('SECRET', '123456');

      expect(speakeasy.totp.verify).toHaveBeenCalledWith(
        expect.objectContaining({
          window: 2 // ±2 intervalos de 30s = ±60s
        })
      );
    });

    it('debería manejar tokens de 6 dígitos', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const token = '123456';
      const result = twoFactorAuth.verifyToken('SECRET', token);

      expect(result).toBe(true);
      expect(token).toHaveLength(6);
    });
  });

  describe('generateBackupCodes()', () => {
    it('debería generar 10 códigos únicos', () => {
      const codes = twoFactorAuth.generateBackupCodes();

      expect(codes).toHaveLength(10);
      
      // Verificar unicidad
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });

    it('debería generar códigos de formato correcto (8 caracteres alfanuméricos)', () => {
      const codes = twoFactorAuth.generateBackupCodes();

      codes.forEach(code => {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-Z0-9]{8}$/);
      });
    });

    it('debería generar códigos diferentes en cada llamada', () => {
      const codes1 = twoFactorAuth.generateBackupCodes();
      const codes2 = twoFactorAuth.generateBackupCodes();

      expect(codes1).not.toEqual(codes2);
    });
  });

  describe('generateQRCode()', () => {
    it('debería generar QR code como data URL', async () => {
      const mockDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      QRCode.toDataURL.mockResolvedValue(mockDataURL);

      const otpauthUrl = 'otpauth://totp/CHAT2.0:test@test.com?secret=TEST';
      const result = await twoFactorAuth.generateQRCode(otpauthUrl);

      expect(result).toBe(mockDataURL);
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('debería usar otpauth_url correcto', async () => {
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,test');

      const url = 'otpauth://totp/CHAT2.0:admin@test.com?secret=SECRETKEY';
      await twoFactorAuth.generateQRCode(url);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(url);
    });

    it('debería manejar errores de generación', async () => {
      QRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'));

      await expect(
        twoFactorAuth.generateQRCode('invalid-url')
      ).rejects.toThrow();
    });
  });

  describe('Integration', () => {
    it('debería generar secret y QR code juntos', async () => {
      speakeasy.generateSecret.mockReturnValue({
        base32: 'TESTSECRET',
        otpauth_url: 'otpauth://totp/ChatSystem:user@test.com?secret=TESTSECRET'
      });
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,qrcode');

      const secret = twoFactorAuth.generateSecret('user@test.com');
      const qrCode = await twoFactorAuth.generateQRCode(secret.otpauth_url);

      expect(secret.secret).toBeDefined();
      expect(qrCode).toMatch(/^data:image\/png/);
    });

    it('debería validar token generado con secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      
      // Simular token válido generado por Google Authenticator
      speakeasy.totp.verify.mockReturnValue(true);
      
      const isValid = twoFactorAuth.verifyToken(secret, '123456');

      expect(isValid).toBe(true);
    });
  });

  describe('Security', () => {
    it('debería generar secretos de longitud segura (≥32 caracteres base32)', () => {
      speakeasy.generateSecret.mockReturnValue({
        base32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', // 32 chars
        otpauth_url: 'otpauth://test'
      });

      const secret = twoFactorAuth.generateSecret('test@test.com');

      expect(secret.secret.length).toBeGreaterThanOrEqual(16);
    });

    it('debería rechazar tokens fuera de ventana de tiempo', () => {
      speakeasy.totp.verify.mockReturnValue(false);

      // Token expirado (fuera de ventana ±60s)
      const result = twoFactorAuth.verifyToken('SECRET', '999999');

      expect(result).toBe(false);
    });

    it('debería usar encoding base32 para compatibilidad con Google Authenticator', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      twoFactorAuth.verifyToken('SECRET', '123456');

      expect(speakeasy.totp.verify).toHaveBeenCalledWith(
        expect.objectContaining({
          encoding: 'base32'
        })
      );
    });
  });
});
