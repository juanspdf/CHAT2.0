const express = require('express');
const bcrypt = require('bcrypt');
const Room = require('../models/Room');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { validatePin, generateRoomCode } = require('../utils/validators');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateMimeType, generateSafeFilename } = require('../utils/validators');

const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const roomCode = req.params.roomCode;
    const uploadDir = path.join(__dirname, '../../uploads', roomCode);
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = generateSafeFilename(file.originalname);
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (validateMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// POST /api/rooms - Crear sala (requiere auth de admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, pin, maxFileSizeMB } = req.body;

    // Validaciones
    if (!type || !['TEXT', 'MULTIMEDIA'].includes(type)) {
      return res.status(400).json({
        errorCode: 'INVALID_TYPE',
        message: 'Tipo de sala inválido. Debe ser TEXT o MULTIMEDIA'
      });
    }

    if (!validatePin(pin)) {
      return res.status(400).json({
        errorCode: 'INVALID_PIN',
        message: 'PIN inválido. Debe tener al menos 4 dígitos'
      });
    }

    // Generar roomCode único
    let roomCode;
    let isUnique = false;
    while (!isUnique) {
      roomCode = generateRoomCode();
      const existing = await Room.findOne({ roomCode });
      if (!existing) isUnique = true;
    }

    // Hash del PIN
    const pinHash = await bcrypt.hash(String(pin), 10);

    // Crear sala
    const room = new Room({
      roomCode,
      pinHash,
      type,
      maxFileSizeMB: maxFileSizeMB || 10,
      createdBy: req.admin.id
    });

    await room.save();

    res.status(201).json({
      roomCode: room.roomCode,
      type: room.type,
      maxFileSizeMB: room.maxFileSizeMB,
      createdAt: room.createdAt,
      status: room.status
    });
  } catch (error) {
    console.error('Error creando sala:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/rooms/:roomCode - Obtener info de sala
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await Room.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({
        errorCode: 'ROOM_NOT_FOUND',
        message: 'Sala no encontrada'
      });
    }

    res.json({
      roomCode: room.roomCode,
      type: room.type,
      maxFileSizeMB: room.maxFileSizeMB,
      createdAt: room.createdAt,
      status: room.status
    });
  } catch (error) {
    console.error('Error obteniendo sala:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/rooms - Obtener todas las salas (requiere auth)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find({ createdBy: req.admin.id })
      .sort({ createdAt: -1 });

    res.json({
      rooms: rooms.map(room => ({
        id: room._id,
        roomCode: room.roomCode,
        type: room.type,
        maxFileSizeMB: room.maxFileSizeMB,
        createdAt: room.createdAt,
        status: room.status
      }))
    });
  } catch (error) {
    console.error('Error obteniendo salas:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/rooms/:roomCode/files - Subir archivo
router.post('/:roomCode/files', upload.single('file'), async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { nickname } = req.body;

    // Buscar sala
    const room = await Room.findOne({ roomCode, status: 'ACTIVE' });
    
    if (!room) {
      return res.status(404).json({
        errorCode: 'ROOM_NOT_FOUND',
        message: 'Sala no encontrada o cerrada'
      });
    }

    if (room.type !== 'MULTIMEDIA') {
      return res.status(400).json({
        errorCode: 'INVALID_ROOM_TYPE',
        message: 'Esta sala no permite archivos multimedia'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        errorCode: 'NO_FILE',
        message: 'No se proporcionó ningún archivo'
      });
    }

    // Crear mensaje en BD
    const fileUrl = `/uploads/${roomCode}/${req.file.filename}`;
    
    const message = new Message({
      roomId: room._id,
      senderNickname: nickname || 'Anónimo',
      type: 'FILE',
      content: req.file.originalname,
      fileUrl,
      fileMimeType: req.file.mimetype,
      fileSizeBytes: req.file.size
    });

    await message.save();

    // Aquí se notificará vía socket en el servidor principal
    res.status(201).json({
      messageId: message._id,
      fileUrl,
      fileMimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      originalName: req.file.originalname
    });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    
    if (error.message === 'Tipo de archivo no permitido') {
      return res.status(400).json({
        errorCode: 'INVALID_FILE_TYPE',
        message: 'Tipo de archivo no permitido'
      });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        errorCode: 'FILE_TOO_LARGE',
        message: `El archivo excede el tamaño máximo permitido de ${process.env.MAX_FILE_SIZE_MB || 10}MB`
      });
    }

    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
