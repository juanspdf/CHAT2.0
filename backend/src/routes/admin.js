const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const auditLogService = require('../services/auditLogService');
const { authRateLimit } = require('../middleware/rateLimiter');
const workerManager = require('../services/workerManager');

const router = express.Router();

// POST /api/admin/login
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔍 DEBUG Login - Request body:', { username, password: '***' });

    // Validaciones
    if (!username || !password) {
      console.log('❌ Credenciales faltantes');
      return res.status(400).json({
        errorCode: 'MISSING_CREDENTIALS',
        message: 'Usuario y contraseña son requeridos'
      });
    }

    // Buscar admin
    const admin = await Admin.findOne({ username });
    console.log('🔍 Admin encontrado:', !!admin);
    console.log('🔍 Admin username:', admin?.username);
    console.log('🔍 Admin tiene passwordHash:', !!admin?.passwordHash);
    if (!admin) {
      await auditLogService.createLog({
        action: 'ADMIN_LOGIN_FAILED',
        actor: 'unknown',
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: { 
          username: username,
          userType: 'admin',
          reason: 'USER_NOT_FOUND' 
        }
      });
      
      return res.status(401).json({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar contraseña directamente con bcrypt (más confiable)
    console.log('🔍 Verificando contraseña...');
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    console.log('🔍 Password válida:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Contraseña incorrecta');
      await auditLogService.createLog({
        action: 'ADMIN_LOGIN_FAILED',
        actor: admin._id.toString(),
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: { 
          username: admin.username,
          userType: 'admin',
          reason: 'INVALID_PASSWORD' 
        }
      });
      
      return res.status(401).json({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar si el admin tiene 2FA habilitado
    console.log('🔍 DEBUG Login - Admin:', admin.username);
    console.log('🔍 twoFactorEnabled:', admin.twoFactorEnabled);
    console.log('🔍 typeof twoFactorEnabled:', typeof admin.twoFactorEnabled);
    console.log('🔍 twoFactorSecret:', !!admin.twoFactorSecret);
    
    if (!admin.twoFactorEnabled) {
      // Si no tiene 2FA, generar token temporal para que pueda configurarlo
      console.log('✅ Entrando a rama de SETUP 2FA');
      const tempToken = jwt.sign(
        { 
          adminId: admin._id, 
          username: admin.username,
          temp: true, // Token temporal solo para configurar 2FA
          purpose: 'setup_2fa'
        },
        process.env.JWT_SECRET,
        { expiresIn: '30m' } // 30 minutos para configurar 2FA
      );

      await auditLogService.createLog({
        action: 'ADMIN_LOGIN',
        actor: admin._id.toString(),
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: { 
          username: admin.username,
          userType: 'admin',
          requires2FASetup: true 
        }
      });

      return res.json({
        requires2FASetup: true,
        tempToken: tempToken,
        message: 'Debes configurar la autenticación de dos factores',
        admin: {
          id: admin._id,
          username: admin.username
        }
      });
    }

    // 2FA es obligatorio para todos los admins que ya lo tienen configurado
    console.log('✅ Entrando a rama de VERIFICAR 2FA (admin ya tiene 2FA configurado)');
    // Crear sesión temporal (sin privilegios completos)
    req.session.tempAdminId = admin._id.toString();
    req.session.tempUsername = admin.username;
    req.session.requires2FA = true;
    
    // Guardar sesión explícitamente
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await auditLogService.createLog({
      action: 'ADMIN_2FA_REQUIRED',
      actor: admin._id.toString(),
      ipAddress: req.ip,
      deviceFingerprint: require('crypto')
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      details: { 
        username: admin.username,
        userType: 'admin',
        requires2FA: true 
      }
    });
    
    return res.json({
      requires2FA: true,
      message: 'Ingresa el código de autenticación de dos factores'
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/admin/register (solo para testing/setup inicial)
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        errorCode: 'MISSING_DATA',
        message: 'Usuario y contraseña son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        errorCode: 'WEAK_PASSWORD',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si ya existe
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({
        errorCode: 'USER_EXISTS',
        message: 'El usuario ya existe'
      });
    }

    // Hash de contraseña usando worker thread
    const passwordHash = await workerManager.hashPassword(password, 10);

    // Generar 2FA automáticamente
    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');
    
    const secret = speakeasy.generateSecret({
      name: `ChatSystem - ${username}`,
      length: 32
    });

    // Generar códigos de respaldo
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      backupCodes.push(code);
    }

    // Hash de códigos de respaldo
    const crypto = require('crypto');
    const hashedBackupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    // Crear admin con 2FA habilitado
    const admin = new Admin({
      username,
      passwordHash,
      twoFactorEnabled: true,
      twoFactorSecret: secret.base32,
      backupCodes: hashedBackupCodes
    });

    await admin.save();

    // Generar código QR
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    await auditLogService.createLog({
      action: 'ADMIN_CREATED',
      actor: admin._id.toString(),
      ipAddress: req.ip,
      deviceFingerprint: require('crypto')
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      details: {
        username: admin.username,
        userType: 'admin',
        twoFactorEnabled: true
      }
    });

    res.status(201).json({
      message: 'Admin creado exitosamente con 2FA obligatorio',
      adminId: admin._id,
      username: admin.username,
      qrCode: qrCode,
      backupCodes: backupCodes,
      warning: 'IMPORTANTE: Guarda los códigos de respaldo en un lugar seguro. No se mostrarán de nuevo.'
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
