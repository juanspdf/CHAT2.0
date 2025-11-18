const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const auditLogService = require('./auditLogService');

/**
 * Servicio de gestión de JWT con rotación de tokens
 */
class TokenService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET;
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  /**
   * Genera un access token JWT
   * @param {Object} payload - Datos del usuario (adminId, email, role)
   * @returns {string} Access token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });
  }

  /**
   * Genera un refresh token y lo almacena en la BD
   * @param {string} adminId - ID del administrador
   * @param {Object} metadata - Información del dispositivo (ip, userAgent, fingerprint)
   * @returns {Promise<Object>} { token, expiresAt }
   */
  async generateRefreshToken(adminId, metadata = {}) {
    try {
      // Generar token único criptográficamente seguro
      const token = crypto.randomBytes(64).toString('hex');
      
      // Generar family ID para tracking de rotación
      const family = crypto.randomBytes(32).toString('hex');
      
      // Calcular fecha de expiración
      const expiresAt = this.calculateExpiry(this.refreshTokenExpiry);
      
      // Crear registro en BD
      const refreshToken = new RefreshToken({
        token,
        adminId,
        deviceFingerprint: metadata.deviceFingerprint,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        family,
        expiresAt
      });
      
      await refreshToken.save();
      
      // Registrar en audit log
      await auditLogService.createLog({
        action: 'REFRESH_TOKEN_CREATED',
        actor: adminId,
        ipAddress: metadata.ipAddress,
        deviceFingerprint: metadata.deviceFingerprint,
        details: {
          family,
          expiresAt: expiresAt.toISOString()
        }
      });
      
      return {
        token,
        expiresAt
      };
    } catch (error) {
      console.error('Error generando refresh token:', error);
      throw new Error('Error generando refresh token');
    }
  }

  /**
   * Verifica y rota un refresh token
   * @param {string} token - Refresh token a verificar
   * @param {Object} metadata - Información del dispositivo
   * @returns {Promise<Object>} { accessToken, refreshToken, adminId }
   */
  async rotateRefreshToken(token, metadata = {}) {
    try {
      // Buscar el token en la BD
      const storedToken = await RefreshToken.findOne({ token }).populate('adminId');
      
      if (!storedToken) {
        await auditLogService.createLog({
          action: 'REFRESH_TOKEN_NOT_FOUND',
          ipAddress: metadata.ipAddress,
          details: { token: token.substring(0, 16) + '...' }
        });
        throw new Error('Token inválido');
      }

      // Verificar si el token está válido
      if (!storedToken.isValid()) {
        await auditLogService.createLog({
          action: 'REFRESH_TOKEN_INVALID',
          actor: storedToken.adminId._id,
          ipAddress: metadata.ipAddress,
          details: {
            isRevoked: storedToken.isRevoked,
            expiresAt: storedToken.expiresAt
          }
        });
        throw new Error('Token expirado o revocado');
      }

      // DETECCIÓN DE REUSO DE TOKEN (posible ataque)
      const timeSinceLastUse = Date.now() - storedToken.lastUsedAt.getTime();
      if (timeSinceLastUse < 5000) { // Menos de 5 segundos
        // Posible token reuse attack - revocar toda la familia
        await this.revokeTokenFamily(storedToken.family, storedToken.adminId._id);
        
        await auditLogService.createLog({
          action: 'TOKEN_REUSE_DETECTED',
          actor: storedToken.adminId._id,
          ipAddress: metadata.ipAddress,
          details: {
            family: storedToken.family,
            timeSinceLastUse,
            severity: 'HIGH'
          }
        });
        
        throw new Error('Token reuse detectado - sesión revocada');
      }

      // Marcar el token como usado
      storedToken.lastUsedAt = new Date();
      await storedToken.save();

      // Generar nuevo access token
      const accessToken = this.generateAccessToken({
        adminId: storedToken.adminId._id,
        email: storedToken.adminId.email,
        role: storedToken.adminId.role
      });

      // Generar nuevo refresh token (rotación)
      const newRefreshToken = await this.generateRefreshToken(
        storedToken.adminId._id,
        metadata
      );

      // Revocar el token antiguo
      storedToken.isRevoked = true;
      await storedToken.save();

      // Registrar rotación exitosa
      await auditLogService.createLog({
        action: 'REFRESH_TOKEN_ROTATED',
        actor: storedToken.adminId._id,
        ipAddress: metadata.ipAddress,
        deviceFingerprint: metadata.deviceFingerprint,
        details: {
          oldTokenFamily: storedToken.family,
          newTokenFamily: newRefreshToken.family
        }
      });

      return {
        accessToken,
        refreshToken: newRefreshToken.token,
        adminId: storedToken.adminId._id
      };
    } catch (error) {
      console.error('Error rotando refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoca un refresh token específico
   * @param {string} token - Token a revocar
   * @param {string} adminId - ID del admin (para audit log)
   */
  async revokeRefreshToken(token, adminId) {
    try {
      const result = await RefreshToken.updateOne(
        { token },
        { isRevoked: true }
      );

      if (result.modifiedCount > 0) {
        await auditLogService.createLog({
          action: 'REFRESH_TOKEN_REVOKED',
          actor: adminId,
          details: { token: token.substring(0, 16) + '...' }
        });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error revocando refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoca todos los tokens de una familia (token reuse attack)
   * @param {string} family - ID de la familia de tokens
   * @param {string} adminId - ID del admin
   */
  async revokeTokenFamily(family, adminId) {
    try {
      const result = await RefreshToken.updateMany(
        { family, isRevoked: false },
        { isRevoked: true }
      );

      await auditLogService.createLog({
        action: 'TOKEN_FAMILY_REVOKED',
        actor: adminId,
        details: {
          family,
          tokensRevoked: result.modifiedCount,
          reason: 'Token reuse detected'
        }
      });

      return result.modifiedCount;
    } catch (error) {
      console.error('Error revocando familia de tokens:', error);
      throw error;
    }
  }

  /**
   * Revoca todos los tokens de un usuario (logout global)
   * @param {string} adminId - ID del administrador
   */
  async revokeAllUserTokens(adminId) {
    try {
      const result = await RefreshToken.updateMany(
        { adminId, isRevoked: false },
        { isRevoked: true }
      );

      await auditLogService.createLog({
        action: 'ALL_TOKENS_REVOKED',
        actor: adminId,
        details: {
          tokensRevoked: result.modifiedCount,
          reason: 'Logout from all devices'
        }
      });

      return result.modifiedCount;
    } catch (error) {
      console.error('Error revocando todos los tokens:', error);
      throw error;
    }
  }

  /**
   * Verifica un access token JWT
   * @param {string} token - Access token a verificar
   * @returns {Object} Payload decodificado
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Calcula fecha de expiración basada en string de tiempo
   * @param {string} expiry - Tiempo de expiración (ej: '7d', '24h')
   * @returns {Date} Fecha de expiración
   */
  calculateExpiry(expiry) {
    const match = expiry.match(/^(\d+)([dhms])$/);
    if (!match) {
      throw new Error('Formato de expiración inválido');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const now = new Date();
    
    switch (unit) {
      case 'd': return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'h': return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'm': return new Date(now.getTime() + value * 60 * 1000);
      case 's': return new Date(now.getTime() + value * 1000);
      default: throw new Error('Unidad de tiempo inválida');
    }
  }

  /**
   * Limpia tokens expirados (job periódico)
   */
  async cleanExpiredTokens() {
    try {
      const result = await RefreshToken.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Limpiados ${result.deletedCount} refresh tokens expirados`);
      }

      return result.deletedCount;
    } catch (error) {
      console.error('Error limpiando tokens expirados:', error);
      return 0;
    }
  }
}

module.exports = new TokenService();
