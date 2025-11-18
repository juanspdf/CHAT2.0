# 🔒 Sistema de Seguridad CHAT2.0

## ✅ Propiedades de Software Seguro Implementadas

### 1. Confidencialidad

#### ✅ Encriptación TLS/SSL para tránsito
- **HTTPS habilitado** con certificados self-signed para desarrollo
- Servidor configurado en `https://localhost:5000`
- Frontend en `https://localhost:5173`
- Variable de entorno `USE_HTTPS=true` controla HTTPS/HTTP

**Producción:** Usar certificados de Let's Encrypt o una CA confiable

#### ✅ AES-256 para datos en reposo
- Mensajes encriptados con **AES-256-GCM**
- Claves efímeras por sala (rotación automática)
- Almacenamiento seguro en MongoDB con:
  - `encryptionKey` (hex, 256 bits)
  - `encryptionIV` (hex, 128 bits)
  - `encryptionTag` (GCM authentication tag)

---

### 2. Integridad

#### ✅ Firmas digitales en mensajes
- **HMAC-SHA256** en cada mensaje
- Campo `signature` en modelo Message
- Generación: `SHA256(nickname + content + timestamp)`
- Verificación en backend

#### ✅ Hashes SHA-256 para detectar alteraciones
- **Blockchain de audit logs** con hash encadenado
- Cada bloque contiene:
  - `hash`: SHA-256 del bloque actual
  - `previousHash`: enlace al bloque anterior
  - `signature`: HMAC del hash del bloque
- Logs **inmutables** (no se pueden modificar ni eliminar)

#### ✅ Detección de esteganografía
- **Análisis de entropía Shannon** (umbral: 7.5)
- **Detección LSB** (Least Significant Bit)
- **Correlación de píxeles** en imágenes
- **Detección de patrones OpenStego**
- Veredictos: APROBADO / ADVERTENCIA / ALERTA / RECHAZADO

---

### 3. Disponibilidad

#### ✅ Rate Limiting contra DDoS
- **Múltiples limitadores configurados:**
  - Autenticación: 5 intentos / 15 min
  - API general: 100 requests / 15 min
  - Upload: 10 archivos / hora
  - Mensajes: 50 mensajes / min
  - Creación de salas: 5 salas / hora
- Soporte para **Redis distribuido** (opcional)
- Registro en audit log cuando se excede

#### ✅ Redundancia en hilos (Workers)
- **Pool de 30 workers:**
  - 14 workers de esteganografía
  - 14 workers de encriptación
  - 2 workers de hashing
- Sistema de cola para peticiones concurrentes
- Reinicio automático en caso de fallo

---

### 4. Autenticación y Autorización

#### ✅ JWT con rotación de tokens
- **Access tokens** de corta duración (1 hora)
- **Refresh tokens** de larga duración (7 días)
- **Rotación automática** antes de expiración
- Detección de **token reuse attacks**
- Revocación por familia de tokens

**Endpoints:**
- `POST /api/auth/refresh` - Renovar access token
- `POST /api/auth/logout` - Cerrar sesión (dispositivo actual)
- `POST /api/auth/logout-all` - Cerrar todas las sesiones

#### ✅ Roles estrictos
- **2FA obligatorio** para administradores
- Separación Admin / Usuario
- Middleware `requireAdmin` en rutas protegidas
- Modelo Admin con campos:
  - `twoFactorEnabled`
  - `twoFactorSecret`
  - `backupCodes`

---

### 5. No Repudio

#### ✅ Logs inmutables firmados digitalmente
- **Blockchain de audit logs** con:
  - Hash SHA-256 encadenado
  - Firma HMAC de cada bloque
  - Prevención de modificación/eliminación (middlewares)
  - Índices optimizados para consultas

**Acciones registradas:**
- LOGIN_SUCCESS, LOGIN_FAILED
- ROOM_CREATED, FILE_UPLOADED
- STEGANOGRAPHY_DETECTED, ADMIN_ALERT_SENT
- RATE_LIMIT_EXCEEDED
- 2FA_ENABLED, 2FA_VERIFIED, 2FA_FAILED
- REFRESH_TOKEN_CREATED, REFRESH_TOKEN_ROTATED
- TOKEN_REUSE_DETECTED, TOKEN_FAMILY_REVOKED

---

## 🚀 Configuración

### Variables de Entorno (.env)

```env
# Servidor
PORT=5000
NODE_ENV=development
USE_HTTPS=true

# JWT
JWT_SECRET=super-secret-jwt-key-12345-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/chat-system

# Frontend
FRONTEND_URL=https://localhost:5173

# Auditoría
AUDIT_SECRET_KEY=audit-secret-key-change-in-production
```

### Generar Certificados SSL

```bash
cd backend
node scripts/generateCerts.js
```

Los certificados se guardan en `backend/certs/`:
- `cert.pem` - Certificado público
- `key.pem` - Clave privada

**Producción:** Reemplazar con certificados de Let's Encrypt

---

## 🔧 Uso del Sistema de Tokens

### Frontend (Login)

```javascript
import tokenService from './services/tokenService';

// Después del login con 2FA
const response = await axios.post('/api/2fa/verify', { token });

// Guardar tokens
tokenService.setTokens(response.data.accessToken, response.data.refreshToken);

// Los tokens se renuevan automáticamente antes de expirar
```

### Frontend (Peticiones con autenticación)

```javascript
// Petición con renovación automática
const response = await tokenService.fetchWithAuth('/api/admin/stats', {
  method: 'GET'
});
```

### Logout

```javascript
// Cerrar sesión en dispositivo actual
await tokenService.logout();

// Cerrar sesión en TODOS los dispositivos
await tokenService.logoutAll();
```

---

## 🛡️ Características de Seguridad Avanzadas

### 1. Detección de Token Reuse
Si un refresh token se usa dos veces en menos de 5 segundos:
- Se revoca toda la familia de tokens
- Se registra alerta de seguridad
- Se requiere nuevo login

### 2. Blockchain de Audit Logs
- Cada log tiene hash del bloque anterior
- Imposible modificar logs históricos
- Verificación de integridad de cadena
- Firma HMAC con clave secreta

### 3. Worker Manager
- Procesamiento paralelo de tareas pesadas
- Aislamiento de errores (workers independientes)
- Cola de tareas para alta concurrencia
- Métricas de rendimiento

### 4. Admin Alerts en Tiempo Real
- WebSocket para notificaciones instantáneas
- Browser notifications
- Alertas de audio (HIGH/MEDIUM severity)
- Panel flotante con historial

---

## 📊 Monitoreo

### Endpoint de Health Check

```bash
GET https://localhost:5000/health
```

Respuesta:
```json
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "workerPools": {
    "steganography": { "active": 14, "queued": 0 },
    "encryption": { "active": 14, "queued": 0 },
    "hashing": { "active": 2, "queued": 0 }
  }
}
```

### Logs de Auditoría

Ver todos los logs:
```javascript
const logs = await AuditLog.find().sort({ blockNumber: -1 }).limit(100);
```

Verificar integridad:
```javascript
const isValid = await auditLogService.verifyChain();
```

---

## ⚠️ Advertencias de Seguridad

### Desarrollo
- Los certificados self-signed **NO SON SEGUROS** para producción
- El navegador mostrará advertencia de seguridad (normal en dev)
- Aceptar el certificado manualmente: **Avanzado** → **Continuar**

### Producción
1. **Cambiar JWT_SECRET** a un valor aleatorio fuerte
2. **Usar certificados SSL válidos** (Let's Encrypt)
3. **Habilitar HSTS** (Helmet lo incluye)
4. **Configurar firewall** y rate limiting a nivel de red
5. **Backup de audit logs** (inmutables pero pueden perderse)
6. **Rotar AUDIT_SECRET_KEY** periódicamente

---

## 🧹 Mantenimiento

### Limpieza Automática

**Tokens expirados:** Se limpian automáticamente cada 1 hora

**Sesiones inactivas:** Job cada 5 minutos (timeout: 30 min)

### Limpieza Manual

```javascript
// Limpiar tokens expirados
await tokenService.cleanExpiredTokens();

// Revocar todos los tokens de un usuario
await tokenService.revokeAllUserTokens(adminId);
```

---

## 📝 Testing de Seguridad

### Probar Rotación de Tokens

```bash
# Login
curl -X POST https://localhost:5000/api/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}' \
  --cookie-jar cookies.txt

# Renovar token
curl -X POST https://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "TOKEN_AQUI"}'
```

### Probar Detección de Token Reuse

```bash
# Usar el mismo refresh token 2 veces rápidamente
# Debería revocar toda la familia y registrar alerta
```

### Verificar Audit Logs

```bash
curl https://localhost:5000/api/admin/audit-logs \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

## 🎯 Resumen de Completitud

| Propiedad | Implementación | Estado |
|-----------|----------------|--------|
| **TLS/SSL** | HTTPS con certificados | ✅ 100% |
| **AES-256** | Mensajes encriptados | ✅ 100% |
| **Firmas digitales** | HMAC en mensajes | ✅ 100% |
| **Hashes SHA-256** | Blockchain audit logs | ✅ 100% |
| **Esteganografía** | Análisis multinivel | ✅ 100% |
| **Rate Limiting** | 5 limitadores configurados | ✅ 100% |
| **Workers** | 30 hilos paralelos | ✅ 100% |
| **JWT rotación** | Refresh tokens automáticos | ✅ 100% |
| **Roles** | Admin + 2FA obligatorio | ✅ 100% |
| **Logs inmutables** | Blockchain firmado | ✅ 100% |

**TOTAL: 100% IMPLEMENTADO** 🎉
