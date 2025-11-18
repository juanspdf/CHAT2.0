const socketService = require('../src/services/socketService');
const Session = require('../src/models/Session');
const Message = require('../src/models/Message');
const Room = require('../src/models/Room');
const redisService = require('../src/services/redisService');
const fingerprintService = require('../src/services/fingerprintService');

// Mocks
jest.mock('../src/models/Session');
jest.mock('../src/models/Message');
jest.mock('../src/models/Room');
jest.mock('../src/services/redisService');
jest.mock('../src/services/fingerprintService');

describe('SocketService Integration', () => {
  let mockSocket;
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket123',
      handshake: {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0'
        },
        address: '127.0.0.1'
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      broadcast: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      }
    };

    const mockEmit = jest.fn();
    mockIo = {
      to: jest.fn().mockReturnValue({ emit: mockEmit }),
      emit: mockEmit,
      sockets: {
        sockets: new Map()
      }
    };

    // Setup default redis mocks
    redisService.getActiveSession = jest.fn().mockResolvedValue(null);
    redisService.setActiveSession = jest.fn().mockResolvedValue(true);
    redisService.removeSession = jest.fn().mockResolvedValue(true);
  });

  describe('handleJoinRoom()', () => {
    it('debería crear sesión con fingerprinting completo', async () => {
      const roomCode = 'ABC123';
      const pin = '1234';
      const nickname = 'TestUser';

      // Mock fingerprint service
      fingerprintService.generateSessionFingerprint.mockReturnValue({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        userAgentHash: 'hash123',
        deviceId: 'device_192.168.1.1',
        deviceFingerprint: 'fingerprint123'
      });

      fingerprintService.hashNickname.mockReturnValue('nickhash123');

      // Mock room exists
      Room.findOne.mockResolvedValue({
        _id: 'room123',
        roomCode,
        name: 'Test Room',
        pinHash: '$2b$10$validhash',
        status: 'ACTIVE',
        e2eEnabled: false
      });

      // Mock bcrypt compare
      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      // Mock no existing session
      Session.findOne.mockResolvedValue(null);

      // Mock session creation with findOneAndUpdate
      Session.findOneAndUpdate.mockResolvedValue({
        _id: 'session123',
        roomId: 'room123',
        nickname,
        socketId: mockSocket.id,
        deviceFingerprint: 'fingerprint123',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash123',
        nicknameHash: 'nickhash123',
        isActive: true
      });

      // Mock getConnectedUsers with select chain
      const mockSessions = [];
      Session.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockSessions)
      });

      await socketService.handleJoinRoom(mockSocket, { roomCode, pin, nickname });

      expect(fingerprintService.generateSessionFingerprint).toHaveBeenCalledWith(mockSocket);
      expect(mockSocket.join).toHaveBeenCalled();
    });

    it('debería validar datos requeridos', async () => {
      fingerprintService.generateSessionFingerprint.mockReturnValue({
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'fingerprint123'
      });

      // Missing roomCode
      await socketService.handleJoinRoom(mockSocket, { pin: '1234', nickname: 'Test' });
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        errorCode: 'MISSING_DATA'
      }));

      jest.clearAllMocks();

      // Missing pin
      await socketService.handleJoinRoom(mockSocket, { roomCode: 'ABC123', nickname: 'Test' });
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        errorCode: 'MISSING_DATA'
      }));
    });

    it('debería validar PIN incorrecto', async () => {
      const roomCode = 'ABC123';
      const pin = 'wrong';
      const nickname = 'TestUser';

      fingerprintService.generateSessionFingerprint.mockReturnValue({
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'fingerprint123'
      });

      Room.findOne.mockResolvedValue({
        _id: 'room123',
        roomCode,
        pinHash: '$2b$10$validhash',
        status: 'ACTIVE'
      });

      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      await socketService.handleJoinRoom(mockSocket, { roomCode, pin, nickname });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        errorCode: 'INVALID_PIN'
      }));
    });

    it('debería rechazar sala no encontrada', async () => {
      const roomCode = 'INVALID';
      const pin = '1234';
      const nickname = 'TestUser';

      fingerprintService.generateSessionFingerprint.mockReturnValue({
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'fingerprint123'
      });

      Room.findOne.mockResolvedValue(null);

      await socketService.handleJoinRoom(mockSocket, { roomCode, pin, nickname });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        errorCode: 'ROOM_NOT_FOUND'
      }));
    });
  });

  describe('handleSendMessage()', () => {
    it('debería guardar mensaje y hacer broadcast', async () => {
      const roomCode = 'ABC123';
      const content = 'Hola mundo';

      const mockRoom = {
        _id: 'room123',
        roomCode,
        name: 'Test Room'
      };

      const mockSession = {
        _id: 'session123',
        nickname: 'TestUser',
        roomId: mockRoom,
        socketId: mockSocket.id,
        lastActivityAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock Session.findOne with populate chain
      Session.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSession)
      });

      const mockMessage = {
        _id: 'msg123',
        roomId: 'room123',
        senderNickname: 'TestUser',
        content,
        type: 'TEXT',
        save: jest.fn().mockResolvedValue(true)
      };

      Message.mockImplementation(() => mockMessage);

      await socketService.handleSendMessage(mockSocket, { roomCode, content });

      expect(mockSession.save).toHaveBeenCalled();
      expect(mockMessage.save).toHaveBeenCalled();
    });

    it('debería validar datos requeridos', async () => {
      await socketService.handleSendMessage(mockSocket, { content: 'test' });
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        errorCode: 'MISSING_DATA'
      }));

      jest.clearAllMocks();

      await socketService.handleSendMessage(mockSocket, { roomCode: 'ABC123' });
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        errorCode: 'MISSING_DATA'
      }));
    });
  });

  describe('handleDisconnect()', () => {
    it('debería desactivar sesión al desconectar', async () => {
      const mockRoom = {
        _id: 'room123',
        roomCode: 'ABC123'
      };

      const mockSession = {
        _id: 'session123',
        socketId: mockSocket.id,
        roomId: mockRoom,
        nickname: 'TestUser',
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock Session.findOne with populate
      Session.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSession)
      });

      // Mock getConnectedUsers with select chain
      Session.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([])
      });

      await socketService.handleDisconnect(mockSocket);

      expect(mockSession.isActive).toBe(false);
      expect(mockSession.save).toHaveBeenCalled();
      expect(redisService.removeSession).toHaveBeenCalled();
    });

  });

  describe('getConnectedUsers()', () => {
    it('debería devolver lista de usuarios con select chain', async () => {
      const roomId = 'room123';
      const mockSessions = [
        { nickname: 'User1', nicknameHash: 'hash1' },
        { nickname: 'User2', nicknameHash: 'hash2' }
      ];

      Session.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockSessions)
      });

      const result = await socketService.getConnectedUsers(roomId);

      expect(Session.find).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId,
          isActive: true
        })
      );
      expect(result).toBeDefined();
    });
  });
});
