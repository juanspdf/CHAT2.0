const workerManager = require('../src/services/workerManager');

describe('WorkerManager', () => {
  beforeEach(() => {
    // Limpiar el pool antes de cada test
    if (workerManager.pools && workerManager.pools.steganography) {
      workerManager.shutdown();
    }
  });

  afterAll(() => {
    if (workerManager.pools && workerManager.pools.steganography) {
      workerManager.shutdown();
    }
  });

  describe('Initialization', () => {
    it('debería inicializar pools de workers', () => {
      workerManager.initialize();

      expect(workerManager.pools).toBeDefined();
      expect(workerManager.pools.steganography).toBeDefined();
      expect(workerManager.pools.encryption).toBeDefined();
      expect(workerManager.pools.hashing).toBeDefined();
    });

    it('debería tener métodos principales disponibles', () => {
      workerManager.initialize();

      expect(typeof workerManager.analyzeSteganography).toBe('function');
      expect(typeof workerManager.encrypt).toBe('function');
      expect(typeof workerManager.hash).toBe('function');
      expect(typeof workerManager.getStats).toBe('function');
      expect(typeof workerManager.shutdown).toBe('function');
    });
  });

  describe('getStats()', () => {
    it('debería devolver estadísticas de todos los pools', () => {
      workerManager.initialize();

      const stats = workerManager.getStats();

      expect(stats).toHaveProperty('steganography');
      expect(stats).toHaveProperty('encryption');
      expect(stats).toHaveProperty('hashing');
      
      expect(stats.steganography).toHaveProperty('poolSize');
      expect(stats.steganography).toHaveProperty('activeWorkers');
      expect(stats.steganography).toHaveProperty('availableWorkers');
      expect(stats.steganography).toHaveProperty('queuedTasks');
    });

    it('debería mostrar workers disponibles correctamente', () => {
      workerManager.initialize();

      const stats = workerManager.getStats();

      expect(stats.steganography.poolSize).toBeGreaterThan(0);
      expect(stats.steganography.availableWorkers).toBeLessThanOrEqual(stats.steganography.poolSize);
      expect(stats.steganography.activeWorkers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shutdown()', () => {
    it('debería terminar todos los pools sin errores', async () => {
      workerManager.initialize();

      await expect(workerManager.shutdown()).resolves.not.toThrow();
    });

    it('debería limpiar referencias a pools', async () => {
      workerManager.initialize();
      await workerManager.shutdown();

      // Los pools deberían estar vacíos después del shutdown
      const stats = workerManager.getStats();
      expect(stats.steganography.poolSize).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('debería lanzar error si se usa pool sin inicializar', async () => {
      // No inicializar workerManager

      await expect(
        workerManager.analyzeSteganography(Buffer.from('test'), 'test.png', 'image/png')
      ).rejects.toThrow(/no inicializado/i);
    });

    it('debería manejar errores de encrypt sin pool inicializado', async () => {
      await expect(
        workerManager.encrypt('data', 'key', 'iv')
      ).rejects.toThrow(/no inicializado/i);
    });

    it('debería manejar errores de hash sin pool inicializado', async () => {
      await expect(
        workerManager.hash('data')
      ).rejects.toThrow(/no inicializado/i);
    });
  });

  describe('Integration', () => {
    it('debería poder inicializar y hacer shutdown múltiples veces', async () => {
      workerManager.initialize();
      await workerManager.shutdown();

      workerManager.initialize();
      const stats = workerManager.getStats();
      
      expect(stats.steganography.poolSize).toBeGreaterThan(0);
      
      await workerManager.shutdown();
    });
  });
});
