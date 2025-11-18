require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./utils/database');
const SocketService = require('./services/socketService');
const redisService = require('./services/redisService');
const workerManager = require('./services/workerManager');
const tokenService = require('./services/tokenService');

// Middlewares de seguridad
const {
  securityMiddleware,
  additionalSecurityHeaders,
  sanitizeInput,
  validateContentType,
  preventParameterPollution,
  logSuspiciousRequests
} = require('./middleware/security');
const { apiRateLimit } = require('./middleware/rateLimiter');

// Importar rutas
const adminRoutes = require('./routes/admin');
const roomRoutes = require('./routes/rooms');
const twoFactorRoutes = require('./routes/twoFactor');
const authRoutes = require('./routes/auth');

// Conectar a MongoDB
connectDB();

// Conectar a Redis (opcional, no bloqueante)
redisService.connect().catch(err => {
  console.warn('⚠️ Continuando sin Redis:', err.message);
});

// Inicializar Worker Manager
console.log('🔧 Inicializando Worker Manager...');
workerManager.initialize();

// Crear app Express
const app = express();

// Configurar servidor HTTPS en desarrollo, HTTP en producción (detrás de proxy)
let server;
const useHTTPS = process.env.USE_HTTPS === 'true' || process.env.NODE_ENV !== 'production';

if (useHTTPS) {
  try {
    const certPath = path.join(__dirname, '..', 'certs', 'cert.pem');
    const keyPath = path.join(__dirname, '..', 'certs', 'key.pem');
    
    const httpsOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath)
    };
    
    server = https.createServer(httpsOptions, app);
    console.log('🔒 Servidor HTTPS configurado');
  } catch (error) {
    console.warn('⚠️ No se pudieron cargar certificados SSL, usando HTTP:', error.message);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
  console.log('📡 Servidor HTTP configurado (producción con proxy)');
}

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares de seguridad (ORDEN IMPORTANTE)
app.use(securityMiddleware); // Helmet con CSP, HSTS, etc.
app.use(additionalSecurityHeaders); // Headers adicionales
app.use(preventParameterPollution); // Prevenir parameter pollution
app.use(logSuspiciousRequests); // Log de requests sospechosos

// Middlewares básicos
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// JSON parsing - EXCLUIR rutas de upload de archivos
app.use((req, res, next) => {
  if (req.path.includes('/files') || req.path.includes('/upload')) {
    // No parsear JSON en rutas de upload
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar sesiones
app.use(session({
  secret: process.env.JWT_SECRET || 'super-secret-session-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'http_sessions', // Usar colección diferente para evitar conflicto
    touchAfter: 24 * 3600 // lazy session update (24 hours)
  }),
  cookie: {
    secure: process.env.USE_HTTPS === 'true', // Solo secure en HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'lax' // Permitir cookies en navegación normal
  }
}));

// Middlewares de seguridad adicionales
app.use(sanitizeInput); // Sanitizar inputs (XSS protection)
app.use(validateContentType); // Validar Content-Type
app.use(apiRateLimit); // Rate limiting global

// Servir archivos estáticos (uploads) con CORS
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Hacer io disponible en las rutas
app.set('io', io);

// Rutas
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/auth', authRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  const stats = workerManager.getStats();
  res.json({ 
    status: 'ok', 
    message: 'Servidor funcionando correctamente',
    workerPools: stats
  });
});

// Inicializar servicio de Socket.io
const socketService = new SocketService(io);

// Hacer socketService accesible globalmente para usar en routes
app.set('socketService', socketService);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    errorCode: err.code || 'SERVER_ERROR',
    message: err.message || 'Error interno del servidor'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
const protocol = useHTTPS ? 'https' : 'http';
const wsProtocol = useHTTPS ? 'wss' : 'ws';

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ${wsProtocol}://localhost:${PORT}`);
  console.log(`🌐 API REST disponible en ${protocol}://localhost:${PORT}/api`);
  console.log(`🔒 Seguridad: ${useHTTPS ? 'HTTPS/TLS' : 'HTTP'}, Helmet, Rate Limiting, XSS Protection activos`);
  console.log(`🔧 Worker Pools: Steganography, Encryption, Hashing inicializados`);
  
  // Job de limpieza de tokens expirados (cada 1 hora)
  setInterval(async () => {
    try {
      await tokenService.cleanExpiredTokens();
    } catch (error) {
      console.error('Error en job de limpieza de tokens:', error);
    }
  }, 60 * 60 * 1000); // 1 hora
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM recibido, cerrando servidor...');
  
  await workerManager.shutdown();
  await redisService.disconnect();
  
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('📛 SIGINT recibido, cerrando servidor...');
  
  await workerManager.shutdown();
  await redisService.disconnect();
  
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Job periódico para limpiar sesiones inactivas
const Session = require('./models/Session');
const TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30;

setInterval(async () => {
  try {
    const timeoutDate = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);
    
    const result = await Session.updateMany(
      {
        isActive: true,
        lastActivityAt: { $lt: timeoutDate }
      },
      {
        isActive: false
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`🧹 Limpieza: ${result.modifiedCount} sesiones inactivas desactivadas`);
    }
  } catch (error) {
    console.error('Error en limpieza de sesiones:', error);
  }
}, 5 * 60 * 1000); // Ejecutar cada 5 minutos

module.exports = { app, server, io };


