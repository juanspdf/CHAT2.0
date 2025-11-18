const redisService = require('../src/services/redisService');

// Mock de ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const mockClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
      on: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      publish: jest.fn().mockResolvedValue(1),
      subscribe: jest.fn(),
      flushdb: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK')
    };
    return mockClient;
  });
});

describe('RedisService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await redisService.connect();
    // Manually set connected for tests since mock doesn't trigger events
    redisService.connected = true;
  });

  describe('Session Management', () => {
    it('debería guardar sesión activa', async () => {
      const sessionData = { userId: '123', nickname: 'Test' };
      const result = await redisService.setActiveSession('192.168.1.1', sessionData, 3600);

      expect(result).toBe(true);
      expect(redisService.client.setex).toHaveBeenCalledWith(
        'session:192.168.1.1',
        3600,
        JSON.stringify(sessionData)
      );
    });

    it('debería recuperar sesión activa', async () => {
      const sessionData = { userId: '123', nickname: 'Test' };
      redisService.client.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await redisService.getActiveSession('192.168.1.1');

      expect(result).toEqual(sessionData);
      expect(redisService.client.get).toHaveBeenCalledWith('session:192.168.1.1');
    });

    it('debería devolver null si no existe sesión', async () => {
      redisService.client.get.mockResolvedValue(null);

      const result = await redisService.getActiveSession('192.168.1.1');

      expect(result).toBeNull();
    });

    it('debería eliminar sesión', async () => {
      redisService.client.del.mockResolvedValue(1);

      const result = await redisService.removeSession('192.168.1.1');

      expect(result).toBe(true);
      expect(redisService.client.del).toHaveBeenCalledWith('session:192.168.1.1');
    });

    it('debería verificar si existe sesión activa', async () => {
      redisService.client.exists.mockResolvedValue(1);

      const result = await redisService.hasActiveSession('192.168.1.1');

      expect(result).toBe(true);
      expect(redisService.client.exists).toHaveBeenCalledWith('session:192.168.1.1');
    });

    it('debería refrescar TTL de sesión', async () => {
      redisService.client.expire.mockResolvedValue(1);

      const result = await redisService.refreshSession('192.168.1.1', 3600);

      expect(result).toBe(true);
      expect(redisService.client.expire).toHaveBeenCalledWith('session:192.168.1.1', 3600);
    });

    it('debería obtener todas las sesiones activas', async () => {
      const sessions = [
        { userId: '1', nickname: 'User1' },
        { userId: '2', nickname: 'User2' }
      ];
      
      redisService.client.keys.mockResolvedValue(['session:192.168.1.1', 'session:192.168.1.2']);
      redisService.client.get
        .mockResolvedValueOnce(JSON.stringify(sessions[0]))
        .mockResolvedValueOnce(JSON.stringify(sessions[1]));

      const result = await redisService.getAllActiveSessions();

      expect(result).toHaveLength(2);
      expect(result).toEqual(sessions);
    });
  });

  describe('Error Handling', () => {
    it('debería devolver false si no está conectado', async () => {
      redisService.connected = false;

      const result = await redisService.setActiveSession('192.168.1.1', {});

      expect(result).toBe(false);
    });

    it('debería manejar errores al guardar sesión', async () => {
      redisService.client.setex.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.setActiveSession('192.168.1.1', {});

      expect(result).toBe(false);
    });

    it('debería manejar errores al obtener sesión', async () => {
      redisService.client.get.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.getActiveSession('192.168.1.1');

      expect(result).toBeNull();
    });

    it('debería manejar errores al eliminar sesión', async () => {
      redisService.client.del.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.removeSession('192.168.1.1');

      expect(result).toBe(false);
    });

    it('debería manejar errores al verificar sesión', async () => {
      redisService.client.exists.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.hasActiveSession('192.168.1.1');

      expect(result).toBe(false);
    });

    it('debería devolver array vacío al fallar getAllActiveSessions', async () => {
      redisService.client.keys.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.getAllActiveSessions();

      expect(result).toEqual([]);
    });
  });

  describe('Connection Management', () => {
    it('debería conectar correctamente', () => {
      expect(redisService.connected).toBe(true);
      expect(redisService.client).toBeDefined();
    });

    it('debería desconectar correctamente', async () => {
      redisService.client.quit.mockResolvedValue('OK');

      await redisService.disconnect();

      expect(redisService.client.quit).toHaveBeenCalled();
      expect(redisService.connected).toBe(false);
    });
  });
});
