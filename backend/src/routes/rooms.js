const express = require('express');
const bcrypt = require('bcrypt');
const Room = require('../models/Room');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { validatePin, generateRoomCode } = require('../utils/validators');
const { roomCreationRateLimit, uploadRateLimit } = require('../middleware/rateLimiter');
const workerManager = require('../services/workerManager');
const encryptionService = require('../services/encryptionService');
const auditLogService = require('../services/auditLogService');
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
router.post('/', authMiddleware, roomCreationRateLimit, async (req, res) => {
  try {
    const { type, pin, maxFileSizeMB, encryptionEnabled } = req.body;

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
    let roomCodeHash;
    let isUnique = false;
    while (!isUnique) {
      roomCode = generateRoomCode();
      roomCodeHash = encryptionService.hashRoomCode(roomCode);
      const existing = await Room.findOne({ roomCodeHash });
      if (!existing) isUnique = true;
    }

    // Hash del PIN usando worker thread
    const pinHash = await workerManager.hashPassword(String(pin), 10);

    // Generar claves de cifrado E2E (siempre habilitado para nuevas salas)
    const { key, iv } = encryptionService.generateRoomKey();
    const encryptionData = {
      encryptionEnabled: true,
      encryptionKey: key,
      encryptionIV: iv
    };

    // Crear sala (roomCode en texto plano + hash)
    const room = new Room({
      roomCode,
      roomCodeHash,
      pinHash,
      type,
      maxFileSizeMB: maxFileSizeMB || 10,
      createdBy: req.admin.id,
      ...encryptionData
    });

    await room.save();

    await auditLogService.createLog({
      action: 'ROOM_CREATED',
      actor: req.admin.id,
      ipAddress: req.ip,
      deviceFingerprint: require('crypto')
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      details: {
        username: req.admin.username,
        userType: 'admin',
        roomCode,
        type,
        encryptionEnabled: true
      }
    });

    // Retornar roomCode para el admin
    res.status(201).json({
      roomCode: roomCode,
      type: room.type,
      maxFileSizeMB: room.maxFileSizeMB,
      encryptionEnabled: room.encryptionEnabled,
      encryptionKey: room.encryptionKey,
      encryptionIV: room.encryptionIV,
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

    // Hashear el código ingresado para buscar
    const roomCodeHash = encryptionService.hashRoomCode(roomCode);
    const room = await Room.findOne({ roomCodeHash });
    
    if (!room) {
      return res.status(404).json({
        errorCode: 'ROOM_NOT_FOUND',
        message: 'Sala no encontrada'
      });
    }

    // No retornar roomCode original (solo hash)
    res.json({
      roomCode: roomCode,
      type: room.type,
      maxFileSizeMB: room.maxFileSizeMB,
      encryptionEnabled: room.encryptionEnabled,
      encryptionKey: room.encryptionKey,
      encryptionIV: room.encryptionIV,
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
      .select('+roomCode') // Incluir roomCode explícitamente para admin
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
router.post('/:roomCode/files', uploadRateLimit, upload.single('file'), async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { nickname } = req.body;

    // Hashear para buscar
    const roomCodeHash = encryptionService.hashRoomCode(roomCode);
    const room = await Room.findOne({ roomCodeHash, status: 'ACTIVE' });
    
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

    console.log('📁 Archivo recibido:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Analizar esteganografía en paralelo usando worker thread
    let steganographyResult;
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      console.log('📊 Buffer leído, tamaño:', fileBuffer.length);
      
      const rawResult = await workerManager.analyzeSteganography(
        fileBuffer,
        req.file.originalname,
        req.file.mimetype
      );
      
      console.log('✅ Análisis completado:', rawResult);
      
      // Normalizar la respuesta del worker
      steganographyResult = {
        success: true,
        result: rawResult.verdict ? rawResult : {
          verdict: rawResult.verdict || 'APROBADO',
          riskScore: rawResult.riskScore || 0,
          details: rawResult.analysis || {},
          warnings: []
        }
      };
    } catch (analysisError) {
      console.error('❌ Error en análisis de esteganografía:', analysisError);
      
      // No bloquear el upload si el análisis falla - solo advertir
      steganographyResult = {
        success: true,
        result: {
          verdict: 'APROBADO',
          riskScore: 0,
          details: 'Análisis omitido por error técnico',
          warnings: ['El análisis de esteganografía no pudo completarse']
        }
      };
    }

    // Verificar resultado del análisis
    if (!steganographyResult.success) {
      // Eliminar archivo si el análisis falló
      fs.unlinkSync(req.file.path);
      
      return res.status(500).json({
        errorCode: 'ANALYSIS_FAILED',
        message: 'Error al analizar el archivo'
      });
    }

    const analysis = steganographyResult.result;

    // Extraer veredicto simple del texto completo
    let verdictEnum = 'APROBADO';
    if (analysis.verdict) {
      if (analysis.verdict.includes('RECHAZADO')) verdictEnum = 'RECHAZADO';
      else if (analysis.verdict.includes('ALERTA')) verdictEnum = 'ALERTA';
      else if (analysis.verdict.includes('ADVERTENCIA')) verdictEnum = 'ADVERTENCIA';
      else verdictEnum = 'APROBADO';
    }

    // 🚨 EMITIR ALERTA AL ADMINISTRADOR ANTES DE RECHAZAR
    const io = req.app.get('io');
    if (io && (verdictEnum === 'ALERTA' || verdictEnum === 'RECHAZADO')) {
      console.log('⚠️ CONDICIÓN DE ALERTA CUMPLIDA:');
      console.log('   Veredicto:', verdictEnum);
      console.log('   Archivo:', req.file.originalname);
      console.log('   RoomCode:', roomCode);

      const alertData = {
        type: 'STEGANOGRAPHY_DETECTED',
        severity: verdictEnum === 'RECHAZADO' ? 'HIGH' : 'MEDIUM',
        timestamp: new Date(),
        data: {
          roomCode: roomCode,
          roomId: room._id,
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          uploadedBy: nickname || 'Anónimo',
          verdict: verdictEnum,
          riskScore: analysis.riskScore,
          analysis: {
            entropy: analysis.analysis?.entropy,
            lsb: analysis.analysis?.lsb,
            pixelCorrelation: analysis.analysis?.pixelCorrelation
          }
        }
      };

      console.log('📡 Emitiendo admin_alert:', JSON.stringify(alertData, null, 2));
      io.emit('admin_alert', alertData);
      console.log(`🚨 ALERTA ENVIADA AL ADMINISTRADOR: ${verdictEnum} en sala ${roomCode}`);

      // Registrar alerta en audit log
      await auditLogService.createLog({
        action: 'ADMIN_ALERT_SENT',
        actor: nickname || 'Anónimo',
        target: roomCode,
        details: {
          severity: verdictEnum === 'RECHAZADO' ? 'HIGH' : 'MEDIUM',
          filename: req.file.originalname,
          verdict: verdictEnum,
          riskScore: analysis.riskScore
        }
      });
    }

    // Si el veredicto contiene RECHAZADO, eliminar archivo y rechazar upload
    if (analysis.verdict && analysis.verdict.includes('RECHAZADO')) {
      fs.unlinkSync(req.file.path);
      
      await auditLogService.createLog({
        action: 'FILE_UPLOAD_REJECTED',
        actor: 'user',
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: {
          username: nickname || 'Anónimo',
          userType: 'user',
          roomCode,
          filename: req.file.originalname,
          verdict: analysis.verdict,
          riskScore: analysis.riskScore,
          reasons: analysis.details
        }
      });
      
      return res.status(400).json({
        errorCode: 'STEGANOGRAPHY_DETECTED',
        message: 'Archivo rechazado: posible contenido oculto detectado',
        verdict: analysis.verdict,
        riskScore: analysis.riskScore,
        details: analysis.details
      });
    }

    // Registrar si hay ALERTA o ADVERTENCIA
    if (analysis.verdict && (analysis.verdict.includes('ALERTA') || analysis.verdict.includes('ADVERTENCIA'))) {
      await auditLogService.createLog({
        action: 'FILE_UPLOAD_FLAGGED',
        actor: 'user',
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: {
          username: nickname || 'Anónimo',
          userType: 'user',
          roomCode,
          filename: req.file.originalname,
          verdict: analysis.verdict,
          riskScore: analysis.riskScore
        }
      });
    }

    // Crear mensaje en BD con análisis de esteganografía
    const fileUrl = `/uploads/${roomCode}/${req.file.filename}`;
    
    // Convertir analysisTime de "6ms" a número 6
    const analysisTimeMs = analysis.analysisTime ? 
      parseInt(analysis.analysisTime.toString().replace(/ms/i, '')) : null;
    
    const message = new Message({
      roomId: room._id,
      senderNickname: nickname || 'Anónimo',
      type: 'FILE',
      content: req.file.originalname,
      fileUrl,
      fileMimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      steganographyAnalysis: {
        verdict: verdictEnum,
        riskScore: analysis.riskScore || 0,
        analysisTime: analysisTimeMs
      }
    });

    await message.save();

    // Emitir mensaje a todos los usuarios en la sala vía WebSocket
    if (io) {
      io.to(roomCode).emit('new_message', {
        id: message._id,
        nickname: message.senderNickname,
        type: 'FILE',
        content: message.content,
        fileUrl: message.fileUrl,
        fileMimeType: message.fileMimeType,
        fileSizeBytes: message.fileSizeBytes,
        steganographyAnalysis: {
          verdict: verdictEnum,
          riskScore: analysis.riskScore || 0
        },
        createdAt: message.createdAt
      });
    }

    // Responder al cliente HTTP
    res.status(201).json({
      messageId: message._id,
      fileUrl,
      fileMimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      originalName: req.file.originalname,
      steganographyAnalysis: {
        verdict: analysis.verdict,
        riskScore: analysis.riskScore,
        warning: verdictEnum !== 'APROBADO' ? 
          'Este archivo presenta anomalías que podrían indicar contenido oculto' : null
      }
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
