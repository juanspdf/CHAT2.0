# Arquitectura del Sistema - Chat en Tiempo Real

## Diagrama de Arquitectura General

```
┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                              │
│                    (React + Vite + Socket.io-client)          │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Admin Login │  │ Admin Panel  │  │  Join Room   │        │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
│                                                               │
│                    ┌──────────────┐                          │
│                    │  Chat View   │                          │
│                    └──────────────┘                          │
└──────────────────────┬──────────────────┬────────────────────┘
                       │                  │
                       │ HTTP REST        │ WebSocket
                       │ (API calls)      │ (Real-time)
                       │                  │
┌──────────────────────▼──────────────────▼────────────────────┐
│                         BACKEND                               │
│              (Node.js + Express + Socket.io)                  │
│                                                               │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │   API REST       │           │  Socket Service  │        │
│  │                  │           │                  │        │
│  │ • /admin/login   │           │ • join_room      │        │
│  │ • /admin/register│           │ • send_message   │        │
│  │ • /rooms         │           │ • get_messages   │        │
│  │ • /rooms/files   │           │ • disconnect     │        │
│  └────────┬─────────┘           └────────┬─────────┘        │
│           │                              │                   │
│  ┌────────▼──────────────────────────────▼─────────┐        │
│  │           Middleware Layer                      │        │
│  │  • JWT Auth  • Validators  • Multer            │        │
│  └────────┬──────────────────────────────┬─────────┘        │
│           │                              │                   │
│  ┌────────▼──────────────────────────────▼─────────┐        │
│  │            Services Layer                       │        │
│  │  • Session Manager  • File Handler             │        │
│  └────────┬──────────────────────────────┬─────────┘        │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            │                              │
    ┌───────▼─────────┐           ┌────────▼────────┐
    │    MongoDB      │           │  File System    │
    │                 │           │                 │
    │ • admins        │           │  /uploads/      │
    │ • rooms         │           │  └─ roomCode/   │
    │ • messages      │           │     └─ files    │
    │ • sessions      │           │                 │
    └─────────────────┘           └─────────────────┘
```

---

## Diagrama de Secuencia 1: Login de Administrador

```
┌───────┐         ┌────────┐         ┌────────┐         ┌────────┐
│Usuario│         │Frontend│         │Backend │         │MongoDB │
└───┬───┘         └───┬────┘         └───┬────┘         └───┬────┘
    │                 │                  │                  │
    │ 1. Ingresa      │                  │                  │
    │ credenciales    │                  │                  │
    ├────────────────>│                  │                  │
    │                 │                  │                  │
    │                 │ 2. POST          │                  │
    │                 │ /api/admin/login │                  │
    │                 ├─────────────────>│                  │
    │                 │                  │                  │
    │                 │                  │ 3. Buscar admin  │
    │                 │                  │ por username     │
    │                 │                  ├─────────────────>│
    │                 │                  │                  │
    │                 │                  │ 4. Retorna admin │
    │                 │                  │<─────────────────┤
    │                 │                  │                  │
    │                 │                  │ 5. bcrypt.compare│
    │                 │                  │ (password, hash) │
    │                 │                  │─────┐            │
    │                 │                  │     │            │
    │                 │                  │<────┘            │
    │                 │                  │                  │
    │                 │                  │ 6. jwt.sign()    │
    │                 │                  │ genera token     │
    │                 │                  │─────┐            │
    │                 │                  │     │            │
    │                 │                  │<────┘            │
    │                 │                  │                  │
    │                 │ 7. {token, admin}│                  │
    │                 │<─────────────────┤                  │
    │                 │                  │                  │
    │                 │ 8. Guarda token  │                  │
    │                 │ en localStorage  │                  │
    │                 │─────┐            │                  │
    │                 │     │            │                  │
    │                 │<────┘            │                  │
    │                 │                  │                  │
    │ 9. Redirige a   │                  │                  │
    │ /admin/dashboard│                  │                  │
    │<────────────────┤                  │                  │
    │                 │                  │                  │
```

---

## Diagrama de Secuencia 2: Creación de Sala

```
┌─────┐    ┌────────┐    ┌────────┐    ┌────────┐
│Admin│    │Frontend│    │Backend │    │MongoDB │
└──┬──┘    └───┬────┘    └───┬────┘    └───┬────┘
   │           │             │             │
   │ 1. Clic   │             │             │
   │ "Nueva    │             │             │
   │ Sala"     │             │             │
   ├──────────>│             │             │
   │           │             │             │
   │ 2. Llena  │             │             │
   │ formulario│             │             │
   │ (tipo, PIN│             │             │
   │ tamaño)   │             │             │
   ├──────────>│             │             │
   │           │             │             │
   │           │ 3. POST     │             │
   │           │ /api/rooms  │             │
   │           │ + JWT token │             │
   │           ├────────────>│             │
   │           │             │             │
   │           │             │ 4. Verifica │
   │           │             │ JWT token   │
   │           │             │─────┐       │
   │           │             │     │       │
   │           │             │<────┘       │
   │           │             │             │
   │           │             │ 5. Valida   │
   │           │             │ tipo y PIN  │
   │           │             │─────┐       │
   │           │             │     │       │
   │           │             │<────┘       │
   │           │             │             │
   │           │             │ 6. Genera   │
   │           │             │ roomCode    │
   │           │             │ único       │
   │           │             │─────┐       │
   │           │             │     │       │
   │           │             │<────┘       │
   │           │             │             │
   │           │             │ 7. bcrypt   │
   │           │             │ .hash(PIN)  │
   │           │             │─────┐       │
   │           │             │     │       │
   │           │             │<────┘       │
   │           │             │             │
   │           │             │ 8. Guarda   │
   │           │             │ sala en BD  │
   │           │             ├────────────>│
   │           │             │             │
   │           │             │ 9. Confirma │
   │           │             │<────────────┤
   │           │             │             │
   │           │ 10. {room   │             │
   │           │ Code, type} │             │
   │           │<────────────┤             │
   │           │             │             │
   │ 11. Muestra│             │             │
   │ roomCode   │             │             │
   │<──────────┤             │             │
   │           │             │             │
```

---

## Diagrama de Secuencia 3: Usuario Entra a Sala

```
┌───────┐  ┌────────┐  ┌─────────┐  ┌────────┐  ┌────────┐
│Usuario│  │Frontend│  │Socket.io│  │Backend │  │MongoDB │
└───┬───┘  └───┬────┘  └────┬────┘  └───┬────┘  └───┬────┘
    │          │            │           │           │
    │ 1. Ingresa roomCode, │           │           │
    │ PIN, nickname        │           │           │
    ├─────────>│            │           │           │
    │          │            │           │           │
    │          │ 2. socket  │           │           │
    │          │ .connect() │           │           │
    │          ├───────────>│           │           │
    │          │            │           │           │
    │          │            │ 3. connected          │
    │          │<───────────┤           │           │
    │          │            │           │           │
    │          │ 4. emit    │           │           │
    │          │ 'join_room'│           │           │
    │          │ {roomCode, │           │           │
    │          │ pin,       │           │           │
    │          │ nickname,  │           │           │
    │          │ deviceId}  │           │           │
    │          ├───────────>│──────────>│           │
    │          │            │           │           │
    │          │            │           │ 5. Busca  │
    │          │            │           │ sala      │
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │ 6. Sala   │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │            │           │ 7. bcrypt │
    │          │            │           │ .compare  │
    │          │            │           │ (pin,hash)│
    │          │            │           │─────┐     │
    │          │            │           │     │     │
    │          │            │           │<────┘     │
    │          │            │           │           │
    │          │            │           │ 8. Verifica
    │          │            │           │ nickname  │
    │          │            │           │ único     │
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │            │           │ 9. Verifica
    │          │            │           │ sesión    │
    │          │            │           │ única     │
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │            │           │ 10. Crea  │
    │          │            │           │ sesión    │
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │ 11. emit   │           │           │
    │          │ 'joined_   │           │           │
    │          │ room'      │           │           │
    │          │<───────────│<──────────┤           │
    │          │            │           │           │
    │ 12. UI   │            │           │           │
    │ actualiza│            │           │           │
    │<─────────┤            │           │           │
    │          │            │           │           │
    │          │            │ 13. broadcast         │
    │          │            │ 'user_joined'         │
    │          │            │ a otros usuarios      │
    │          │            │           │           │
```

---

## Diagrama de Secuencia 4: Envío de Mensaje

```
┌───────┐  ┌────────┐  ┌─────────┐  ┌────────┐  ┌────────┐
│Usuario│  │Frontend│  │Socket.io│  │Backend │  │MongoDB │
└───┬───┘  └───┬────┘  └────┬────┘  └───┬────┘  └───┬────┘
    │          │            │           │           │
    │ 1. Escribe mensaje   │           │           │
    ├─────────>│            │           │           │
    │          │            │           │           │
    │          │ 2. emit    │           │           │
    │          │ 'send_     │           │           │
    │          │ message'   │           │           │
    │          ├───────────>│──────────>│           │
    │          │            │           │           │
    │          │            │           │ 3. Valida │
    │          │            │           │ sesión    │
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │            │           │ 4. Sanitiza
    │          │            │           │ contenido │
    │          │            │           │─────┐     │
    │          │            │           │     │     │
    │          │            │           │<────┘     │
    │          │            │           │           │
    │          │            │           │ 5. Guarda │
    │          │            │           │ mensaje   │
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │ 6. OK     │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │            │           │ 7. Actualiza
    │          │            │           │ lastActivity
    │          │            │           ├──────────>│
    │          │            │           │           │
    │          │            │           │<──────────┤
    │          │            │           │           │
    │          │            │ 8. io.to(roomCode)    │
    │          │            │ .emit('new_message')  │
    │          │            │<──────────┤           │
    │          │            │           │           │
    │          │ 9. Evento  │           │           │
    │          │ 'new_      │           │           │
    │          │ message'   │           │           │
    │          │<───────────┤           │           │
    │          │            │           │           │
    │ 10. Muestra          │           │           │
    │ mensaje  │            │           │           │
    │<─────────┤            │           │           │
    │          │            │           │           │
    │          │  Todos los usuarios de la sala    │
    │          │  reciben el mismo mensaje         │
    │          │            │           │           │
```

---

## Diagrama de Secuencia 5: Subida de Archivo (Multimedia)

```
┌───────┐  ┌────────┐  ┌────────┐  ┌─────────┐  ┌────────┐
│Usuario│  │Frontend│  │Backend │  │Socket.io│  │MongoDB │
└───┬───┘  └───┬────┘  └───┬────┘  └────┬────┘  └───┬────┘
    │          │           │            │           │
    │ 1. Selecciona      │            │           │
    │ archivo  │           │            │           │
    ├─────────>│           │            │           │
    │          │           │            │           │
    │          │ 2. POST   │            │           │
    │          │ /api/rooms│            │           │
    │          │ /:roomCode│            │           │
    │          │ /files    │            │           │
    │          │ FormData  │            │           │
    │          ├──────────>│            │           │
    │          │           │            │           │
    │          │           │ 3. Valida  │           │
    │          │           │ sala tipo  │           │
    │          │           │ MULTIMEDIA │           │
    │          │           ├───────────>│           │
    │          │           │            │           │
    │          │           │<───────────┤           │
    │          │           │            │           │
    │          │           │ 4. Valida  │           │
    │          │           │ tipo MIME  │           │
    │          │           │ y tamaño   │           │
    │          │           │─────┐      │           │
    │          │           │     │      │           │
    │          │           │<────┘      │           │
    │          │           │            │           │
    │          │           │ 5. Genera  │           │
    │          │           │ nombre     │           │
    │          │           │ seguro     │           │
    │          │           │─────┐      │           │
    │          │           │     │      │           │
    │          │           │<────┘      │           │
    │          │           │            │           │
    │          │           │ 6. Guarda  │           │
    │          │           │ archivo en │           │
    │          │           │ /uploads/  │           │
    │          │           │─────┐      │           │
    │          │           │     │      │           │
    │          │           │<────┘      │           │
    │          │           │            │           │
    │          │           │ 7. Crea    │           │
    │          │           │ mensaje    │           │
    │          │           │ tipo FILE  │           │
    │          │           ├───────────────────────>│
    │          │           │            │           │
    │          │           │<───────────────────────┤
    │          │           │            │           │
    │          │ 8. {fileUrl            │           │
    │          │ messageId} │            │           │
    │          │<──────────┤            │           │
    │          │           │            │           │
    │          │           │ 9. io.to(roomCode)     │
    │          │           │ .emit('new_message')   │
    │          │           ├───────────>│           │
    │          │           │            │           │
    │          │           │            │ 10. Broadcast
    │          │<──────────────────────┤            │
    │          │           │            │           │
    │ 11. Muestra         │            │           │
    │ archivo  │           │            │           │
    │<─────────┤           │            │           │
    │          │           │            │           │
```

---

## Modelo de Datos

### Colección: `admins`

```javascript
{
  _id: ObjectId,
  username: String (unique, required),
  passwordHash: String (required),
  createdAt: Date (default: now)
}
```

### Colección: `rooms`

```javascript
{
  _id: ObjectId,
  roomCode: String (unique, required),
  pinHash: String (required),
  type: String (enum: ['TEXT', 'MULTIMEDIA']),
  maxFileSizeMB: Number (default: 10),
  createdBy: ObjectId (ref: Admin),
  createdAt: Date (default: now),
  status: String (enum: ['ACTIVE', 'CLOSED'])
}
```

### Colección: `messages`

```javascript
{
  _id: ObjectId,
  roomId: ObjectId (ref: Room, required),
  senderNickname: String (required),
  type: String (enum: ['TEXT', 'FILE']),
  content: String (required),
  fileUrl: String (nullable),
  fileMimeType: String (nullable),
  fileSizeBytes: Number (nullable),
  createdAt: Date (default: now)
}
```

### Colección: `sessions`

```javascript
{
  _id: ObjectId,
  roomId: ObjectId (ref: Room, required),
  deviceId: String (required, indexed),
  nickname: String (required),
  socketId: String (required, unique),
  createdAt: Date (default: now),
  lastActivityAt: Date (default: now),
  isActive: Boolean (default: true)
}

// Índices
{deviceId: 1, isActive: 1}
{roomId: 1, isActive: 1}
```

---

## Flujo de Concurrencia

### Manejo de Múltiples Usuarios Simultáneos

```
┌─────────────────────────────────────────────────────┐
│          Event Loop (Node.js)                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  Socket.io Event Handler (Asíncrono)        │  │
│  │                                              │  │
│  │  Usuario 1 → join_room ───┐                │  │
│  │  Usuario 2 → join_room ───┼─→ Queue        │  │
│  │  Usuario 3 → send_message ┘                │  │
│  │                                              │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Procesamiento Paralelo              │  │  │
│  │  │                                       │  │  │
│  │  │  Task 1: Validar PIN ────────────┐  │  │  │
│  │  │  Task 2: Verificar nickname ─────┼──┼──┼  │
│  │  │  Task 3: Guardar mensaje ────────┘  │  │  │
│  │  │                                       │  │  │
│  │  │  Todos se ejecutan sin bloquear      │  │  │
│  │  │  gracias a async/await               │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  MongoDB Connection Pool                    │  │
│  │  (Múltiples conexiones simultáneas)         │  │
│  │                                              │  │
│  │  Connection 1 ──→ Query sesiones            │  │
│  │  Connection 2 ──→ Insert mensaje            │  │
│  │  Connection 3 ──→ Update lastActivity       │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  bcrypt (CPU-bound tasks)                   │  │
│  │  Se pueden mover a Worker Threads           │  │
│  │  si la carga es muy alta                    │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Características de Concurrencia

1. **I/O No Bloqueante**
   - Todas las operaciones de BD son asíncronas
   - Socket.io maneja múltiples conexiones concurrentes

2. **Event Loop de Node.js**
   - Procesa múltiples eventos simultáneamente
   - No bloquea el thread principal

3. **Connection Pool de MongoDB**
   - Múltiples conexiones para consultas paralelas
   - Configuración por defecto: 5 conexiones

4. **Broadcast Eficiente**
   - Socket.io optimiza el envío a múltiples clientes
   - Usa rooms para segmentar usuarios

---

## Seguridad - Diagrama de Flujo

```
┌─────────────────────────────────────────┐
│  Request Entrante                       │
└──────────────┬──────────────────────────┘
               │
               ▼
        ┌─────────────┐
        │  Helmet     │ ← Headers de seguridad
        │  Middleware │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │    CORS     │ ← Solo frontend autorizado
        │  Middleware │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │ Rate Limit  │ ← Prevenir abuso
        │  (opcional) │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │  JWT Auth   │ ← Validar token (admin)
        │  Middleware │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │ Validators  │ ← Sanitizar inputs
        │             │   Validar formatos
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │  Business   │
        │    Logic    │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │   MongoDB   │ ← Datos encriptados
        │             │   (PINs hasheados)
        └─────────────┘
```

---

## Escalabilidad

### Escenario Actual (Single Instance)

```
        ┌──────────────┐
        │   Cliente 1  │─┐
        └──────────────┘ │
        ┌──────────────┐ │     ┌──────────────┐
        │   Cliente 2  │─┼────→│   Servidor   │
        └──────────────┘ │     │   Node.js    │
        ┌──────────────┐ │     └──────┬───────┘
        │   Cliente N  │─┘            │
        └──────────────┘              │
                                      │
                              ┌───────▼────────┐
                              │    MongoDB     │
                              └────────────────┘
```

### Escenario Escalable (Load Balancer + Redis)

```
        ┌──────────────┐
        │   Cliente 1  │─┐
        └──────────────┘ │
        ┌──────────────┐ │     ┌─────────────────┐
        │   Cliente 2  │─┼────→│ Load Balancer   │
        └──────────────┘ │     │    (Nginx)      │
        ┌──────────────┐ │     └────────┬────────┘
        │   Cliente N  │─┘              │
        └──────────────┘                │
                          ┌─────────────┼──────────────┐
                          │             │              │
                   ┌──────▼──────┐ ┌───▼─────┐ ┌──────▼──────┐
                   │ Servidor 1  │ │Server 2 │ │ Servidor 3  │
                   │  Node.js    │ │Node.js  │ │  Node.js    │
                   └──────┬──────┘ └───┬─────┘ └──────┬──────┘
                          │            │              │
                          └────────────┼──────────────┘
                                       │
                          ┌────────────┼──────────────┐
                          │            │              │
                   ┌──────▼──────┐ ┌──▼───────┐ ┌────▼──────┐
                   │   MongoDB   │ │  Redis   │ │  Storage  │
                   │  (Replica   │ │ (Session)│ │  (Files)  │
                   │    Set)     │ │          │ │           │
                   └─────────────┘ └──────────┘ └───────────┘
```

---

**Documento de Arquitectura - Chat 2.0**
*Versión 1.0 - Noviembre 2025*
