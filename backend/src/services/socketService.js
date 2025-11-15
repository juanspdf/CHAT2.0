const bcrypt = require('bcrypt');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Session = require('../models/Session');
const { validateNickname, sanitizeText } = require('../utils/validators');

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
      const { roomCode, pin, nickname, deviceId } = data;

      // Validaciones básicas
      if (!roomCode || !pin || !nickname || !deviceId) {
        socket.emit('error', {
          errorCode: 'MISSING_DATA',
          message: 'Faltan datos requeridos (roomCode, pin, nickname, deviceId)'
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

      // Buscar sala
      const room = await Room.findOne({ roomCode, status: 'ACTIVE' });
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

      // Verificar que el deviceId no esté en otra sala
      const existingSession = await Session.findOne({
        deviceId,
        isActive: true
      });

      if (existingSession && existingSession.roomId.toString() !== room._id.toString()) {
        socket.emit('error', {
          errorCode: 'ALREADY_IN_ROOM',
          message: 'Ya estás conectado en otra sala. Solo puedes estar en una sala a la vez.'
        });
        return;
      }

      // Verificar que el nickname no esté en uso en esta sala
      const nicknameInUse = await Session.findOne({
        roomId: room._id,
        nickname: nickname.trim(),
        isActive: true,
        socketId: { $ne: socket.id }
      });

      if (nicknameInUse) {
        socket.emit('error', {
          errorCode: 'NICKNAME_IN_USE',
          message: 'Este nickname ya está en uso en esta sala'
        });
        return;
      }

      // Crear o actualizar sesión
      await Session.findOneAndUpdate(
        { socketId: socket.id },
        {
          roomId: room._id,
          deviceId,
          nickname: nickname.trim(),
          socketId: socket.id,
          isActive: true,
          lastActivityAt: new Date()
        },
        { upsert: true }
      );

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
      socket.to(roomCode).emit('user_joined', {
        nickname: nickname.trim(),
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

      if (session.roomId.roomCode !== roomCode) {
        socket.emit('error', {
          errorCode: 'WRONG_ROOM',
          message: 'No estás en esta sala'
        });
        return;
      }

      // Sanitizar contenido
      const sanitizedContent = sanitizeText(content);

      // Crear mensaje en BD
      const message = new Message({
        roomId: session.roomId._id,
        senderNickname: session.nickname,
        type: 'TEXT',
        content: sanitizedContent
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

        // Desactivar sesión
        session.isActive = false;
        await session.save();

        // Obtener usuarios restantes
        const connectedUsers = await this.getConnectedUsers(session.roomId._id);

        // Notificar a los demás usuarios
        socket.to(roomCode).emit('user_left', {
          nickname,
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

      if (!session || session.roomId.roomCode !== roomCode) {
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

      socket.emit('messages_history', {
        roomCode,
        messages: messages.reverse().map(msg => ({
          messageId: msg._id,
          nickname: msg.senderNickname,
          type: msg.type,
          content: msg.content,
          fileUrl: msg.fileUrl,
          fileMimeType: msg.fileMimeType,
          fileSizeBytes: msg.fileSizeBytes,
          createdAt: msg.createdAt
        }))
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
    }).select('nickname');

    return sessions.map(s => ({ nickname: s.nickname }));
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

module.exports = SocketService;
