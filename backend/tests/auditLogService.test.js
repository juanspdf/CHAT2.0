const auditLogService = require('../src/services/auditLogService');
const AuditLog = require('../src/models/AuditLog');

// Mock del modelo AuditLog
jest.mock('../src/models/AuditLog');

describe('AuditLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLog()', () => {
    it('debería crear log con todos los campos requeridos', async () => {
      const logData = {
        action: 'USER_LOGIN',
        actor: 'admin@test.com',
        target: 'sala-test',
        ipAddress: '192.168.1.1',
        details: { method: '2FA', deviceFingerprint: 'abc123' }
      };

      const mockSort = jest.fn().mockReturnThis();
      
      AuditLog.countDocuments.mockResolvedValue(5);
      AuditLog.findOne.mockReturnValue({
        sort: mockSort.mockResolvedValue({
          blockNumber: 4,
          hash: 'previousHash123'
        })
      });
      
      AuditLog.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({
          ...logData,
          blockNumber: 5,
          timestamp: new Date(),
          hash: 'newHash456',
          toObject: () => ({
            ...logData,
            blockNumber: 5,
            timestamp: new Date(),
            hash: 'newHash456'
          })
        }),
        toObject: jest.fn().mockReturnValue({
          ...logData,
          blockNumber: 5,
          timestamp: new Date(),
          hash: 'newHash456'
        })
      }));

      const result = await auditLogService.createLog(logData);

      expect(result.blockNumber).toBe(5);
      expect(result.hash).toBeDefined();
    });

    it('debería calcular hash chain correctamente', async () => {
      const mockSort = jest.fn().mockReturnThis();
      
      AuditLog.countDocuments.mockResolvedValue(10);
      AuditLog.findOne.mockReturnValue({
        sort: mockSort.mockResolvedValue({
          blockNumber: 9,
          hash: 'prevHash'
        })
      });

      const mockSave = jest.fn().mockResolvedValue({
        blockNumber: 10,
        hash: 'currentHash',
        toObject: () => ({
          blockNumber: 10,
          hash: 'currentHash'
        })
      });
      
      AuditLog.mockImplementation(() => ({
        save: mockSave,
        toObject: jest.fn().mockReturnValue({
          blockNumber: 10,
          hash: 'currentHash'
        })
      }));

      await auditLogService.createLog({
        action: 'FILE_UPLOAD',
        actor: 'user@test.com'
      });

      expect(mockSave).toHaveBeenCalled();
    });

    it('debería crear bloque génesis (blockNumber 0) sin hash previo', async () => {
      const mockSort = jest.fn().mockReturnThis();
      
      AuditLog.countDocuments.mockResolvedValue(0);
      AuditLog.findOne.mockReturnValue({
        sort: mockSort.mockResolvedValue(null)
      });

      const mockSave = jest.fn().mockResolvedValue({
        blockNumber: 0,
        previousHash: '0',
        hash: 'genesisHash',
        toObject: () => ({
          blockNumber: 0,
          previousHash: '0',
          hash: 'genesisHash'
        })
      });
      
      AuditLog.mockImplementation(() => ({
        save: mockSave,
        toObject: jest.fn().mockReturnValue({
          blockNumber: 0,
          previousHash: '0',
          hash: 'genesisHash'
        })
      }));

      const result = await auditLogService.createLog({
        action: 'SYSTEM_INIT',
        actor: 'system'
      });

      expect(result.blockNumber).toBe(0);
    });
  });

  describe('verifyChainIntegrity()', () => {
    it('debería validar cadena correcta', async () => {
      const mockLogs = [
        {
          blockNumber: 0,
          previousHash: '0',
          hash: 'hash0',
          action: 'INIT',
          recalculateHash: jest.fn().mockReturnValue('hash0')
        },
        {
          blockNumber: 1,
          previousHash: 'hash0',
          hash: 'hash1',
          action: 'LOGIN',
          recalculateHash: jest.fn().mockReturnValue('hash1')
        },
        {
          blockNumber: 2,
          previousHash: 'hash1',
          hash: 'hash2',
          action: 'UPLOAD',
          recalculateHash: jest.fn().mockReturnValue('hash2')
        }
      ];

      const mockSort = jest.fn().mockReturnThis();
      AuditLog.find.mockReturnValue({
        sort: mockSort.mockResolvedValue(mockLogs)
      });

      const result = await auditLogService.verifyChainIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.totalBlocks).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('debería detectar hash manipulado', async () => {
      const mockLogs = [
        {
          blockNumber: 0,
          previousHash: '0',
          hash: 'hash0',
          recalculateHash: jest.fn().mockReturnValue('hash0')
        },
        {
          blockNumber: 1,
          previousHash: 'hash0',
          hash: 'tamperedHash', // Hash manipulado
          recalculateHash: jest.fn().mockReturnValue('correctHash1')
        }
      ];

      const mockSort = jest.fn().mockReturnThis();
      AuditLog.find.mockReturnValue({
        sort: mockSort.mockResolvedValue(mockLogs)
      });

      const result = await auditLogService.verifyChainIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('debería detectar cadena rota (previousHash incorrecto)', async () => {
      const mockLogs = [
        {
          blockNumber: 0,
          previousHash: '0',
          hash: 'hash0',
          recalculateHash: jest.fn().mockReturnValue('hash0')
        },
        {
          blockNumber: 1,
          previousHash: 'wrongPrevHash', // No coincide con hash0
          hash: 'hash1',
          recalculateHash: jest.fn().mockReturnValue('hash1')
        }
      ];

      const mockSort = jest.fn().mockReturnThis();
      AuditLog.find.mockReturnValue({
        sort: mockSort.mockResolvedValue(mockLogs)
      });

      const result = await auditLogService.verifyChainIntegrity();

      expect(result.isValid).toBe(false);
    });
  });

  describe('Query Methods', () => {
    it('getLogsByAction() debería filtrar por acción', async () => {
      const mockLogs = [
        { action: 'USER_LOGIN', actor: 'user1' },
        { action: 'USER_LOGIN', actor: 'user2' }
      ];

      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(mockLogs);
      
      AuditLog.find.mockReturnValue({
        sort: mockSort.mockReturnValue({
          limit: mockLimit.mockReturnValue({
            lean: mockLean
          })
        })
      });

      const result = await auditLogService.getLogsByAction('USER_LOGIN', 10);

      expect(result).toHaveLength(2);
      expect(AuditLog.find).toHaveBeenCalledWith({ action: 'USER_LOGIN' });
    });

    it('getLogsByActor() debería filtrar por actor', async () => {
      const mockLogs = [
        { action: 'LOGIN', actor: 'admin@test.com' },
        { action: 'UPLOAD', actor: 'admin@test.com' }
      ];

      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue(mockLogs);
      
      AuditLog.find.mockReturnValue({
        sort: mockSort.mockReturnValue({
          limit: mockLimit.mockReturnValue({
            lean: mockLean
          })
        })
      });

      const result = await auditLogService.getLogsByActor('admin@test.com', 10);

      expect(result).toHaveLength(2);
    });

    it('getLogsByDateRange() debería filtrar por rango de fechas', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockSort = jest.fn().mockReturnThis();
      const mockLean = jest.fn().mockResolvedValue([
        { action: 'LOGIN', timestamp: new Date('2024-01-15') }
      ]);
      
      AuditLog.find.mockReturnValue({
        sort: mockSort.mockReturnValue({
          lean: mockLean
        })
      });

      const result = await auditLogService.getLogsByDateRange(startDate, endDate);

      expect(AuditLog.find).toHaveBeenCalledWith({
        timestamp: { $gte: startDate, $lte: endDate }
      });
    });
  });
});
