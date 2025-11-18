const helmet = require('helmet');
const crypto = require('crypto');

/**
 * Configuración de seguridad con Helmet.js
 * Protección contra vulnerabilidades web comunes
 */

/**
 * Middleware de seguridad principal
 */
const securityMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Para React
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "http://localhost:5173"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5000", "ws://localhost:5000"], // Para WebSocket
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "http://localhost:5000"],
      frameSrc: ["'none'"]
    }
  },
  
  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // Hide X-Powered-By
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  
  // X-Download-Options
  ieNoOpen: true,
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },
  
  // Referrer-Policy
  referrerPolicy: {
    policy: 'no-referrer'
  },
  
  // X-XSS-Protection
  xssFilter: true
});

/**
 * Middleware para agregar headers de seguridad adicionales
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevenir MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Política de permisos
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Cache control para datos sensibles
  if (req.path.includes('/api/admin') || req.path.includes('/api/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

/**
 * Middleware para sanitizar inputs (XSS protection)
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remover scripts y etiquetas HTML peligrosas
        obj[key] = obj[key]
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
};

/**
 * Middleware para validar Content-Type en requests
 */
const validateContentType = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('content-type');
    
    // Permitir multipart/form-data para uploads de archivos
    if (req.path.includes('/upload') || req.path.includes('/files')) {
      next();
      return;
    }
    
    // Validar JSON para otros endpoints
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Content-Type inválido',
        message: 'Se requiere Content-Type: application/json'
      });
    }
  }
  
  next();
};

/**
 * Middleware para generar nonce para CSP inline scripts
 */
const generateNonce = (req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
};

/**
 * Middleware para prevenir Parameter Pollution
 */
const preventParameterPollution = (req, res, next) => {
  const cleanParams = (params) => {
    for (let key in params) {
      if (Array.isArray(params[key])) {
        // Tomar solo el primer valor si hay múltiples
        params[key] = params[key][0];
      }
    }
  };
  
  if (req.query) cleanParams(req.query);
  if (req.body) cleanParams(req.body);
  
  next();
};

/**
 * Middleware para logging de requests sospechosos
 */
const logSuspiciousRequests = async (req, res, next) => {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path Traversal
    /(union\s+select|drop\s+table|insert\s+into)/i, // SQL Injection
    /(<script|javascript:|onerror=|onload=)/i, // XSS
    /(exec\(|eval\(|system\()/i, // Code Injection
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => {
    return pattern.test(req.url) || 
           pattern.test(JSON.stringify(req.body)) || 
           pattern.test(JSON.stringify(req.query));
  });
  
  if (isSuspicious) {
    const auditLogService = require('../services/auditLogService');
    
    await auditLogService.createLog({
      action: 'SUSPICIOUS_REQUEST',
      actor: {
        id: req.session?.userId || 'anonymous',
        username: req.session?.username || 'anonymous',
        type: req.session?.isAdmin ? 'admin' : 'user'
      },
      ipAddress: req.ip,
      userAgentHash: crypto
        .createHash('sha256')
        .update(req.get('user-agent') || '')
        .digest('hex'),
      eventData: {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query
      }
    });
  }
  
  next();
};

module.exports = {
  securityMiddleware,
  additionalSecurityHeaders,
  sanitizeInput,
  validateContentType,
  generateNonce,
  preventParameterPollution,
  logSuspiciousRequests
};
