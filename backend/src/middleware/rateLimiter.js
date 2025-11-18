const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const auditLogService = require('../services/auditLogService');

/**
 * Configuración de rate limiters para protección DDoS
 */

// Cliente Redis para rate limiting distribuido
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: null, // No reintentar conexión
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  showFriendlyErrorStack: false
});

let redisAvailable = false;

// Intentar conectar una sola vez
redisClient.connect().then(() => {
  console.log('✅ Redis disponible para Rate Limiting');
  redisAvailable = true;
}).catch(() => {
  console.log('⚠️ Redis no disponible - Rate Limiting usará memoria local');
  redisAvailable = false;
});

redisClient.on('error', () => {
  // Silenciar errores después del intento inicial
});

/**
 * Rate Limiter estricto para autenticación
 * Previene ataques de fuerza bruta
 */
const authLimiter = new RateLimiterMemory({
  keyPrefix: 'rl:auth',
  points: 50, // Más permisivo en desarrollo
  duration: 60, // por minuto
});

/**
 * Rate Limiter para APIs generales
 * Previene abuso de endpoints
 */
const apiLimiter = new RateLimiterMemory({
  keyPrefix: 'rl:api',
  points: 1000, // Muy permisivo en desarrollo
  duration: 60, // por minuto
});

/**
 * Rate Limiter para subida de archivos
 * Previene spam de archivos multimedia
 */
const uploadLimiter = new RateLimiterMemory({
  keyPrefix: 'rl:upload',
  points: 20, // 20 archivos
  duration: 60, // por minuto (más permisivo)
});

/**
 * Rate Limiter para mensajes de chat
 * Previene flooding de mensajes
 */
const messageLimiter = new RateLimiterMemory({
  keyPrefix: 'rl:message',
  points: 100, // 100 mensajes
  duration: 60, // por minuto
});

/**
 * Rate Limiter para creación de salas
 * Previene creación masiva de salas
 */
const roomCreationLimiter = new RateLimiterMemory({
  keyPrefix: 'rl:room',
  points: 20, // 20 salas
  duration: 60, // por minuto (más permisivo)
});

/**
 * Middleware genérico de rate limiting
 * @param {Object} limiter - Instancia de RateLimiter
 * @param {string} actionType - Tipo de acción para auditoría
 */
const rateLimitMiddleware = (limiter, actionType) => {
  return async (req, res, next) => {
    try {
      const key = req.ip || req.connection.remoteAddress;
      
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      // Registrar en audit log
      await auditLogService.createLog({
        action: 'RATE_LIMIT_EXCEEDED',
        actor: req.session?.userId || 'anonymous',
        ipAddress: req.ip,
        deviceFingerprint: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        details: {
          actionType,
          username: req.session?.username || 'anonymous',
          userType: req.session?.isAdmin ? 'admin' : 'user',
          remainingPoints: rejRes.remainingPoints || 0,
          msBeforeNext: rejRes.msBeforeNext || 0
        }
      });
      
      res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de solicitudes. Intenta nuevamente más tarde.',
        retryAfter: Math.ceil((rejRes.msBeforeNext || 0) / 1000),
        remainingPoints: rejRes.remainingPoints || 0
      });
    }
  };
};

/**
 * Middleware específico para autenticación
 */
const authRateLimit = rateLimitMiddleware(authLimiter, 'AUTH_ATTEMPT');

/**
 * Middleware específico para API general
 */
const apiRateLimit = rateLimitMiddleware(apiLimiter, 'API_REQUEST');

/**
 * Middleware específico para subida de archivos
 */
const uploadRateLimit = rateLimitMiddleware(uploadLimiter, 'FILE_UPLOAD');

/**
 * Middleware específico para mensajes
 */
const messageRateLimit = rateLimitMiddleware(messageLimiter, 'MESSAGE_SENT');

/**
 * Middleware específico para creación de salas
 */
const roomCreationRateLimit = rateLimitMiddleware(roomCreationLimiter, 'ROOM_CREATION');

/**
 * Middleware para resetear límites (para administradores)
 */
const resetRateLimit = async (req, res, next) => {
  if (req.session?.isAdmin) {
    const key = req.body.ipAddress || req.ip;
    
    try {
      await authLimiter.delete(key);
      await apiLimiter.delete(key);
      await uploadLimiter.delete(key);
      await messageLimiter.delete(key);
      await roomCreationLimiter.delete(key);
      
      await auditLogService.createLog({
        action: 'RATE_LIMIT_RESET',
        actor: {
          id: req.session.userId,
          username: req.session.username,
          type: 'admin'
        },
        ipAddress: req.ip,
        userAgentHash: require('crypto')
          .createHash('sha256')
          .update(req.get('user-agent') || '')
          .digest('hex'),
        eventData: {
          targetIp: key
        }
      });
      
      res.json({ message: 'Límites de tasa reseteados exitosamente' });
    } catch (error) {
      res.status(500).json({ error: 'Error al resetear límites' });
    }
  } else {
    res.status(403).json({ error: 'No autorizado' });
  }
};

module.exports = {
  authRateLimit,
  apiRateLimit,
  uploadRateLimit,
  messageRateLimit,
  roomCreationRateLimit,
  resetRateLimit
};
