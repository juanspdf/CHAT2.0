require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./utils/database');
const SocketService = require('./services/socketService');
const redisService = require('./services/redisService');

// Importar rutas
const adminRoutes = require('./routes/admin');
const roomRoutes = require('./routes/rooms');

// Conectar a MongoDB
connectDB();

// Conectar a Redis (opcional, no bloqueante)
redisService.connect().catch(err => {
  console.warn('⚠️ Continuando sin Redis:', err.message);
});

// Crear app Express
const app = express();
const server = http.createServer(app);

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
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
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`🌐 API REST disponible en http://localhost:${PORT}/api`);
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


