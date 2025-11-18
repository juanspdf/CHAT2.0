const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Session = require('../models/Session');
const { validateNickname, sanitizeText } = require('../utils/validators');
const redisService = require('./redisService');
const FingerprintService = require('./fingerprintService');
const workerManager = require('./workerManager');

class SocketService {
  constructor(io) {
    this.io = io;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Cliente conectado: ${socket.id}`);

      // Evento: Usuario intenta unirse a una sala
      socket.on('join_room', async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      // Evento: Usuario envía mensaje
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Evento: Usuario se desconecta
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });

      // Evento: Obtener historial de mensajes
      socket.on('get_messages', async (data) => {
        await this.handleGetMessages(socket, data);
      });
    });
  }

  async handleJoinRoom(socket, data) {
    try {
      const { roomCode, pin, nickname } = data;

      // Generar fingerprint completo del dispositivo
      const fingerprint = FingerprintService.generateSessionFingerprint(socket);
      const { ipAddress, userAgent, userAgentHash, deviceId, deviceFingerprint } = fingerprint;
      
      console.log(`🔍 Cliente conectando:`, {
        ip: ipAddress,
        deviceId,
        fingerprint: deviceFingerprint.substring(0, 16) + '...'
      });

      // Validaciones básicas
      if (!roomCode || !pin || !nickname) {
        socket.emit('error', {
          errorCode: 'MISSING_DATA',
          message: 'Faltan datos requeridos (roomCode, pin, nickname)'
        });
        return;
      }

      // Validar nickname
      if (!validateNickname(nickname)) {
        socket.emit('error', {
          errorCode: 'INVALID_NICKNAME',
          message: 'El nickname debe tener entre 3 y 20 caracteres'
        });
        return;
      }

      // Hashear roomCode para buscar en BD
      const encryptionService = require('./encryptionService');
      const roomCodeHash = encryptionService.hashRoomCode(roomCode);
      const room = await Room.findOne({ roomCodeHash, status: 'ACTIVE' });
      if (!room) {
        socket.emit('error', {
          errorCode: 'ROOM_NOT_FOUND',
          message: 'Sala no encontrada o cerrada'
        });
        return;
      }

      // Verificar PIN
      const isPinValid = await bcrypt.compare(String(pin), room.pinHash);
      if (!isPinValid) {
        socket.emit('error', {
          errorCode: 'INVALID_PIN',
          message: 'PIN incorrecto'
        });
        return;
      }

      // VALIDACIÓN CRÍTICA: Verificar que este dispositivo no tenga sesiones activas
      // Primero verificar en Redis (cache rápido)
      let existingSession = await redisService.getActiveSession(deviceFingerprint);
      
      if (existingSession) {
        console.log('🔍 Sesión encontrada en Redis cache');
      } else {
        // Si no está en Redis, buscar en MongoDB
        existingSession = await Session.findOne({
          deviceFingerprint,
          isActive: true
        });
        
        // Si se encontró en MongoDB, guardar en Redis para próximas consultas
        if (existingSession) {
          console.log('🔍 Sesión encontrada en MongoDB, guardando en Redis cache');
          await redisService.setActiveSession(deviceFingerprint, {
            roomId: existingSession.roomId.toString(),
            nickname: existingSession.nickname,
            nicknameHash: existingSession.nicknameHash,
            socketId: existingSession.socketId,
            deviceId: existingSession.deviceId,
            deviceFingerprint: existingSession.deviceFingerprint
          }, parseInt(process.env.REDIS_SESSION_TTL) || 1800);
        }
      }

      console.log('🔍 Validación de sesión:', {
        deviceId,
        socketId: socket.id,
        tieneSessionExistente: !!existingSession,
        sessionExistente: existingSession ? {
          roomId: existingSession.roomId,
          nickname: existingSession.nickname,
          socketId: existingSession.socketId
        } : null,
        intentaUnirse: {
          roomId: room._id,
          nickname: nickname.trim()
        }
      });

      if (existingSession) {
        // Verificar si el socket de la sesión existente realmente está conectado
        const oldSocket = this.io.sockets.sockets.get(existingSession.socketId);
        
        if (!oldSocket) {
          // Socket huérfano - limpiar y permitir nueva sesión
          console.log('🧹 Limpiando sesión huérfana');
          await Session.findByIdAndUpdate(existingSession._id, { isActive: false });
          await redisService.removeSession(deviceFingerprint);
          
          console.log('🆕 Creando nueva sesión');
          const nicknameHash = FingerprintService.hashNickname(nickname.trim(), room._id.toString());
          const newSession = await Session.findOneAndUpdate(
            { socketId: socket.id },
            {
              roomId: room._id,
              deviceId,
              deviceFingerprint,
              ipAddress,
              userAgentHash,
              nickname: nickname.trim(),
              nicknameHash,
              socketId: socket.id,
              isActive: true,
              lastActivityAt: new Date()
            },
            { upsert: true, new: true }
          );
          
          // Guardar en Redis
          await redisService.setActiveSession(deviceFingerprint, {
            roomId: room._id.toString(),
            nickname: nickname.trim(),
            nicknameHash,
            socketId: socket.id,
            deviceId,
            deviceFingerprint
          }, parseInt(process.env.REDIS_SESSION_TTL) || 1800);
        } else {
          // Socket existe - es un refresh de la misma pestaña
          const isSameSocket = existingSession.socketId === socket.id;
          
          console.log('🔍 Sesión existente válida:', { 
            isSameSocket,
            roomExistente: existingSession.roomId,
            roomNueva: room._id 
          });
          
          if (isSameSocket) {
            // Mismo socket - solo actualizar timestamp
            console.log('🔄 Actualizando sesión existente');
            await Session.findByIdAndUpdate(existingSession._id, {
              lastActivityAt: new Date()
            });
            await redisService.refreshSession(deviceFingerprint, parseInt(process.env.REDIS_SESSION_TTL) || 1800);
          } else {
            // Socket diferente de la MISMA pestaña (refresh) - actualizar socket
            console.log('🔄 Refresh detectado - actualizando socket');
            await Session.findByIdAndUpdate(existingSession._id, {
              socketId: socket.id,
              lastActivityAt: new Date()
            });
            
            // Actualizar en Redis
            await redisService.setActiveSession(deviceFingerprint, {
              roomId: existingSession.roomId.toString(),
              nickname: existingSession.nickname,
              nicknameHash: existingSession.nicknameHash,
              socketId: socket.id,
              deviceId,
              deviceFingerprint
            }, parseInt(process.env.REDIS_SESSION_TTL) || 1800);
          }
        }
      } else {
        // No hay sesión existente - crear nueva usando upsert para evitar duplicados
        console.log('🆕 Creando nueva sesión');
        const nicknameHash = FingerprintService.hashNickname(nickname.trim(), room._id.toString());
        await Session.findOneAndUpdate(
          { socketId: socket.id }, // Buscar por socketId
          {
            roomId: room._id,
            deviceId,
            deviceFingerprint,
            ipAddress,
            userAgentHash,
            nickname: nickname.trim(),
            nicknameHash,
            socketId: socket.id,
            isActive: true,
            lastActivityAt: new Date()
          },
          { upsert: true, new: true } // Crear si no existe
        );
        
        // Guardar en Redis
        await redisService.setActiveSession(deviceFingerprint, {
          roomId: room._id.toString(),
          nickname: nickname.trim(),
          nicknameHash,
          socketId: socket.id,
          deviceId,
          deviceFingerprint
        }, parseInt(process.env.REDIS_SESSION_TTL) || 1800);
      }

      // Verificar que el nickname no esté en uso en esta sala por OTRA IP
      const nicknameInUse = await Session.findOne({
        roomId: room._id,
        nickname: nickname.trim(),
        isActive: true,
        deviceId: { $ne: deviceId } // Importante: solo si es otro dispositivo
      });

      if (nicknameInUse) {
        socket.emit('error', {
          errorCode: 'NICKNAME_IN_USE',
          message: 'Este nickname ya está en uso en esta sala'
        });
        return;
      }

      // La sesión ya fue creada o actualizada arriba en la validación

      // Unir al usuario a la sala de Socket.io
      socket.join(roomCode);

      // Obtener usuarios conectados en la sala
      const connectedUsers = await this.getConnectedUsers(room._id);

      // Notificar al usuario que se unió exitosamente
      socket.emit('joined_room', {
        roomCode: room.roomCode,
        type: room.type,
        nickname: nickname.trim(),
        users: connectedUsers
      });

      // Notificar a los demás usuarios
      const currentUser = connectedUsers.find(u => u.nickname === nickname.trim());
      socket.to(roomCode).emit('user_joined', {
        nickname: nickname.trim(),
        displayName: currentUser?.displayName,
        nicknameHash: currentUser?.nicknameHash,
        users: connectedUsers
      });

      console.log(`✅ ${nickname} se unió a la sala ${roomCode}`);
    } catch (error) {
      console.error('Error en join_room:', error);
      socket.emit('error', {
        errorCode: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      });
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { roomCode, content } = data;

      if (!roomCode || !content) {
        socket.emit('error', {
          errorCode: 'MISSING_DATA',
          message: 'Faltan datos requeridos'
        });
        return;
      }

      // Obtener sesión del usuario
      const session = await Session.findOne({
        socketId: socket.id,
        isActive: true
      }).populate('roomId');

      if (!session) {
        socket.emit('error', {
          errorCode: 'NOT_IN_ROOM',
          message: 'No estás en ninguna sala'
        });
        return;
      }

      // Verificar que el roomCode coincida con el hash de la sala
      const encryptionService = require('./encryptionService');
      const roomCodeHash = encryptionService.hashRoomCode(roomCode);
      
      if (session.roomId.roomCodeHash !== roomCodeHash) {
        socket.emit('error', {
          errorCode: 'WRONG_ROOM',
          message: 'No estás en esta sala'
        });
        return;
      }

      // Sanitizar contenido
      const sanitizedContent = sanitizeText(content);

      // Obtener sala para claves de cifrado
      const room = await Room.findById(session.roomId._id);
      if (!room) {
        socket.emit('error', {
          errorCode: 'ROOM_NOT_FOUND',
          message: 'Sala no encontrada'
        });
        return;
      }

      // Preparar datos del mensaje
      let messageContent = sanitizedContent;
      let encrypted = false;
      let encryptionTag = null;

      // Cifrar el mensaje solo si la sala tiene claves de cifrado
      if (room.encryptionKey && room.encryptionIV) {
        try {
          const encryptionResult = await workerManager.encrypt(
            sanitizedContent,
            room.encryptionKey,
            room.encryptionIV
          );
          messageContent = encryptionResult.encrypted;
          encryptionTag = encryptionResult.tag;
          encrypted = true;
        } catch (error) {
          console.error('Error al cifrar mensaje:', error);
          // Continuar sin cifrado si falla
        }
      }

      // Calcular hash del contenido original
      const contentHash = crypto
        .createHash('sha256')
        .update(sanitizedContent)
        .digest('hex');

      // Generar firma del mensaje
      const signature = crypto
        .createHash('sha256')
        .update(`${session.nickname}:${sanitizedContent}:${Date.now()}`)
        .digest('hex');

      // Crear mensaje en BD
      const message = new Message({
        roomId: session.roomId._id,
        senderNickname: session.nickname,
        type: 'TEXT',
        content: messageContent,
        encrypted: encrypted,
        encryptionTag: encryptionTag,
        contentHash: contentHash,
        signature: signature
      });

      await message.save();

      // Actualizar última actividad
      session.lastActivityAt = new Date();
      await session.save();

      // Broadcast del mensaje a todos en la sala
      const messageData = {
        messageId: message._id,
        roomCode,
        nickname: session.nickname,
        type: 'TEXT',
        content: sanitizedContent,
        createdAt: message.createdAt
      };

      this.io.to(roomCode).emit('new_message', messageData);

      console.log(`📨 Mensaje de ${session.nickname} en ${roomCode}`);
    } catch (error) {
      console.error('Error en send_message:', error);
      socket.emit('error', {
        errorCode: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      });
    }
  }

  async handleDisconnect(socket) {
    try {
      const session = await Session.findOne({ socketId: socket.id }).populate('roomId');

      if (session) {
        const roomCode = session.roomId.roomCode;
        const nickname = session.nickname;

        // Extraer IP del socket
        const clientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0] || 
                         socket.handshake.address;

        // Desactivar sesión en MongoDB
        session.isActive = false;
        await session.save();
        
        // Eliminar de Redis
        await redisService.removeSession(clientIP);

        // Obtener usuarios restantes
        const connectedUsers = await this.getConnectedUsers(session.roomId._id);

        // Notificar a los demás usuarios
        socket.to(roomCode).emit('user_left', {
          nickname,
          displayName: session.nicknameHash,
          nicknameHash: session.nicknameHash,
          users: connectedUsers
        });

        console.log(`👋 ${nickname} dejó la sala ${roomCode}`);
      }

      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    } catch (error) {
      console.error('Error en disconnect:', error);
    }
  }

  async handleGetMessages(socket, data) {
    try {
      const { roomCode, limit = 50 } = data;

      // Verificar que el usuario esté en la sala
      const session = await Session.findOne({
        socketId: socket.id,
        isActive: true
      }).populate('roomId');

      // Verificar que el roomCode coincida con el hash de la sala
      const encryptionService = require('./encryptionService');
      const roomCodeHash = encryptionService.hashRoomCode(roomCode);

      if (!session || session.roomId.roomCodeHash !== roomCodeHash) {
        socket.emit('error', {
          errorCode: 'NOT_IN_ROOM',
          message: 'No estás en esta sala'
        });
        return;
      }

      // Obtener mensajes
      const messages = await Message.find({ roomId: session.roomId._id })
        .sort({ createdAt: -1 })
        .limit(limit);

      // Obtener sala para desencriptar
      const room = await Room.findById(session.roomId._id);

      // Desencriptar mensajes si están encriptados
      const workerManager = require('./workerManager');
      const decryptedMessages = await Promise.all(messages.map(async (msg) => {
        let content = msg.content;
        
        // Desencriptar si el mensaje está encriptado
        if (msg.encrypted && room.encryptionKey && room.encryptionIV) {
          try {
            console.log(`🔓 Desencriptando mensaje ID: ${msg._id}`);
            content = await workerManager.decrypt(
              msg.content,
              room.encryptionKey,
              room.encryptionIV,
              msg.encryptionTag
            );
            console.log(`✅ Desencriptado exitoso: "${content.substring(0, 20)}..."`);
          } catch (error) {
            console.error('❌ Error al desencriptar mensaje ID', msg._id, ':', error.message);
            // Si falla, mantener el contenido encriptado
            console.log('⚠️ Usando contenido encriptado como fallback');
          }
        } else if (msg.encrypted) {
          console.warn(`⚠️ Mensaje ${msg._id} está marcado como encriptado pero faltan claves`);
        }

        return {
          messageId: msg._id,
          nickname: msg.senderNickname,
          type: msg.type,
          content: content,
          fileUrl: msg.fileUrl,
          fileMimeType: msg.fileMimeType,
          fileSizeBytes: msg.fileSizeBytes,
          createdAt: msg.createdAt
        };
      }));

      socket.emit('messages_history', {
        roomCode,
        messages: decryptedMessages.reverse()
      });
    } catch (error) {
      console.error('Error en get_messages:', error);
      socket.emit('error', {
        errorCode: 'SERVER_ERROR',
        message: 'Error interno del servidor'
      });
    }
  }

  async getConnectedUsers(roomId) {
    const sessions = await Session.find({
      roomId,
      isActive: true
    }).select('nickname nicknameHash');

    return sessions.map(s => ({ 
      nickname: s.nickname, // Solo para uso interno del servidor
      nicknameHash: s.nicknameHash, // Para mostrar en frontend (privacidad)
      displayName: s.nicknameHash // Alias para frontend
    }));
  }

  // Método para broadcast de archivo subido (llamado desde el endpoint REST)
  async broadcastFileUpload(roomCode, fileData) {
    this.io.to(roomCode).emit('new_message', {
      messageId: fileData.messageId,
      roomCode,
      nickname: fileData.nickname,
      type: 'FILE',
      content: fileData.originalName,
      fileUrl: fileData.fileUrl,
      fileMimeType: fileData.fileMimeType,
      fileSizeBytes: fileData.fileSizeBytes,
      createdAt: fileData.createdAt || new Date()
    });
  }
}

// Export class for instantiation and methods for testing
module.exports = SocketService;
module.exports.handleJoinRoom = SocketService.prototype.handleJoinRoom;
module.exports.handleSendMessage = SocketService.prototype.handleSendMessage;
module.exports.handleMessage = SocketService.prototype.handleSendMessage;
module.exports.handleDisconnect = SocketService.prototype.handleDisconnect;
module.exports.getConnectedUsers = SocketService.prototype.getConnectedUsers;
