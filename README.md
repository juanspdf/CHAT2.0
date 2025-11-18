# 🚀 CHAT 2.0 - Sistema de Chat Seguro con Docker

Sistema de chat en tiempo real con características de seguridad avanzadas, cifrado end-to-end, autenticación de dos factores, y detección de esteganografía.

![Security](https://img.shields.io/badge/security-advanced-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🌟 Características Principales

### 💬 Chat en Tiempo Real
- Salas de texto y multimedia con Socket.io
- Mensajes instantáneos con confirmación de entrega
- Subida de archivos (imágenes, videos, audio)
- Gestión de salas por administradores

### 🔒 Seguridad Avanzada
- ✅ **Autenticación 2FA/TOTP** (Google Authenticator)
- ✅ **Cifrado End-to-End** (AES-256-GCM)
- ✅ **Detección de Esteganografía** en archivos multimedia
- ✅ **Registros de Auditoría Inmutables** (blockchain-like)
- ✅ **Worker Threads** para procesamiento paralelo
- ✅ **Rate Limiting** y protección DDoS
- ✅ **Headers de Seguridad** (Helmet.js, CSP, HSTS)
- ✅ **Protección XSS** y sanitización de inputs
- ✅ **Verificación de Integridad** (SHA-256, HMAC)

### 🐳 Despliegue con Docker
- Contenedores optimizados para MongoDB, Redis, Backend, Frontend
- Orquestación con Docker Compose
- Health checks automáticos
- Volúmenes persistentes para datos y uploads
- Red aislada para comunicación entre servicios

---

## 📋 Requisitos Previos

- **Docker Desktop** 20.10+
- **Docker Compose** 2.0+
- **Node.js** 18+ (solo para desarrollo local)
- **Git** 2.30+

---

## 🚀 Inicio Rápido con Docker

### 1. Clonar el Repositorio
```powershell
git clone https://github.com/tu-usuario/CHAT2.0.git
cd CHAT2.0
```

### 2. Configurar Variables de Entorno

**Backend** (`backend/.env`):
```env
MONGODB_URI=mongodb://chat-mongodb:27017/chat
REDIS_HOST=chat-redis
REDIS_PORT=6379
PORT=5000
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_here_minimum_32_chars
JWT_EXPIRES_IN=7d
SESSION_SECRET=your_session_secret_here
FRONTEND_URL=http://localhost:5173
MAX_FILE_SIZE_MB=10
MASTER_ENCRYPTION_KEY=your_master_encryption_key_32_bytes_hex
AUDIT_HMAC_SECRET=your_audit_hmac_secret_here
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

### 3. Construir y Desplegar
```powershell
docker-compose up -d --build
```

### 4. Verificar Estado
```powershell
docker-compose ps
```

Todos los servicios deben mostrar status `Up (healthy)`.

### 5. Crear Administrador Inicial
```powershell
docker exec -it chat-backend node seed-admin.js
```

Credenciales por defecto:
- **Usuario**: `admin`
- **Contraseña**: `admin123`

### 6. Acceder a la Aplicación
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health

---

## 🔐 Configuración de Seguridad

Ver documentación completa en [SECURITY.md](./SECURITY.md)

### Resumen de Características

#### 1. **Autenticación 2FA/TOTP**
- Google Authenticator/Authy compatible
- Códigos de respaldo de emergencia
- Ventana de tiempo ±60s

#### 2. **Cifrado End-to-End**
- AES-256-GCM con authentication tags
- Claves únicas por sala
- HMAC-SHA256 para integridad

#### 3. **Detección de Esteganografía**
- Análisis de entropía de Shannon
- LSB (Least Significant Bit) detection
- Test Chi-cuadrado estadístico
- Detección de patrones repetitivos
- Verificación de magic bytes

#### 4. **Audit Logs Inmutables**
- Blockchain-like hash chain
- 15 tipos de eventos auditables
- Prevención de modificación/eliminación
- Verificación de integridad completa

#### 5. **Worker Threads**
- Pool de 6-8 workers para tareas CPU-intensive
- Análisis de archivos en paralelo
- Hashing bcrypt sin bloquear event loop

#### 6. **Rate Limiting**
- 5 intentos login / 15 min
- 100 requests API / min
- 10 uploads / hora
- 30 mensajes / min
- Almacenamiento distribuido en Redis

---

## 📦 Servicios Docker

| Servicio | Puerto | Imagen | Propósito |
|----------|--------|--------|-----------|
| MongoDB | 27017 | mongo:7 | Base de datos principal |
| Redis | 6379 | redis:7-alpine | Sesiones y rate limiting |
| Backend | 5000 | Node 18 Alpine | API REST + WebSocket |
| Frontend | 5173 | Nginx Alpine | Aplicación React |

---

## 🔧 Comandos Docker Útiles

```powershell
# Ver logs en tiempo real
docker-compose logs -f backend

# Reiniciar servicio
docker-compose restart backend

# Detener sistema
docker-compose down

# Reconstruir imágenes
docker-compose up -d --build --force-recreate

# Ejecutar comandos en contenedor
docker exec -it chat-backend sh
```

---

## 📊 Monitoreo

### Health Check
```bash
curl http://localhost:5000/health
```

Respuesta incluye estadísticas de worker pools en tiempo real.

---

## 🧪 Testing

```powershell
# Backend tests
cd backend
npm test

# Auditoría de seguridad
npm audit

# Cobertura de código
npm run test:coverage
```

---

## 📚 Documentación

- [📖 Guía de Seguridad Completa](./SECURITY.md)
- [🐳 Documentación Docker](./DOCKER.md)

---

## 🔍 Troubleshooting

### Error: bcrypt `ERR_DLOPEN_FAILED`
```powershell
cd backend
Remove-Item -Recurse -Force node_modules
cd ..
docker-compose up -d --build backend
```

### MongoDB connection refused
```powershell
docker-compose restart backend
```

### Redis connection failed
El backend continúa en modo degradado sin Redis.

---

## 📄 Licencia

MIT License - Ver [LICENSE](./LICENSE)

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

**⚡ Hecho con Node.js, React, Socket.io y mucho ☕**
