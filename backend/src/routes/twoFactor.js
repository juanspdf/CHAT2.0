const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const twoFactorAuth = require('../services/twoFactorAuth');
const auditLogService = require('../services/auditLogService');
const tokenService = require('../services/tokenService');
const fingerprintService = require('../services/fingerprintService');
const { authRateLimit } = require('../middleware/rateLimiter');

/**
 * Middleware para verificar autenticación de admin
 * Acepta sesiones completas O tokens temporales para setup de 2FA
 */
const requireAdmin = (req, res, next) => {
  console.log('🔍 requireAdmin middleware - Verificando autenticación');
  console.log('🔍 Session isAdmin:', req.session?.isAdmin);
  console.log('🔍 Session userId:', req.session?.userId);
  console.log('🔍 Authorization header:', req.headers.authorization?.substring(0, 30));
  
  // Opción 1: Sesión completa de admin (ya pasó 2FA)
  if (req.session?.isAdmin && req.session?.userId) {
    console.log('✅ Autenticado por sesión');
    return next();
  }
  
  // Opción 2: Token temporal para setup de 2FA
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      console.log('🔍 Token decoded:', { temp: decoded.temp, purpose: decoded.purpose, adminId: decoded.adminId });
      
      // Verificar que sea un token temporal para setup
      if (decoded.temp && decoded.purpose === 'setup_2fa') {
        console.log('✅ Autenticado por token temporal');
        req.admin = {
          id: decoded.adminId,
          username: decoded.username,
          tempSetup: true
        };
        return next();
      }
    } catch (error) {
      console.log('❌ Error verificando token:', error.message);
      // Token inválido, continuar con el rechazo
    }
  }
  
  console.log('❌ No autorizado');
  return res.status(401).json({ error: 'No autorizado' });
};

/**
 * POST /api/2fa/setup
 * Genera secreto y QR code para configurar 2FA
 */
router.post('/setup', requireAdmin, async (req, res) => {
  try {
    // Obtener adminId desde sesión o desde token temporal
    const adminId = req.session?.userId || req.admin?.id;
    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Administrador no encontrado' });
    }
    
    if (admin.twoFactorEnabled) {
      return res.status(400).json({ 
        error: '2FA ya está habilitado',
        message: 'Debes deshabilitar 2FA antes de configurar uno nuevo'
      });
    }
    
    // Generar secreto y QR
    const { secret, otpauth_url } = twoFactorAuth.generateSecret(admin.username);
    const qrCode = await twoFactorAuth.generateQRCode(otpauth_url);
    
    // Guardar secreto temporalmente (sin habilitar)
    admin.twoFactorSecret = secret;
    await admin.save();
    
    // Registrar en audit log
    await auditLogService.createLog({
      action: 'ADMIN_2FA_SETUP_INITIATED',
      actor: admin._id.toString(),
      ipAddress: req.ip,
      deviceFingerprint: require('crypto')
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      details: {
        username: admin.username,
        userType: 'admin'
      }
    });
    
    res.json({
      secret,
      qrCode,
      message: 'Escanea el código QR con Google Authenticator y verifica con un token para activar 2FA'
    });
  } catch (error) {
    console.error('Error en setup 2FA:', error);
    res.status(500).json({ error: 'Error al configurar 2FA' });
  }
});

/**
 * POST /api/2fa/verify-setup
 * Verifica token y activa 2FA
 */
router.post('/verify-setup', requireAdmin, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token || token.length !== 6) {
      return res.status(400).json({ 
        error: 'Token inválido',
        message: 'El token debe tener 6 dígitos'
      });
    }
    
    // Obtener adminId desde sesión o desde token temporal
    const adminId = req.session?.userId || req.admin?.id;
    const admin = await Admin.findById(adminId);
    
    if (!admin || !admin.twoFactorSecret) {
      return res.status(400).json({ 
        error: 'No hay configuración 2FA pendiente' 
      });
    }
    
    // Verificar token
    console.log('🔍 Verificando token TOTP para setup');
    console.log('🔍 Token recibido:', token);
    console.log('🔍 Secret:', admin.twoFactorSecret);
    console.log('🔍 Timestamp servidor:', Date.now());
    console.log('🔍 Hora servidor:', new Date().toISOString());
    
    const isValid = twoFactorAuth.verifyToken(admin.twoFactorSecret, token);
    console.log('🔍 Token válido:', isValid);
    
    if (!isValid) {
      console.log('❌ Token inválido durante setup');
      console.log('❌ Posibles razones: 1) Código expiró 2) QR code viejo 3) Desincronización de tiempo');
      return res.status(400).json({ 
        error: 'Token inválido',
        message: 'El código de verificación no es correcto. Asegúrate de usar el código más reciente de Google Authenticator.'
      });
    }
    
    // Generar códigos de respaldo
    const backupCodes = twoFactorAuth.generateBackupCodes();
    
    // Activar 2FA
    admin.twoFactorEnabled = true;
    admin.backupCodes = backupCodes;
    await admin.save();
    
    // Registrar en audit log
    await auditLogService.createLog({
      action: 'ADMIN_2FA_ENABLED',
      actor: admin._id.toString(),
      ipAddress: req.ip,
      deviceFingerprint: require('crypto')
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      details: {
        username: admin.username,
        userType: 'admin'
      }
    });
    
    res.json({
      message: '2FA activado exitosamente',
      backupCodes,
      warning: 'Guarda estos códigos de respaldo en un lugar seguro. No se mostrarán nuevamente.'
    });
  } catch (error) {
    console.error('Error al verificar setup 2FA:', error);
    res.status(500).json({ error: 'Error al verificar 2FA' });
  }
});

/**
 * POST /api/2fa/verify
 * Verifica token 2FA durante login
 */
router.post('/verify', authRateLimit, async (req, res) => {
  try {
    console.log('🔍 DEBUG /verify - Llamado a verificar 2FA');
    console.log('🔍 Session tempAdminId:', req.session?.tempAdminId);
    console.log('🔍 Session requires2FA:', req.session?.requires2FA);
    console.log('🔍 Body:', req.body);
    
    const { token: verificationToken, isBackupCode } = req.body;
    
    if (!verificationToken) {
      console.log('❌ Token no proporcionado');
      return res.status(400).json({ 
        errorCode: 'MISSING_TOKEN',
        message: 'Token requerido' 
      });
    }
    
    // Obtener adminId de la sesión temporal
    const adminId = req.session?.tempAdminId;
    
    if (!adminId || !req.session?.requires2FA) {
      console.log('❌ No hay sesión temporal de admin');
      return res.status(400).json({ 
        errorCode: 'NO_TEMP_SESSION',
        message: 'Primero debe iniciar sesión con usuario y contraseña' 
      });
    }
    
    const admin = await Admin.findById(adminId);
    console.log('🔍 Admin encontrado:', admin?.username);
    console.log('🔍 Admin 2FA habilitado:', admin?.twoFactorEnabled);
    
    if (!admin || !admin.twoFactorEnabled) {
      console.log('❌ Admin no tiene 2FA configurado');
      return res.status(400).json({ 
        errorCode: '2FA_NOT_CONFIGURED',
        message: 'Configuración 2FA no encontrada' 
      });
    }
    
    let isValid = false;
    
    if (isBackupCode) {
      // Verificar código de respaldo (hasheado)
      const crypto = require('crypto');
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      const index = admin.backupCodes.indexOf(hashedToken);
      if (index > -1) {
        // Remover código usado
        admin.backupCodes.splice(index, 1);
        await admin.save();
        isValid = true;
        
        await auditLogService.createLog({
          action: 'ADMIN_2FA_BACKUP_CODE_USED',
          actor: admin._id.toString(),
          ipAddress: req.ip,
          deviceFingerprint: require('crypto')
            .createHash('sha256')
            .update(req.get('user-agent') || '')
            .digest('hex'),
          details: {
            username: admin.username,
            userType: 'admin',
            remainingBackupCodes: admin.backupCodes.length
          }
        });
      }
    } else {
      // Verificar token TOTP
      isValid = twoFactorAuth.verifyToken(admin.twoFactorSecret, verificationToken);
    }
    
    if (!isValid) {
      await auditLogService.createLog({
        action: 'ADMIN_2FA_FAILED',
        actor: admin._id.toString(),
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: {
          username: admin.username,
          userType: 'admin'
        }
      });
      
      return res.status(400).json({ 
        errorCode: 'INVALID_TOKEN',
        message: 'El código de verificación no es correcto'
      });
    }
    
    // Limpiar sesión temporal
    delete req.session.tempAdminId;
    delete req.session.tempUsername;
    delete req.session.requires2FA;
    
    // Establecer sesión completa
    req.session.isAdmin = true;
    req.session.userId = admin._id.toString();
    req.session.username = admin.username;
    
    // Generar access token JWT
    const accessToken = tokenService.generateAccessToken({
      adminId: admin._id,
      email: admin.email,
      role: admin.role
    });
    
    // Generar refresh token
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceFingerprint: fingerprintService.generateFingerprint(req)
    };
    
    const refreshTokenData = await tokenService.generateRefreshToken(admin._id, metadata);
    
    await auditLogService.createLog({
      action: 'ADMIN_LOGIN',
      actor: admin._id.toString(),
      ipAddress: req.ip,
      deviceFingerprint: metadata.deviceFingerprint,
      details: {
        username: admin.username,
        userType: 'admin',
        method: '2FA'
      }
    });
    
    res.json({ 
      accessToken,
      refreshToken: refreshTokenData.token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        twoFactorEnabled: admin.twoFactorEnabled
      }
    });
  } catch (error) {
    console.error('Error al verificar 2FA:', error);
    res.status(500).json({ 
      errorCode: 'SERVER_ERROR',
      message: 'Error al verificar 2FA' 
    });
  }
});

/**
 * POST /api/2fa/disable
 * Deshabilita 2FA
 */
router.post('/disable', requireAdmin, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Token requerido',
        message: 'Debes proporcionar un token de verificación para deshabilitar 2FA'
      });
    }
    
    const admin = await Admin.findById(req.session.userId);
    
    if (!admin || !admin.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA no está habilitado' });
    }
    
    // Verificar token
    const isValid = twoFactorAuth.verifyToken(token, admin.twoFactorSecret);
    
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Token inválido',
        message: 'El código de verificación no es correcto'
      });
    }
    
    // Deshabilitar 2FA
    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = null;
    admin.backupCodes = [];
    await admin.save();
    
    await auditLogService.createLog({
      action: 'ADMIN_2FA_DISABLED',
      actor: admin._id.toString(),
      ipAddress: req.ip,
      deviceFingerprint: require('crypto')
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      details: {
        username: admin.username,
        userType: 'admin'
      }
    });
    
    res.json({ message: '2FA deshabilitado exitosamente' });
  } catch (error) {
    console.error('Error al deshabilitar 2FA:', error);
    res.status(500).json({ error: 'Error al deshabilitar 2FA' });
  }
});

/**
 * GET /api/2fa/status
 * Obtiene el estado actual de 2FA
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.userId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Administrador no encontrado' });
    }
    
    res.json({
      enabled: admin.twoFactorEnabled,
      backupCodesRemaining: admin.backupCodes?.length || 0
    });
  } catch (error) {
    console.error('Error al obtener estado 2FA:', error);
    res.status(500).json({ error: 'Error al obtener estado 2FA' });
  }
});

module.exports = router;
