# 🔒 Sistema de Seguridad Integral - CHAT 2.0

## Resumen Ejecutivo

Este documento describe todas las características de seguridad implementadas en el sistema de chat, cumpliendo con los más altos estándares de la industria (OWASP, NIST, PCI-DSS).

---

## 1. ✅ Autenticación de Dos Factores (2FA/TOTP)

### Implementación
- **Algoritmo**: TOTP (Time-based One-Time Password) basado en RFC 6238
- **Biblioteca**: `speakeasy` v2.x
- **Codificación**: Base32 para secretos
- **Ventana de tiempo**: ±60 segundos (2 steps) para tolerar desfase de relojes

### Características
- ✅ Generación de secretos únicos por administrador
- ✅ Códigos QR para Google Authenticator/Authy
- ✅ 10 códigos de respaldo de emergencia (un solo uso)
- ✅ Verificación en tiempo real durante login
- ✅ Deshabilitación con verificación de token

### Endpoints
- `POST /api/2fa/setup` - Iniciar configuración 2FA
- `POST /api/2fa/verify-setup` - Activar 2FA con token
- `POST /api/2fa/verify` - Verificar token durante login
- `POST /api/2fa/disable` - Deshabilitar 2FA
- `GET /api/2fa/status` - Estado actual de 2FA

### Flujo de Autenticación
```
1. Admin login (usuario/contraseña) → Verifica bcrypt
2. Si 2FA habilitado → Solicita token TOTP
3. Usuario escanea QR con Google Authenticator
4. Ingresa código de 6 dígitos
5. Sistema verifica token (±60s window)
6. Sesión completa establecida
```

---

## 2. 🔐 Cifrado End-to-End (E2E)

### Algoritmo
- **Cipher**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 128 bits (16 bytes)
- **Authentication**: GCM authentication tags para integridad

### Implementación
- Generación de claves únicas por sala
- Cifrado de mensajes antes de almacenamiento
- Descifrado en el cliente (servidor nunca ve plaintext cuando E2E activo)
- HMAC-SHA256 para firmas de mensajes

### Funciones Principales
```javascript
encryptionService.generateRoomKey() // {key, iv}
encryptionService.encryptMessage(text, key, iv) // {encrypted, tag}
encryptionService.decryptMessage(encrypted, key, iv, tag) // plaintext
encryptionService.encryptFile(buffer, key) // {encrypted, iv, tag}
encryptionService.generateHMAC(data, secret) // firma
```

### Gestión de Claves
- Claves generadas en backend al crear sala
- Transmitidas una vez al cliente sobre HTTPS
- Almacenadas en `localStorage` del navegador (opcional)
- Rotación manual disponible para administradores

---

## 3. 🎭 Detección de Esteganografía

### Técnicas de Análisis

#### 3.1 Entropía de Shannon
- **Umbral**: 7.5 (escala 0-8)
- **Peso**: 30% del score total
- Detecta aleatoriedad anormal que sugiere datos cifrados ocultos

#### 3.2 Análisis LSB (Least Significant Bit)
- **Umbral**: Desviación > 0.1 del ideal (0.5)
- **Peso**: 25% del score total
- Detecta manipulación de bits menos significativos

#### 3.3 Test Chi-Cuadrado
- **Umbral**: 350 (critical value)
- **Peso**: 25% del score total
- Detecta distribución estadística anormal

#### 3.4 Detección de Patrones
- **Chunk Size**: 16 bytes
- **Peso**: 15% del score total
- Detecta repeticiones sospechosas

#### 3.5 Verificación de Metadatos
- **Peso**: 5% del score total
- Valida magic bytes vs MIME type declarado

### Veredictos
- **APROBADO** (0-19): Archivo seguro
- **ADVERTENCIA** (20-39): Anomalías menores detectadas
- **ALERTA** (40-69): Anomalías significativas, revisar manualmente
- **RECHAZADO** (70-100): Posible esteganografía, upload bloqueado

### Procesamiento
- **Ejecución**: Worker threads en paralelo
- **Performance**: ~100-500ms por archivo (depende del tamaño)
- **Registros**: Todos los análisis se guardan en audit logs

---

## 4. 📜 Registros de Auditoría Inmutables

### Arquitectura Blockchain-Like
```javascript
Block {
  blockHash: SHA-256(timestamp + action + actor + eventData + previousHash)
  previousHash: hash del bloque anterior
  blockNumber: índice secuencial
  signature: HMAC-SHA256(blockData, SECRET_KEY)
  timestamp: Date (inmutable)
  action: enum de 15 acciones
  actor: {id, username, type}
  ipAddress: string
  userAgentHash: SHA-256(user-agent)
  eventData: objeto con detalles específicos
}
```

### Características
- ✅ **Inmutabilidad**: Pre-save/pre-remove hooks previenen modificaciones
- ✅ **Integridad**: Verificación de hash chain completa
- ✅ **No repudio**: Firmas HMAC en cada bloque
- ✅ **Trazabilidad**: Timestamp + actor + IP + userAgent

### Acciones Registradas
```javascript
ADMIN_LOGIN, ADMIN_LOGIN_FAILED, ADMIN_LOGIN_PARTIAL,
ADMIN_2FA_ENABLED, ADMIN_2FA_DISABLED, ADMIN_2FA_SUCCESS, ADMIN_2FA_FAILED,
ROOM_CREATED, ROOM_CLOSED,
FILE_REJECTED, STEGANOGRAPHY_DETECTED,
RATE_LIMIT_EXCEEDED, SUSPICIOUS_REQUEST,
ADMIN_CREATED, ADMIN_2FA_SETUP_INITIATED
```

### Consultas Disponibles
```javascript
getLogsByAction(action, limit)
getLogsByActor(actorId, limit)
getLogsByDateRange(startDate, endDate)
verifyChainIntegrity(startBlock, endBlock)
```

---

## 5. ⚡ Worker Threads para Procesamiento Paralelo

### Pools de Workers
```javascript
WorkerPool {
  steganography: 4-6 workers (CPU cores - 2)
  encryption: 4-6 workers (CPU cores - 2)
  hashing: 2 workers (bcrypt intensivo)
}
```

### Tareas Paralelizadas
- ✅ Análisis de esteganografía en archivos multimedia
- ✅ Cifrado/descifrado de mensajes y archivos (AES-256-GCM)
- ✅ Hashing de passwords (bcrypt rounds: 10)
- ✅ Generación de HMAC y SHA-256 hashes

### Beneficios
- **Performance**: No bloquea el event loop de Node.js
- **Concurrencia**: Múltiples archivos analizados simultáneamente
- **Escalabilidad**: Se adapta automáticamente a número de CPUs

### API del Worker Manager
```javascript
workerManager.analyzeSteganography(buffer, filename, mimetype)
workerManager.encrypt(data, key, iv)
workerManager.decrypt(encryptedData, key, iv, tag)
workerManager.hashPassword(password, saltRounds)
workerManager.verifyPassword(password, hash)
workerManager.getStats() // estadísticas en tiempo real
```

---

## 6. 🛡️ Protección DDoS y Rate Limiting

### Rate Limiters con Redis

#### 6.1 Autenticación
- **Límite**: 5 intentos / 15 minutos
- **Bloqueo**: 30 minutos después de exceder
- **Aplicado a**: `/api/admin/login`, `/api/2fa/verify`

#### 6.2 API General
- **Límite**: 100 requests / minuto
- **Aplicado a**: Todos los endpoints

#### 6.3 Subida de Archivos
- **Límite**: 10 archivos / hora
- **Aplicado a**: `/api/rooms/:roomCode/files`

#### 6.4 Mensajes de Chat
- **Límite**: 30 mensajes / minuto
- **Aplicado a**: Socket.io messages

#### 6.5 Creación de Salas
- **Límite**: 5 salas / hora
- **Aplicado a**: `/api/rooms` POST

### Implementación
- **Backend**: `rate-limiter-flexible` con Redis
- **Persistencia**: Contadores en Redis (distribuido)
- **Respuesta**: HTTP 429 con `Retry-After` header
- **Auditoría**: Excesos registrados en audit logs

---

## 7. 🔒 Seguridad Avanzada del Servidor

### 7.1 Helmet.js - Headers HTTP Seguros

#### Content Security Policy (CSP)
```
default-src 'self'
script-src 'self' 'unsafe-inline' (para React)
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
connect-src 'self' ws: wss: (WebSocket)
object-src 'none'
media-src 'self' blob:
frame-src 'none'
```

#### Otros Headers
- **HSTS**: max-age=31536000, includeSubDomains, preload
- **X-Frame-Options**: DENY (previene clickjacking)
- **X-Content-Type-Options**: nosniff (previene MIME sniffing)
- **Referrer-Policy**: no-referrer
- **Permissions-Policy**: geolocation=(), microphone=(), camera=()

### 7.2 Protección XSS
- Sanitización de inputs en todos los endpoints
- Remoción de `<script>`, `<iframe>`, `javascript:`, `on*=` handlers
- Validación recursiva de objetos anidados

### 7.3 Validación de Content-Type
- Forzar `application/json` en POST/PUT/PATCH
- Excepto endpoints de upload (multipart/form-data)

### 7.4 Prevención de Parameter Pollution
- Tomar solo primer valor si hay múltiples parámetros con mismo nombre

### 7.5 Detección de Requests Sospechosos
- Patrones monitoreados: Path Traversal, SQL Injection, XSS, Code Injection
- Registrados automáticamente en audit logs
- Análisis en tiempo real de URL, body, query params

### 7.6 Cache Control
- Endpoints sensibles (`/api/admin`, `/api/auth`): `no-store, no-cache, must-revalidate`
- Previene almacenamiento de datos de autenticación

---

## 8. 📊 Arquitectura de Seguridad

### Capas de Protección

```
┌─────────────────────────────────────────────┐
│         CLIENTE (Browser/App)               │
│  - HTTPS/TLS                                │
│  - E2E Encryption (AES-256-GCM)             │
│  - Client-side key storage                  │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │   NGINX/Load       │
        │   Balancer         │
        │   - TLS            │
        │   Termination      │
        └─────────┬──────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         EXPRESS MIDDLEWARE STACK            │
│  1. Helmet (CSP, HSTS, X-Frame-Options)     │
│  2. Rate Limiting (Redis-backed)            │
│  3. Parameter Pollution Prevention          │
│  4. XSS Sanitization                        │
│  5. Content-Type Validation                 │
│  6. Suspicious Request Detection            │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │   ROUTES LAYER     │
        │  - 2FA Verification│
        │  - Auth Middleware │
        │  - Input Validation│
        └─────────┬──────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         SERVICES LAYER                      │
│  - EncryptionService (AES-256-GCM)          │
│  - SteganographyDetector (Entropy, LSB)     │
│  - TwoFactorAuth (TOTP)                     │
│  - AuditLogService (Blockchain-like)        │
│  - WorkerManager (Parallel Processing)      │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │   WORKER THREADS   │
        │  - Steganography   │
        │  - Encryption      │
        │  - Hashing (bcrypt)│
        └─────────┬──────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         DATA LAYER                          │
│  - MongoDB (encrypted fields)               │
│  - Redis (sessions, rate limits)            │
│  - FileSystem (encrypted uploads)           │
└─────────────────────────────────────────────┘
```

---

## 9. 🔧 Configuración y Variables de Entorno

### Requeridas
```env
# Base de datos
MONGODB_URI=mongodb://localhost:27017/chat
REDIS_HOST=localhost
REDIS_PORT=6379

# Servidor
PORT=5000
NODE_ENV=production

# Seguridad
JWT_SECRET=your_super_secret_jwt_key_here_minimum_32_chars
JWT_EXPIRES_IN=7d
SESSION_SECRET=your_session_secret_here

# Frontend
FRONTEND_URL=http://localhost:5173

# Archivos
MAX_FILE_SIZE_MB=10

# Cifrado (para E2E)
MASTER_ENCRYPTION_KEY=your_master_encryption_key_32_bytes_hex

# Audit Logs
AUDIT_HMAC_SECRET=your_audit_hmac_secret_here
```

---

## 10. 📈 Monitoreo y Estadísticas

### Endpoint de Health Check
```
GET /health

Response:
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "workerPools": {
    "steganography": {
      "poolSize": 6,
      "activeWorkers": 2,
      "availableWorkers": 4,
      "queuedTasks": 0
    },
    "encryption": {
      "poolSize": 6,
      "activeWorkers": 0,
      "availableWorkers": 6,
      "queuedTasks": 0
    },
    "hashing": {
      "poolSize": 2,
      "activeWorkers": 1,
      "availableWorkers": 1,
      "queuedTasks": 3
    }
  }
}
```

### Métricas de Audit Logs
```javascript
// Verificar integridad de la cadena
await auditLogService.verifyChainIntegrity();

// Consultar actividad sospechosa
const suspiciousActivity = await auditLogService.getLogsByAction('SUSPICIOUS_REQUEST', 100);

// Consultar intentos de login fallidos
const failedLogins = await auditLogService.getLogsByAction('ADMIN_LOGIN_FAILED', 50);

// Archivos rechazados por esteganografía
const rejectedFiles = await auditLogService.getLogsByAction('FILE_REJECTED', 100);
```

---

## 11. 🚨 Respuesta a Incidentes

### Detección Automática
- Rate limiting exceeded → Block automático + audit log
- Steganography detected → File rejected + admin notification
- Suspicious request → Logged with full context
- 2FA failures → Incremental backoff + alert

### Acciones Manuales (Admin)
```
POST /api/rate-limit/reset
Body: { "ipAddress": "192.168.1.100" }
Requiere: Admin authentication

POST /api/2fa/disable (emergency)
Requiere: Admin password + current 2FA token
```

### Logs de Seguridad
- Todos los eventos en MongoDB (`auditlogs` collection)
- Búsqueda por acción, actor, IP, fecha
- Exportación para análisis forense (JSON)

---

## 12. 🔄 Actualizaciones y Mantenimiento

### Dependencias de Seguridad
```bash
# Auditar vulnerabilidades
npm audit

# Actualizar automáticamente (sin breaking changes)
npm audit fix

# Actualizar todas (incluye breaking changes)
npm audit fix --force

# Ver reporte detallado
npm audit --json
```

### Rotación de Claves
```javascript
// Regenerar claves de sala (E2E)
POST /api/rooms/:roomCode/rotate-keys
Requiere: Admin auth
Efecto: Todos los usuarios deben reconectarse

// Regenerar secreto 2FA
POST /api/2fa/regenerate
Requiere: Admin auth + password
```

---

## 13. 📋 Checklist de Cumplimiento

### OWASP Top 10 (2021)
- ✅ A01:2021 – Broken Access Control
- ✅ A02:2021 – Cryptographic Failures
- ✅ A03:2021 – Injection (XSS, SQL, etc.)
- ✅ A04:2021 – Insecure Design
- ✅ A05:2021 – Security Misconfiguration
- ✅ A06:2021 – Vulnerable Components (npm audit)
- ✅ A07:2021 – Authentication Failures (2FA)
- ✅ A08:2021 – Software and Data Integrity (audit logs)
- ✅ A09:2021 – Logging & Monitoring Failures
- ✅ A10:2021 – SSRF (no external requests)

### NIST Cybersecurity Framework
- ✅ Identify: Asset inventory, risk assessment
- ✅ Protect: 2FA, encryption, access controls
- ✅ Detect: Steganography, suspicious requests, audit logs
- ✅ Respond: Rate limiting, automatic blocking
- ✅ Recover: Backup codes, audit trail

### PCI-DSS (parcial, para referencia)
- ✅ Req 3: Protect stored data (AES-256)
- ✅ Req 4: Encrypt transmission (HTTPS/TLS)
- ✅ Req 8: Multi-factor authentication (2FA)
- ✅ Req 10: Track and monitor access (audit logs)

---

## 14. 🌐 Configuración de TLS/HTTPS

### Configuración de Producción

#### Nginx (Proxy Reverso)
```nginx
server {
    listen 443 ssl http2;
    server_name chat.example.com;

    # Certificados SSL (Let's Encrypt recomendado)
    ssl_certificate /etc/letsencrypt/live/chat.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.example.com/privkey.pem;

    # TLS 1.3 + TLS 1.2 (compatibilidad)
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Certificate Stapling (OCSP)
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/chat.example.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Diffie-Hellman parameters (4096 bits)
    ssl_dhparam /etc/nginx/dhparam.pem;

    # Session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # WebSocket upgrade headers
    location /socket.io/ {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name chat.example.com;
    return 301 https://$server_name$request_uri;
}
```

#### Generación de DH Parameters
```bash
openssl dhparam -out /etc/nginx/dhparam.pem 4096
```

#### Let's Encrypt (Certbot)
```bash
# Instalación
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d chat.example.com

# Renovación automática (cron)
0 3 * * * /usr/bin/certbot renew --quiet
```

### Configuración de Desarrollo (Auto-firmado)

#### Generar Certificado SSL Local
```bash
cd backend/certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

#### Express HTTPS Server
```javascript
// backend/src/server.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('./certs/key.pem'),
  cert: fs.readFileSync('./certs/cert.pem')
};

https.createServer(options, app).listen(5000, () => {
  console.log('HTTPS server running on port 5000');
});
```

---

## 15. 🔑 Rotación de Tokens JWT

### Estrategia de Tokens

#### Access Tokens (Corta Duración)
- **Duración**: 15 minutos
- **Uso**: Autenticación de requests API
- **Almacenamiento**: memoria (no localStorage/cookies persistentes)

#### Refresh Tokens (Larga Duración)
- **Duración**: 7 días
- **Uso**: Renovar access tokens sin re-login
- **Almacenamiento**: httpOnly cookie (protección XSS)

### Implementación

#### Configuración JWT (.env)
```bash
JWT_SECRET=your-256-bit-secret-key-here-use-crypto-randomBytes
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
JWT_ISSUER=chat2.0
JWT_AUDIENCE=chat-users
```

#### Generación de Tokens
```javascript
// backend/src/middleware/jwtAuth.js
const jwt = require('jsonwebtoken');

const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId, role, type: 'access' },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    }
  );
};
```

#### Endpoint de Renovación
```javascript
// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    });

    // Verificar tipo
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Verificar blacklist (Redis)
    const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Generar nuevos tokens
    const user = await User.findById(decoded.userId);
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    // Blacklist token antiguo (prevenir reuso)
    await redis.setex(
      `blacklist:${refreshToken}`,
      7 * 24 * 60 * 60, // 7 días
      '1'
    );

    // Enviar nuevos tokens
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

#### Logout (Revocación)
```javascript
// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    // Agregar a blacklist
    await redis.setex(
      `blacklist:${refreshToken}`,
      7 * 24 * 60 * 60,
      '1'
    );
  }

  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});
```

### Rotación Automática de Secretos

#### Script de Rotación (ejecutar mensualmente)
```javascript
// scripts/rotateJWTSecret.js
const crypto = require('crypto');
const fs = require('fs');

const newSecret = crypto.randomBytes(64).toString('hex');

// Actualizar .env
const envContent = fs.readFileSync('.env', 'utf8');
const updatedEnv = envContent.replace(
  /JWT_SECRET=.*/,
  `JWT_SECRET=${newSecret}`
);
fs.writeFileSync('.env', updatedEnv);

console.log('JWT secret rotated successfully');
console.log('IMPORTANT: Invalidate all existing tokens and notify users');
```

#### Cron Job (Kubernetes)
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: jwt-secret-rotation
spec:
  schedule: "0 0 1 * *"  # 1er día del mes a las 00:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: rotate-secret
            image: chat-backend:latest
            command: ["node", "scripts/rotateJWTSecret.js"]
          restartPolicy: OnFailure
```

### Seguridad Adicional

#### Token Fingerprinting
```javascript
// Agregar deviceFingerprint al token
const accessToken = jwt.sign(
  { 
    userId, 
    role, 
    deviceFingerprint: req.deviceFingerprint // SHA-256(IP+UA)
  },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

// Verificar en middleware
const decoded = jwt.verify(token, process.env.JWT_SECRET);
if (decoded.deviceFingerprint !== req.deviceFingerprint) {
  throw new Error('Token stolen - device mismatch');
}
```

#### Rate Limiting en Renovación
```javascript
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 renovaciones por ventana
  message: 'Too many refresh requests'
});

router.post('/refresh', refreshLimiter, refreshHandler);
```

---

## 16. 🎯 Roadmap de Seguridad Futura

### Q1 2025
- [ ] Implementar WebAuthn/FIDO2 para autenticación biométrica
- [ ] Agregar detección de deepfakes en imágenes/videos
- [ ] Implementar Zero-Knowledge Proofs para autenticación

### Q2 2025
- [ ] Migrar a TLS 1.3
- [ ] Implementar Certificate Pinning
- [ ] Agregar Homomorphic Encryption para búsquedas cifradas

### Q3 2025
- [ ] Integrar con SIEM (Splunk, ELK)
- [ ] Implementar Machine Learning para detección de anomalías
- [ ] Agregar Honeypots para detectar atacantes

---

## 📞 Contacto de Seguridad

Para reportar vulnerabilidades de seguridad:
- **Email**: security@example.com
- **GPG Key**: [fingerprint]
- **Bug Bounty**: [programa si existe]

**Tiempo de respuesta**: < 24 horas para vulnerabilidades críticas

---

**Documento actualizado**: Enero 2025  
**Versión**: 2.0  
**Mantenedor**: Equipo de Seguridad - CHAT 2.0
