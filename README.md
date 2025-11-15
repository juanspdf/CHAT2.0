# Sistema de Chat en Tiempo Real con Salas Seguras

## 📋 Descripción del Proyecto

Sistema de chat en tiempo real que permite a un administrador crear salas de chat seguras con PIN de acceso. Los usuarios pueden unirse a estas salas mediante un código y PIN, comunicarse en tiempo real, y en salas multimedia, compartir archivos.

### Características Principales

- ✅ **Autenticación de Administrador**: Login seguro con JWT para gestión de salas
- ✅ **Creación de Salas**: Salas de tipo TEXTO o MULTIMEDIA con PIN encriptado
- ✅ **Acceso Seguro**: PIN encriptado con bcrypt, nunca guardado en texto plano
- ✅ **Chat en Tiempo Real**: Mensajes instantáneos vía WebSocket (Socket.io)
- ✅ **Sesiones Únicas**: Un dispositivo solo puede estar en una sala a la vez
- ✅ **Nicknames Únicos**: Validación de nicknames únicos por sala
- ✅ **Soporte Multimedia**: Subida de archivos (imágenes, PDFs, documentos)
- ✅ **Validaciones**: Sanitización de inputs, validación de tipos de archivo
- ✅ **Concurrencia**: Manejo asíncrono para múltiples usuarios simultáneos
- ✅ **Pruebas Unitarias**: Cobertura >70% con Jest

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
   - Subida de archivos

2. **Backend (Node.js + Express + Socket.io)**
   - API REST para autenticación y gestión
   - Servidor WebSocket para chat en tiempo real
   - Validaciones y seguridad
   - Gestión de sesiones

3. **Base de Datos (MongoDB)**
   - Colecciones: admins, rooms, messages, sessions
   - Índices para optimización

---

## 📦 Requisitos

- **Node.js**: v18 o superior
- **MongoDB**: v6.0 o superior (local o Atlas)
- **npm**: v9 o superior
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

Copiar `.env.example` a `.env` y configurar:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/chat-system

JWT_SECRET=super-secret-jwt-key-12345-change-in-production
JWT_EXPIRES_IN=24h

FRONTEND_URL=http://localhost:5173

MAX_FILE_SIZE_MB=10
UPLOAD_DIR=./uploads

SESSION_TIMEOUT_MINUTES=30
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

---

## ▶️ Ejecución

### Modo Desarrollo

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

El backend estará en `http://localhost:5000`
El frontend estará en `http://localhost:5173`

### Modo Producción

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

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
   - Seleccionar tipo: TEXTO o MULTIMEDIA
   - Ingresar PIN de 4+ dígitos
   - (Opcional) Configurar tamaño máximo de archivo
   - Copiar el código de sala generado

3. **Compartir Sala**
   - Proporcionar a los usuarios:
     - **Código de Sala** (ej: `AB12CD`)
     - **PIN** (ej: `1234`)

### Como Usuario

1. **Unirse a Sala**
   - Ir a `http://localhost:5173/join`
   - Ingresar código de sala, PIN y nickname
   - Clic en "Unirse a la Sala"

2. **Chatear**
   - Escribir mensajes en el input inferior
   - Ver usuarios conectados en la barra lateral
   - (En salas multimedia) Clic en 📎 para subir archivos

3. **Salir**
   - Clic en "Salir" para desconectarse

---

## 🧪 Pruebas

### Ejecutar Pruebas Unitarias

```bash
cd backend
npm test
```

### Ver Cobertura

```bash
npm test -- --coverage
```

Objetivo: **≥70% de cobertura**

### Pruebas Incluidas

- ✅ Validación de PINs
- ✅ Validación de nicknames
- ✅ Hashing de contraseñas/PINs
- ✅ Sesiones únicas por dispositivo
- ✅ Nicknames únicos por sala
- ✅ Sanitización de inputs
- ✅ Validación de tipos MIME

---

## 📊 Pruebas de Carga

Para probar ≥50 usuarios simultáneos:

### Opción 1: Script Manual

Crear `load-test.js`:

```javascript
const io = require('socket.io-client');

const ROOM_CODE = 'AB12CD';
const PIN = '1234';
const NUM_USERS = 50;

for (let i = 0; i < NUM_USERS; i++) {
  const socket = io('http://localhost:5000');
  
  socket.on('connect', () => {
    socket.emit('join_room', {
      roomCode: ROOM_CODE,
      pin: PIN,
      nickname: `User${i}`,
      deviceId: `device_${i}`
    });
  });
  
  socket.on('joined_room', () => {
    console.log(`User${i} joined successfully`);
    
    setInterval(() => {
      socket.emit('send_message', {
        roomCode: ROOM_CODE,
        content: `Message from User${i}`
      });
    }, 5000);
  });
}
```

Ejecutar: `node load-test.js`

### Opción 2: Artillery

```bash
npm install -g artillery
artillery quick --count 50 --num 10 http://localhost:5000/health
```

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
│   │   ├── services/        # Servicios (Socket.io)
│   │   │   └── socketService.js
│   │   ├── utils/           # Utilidades
│   │   │   ├── validators.js
│   │   │   └── database.js
│   │   └── server.js        # Servidor principal
│   ├── tests/               # Pruebas unitarias
│   │   ├── validators.test.js
│   │   ├── security.test.js
│   │   └── sessions.test.js
│   ├── uploads/             # Archivos subidos
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
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── utils/           # Utilidades
│   │   │   └── helpers.js
│   │   ├── styles/          # Estilos CSS
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── ARCHITECTURE.md
```

---

## 🔒 Seguridad

### Medidas Implementadas

1. **Encriptación de PINs**
   - Bcrypt con salt rounds = 10
   - Nunca se guarda PIN en texto plano

2. **Autenticación JWT**
   - Tokens firmados con secret
   - Expiración configurable

3. **Validación de Inputs**
   - Sanitización con validator.js
   - Escape de HTML para prevenir XSS
   - Validación de longitud y formato

4. **Sesiones Únicas**
   - DeviceId generado y persistido
   - Validación en cada conexión

5. **Subida de Archivos**
   - Validación de tipo MIME
   - Límite de tamaño
   - Renombrado seguro de archivos

6. **CORS**
   - Configurado solo para frontend autorizado

7. **Helmet**
   - Headers de seguridad HTTP

---

## 🔄 Flujos del Sistema

### 1. Login de Administrador

```
Usuario → Frontend: Ingresa credenciales
Frontend → Backend: POST /api/admin/login
Backend → MongoDB: Busca admin
MongoDB → Backend: Retorna admin
Backend: Verifica password con bcrypt
Backend → Frontend: Retorna JWT
Frontend: Guarda token en localStorage
```

### 2. Creación de Sala

```
Admin → Frontend: Crea sala (tipo, PIN)
Frontend → Backend: POST /api/rooms (con JWT)
Backend: Valida token
Backend: Hashea PIN con bcrypt
Backend: Genera roomCode único
Backend → MongoDB: Guarda sala
MongoDB → Backend: Confirma
Backend → Frontend: Retorna roomCode
```

### 3. Usuario Entra a Sala

```
Usuario → Frontend: Ingresa roomCode, PIN, nickname
Frontend → Backend: WebSocket connect + emit('join_room')
Backend → MongoDB: Busca sala
Backend: Verifica PIN con bcrypt
Backend: Valida nickname único
Backend: Valida sesión única de dispositivo
Backend → MongoDB: Crea/actualiza sesión
Backend → Usuario: emit('joined_room')
Backend → Otros: emit('user_joined')
```

### 4. Envío de Mensaje

```
Usuario → Backend: emit('send_message', {content})
Backend: Valida sesión activa
Backend: Sanitiza contenido
Backend → MongoDB: Guarda mensaje
Backend → Sala: broadcast('new_message')
Sala → Usuarios: Reciben mensaje
```

---

## 🛠️ API REST

### Admin Endpoints

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

#### POST `/api/admin/register`
Registro de administrador (solo para setup)

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Room Endpoints

#### POST `/api/rooms`
Crear sala (requiere auth)

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
  "roomCode": "AB12CD",
  "type": "MULTIMEDIA",
  "maxFileSizeMB": 10
}
```

#### GET `/api/rooms`
Obtener salas del admin (requiere auth)

#### GET `/api/rooms/:roomCode`
Obtener info de sala específica

#### POST `/api/rooms/:roomCode/files`
Subir archivo (multipart/form-data)

**Form Data:**
- `file`: Archivo
- `nickname`: Nombre del usuario

---

## 🔌 WebSocket Events

### Cliente → Servidor

#### `join_room`
```json
{
  "roomCode": "AB12CD",
  "pin": "1234",
  "nickname": "Juan",
  "deviceId": "device_xyz"
}
```

#### `send_message`
```json
{
  "roomCode": "AB12CD",
  "content": "Hola a todos"
}
```

#### `get_messages`
```json
{
  "roomCode": "AB12CD",
  "limit": 50
}
```

### Servidor → Cliente

#### `joined_room`
```json
{
  "roomCode": "AB12CD",
  "type": "MULTIMEDIA",
  "nickname": "Juan",
  "users": [{"nickname": "Ana"}, {"nickname": "Juan"}]
}
```

#### `new_message`
```json
{
  "messageId": "507f...",
  "roomCode": "AB12CD",
  "nickname": "Juan",
  "type": "TEXT",
  "content": "Hola",
  "createdAt": "2025-11-15T10:30:00Z"
}
```

#### `user_joined`
```json
{
  "nickname": "Pedro",
  "users": [...]
}
```

#### `user_left`
```json
{
  "nickname": "Pedro",
  "users": [...]
}
```

#### `error`
```json
{
  "errorCode": "INVALID_PIN",
  "message": "PIN incorrecto"
}
```

---

## 🐛 Solución de Problemas

### MongoDB no conecta
- Verificar que MongoDB esté corriendo: `mongod --version`
- Revisar `MONGODB_URI` en `.env`
- Para MongoDB Atlas, verificar whitelist de IP

### Socket.io no conecta
- Verificar que backend esté corriendo en puerto 5000
- Revisar consola del navegador para errores CORS
- Verificar `FRONTEND_URL` en backend `.env`

### Archivos no se suben
- Verificar que la sala sea tipo MULTIMEDIA
- Revisar tamaño del archivo (límite 10MB por defecto)
- Verificar permisos de carpeta `uploads/`

### Tests fallan
- Instalar todas las dependencias: `npm install`
- Verificar que MongoDB esté disponible
- Ejecutar con `--detectOpenHandles` para ver procesos colgados

---

## 📈 Mejoras Futuras

- [ ] Docker y docker-compose
- [ ] Cifrado end-to-end
- [ ] Notificaciones push
- [ ] Videollamadas
- [ ] Bots y comandos
- [ ] Temas personalizables
- [ ] Exportar historial
- [ ] Moderación automática

---

## 👥 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📄 Licencia

MIT License - Ver archivo LICENSE

---

## 📞 Contacto

Proyecto: [https://github.com/juanspdf/CHAT2.0](https://github.com/juanspdf/CHAT2.0)

---

## 🙏 Agradecimientos

- Express.js
- Socket.io
- React
- MongoDB
- Vite
- Jest

---

**Desarrollado como proyecto académico - Aplicaciones Distribuidas 2025**
