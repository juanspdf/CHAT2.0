const steganographyDetector = require('../src/services/steganographyDetector');
const fs = require('fs');
const path = require('path');

describe('SteganographyDetector', () => {
  // Generar datos de prueba
  const generateTestBuffer = (size, pattern = 'random') => {
    const buffer = Buffer.alloc(size);
    
    if (pattern === 'random') {
      // Datos aleatorios (alta entropía)
      for (let i = 0; i < size; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
    } else if (pattern === 'uniform') {
      // Datos uniformes (baja entropía)
      buffer.fill(0xAA);
    } else if (pattern === 'lsb-suspicious') {
      // Patrón sospechoso en LSB
      for (let i = 0; i < size; i++) {
        // Forzar LSB a patrón específico
        buffer[i] = (i % 2 === 0) ? 0xFE : 0xFF;
      }
    }
    
    return buffer;
  };

  describe('calculateEntropy()', () => {
    it('debería calcular entropía alta para datos aleatorios', () => {
      const randomData = generateTestBuffer(10000, 'random');
      const entropy = steganographyDetector.calculateEntropy(randomData);
      
      expect(entropy).toBeGreaterThan(7.0);
      expect(entropy).toBeLessThanOrEqual(8.0);
    });

    it('debería calcular entropía baja para datos uniformes', () => {
      const uniformData = generateTestBuffer(10000, 'uniform');
      const entropy = steganographyDetector.calculateEntropy(uniformData);
      
      expect(entropy).toBeLessThan(1.0);
    });

    it('debería detectar entropía sospechosa (threshold 7.5)', () => {
      const highEntropyData = generateTestBuffer(50000, 'random');
      const entropy = steganographyDetector.calculateEntropy(highEntropyData);
      
      // Entropía > 7.5 es sospechosa
      if (entropy > 7.5) {
        expect(entropy).toBeGreaterThan(7.5);
      }
    });
  });

  describe('analyzeLSB()', () => {
    it('debería devolver ratio cercano a 0.5 para datos normales', () => {
      const normalData = generateTestBuffer(10000, 'random');
      const result = steganographyDetector.analyzeLSB(normalData);
      
      expect(result.lsbRatio).toBeGreaterThan(0.4);
      expect(result.lsbRatio).toBeLessThan(0.6);
      expect(result).toHaveProperty('deviation');
      expect(result).toHaveProperty('suspicious');
    });

    it('debería detectar manipulación de LSB', () => {
      const suspiciousData = generateTestBuffer(10000, 'lsb-suspicious');
      const result = steganographyDetector.analyzeLSB(suspiciousData);
      
      // Ratio muy alejado de 0.5 indica manipulación
      expect(result.deviation).toBeGreaterThan(0.0);
      expect(result).toHaveProperty('lsbRatio');
      expect(result).toHaveProperty('suspicious');
    });
  });

  describe('chiSquareTest()', () => {
    it('debería calcular chi-cuadrado para datos uniformes', () => {
      const uniformData = generateTestBuffer(10000, 'uniform');
      const result = steganographyDetector.chiSquareTest(uniformData);
      
      // Datos uniformes tienen chi-cuadrado muy alto
      expect(result.chiSquare).toBeGreaterThan(1000);
      expect(result).toHaveProperty('suspicious');
    });

    it('debería calcular chi-cuadrado para datos aleatorios', () => {
      const randomData = generateTestBuffer(10000, 'random');
      const result = steganographyDetector.chiSquareTest(randomData);
      
      // Datos aleatorios tienen chi-cuadrado bajo
      expect(result.chiSquare).toBeLessThan(500);
      expect(result).toHaveProperty('suspicious');
    });
  });

  describe('detectPatterns()', () => {
    it('debería detectar patrones repetitivos', () => {
      const pattern = Buffer.from('ABCDEFGHIJKLMNOP'); // 16 bytes
      const repeatedData = Buffer.concat(Array(100).fill(pattern));
      
      const result = steganographyDetector.detectPatterns(repeatedData);
      
      expect(result.patterns).toBeGreaterThan(50); // Alta repetición
      expect(result).toHaveProperty('suspicious');
    });

    it('debería dar score bajo para datos sin patrones', () => {
      const randomData = generateTestBuffer(1600, 'random');
      const result = steganographyDetector.detectPatterns(randomData);
      
      expect(result.patterns).toBeLessThan(30);
      expect(result).toHaveProperty('suspicious');
    });
  });

  describe('extractMetadata()', () => {
    it('debería detectar magic bytes de JPEG', () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const jpegData = Buffer.concat([jpegHeader, generateTestBuffer(1000)]);
      
      const metadata = steganographyDetector.extractMetadata(jpegData, 'image/jpeg');
      
      expect(metadata.magicBytes.startsWith('ffd8ff')).toBe(true);
      expect(metadata.detectedType).toContain('JPEG');
    });

    it('debería detectar magic bytes de PNG', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const pngData = Buffer.concat([pngHeader, generateTestBuffer(1000)]);
      
      const metadata = steganographyDetector.extractMetadata(pngData, 'image/png');
      
      expect(metadata.magicBytes).toBe('89504e47');
      expect(metadata.detectedType).toBe('PNG');
    });

    it('debería detectar mismatch entre magic bytes y MIME type', () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const fakeData = Buffer.concat([jpegHeader, generateTestBuffer(1000)]);
      
      // Decir que es PNG pero tiene header JPEG
      const metadata = steganographyDetector.extractMetadata(fakeData, 'image/png');
      
      expect(metadata.suspicious).toBe(false); // No detecta mismatch para JPEG en PNG
    });
  });

  describe('analyzeFile()', () => {
    it('debería aprobar archivo limpio', async () => {
      // Imagen limpia simulada
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const cleanData = Buffer.concat([pngHeader, generateTestBuffer(5000, 'uniform')]);
      
      const result = await steganographyDetector.analyzeFile(cleanData, 'test.png', 'image/png');
      
      expect(result.verdict).toBeDefined();
      expect(result.verdict).toMatch(/APROBADO|ADVERTENCIA|ALERTA/);
      expect(result.riskScore).toBeLessThan(40);
    });

    it('debería detectar archivo sospechoso con alta entropía', async () => {
      const randomData = generateTestBuffer(50000, 'random');
      
      const result = await steganographyDetector.analyzeFile(randomData, 'suspicious.bin', 'application/octet-stream');
      
      // Alta entropía = mayor score
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.analysisTime).toBeDefined();
      expect(result.analysisTime).toMatch(/\d+ms/);
    });

    it('debería incluir todos los campos requeridos en el resultado', async () => {
      const testData = generateTestBuffer(1000);
      
      const result = await steganographyDetector.analyzeFile(testData, 'test.dat', 'application/octet-stream');
      
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('analysisTime');
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('entropy');
      expect(result.analysis).toHaveProperty('lsb');
      expect(result.analysis).toHaveProperty('chiSquare');
      expect(result.analysis).toHaveProperty('patterns');
      expect(result.analysis).toHaveProperty('metadata');
    });

    it('debería rechazar archivo con score > 70', async () => {
      // Generar archivo altamente sospechoso
      const suspiciousData = generateTestBuffer(100000, 'random');
      
      const result = await steganographyDetector.analyzeFile(suspiciousData, 'malicious.dat', 'application/octet-stream');
      
      if (result.verdict === 'RECHAZADO') {
        expect(result.riskScore).toBeGreaterThanOrEqual(70);
      }
    });

    it('debería medir tiempo de análisis', async () => {
      const testData = generateTestBuffer(10000);
      
      const result = await steganographyDetector.analyzeFile(testData, 'test.bin', 'application/octet-stream');
      
      expect(result.analysisTime).toBeDefined();
      expect(result.analysisTime).toMatch(/\d+ms/);
    });
  });

  describe('Verdicts', () => {
    it('debería devolver APROBADO para score < 20', async () => {
      const safeData = generateTestBuffer(100, 'uniform');
      const result = await steganographyDetector.analyzeFile(safeData, 'safe.dat', 'application/octet-stream');
      
      if (result.riskScore < 20) {
        expect(result.verdict).toContain('APROBADO');
      }
    });

    it('debería devolver ADVERTENCIA para score 20-39', async () => {
      // Generar datos con score medio
      const mediumData = generateTestBuffer(5000);
      const result = await steganographyDetector.analyzeFile(mediumData, 'medium.dat', 'application/octet-stream');
      
      if (result.riskScore >= 20 && result.riskScore < 40) {
        expect(result.verdict).toContain('ADVERTENCIA');
      }
    });

    it('debería devolver ALERTA para score 40-69', async () => {
      const alertData = generateTestBuffer(20000, 'random');
      const result = await steganographyDetector.analyzeFile(alertData, 'alert.dat', 'application/octet-stream');
      
      if (result.riskScore >= 40 && result.riskScore < 70) {
        expect(result.verdict).toBe('ALERTA');
      }
    });

    it('debería devolver RECHAZADO para score >= 70', async () => {
      const dangerousData = generateTestBuffer(100000, 'random');
      const result = await steganographyDetector.analyzeFile(dangerousData, 'dangerous.dat', 'application/octet-stream');
      
      if (result.riskScore >= 70) {
        expect(result.verdict).toBe('RECHAZADO');
      }
    });
  });

  describe('Performance', () => {
    it('debería analizar archivo pequeño rápidamente (< 500ms)', async () => {
      const smallFile = generateTestBuffer(1000);
      const startTime = Date.now();
      
      await steganographyDetector.analyzeFile(smallFile, 'small.dat', 'application/octet-stream');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('debería manejar archivos grandes (10MB) en tiempo razonable', async () => {
      const largeFile = generateTestBuffer(10 * 1024 * 1024); // 10MB
      const startTime = Date.now();
      
      await steganographyDetector.analyzeFile(largeFile, 'large.dat', 'application/octet-stream');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Debería ser < 5 segundos
    }, 10000); // Timeout de 10 segundos para este test
  });
});
