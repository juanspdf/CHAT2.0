const express = require('express');
const router = express.Router();
const tokenService = require('../services/tokenService');
const fingerprintService = require('../services/fingerprintService');
const { authRateLimit } = require('../middleware/rateLimiter');

/**
 * POST /api/auth/refresh
 * Rota un refresh token y genera un nuevo access token
 */
router.post('/refresh', authRateLimit, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        errorCode: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token es requerido'
      });
    }

    // Obtener metadata del dispositivo
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceFingerprint: fingerprintService.generateFingerprint(req)
    };

    // Rotar el refresh token
    const tokens = await tokenService.rotateRefreshToken(refreshToken, metadata);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: 'Tokens renovados exitosamente'
    });
  } catch (error) {
    console.error('Error en /refresh:', error.message);
    
    const statusCode = error.message.includes('reuse') ? 403 : 401;
    
    res.status(statusCode).json({
      errorCode: 'REFRESH_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoca el refresh token actual (logout de dispositivo específico)
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const adminId = req.user?.adminId; // Viene del middleware de autenticación

    if (!refreshToken) {
      return res.status(400).json({
        errorCode: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token es requerido'
      });
    }

    await tokenService.revokeRefreshToken(refreshToken, adminId);

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    console.error('Error en /logout:', error);
    res.status(500).json({
      errorCode: 'LOGOUT_FAILED',
      message: 'Error al cerrar sesión'
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Revoca todos los refresh tokens del usuario (logout global)
 */
router.post('/logout-all', async (req, res) => {
  try {
    const adminId = req.user?.adminId;

    if (!adminId) {
      return res.status(401).json({
        errorCode: 'UNAUTHORIZED',
        message: 'No autenticado'
      });
    }

    const count = await tokenService.revokeAllUserTokens(adminId);

    res.json({
      success: true,
      message: `${count} sesiones cerradas exitosamente`,
      tokensRevoked: count
    });
  } catch (error) {
    console.error('Error en /logout-all:', error);
    res.status(500).json({
      errorCode: 'LOGOUT_ALL_FAILED',
      message: 'Error al cerrar todas las sesiones'
    });
  }
});

module.exports = router;
