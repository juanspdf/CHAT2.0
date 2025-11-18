const mongoose = require('mongoose');
const Room = require('../src/models/Room');
const Session = require('../src/models/Session');

// Mock de MongoDB en memoria
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Room.deleteMany({});
  await Session.deleteMany({});
});

describe('Session Management', () => {
  describe('Sesión única por dispositivo', () => {
    test('debería permitir crear una sesión', async () => {
      const roomId = new mongoose.Types.ObjectId();
      
      const session = new Session({
        roomId,
        deviceId: 'device123',
        deviceFingerprint: 'abc123def456',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash123',
        nicknameHash: 'nick123',
        nickname: 'Juan',
        socketId: 'socket123',
        isActive: true
      });

      await session.save();
      
      const found = await Session.findOne({ deviceId: 'device123' });
      expect(found).toBeDefined();
      expect(found.nickname).toBe('Juan');
    });

    test('debería detectar dispositivo ya en otra sala', async () => {
      const room1Id = new mongoose.Types.ObjectId();
      const room2Id = new mongoose.Types.ObjectId();
      
      // Sesión en sala 1
      await Session.create({
        roomId: room1Id,
        deviceId: 'device123',
        deviceFingerprint: 'abc123def456',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash123',
        nicknameHash: 'nick123',
        nickname: 'Juan',
        socketId: 'socket123',
        isActive: true
      });
      
      // Intentar crear sesión en sala 2 con mismo dispositivo
      await Session.create({
        roomId: room2Id,
        deviceId: 'device123',
        deviceFingerprint: 'abc123def456',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash123',
        nicknameHash: 'nick456',
        nickname: 'Juan',
        socketId: 'socket456',
        isActive: true
      });

      // Intentar buscar sesión activa del mismo dispositivo
      const existingSession = await Session.findOne({
        deviceId: 'device123',
        isActive: true
      });

      expect(existingSession).toBeDefined();
      expect(existingSession.roomId.toString()).toBe(room1Id.toString());
      
      // Verificar que está en otra sala
      const isDifferentRoom = existingSession.roomId.toString() !== room2Id.toString();
      expect(isDifferentRoom).toBe(true);
    });

    test('debería permitir misma sesión si es la misma sala', async () => {
      const roomId = new mongoose.Types.ObjectId();
      
      await Session.create({
        roomId,
        deviceId: 'device123',
        deviceFingerprint: 'abc123def456',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash123',
        nicknameHash: 'nick123',
        nickname: 'Juan',
        socketId: 'socket123',
        isActive: true
      });

      const existingSession = await Session.findOne({
        deviceId: 'device123',
        isActive: true
      });

      const isSameRoom = existingSession.roomId.toString() === roomId.toString();
      expect(isSameRoom).toBe(true);
    });
  });

  describe('Nickname único en sala', () => {
    test('debería detectar nickname duplicado en misma sala', async () => {
      const roomId = new mongoose.Types.ObjectId();
      
      await Session.create({
        roomId,
        deviceId: 'device1',
        deviceFingerprint: 'abc123',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash1',
        nicknameHash: 'nick1',
        nickname: 'Juan',
        socketId: 'socket1',
        isActive: true
      });

      const nicknameInUse = await Session.findOne({
        roomId,
        nickname: 'Juan',
        isActive: true,
        socketId: { $ne: 'socket2' }
      });

      expect(nicknameInUse).toBeDefined();
    });

    test('debería permitir mismo nickname en salas diferentes', async () => {
      const room1Id = new mongoose.Types.ObjectId();
      const room2Id = new mongoose.Types.ObjectId();
      
      await Session.create({
        roomId: room1Id,
        deviceId: 'device1',
        deviceFingerprint: 'abc123',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash1',
        nicknameHash: 'nick1',
        nickname: 'Juan',
        socketId: 'socket1',
        isActive: true
      });

      await Session.create({
        roomId: room2Id,
        deviceId: 'device2',
        deviceFingerprint: 'def456',
        ipAddress: '192.168.1.2',
        userAgentHash: 'hash2',
        nicknameHash: 'nick2',
        nickname: 'Juan',
        socketId: 'socket2',
        isActive: true
      });

      const sessions = await Session.find({ nickname: 'Juan', isActive: true });
      expect(sessions).toHaveLength(2);
    });
  });

  describe('Actualización de actividad', () => {
    test('debería actualizar lastActivityAt', async () => {
      const roomId = new mongoose.Types.ObjectId();
      
      const session = await Session.create({
        roomId,
        deviceId: 'device1',
        deviceFingerprint: 'abc123',
        ipAddress: '192.168.1.1',
        userAgentHash: 'hash1',
        nicknameHash: 'nick1',
        nickname: 'Juan',
        socketId: 'socket1',
        isActive: true
      });

      const originalTime = session.lastActivityAt;
      
      // Esperar un momento
      await new Promise(resolve => setTimeout(resolve, 100));
      
      session.lastActivityAt = new Date();
      await session.save();

      const updated = await Session.findById(session._id);
      expect(updated.lastActivityAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });
});
