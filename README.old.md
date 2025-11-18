# Sistema de Chat en Tiempo Real con Salas Seguras

## 📋 Descripción del Proyecto

Sistema de chat en tiempo real que permite a un administrador crear salas de chat seguras con PIN de acceso. Los usuarios pueden unirse a estas salas mediante un código y PIN, comunicarse en tiempo real, y en salas multimedia, compartir y visualizar archivos multimedia directamente en el chat.

### Características Principales

- ✅ **Autenticación de Administrador**: Login seguro con JWT para gestión de salas
- ✅ **Creación de Salas**: Salas de tipo TEXTO o MULTIMEDIA con PIN encriptado
- ✅ **Acceso Seguro**: PIN encriptado con bcrypt, nunca guardado en texto plano
- ✅ **Chat en Tiempo Real**: Mensajes instantáneos vía WebSocket (Socket.io)
- ✅ **Sesiones Únicas por IP**: Un dispositivo solo puede estar en una sala a la vez
- ✅ **Nicknames Únicos**: Validación de nicknames únicos por sala
- ✅ **Soporte Multimedia**: Subida y visualización de archivos (imágenes, videos, audios)
- ✅ **Visualización de Imágenes**: Previsualización automática en el chat
- ✅ **Reproducción de Medios**: Videos y audios reproducibles directamente en el chat
- ✅ **Redis Cache (Opcional)**: Caching de sesiones para mejor rendimiento
- ✅ **Limpieza de Sesiones**: Detección y eliminación automática de sesiones huérfanas
- ✅ **Validaciones**: Sanitización de inputs, validación de tipos de archivo MIME
- ✅ **Concurrencia**: Manejo asíncrono para múltiples usuarios simultáneos

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐
│   FRONTEND      │
│  (React+Vite)   │
└────────┬────────┘
         │
         │ HTTP REST API & WebSocket
         │
┌────────▼────────┐
│    BACKEND      │
│ (Node.js +      │
│  Express +      │
│  Socket.io)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──┐
│MongoDB│ │Redis│
│  BD   │ │(opt)│
└───────┘ └─────┘
```

### Componentes

1. **Frontend (React + Vite)**
   - Login de administrador
   - Panel de gestión de salas
   - Interfaz de unión a sala
   - Chat en tiempo real
   - Subida y visualización de archivos multimedia

2. **Backend (Node.js + Express + Socket.io)**
   - API REST para autenticación y gestión
   - Servidor WebSocket para chat en tiempo real
   - Validaciones y seguridad
   - Gestión de sesiones por IP con Redis (opcional)
   - Limpieza automática de sesiones huérfanas

3. **Base de Datos (MongoDB)**
   - Colecciones: admins, rooms, messages, sessions
   - Índices para optimización

4. **Cache (Redis - Opcional)**
   - Caching de sesiones activas
   - Fallback automático a MongoDB si Redis no disponible
   - TTL configurable para expiración de sesiones

---

## 📦 Requisitos

- **Node.js**: v18 o superior
- **MongoDB**: v6.0 o superior (local o Atlas)
- **npm**: v9 o superior
- **Redis** (Opcional): v6.0 o superior
- **Navegador**: Chrome, Firefox, Safari, Edge (versiones recientes)

---

## 🚀 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/juanspdf/CHAT2.0.git
cd CHAT2.0
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Crear archivo `.env`:

```env
# Servidor
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/chat-system

# JWT
JWT_SECRET=super-secret-jwt-key-12345-change-in-production
JWT_EXPIRES_IN=24h

# CORS
FRONTEND_URL=http://localhost:5173

# Archivos multimedia
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=./uploads

# Sesiones
SESSION_TIMEOUT_MINUTES=30

# Redis (Opcional - para mejor rendimiento)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SESSION_TTL=1800
```

### 3. Configurar Frontend

```bash
cd ../frontend
npm install
```

### 4. Iniciar MongoDB

**Opción A: MongoDB Local**
```bash
mongod
```

**Opción B: MongoDB Atlas**
- Crear cluster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Actualizar `MONGODB_URI` en `.env`

### 5. Iniciar Redis (Opcional - para mejor rendimiento)

**Windows:**
```powershell
# Con WSL2
wsl
sudo service redis-server start

# O con Chocolatey
choco install redis-64
redis-server
```

**Linux/Mac:**
```bash
sudo service redis-server start
# o
redis-server
```

---

## ▶️ Ejecución

### Modo Desarrollo

**Terminal 1 - MongoDB:**
```bash
mongod
```

**Terminal 2 - Redis (Opcional):**
```bash
redis-server
```

**Terminal 3 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 4 - Frontend:**
```bash
cd frontend
npm run dev
```

El backend estará en `http://localhost:5000`
El frontend estará en `http://localhost:5173`

---

## 👤 Crear Primer Administrador

Usar la API REST para registrar el primer admin:

```bash
curl -X POST http://localhost:5000/api/admin/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

O usar Postman/Thunder Client con:
- **URL**: `POST http://localhost:5000/api/admin/register`
- **Body (JSON)**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```

---

## 📖 Uso del Sistema

### Como Administrador

1. **Iniciar Sesión**
   - Ir a `http://localhost:5173/admin/login`
   - Ingresar usuario y contraseña
   - Recibirás un token JWT guardado automáticamente

2. **Crear Sala**
   - Clic en "Nueva Sala"
   - Seleccionar tipo:
     - **TEXTO**: Solo mensajes de texto
     - **MULTIMEDIA**: Mensajes + archivos (imágenes, videos, audios)
   - Ingresar PIN de 4+ dígitos
   - (Opcional) Configurar tamaño máximo de archivo (solo MULTIMEDIA)
   - Copiar el código de sala generado

3. **Compartir Sala**
   - Proporcionar a los usuarios:
     - **Código de Sala** (ej: `ZKJPHS`)
     - **PIN** (ej: `1234`)

4. **Gestionar Salas**
   - Ver todas las salas creadas
   - Cerrar salas cuando sea necesario
   - Ver estado (ACTIVE/CLOSED)

### Como Usuario

1. **Unirse a Sala**
   - Ir a `http://localhost:5173/join`
   - Ingresar:
     - Código de sala (proporcionado por el admin)
     - PIN (proporcionado por el admin)
     - Nickname (único en la sala)
   - Clic en "Unirse a la Sala"

2. **Chatear**
   - Escribir mensajes en el input inferior
   - Ver usuarios conectados en la barra lateral
   - Ver historial de mensajes

3. **Compartir Multimedia (solo en salas MULTIMEDIA)**
   - Clic en el botón 📎 (clip)
   - Seleccionar archivo:
     - **Imágenes**: JPG, PNG, GIF, etc. → Se muestran directamente en el chat
     - **Videos**: MP4, AVI, MOV, etc. → Reproducibles con controles nativos
     - **Audios**: MP3, WAV, OGG, etc. → Reproducibles con barra de reproducción
     - **Otros**: PDF, DOC, etc. → Descargables con ícono de clip
   - Límite: 10MB por archivo (configurable)

4. **Visualizar Multimedia**
   - **Imágenes**: Click para ver en tamaño completo en nueva pestaña
   - **Videos**: Play/pause, ajuste de volumen, pantalla completa
   - **Audios**: Play/pause, timeline, control de volumen

5. **Salir**
   - Clic en "Salir" para desconectarse
   - O simplemente cerrar la pestaña

---

## 🔒 Seguridad

### Medidas Implementadas

1. **Sesiones Únicas por IP**
   - DeviceId generado basado en IP del cliente
   - Una IP solo puede estar en una sala a la vez
   - Detección y limpieza automática de sesiones huérfanas

2. **Encriptación de PINs**
   - Bcrypt con salt rounds = 10
   - Nunca se guarda PIN en texto plano

3. **Autenticación JWT**
   - Tokens firmados con secret
   - Expiración configurable (24h por defecto)

4. **Validación de Inputs**
   - Sanitización con validator.js
   - Escape de HTML para prevenir XSS
   - Validación de longitud y formato

5. **Subida de Archivos**
   - Validación de tipo MIME
   - Límite de tamaño (10MB por defecto)
   - Renombrado seguro con timestamps
   - Organización por sala (uploads/room_{código}/)

6. **CORS**
   - Configurado solo para frontend autorizado
   - Credentials habilitado

7. **Helmet**
   - Headers de seguridad HTTP
   - Cross-Origin Resource Policy configurado

---

## 📁 Estructura del Proyecto

```
CHAT2.0/
├── backend/
│   ├── src/
│   │   ├── models/          # Modelos de MongoDB
│   │   │   ├── Admin.js
│   │   │   ├── Room.js
│   │   │   ├── Message.js
│   │   │   └── Session.js
│   │   ├── routes/          # Rutas de API REST
│   │   │   ├── admin.js
│   │   │   └── rooms.js
│   │   ├── middleware/      # Middlewares
│   │   │   └── auth.js
│   │   ├── services/        # Servicios
│   │   │   ├── socketService.js   # WebSocket + Sesiones
│   │   │   └── redisService.js    # Cache Redis
│   │   ├── utils/           # Utilidades
│   │   │   ├── validators.js
│   │   │   └── database.js
│   │   └── server.js        # Servidor principal
│   ├── uploads/             # Archivos multimedia subidos
│   │   └── room_{código}/   # Por sala
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Páginas
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── JoinRoom.jsx
│   │   │   └── Chat.jsx
│   │   ├── services/        # Servicios
│   │   │   ├── api.js       # HTTP REST
│   │   │   └── socket.js    # WebSocket
│   │   ├── utils/           # Utilidades
│   │   │   └── helpers.js
│   │   ├── styles/          # Estilos CSS
│   │   │   ├── Chat.css
│   │   │   ├── Dashboard.css
│   │   │   ├── JoinRoom.css
│   │   │   └── Login.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── README.md              # Este archivo
├── REDIS.md              # Documentación de Redis
└── ARCHITECTURE.md       # Arquitectura detallada
```

---

---

## 🛠️ API REST

### Admin Endpoints

#### POST `/api/admin/register`
Registro de administrador (solo para setup inicial)

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "message": "Admin creado exitosamente",
  "adminId": "507f1f77bcf86cd799439011"
}
```

#### POST `/api/admin/login`
Autenticación de administrador

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "admin": {
    "id": "507f1f77bcf86cd799439011",
    "username": "admin"
  }
}
```

### Room Endpoints

#### POST `/api/rooms`
Crear sala (requiere autenticación JWT)

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "type": "MULTIMEDIA",
  "pin": "1234",
  "maxFileSizeMB": 10
}
```

**Response:**
```json
{
  "roomCode": "ZKJPHS",
  "type": "MULTIMEDIA",
  "maxFileSizeMB": 10,
  "createdAt": "2025-11-15T10:30:00Z",
  "status": "ACTIVE"
}
```

#### GET `/api/rooms`
Obtener todas las salas del admin autenticado

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rooms": [
    {
      "roomCode": "ZKJPHS",
      "type": "MULTIMEDIA",
      "status": "ACTIVE",
      "createdAt": "2025-11-15T10:30:00Z"
    }
  ]
}
```

#### GET `/api/rooms/:roomCode`
Obtener información de una sala específica (sin PIN)

**Response:**
```json
{
  "roomCode": "ZKJPHS",
  "type": "MULTIMEDIA",
  "status": "ACTIVE",
  "maxFileSizeMB": 10
}
```

#### PATCH `/api/rooms/:roomCode/close`
Cerrar una sala (requiere autenticación JWT)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Sala cerrada exitosamente"
}
```

#### POST `/api/rooms/:roomCode/files`
Subir archivo multimedia (multipart/form-data)

**Form Data:**
- `file`: Archivo (imagen/video/audio - max 10MB)
- `nickname`: Nombre del usuario que sube

**Response:**
```json
{
  "messageId": "507f1f77bcf86cd799439011",
  "fileUrl": "/uploads/ZKJPHS/1234567890_foto.jpg",
  "fileMimeType": "image/jpeg",
  "fileSizeBytes": 2048576,
  "originalName": "foto.jpg"
}
```

---

## 🔌 WebSocket Events

### Cliente → Servidor

#### `join_room`
Unirse a una sala

```json
{
  "roomCode": "ZKJPHS",
  "pin": "1234",
  "nickname": "Juan"
}
```

**Nota:** El deviceId se genera automáticamente en el backend basado en la IP del cliente.

#### `send_message`
Enviar mensaje de texto

```json
{
  "roomCode": "ZKJPHS",
  "content": "Hola a todos!"
}
```

#### `get_messages`
Obtener historial de mensajes

```json
{
  "roomCode": "ZKJPHS",
  "limit": 50
}
```

### Servidor → Cliente

#### `joined_room`
Confirmación de unión exitosa

```json
{
  "roomCode": "ZKJPHS",
  "type": "MULTIMEDIA",
  "nickname": "Juan",
  "users": [
    {"nickname": "Ana"},
    {"nickname": "Juan"}
  ]
}
```

#### `messages_history`
Historial de mensajes

```json
{
  "roomCode": "ZKJPHS",
  "messages": [
    {
      "messageId": "507f...",
      "nickname": "Ana",
      "type": "TEXT",
      "content": "Hola",
      "createdAt": "2025-11-15T10:30:00Z"
    },
    {
      "messageId": "507g...",
      "nickname": "Pedro",
      "type": "FILE",
      "content": "foto.jpg",
      "fileUrl": "/uploads/ZKJPHS/1234567890_foto.jpg",
      "fileMimeType": "image/jpeg",
      "fileSizeBytes": 2048576,
      "createdAt": "2025-11-15T10:31:00Z"
    }
  ]
}
```

#### `new_message`
Nuevo mensaje (broadcast a todos en la sala)

```json
{
  "messageId": "507f...",
  "roomCode": "ZKJPHS",
  "nickname": "Juan",
  "type": "TEXT",
  "content": "Hola",
  "createdAt": "2025-11-15T10:30:00Z"
}
```

Para archivos:
```json
{
  "messageId": "507g...",
  "roomCode": "ZKJPHS",
  "nickname": "Pedro",
  "type": "FILE",
  "content": "foto.jpg",
  "fileUrl": "/uploads/ZKJPHS/1234567890_foto.jpg",
  "fileMimeType": "image/jpeg",
  "fileSizeBytes": 2048576,
  "createdAt": "2025-11-15T10:31:00Z"
}
```

#### `user_joined`
Nuevo usuario se unió a la sala

```json
{
  "nickname": "Pedro",
  "users": [
    {"nickname": "Ana"},
    {"nickname": "Juan"},
    {"nickname": "Pedro"}
  ]
}
```

#### `user_left`
Usuario dejó la sala

```json
{
  "nickname": "Pedro",
  "users": [
    {"nickname": "Ana"},
    {"nickname": "Juan"}
  ]
}
```

#### `error`
Error en operación

**Códigos de error:**
- `ROOM_NOT_FOUND`: Sala no existe
- `INVALID_PIN`: PIN incorrecto
- `NICKNAME_IN_USE`: Nickname ya está en uso en la sala
- `ALREADY_IN_ROOM`: El dispositivo ya está en otra sala
- `SESSION_REPLACED`: Sesión reemplazada por nueva conexión
- `INVALID_ROOM_TYPE`: Operación no permitida para este tipo de sala
- `NO_FILE`: No se proporcionó archivo
- `INVALID_FILE_TYPE`: Tipo de archivo no permitido
- `FILE_TOO_LARGE`: Archivo excede el límite de tamaño
- `SERVER_ERROR`: Error interno del servidor

```json
{
  "errorCode": "INVALID_PIN",
  "message": "PIN incorrecto"
}
```

---

## 📸 Sistema de Archivos Multimedia

### Almacenamiento

Los archivos se guardan localmente en el servidor:

```
backend/
└── uploads/
    ├── room_ZKJPHS/
    │   ├── 1731667890123_foto.jpg
    │   ├── 1731667891456_video.mp4
    │   └── 1731667892789_audio.mp3
    └── room_ABC123/
        └── 1731667893012_documento.pdf
```

**Estructura:**
- Carpeta por sala: `uploads/room_{código}/`
- Nombre con timestamp: `{timestamp}_{nombre_sanitizado}.ext`
- Evita colisiones y mantiene orden cronológico

### Tipos de Archivo Soportados

**Imágenes** (visualización directa):
- JPG, JPEG, PNG, GIF, BMP, WEBP, SVG

**Videos** (reproducción nativa):
- MP4, AVI, MOV, WMV, FLV, MKV, WEBM

**Audios** (reproducción nativa):
- MP3, WAV, OGG, M4A, AAC, FLAC

**Otros** (descarga):
- PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR, etc.

### Configuración

**Límite de tamaño** (.env):
```env
MAX_FILE_SIZE_MB=10
```

**Validación MIME** (backend/src/routes/rooms.js):
```javascript
const allowedMimeTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  // agregar más según necesidad
];
```

### Flujo de Subida

1. Usuario selecciona archivo en frontend
2. Frontend envía via FormData a `/api/rooms/:roomCode/files`
3. Multer procesa y valida:
   - Tipo MIME permitido
   - Tamaño < límite
   - Nombre seguro (sin caracteres especiales)
4. Archivo guardado en `uploads/room_{código}/`
5. Registro creado en MongoDB (colección `messages`)
6. WebSocket notifica a todos en la sala (`new_message`)
7. Frontend renderiza según tipo:
   - Imagen: `<img>` con preview
   - Video: `<video>` con controles
   - Audio: `<audio>` con barra de reproducción
   - Otros: Link de descarga

### Acceso a Archivos

**URL pública:**
```
http://localhost:5000/uploads/room_ZKJPHS/1731667890123_foto.jpg
```

**Configuración en backend:**
```javascript
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

**CORS permitido** para acceso desde frontend.

---

## 🔄 Gestión de Sesiones

### Sistema de Sesiones por IP

El sistema utiliza la IP del cliente para generar un `deviceId` único:

```
deviceId = "device_{IP_del_cliente}"
```

**Ventajas:**
- ✅ Una IP solo puede estar en una sala a la vez
- ✅ Previene múltiples sesiones desde el mismo dispositivo
- ✅ Limpieza automática de sesiones huérfanas

### Redis Cache (Opcional)

Para mejorar el rendimiento, el sistema puede usar Redis para cachear sesiones:

**Flujo con Redis:**
1. Check Redis cache (rápido - ms)
2. Si no está en cache → Check MongoDB
3. Si está en MongoDB → Guardar en Redis
4. Todas las operaciones actualizan ambos

**Configuración (.env):**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SESSION_TTL=1800  # 30 minutos
```

**Fallback automático:**
Si Redis no está disponible, el sistema usa solo MongoDB sin interrupciones.

**Comandos útiles:**
```bash
# Ver sesiones activas
redis-cli KEYS "session:*"

# Ver contenido de una sesión
redis-cli GET "session:device_192.168.1.100"

# Monitorear operaciones
redis-cli MONITOR
```

### Limpieza de Sesiones Huérfanas

El sistema detecta y limpia automáticamente sesiones de sockets desconectados:

**Validación en cada join:**
1. Buscar sesión existente por deviceId
2. Verificar si socket aún está conectado
3. Si socket desconectado → Eliminar sesión
4. Permitir nueva conexión

**Logs:**
```
🧹 Limpiando sesión huérfana
🆕 Creando nueva sesión
```

---

## 🐛 Solución de Problemas

### Backend no inicia (Exit Code: 1)

**Verificar:**
```bash
# ¿MongoDB está corriendo?
mongosh --eval "db.adminCommand('ping')"

# ¿Puerto 5000 está libre?
netstat -ano | findstr :5000

# Ver logs del backend
cd backend
npm run dev
```

### MongoDB no conecta

```bash
# Windows - Iniciar MongoDB
net start MongoDB

# Linux/Mac
sudo service mongod start

# Verificar conexión
mongosh mongodb://127.0.0.1:27017/chat-system
```

### Redis no conecta (no crítico)

```bash
# Windows (WSL2)
wsl
sudo service redis-server start

# Verificar
redis-cli ping
# Debería responder: PONG
```

**Nota:** Si Redis no está disponible, el sistema funciona con MongoDB solamente.

### Socket.io no conecta

**Verificar CORS:**
```javascript
// backend/.env
FRONTEND_URL=http://localhost:5173

// Debe coincidir con la URL del frontend
```

**Consola del navegador:**
```javascript
// Debería mostrar:
Socket conectado: xxxxx
```

### Imágenes no se visualizan

**Verificar:**
1. Sala es tipo MULTIMEDIA
2. Archivo es imagen válida (MIME type: image/*)
3. URL del archivo es correcta: `http://localhost:5000/uploads/...`
4. Backend sirviendo archivos estáticos

**Consola del navegador:**
```javascript
// Verificar que fileMimeType llegue correctamente
console.log(message.fileMimeType); // "image/jpeg"
```

### Archivos no se suben

```bash
# Verificar permisos de carpeta uploads/
ls -la backend/uploads/

# Crear carpeta si no existe
mkdir backend/uploads

# Verificar límite de tamaño
# backend/.env
MAX_FILE_SIZE_MB=10
```

---

## 📊 Monitoreo y Logs

### Logs del Backend

El sistema genera logs detallados:

```
✅ MongoDB conectado: 127.0.0.1
✅ Redis conectado
🚀 Servidor corriendo en puerto 5000
📡 WebSocket disponible en ws://localhost:5000
🔌 Cliente conectado: xxxxx
🔍 Cliente conectando desde IP: 192.168.1.100, DeviceId: device_192.168.1.100
✅ Juan se unió a la sala ZKJPHS
👋 Pedro dejó la sala ZKJPHS
```

### Monitoreo de Redis

```bash
# Sesiones activas
redis-cli KEYS "session:*"

# Ver todas las operaciones en tiempo real
redis-cli MONITOR

# Estadísticas
redis-cli INFO stats
```

### Monitoreo de MongoDB

```bash
mongosh mongodb://127.0.0.1:27017/chat-system

# Ver sesiones activas
db.sessions.find().pretty()

# Ver mensajes de una sala
db.messages.find({roomId: ObjectId("...")}).pretty()

# Contar usuarios por sala
db.sessions.aggregate([
  { $group: { _id: "$roomId", count: { $sum: 1 } } }
])
```

---

## 📈 Mejoras Futuras

- [ ] **Docker**: Containerización completa
- [ ] **Notificaciones Push**: Avisos de nuevos mensajes
- [ ] **Cifrado E2E**: Mensajes encriptados end-to-end
- [ ] **Videollamadas**: Integración con WebRTC
- [ ] **Temas**: Modo oscuro y personalización
- [ ] **Exportar Chat**: Descargar historial en PDF/TXT
- [ ] **Moderación**: Bloquear palabras/usuarios
- [ ] **Cloud Storage**: S3/Cloudinary para archivos
- [ ] **Compresión**: Imágenes optimizadas automáticamente
- [ ] **Thumbnails**: Miniaturas para videos
- [ ] **Reacciones**: Emojis en mensajes
- [ ] **Respuestas**: Hilos de conversación
- [ ] **Bots**: Comandos y automatización

---

## 👥 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/NuevaFuncionalidad`)
3. Commit cambios (`git commit -m 'feat: Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/NuevaFuncionalidad`)
5. Abrir Pull Request

**Convenciones de commits:**
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bugs
- `docs:` Documentación
- `style:` Formato de código
- `refactor:` Refactorización
- `test:` Pruebas
- `chore:` Mantenimiento

---

## 📄 Licencia

MIT License

Copyright (c) 2025

Se concede permiso para usar, copiar, modificar y distribuir este software con fines educativos y comerciales.

---

## 📞 Contacto y Enlaces

**Proyecto:** [https://github.com/juanspdf/CHAT2.0](https://github.com/juanspdf/CHAT2.0)

**Documentación Adicional:**
- [REDIS.md](./REDIS.md) - Guía completa de Redis
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitectura detallada del sistema

---

## 🙏 Tecnologías Utilizadas

**Backend:**
- [Node.js](https://nodejs.org/) - Runtime de JavaScript
- [Express](https://expressjs.com/) - Framework web
- [Socket.io](https://socket.io/) - WebSocket en tiempo real
- [MongoDB](https://www.mongodb.com/) - Base de datos NoSQL
- [Mongoose](https://mongoosejs.com/) - ODM para MongoDB
- [Redis](https://redis.io/) - Cache en memoria (opcional)
- [ioredis](https://github.com/redis/ioredis) - Cliente Redis
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Encriptación
- [JWT](https://jwt.io/) - Autenticación
- [Multer](https://www.npmjs.com/package/multer) - Subida de archivos
- [Helmet](https://helmetjs.github.io/) - Seguridad HTTP
- [Validator.js](https://www.npmjs.com/package/validator) - Validaciones

**Frontend:**
- [React](https://react.dev/) - Librería UI
- [Vite](https://vitejs.dev/) - Build tool
- [React Router](https://reactrouter.com/) - Enrutamiento
- [Socket.io Client](https://socket.io/docs/v4/client-api/) - WebSocket cliente
- [Axios](https://axios-http.com/) - Cliente HTTP

---

**Desarrollado como proyecto académico - Aplicaciones Distribuidas 2025**

⭐ Si te gusta este proyecto, dale una estrella en GitHub!
```
