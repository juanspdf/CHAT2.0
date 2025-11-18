# 📊 Diagramas de Secuencia - Flujos de Seguridad

Este documento contiene los diagramas de secuencia para los principales flujos de seguridad del sistema CHAT 2.0.

---

## 1. Flujo de Autenticación con 2FA

```mermaid
sequenceDiagram
    participant U as Usuario (Admin)
    participant FE as Frontend
    participant BE as Backend
    participant DB as MongoDB
    participant GA as Google Authenticator

    Note over U,GA: Fase 1: Configuración Inicial
    U->>FE: Click "Habilitar 2FA"
    FE->>BE: POST /api/2fa/setup
    BE->>BE: speakeasy.generateSecret()
    BE->>DB: Guardar secret temporal (not verified)
    BE->>BE: qrcode.toDataURL(otpauth_url)
    BE-->>FE: { qrCode, backupCodes }
    FE->>U: Mostrar QR code + códigos respaldo
    U->>GA: Escanear QR code
    GA-->>U: Token de 6 dígitos

    Note over U,GA: Fase 2: Verificación Setup
    U->>FE: Ingresar token inicial
    FE->>BE: POST /api/2fa/verify-setup { token }
    BE->>BE: speakeasy.totp.verify(token, secret)
    alt Token válido
        BE->>DB: Marcar 2FA como habilitado (twoFactorEnabled: true)
        BE-->>FE: { success: true }
        FE->>U: "2FA habilitado correctamente"
    else Token inválido
        BE-->>FE: { error: "Token inválido" }
        FE->>U: Mostrar error
    end

    Note over U,GA: Fase 3: Login con 2FA
    U->>FE: Ingresar usuario/contraseña
    FE->>BE: POST /api/auth/login { email, password }
    BE->>DB: User.findOne({ email })
    BE->>BE: bcrypt.compare(password, hash)
    alt Contraseña correcta
        BE->>DB: Verificar twoFactorEnabled
        alt 2FA habilitado
            BE-->>FE: { require2FA: true, sessionTemp }
            FE->>U: Solicitar token TOTP
            U->>GA: Leer token actual
            GA-->>U: Token de 6 dígitos
            U->>FE: Ingresar token
            FE->>BE: POST /api/2fa/verify { token, sessionTemp }
            BE->>BE: speakeasy.totp.verify(token, secret, ±60s)
            alt Token válido
                BE->>BE: jwt.sign(accessToken + refreshToken)
                BE->>DB: Session.create({ deviceFingerprint, nicknameHash })
                BE-->>FE: { accessToken, refreshToken }
                FE->>FE: Guardar tokens (memoria + httpOnly cookie)
                FE->>U: Redirigir a dashboard
            else Token inválido
                BE-->>FE: { error: "Token 2FA inválido" }
                FE->>U: Mostrar error
            end
        else 2FA deshabilitado
            BE->>BE: jwt.sign(tokens)
            BE-->>FE: { accessToken, refreshToken }
        end
    else Contraseña incorrecta
        BE-->>FE: { error: "Credenciales inválidas" }
    end
```

---

## 2. Flujo de Cifrado End-to-End

```mermaid
sequenceDiagram
    participant A as Admin (Creador Sala)
    participant FE1 as Frontend Admin
    participant BE as Backend
    participant Redis as Redis Cache
    participant DB as MongoDB
    participant FE2 as Frontend Usuario
    participant U as Usuario

    Note over A,U: Fase 1: Creación de Sala con E2E
    A->>FE1: Crear sala "SecretRoom" con E2E=true
    FE1->>BE: POST /api/rooms/create { name, e2eEnabled: true }
    BE->>BE: encryptionService.generateRoomKey()
    Note right of BE: AES-256-GCM<br/>key: 256 bits<br/>iv: 128 bits
    BE->>DB: Room.create({ name, e2eEnabled: true })
    BE->>Redis: SETEX room:{roomId}:key {key, iv} EX 3600
    BE-->>FE1: { roomId, encryptionKey, iv }
    FE1->>FE1: localStorage.setItem('room_key', encryptionKey)
    FE1->>A: Sala creada (mostrar clave o QR)

    Note over A,U: Fase 2: Usuario Se Une a Sala
    U->>FE2: Click "Unirse a SecretRoom"
    FE2->>BE: POST /api/rooms/join { roomId }
    BE->>DB: Room.findById(roomId)
    alt E2E habilitado
        BE->>Redis: GET room:{roomId}:key
        alt Clave en cache
            Redis-->>BE: { key, iv }
        else Clave expirada
            BE->>BE: Rechazar (admin debe re-generar clave)
            BE-->>FE2: { error: "Clave expirada" }
        end
        BE-->>FE2: { encryptionKey, iv }
        FE2->>FE2: localStorage.setItem('room_key', encryptionKey)
        FE2->>U: "Sala E2E activada 🔒"
    else E2E deshabilitado
        BE-->>FE2: { encryptionKey: null }
    end

    Note over A,U: Fase 3: Envío de Mensaje Cifrado
    A->>FE1: Escribir mensaje "Secreto importante"
    FE1->>FE1: const key = localStorage.getItem('room_key')
    FE1->>FE1: encryptMessage(message, key, iv)
    Note right of FE1: AES-256-GCM<br/>Output: {encrypted, tag}
    FE1->>BE: socket.emit('message', { encrypted, tag, iv })
    BE->>BE: generateHMAC(encrypted, roomSecret)
    BE->>DB: Message.create({ encrypted, tag, hmac })
    Note right of BE: NO se guarda plaintext
    BE->>Redis: PUBLISH room:{roomId} { encrypted, tag, hmac }
    BE->>FE2: socket.broadcast('message', { encrypted, tag, hmac })

    Note over A,U: Fase 4: Recepción y Descifrado
    FE2->>FE2: const key = localStorage.getItem('room_key')
    FE2->>FE2: verifyHMAC(encrypted, hmac)
    alt HMAC válido
        FE2->>FE2: decryptMessage(encrypted, key, iv, tag)
        alt Tag GCM válido
            FE2->>U: Mostrar "Secreto importante"
        else Tag inválido (mensaje alterado)
            FE2->>U: ⚠️ "Mensaje corrupto o alterado"
        end
    else HMAC inválido
        FE2->>U: ⚠️ "Firma inválida - mensaje rechazado"
    end
```

---

## 3. Flujo de Subida de Archivo con Análisis de Esteganografía

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend (Main Thread)
    participant WM as WorkerManager
    participant W as Worker Thread
    participant SD as SteganographyDetector
    participant DB as MongoDB
    participant Audit as AuditLog Service

    Note over U,Audit: Fase 1: Selección y Subida
    U->>FE: Seleccionar archivo (imagen.png)
    FE->>FE: Validar tamaño (<10MB) y tipo MIME
    alt Validación exitosa
        FE->>BE: POST /api/upload (FormData)
        Note right of FE: multer multipart/form-data
    else Archivo muy grande
        FE->>U: ⚠️ "Archivo excede 10MB"
    end

    Note over U,Audit: Fase 2: Recepción y Queue
    BE->>BE: multer.single('file')
    BE->>BE: Extraer { buffer, filename, mimetype }
    BE->>WM: analyzeFile(buffer, filename, mimetype)
    WM->>WM: Verificar workers disponibles
    alt Worker disponible
        WM->>W: worker.postMessage({ fileBuffer, filename, mimetype })
    else Todos ocupados
        WM->>WM: Encolar tarea (queue.push)
        WM-->>BE: { queued: true }
        BE->>FE: "Análisis en cola (posición N)"
    end

    Note over U,Audit: Fase 3: Análisis en Worker
    W->>SD: steganographyDetector.analyzeFile()
    
    par Análisis Paralelo (5 Técnicas)
        SD->>SD: calculateEntropy(buffer)
        Note right of SD: Umbral: 7.5<br/>Peso: 30%
    and
        SD->>SD: analyzeLSB(buffer)
        Note right of SD: Ideal: 0.5<br/>Peso: 25%
    and
        SD->>SD: chiSquareTest(buffer)
        Note right of SD: Umbral: 350<br/>Peso: 25%
    and
        SD->>SD: detectPatterns(buffer)
        Note right of SD: Chunks: 16 bytes<br/>Peso: 15%
    and
        SD->>SD: extractMetadata(buffer, mimetype)
        Note right of SD: Magic bytes<br/>Peso: 5%
    end

    SD->>SD: Calcular riskScore (0-100)
    SD->>SD: Determinar veredicto:
    Note right of SD: APROBADO (0-19)<br/>ADVERTENCIA (20-39)<br/>ALERTA (40-69)<br/>RECHAZADO (70-100)

    SD-->>W: { verdict, riskScore, details, analysisTime }
    W->>WM: worker.postMessage({ taskId, result })
    WM-->>BE: Promise.resolve(result)

    Note over U,Audit: Fase 4: Decisión y Almacenamiento
    alt Veredicto: APROBADO o ADVERTENCIA
        BE->>DB: File.create({ filename, verdict, riskScore })
        BE->>Audit: createLog({ action: 'FILE_UPLOAD_APPROVED' })
        BE->>FE: { success: true, verdict, riskScore }
        FE->>U: ✅ "Archivo aprobado (Score: X)"
    else Veredicto: ALERTA
        BE->>DB: File.create({ filename, verdict, flagged: true })
        BE->>Audit: createLog({ action: 'FILE_UPLOAD_FLAGGED' })
        BE->>FE: { success: true, verdict, warning: true }
        FE->>U: ⚠️ "Archivo almacenado pero sospechoso"
    else Veredicto: RECHAZADO
        BE->>Audit: createLog({ action: 'FILE_UPLOAD_REJECTED', details })
        BE-->>FE: { error: "Archivo rechazado", riskScore }
        FE->>U: ❌ "Archivo contiene esteganografía (Score: X)"
    end

    Note over U,Audit: Fase 5: Worker Cleanup
    WM->>WM: Marcar worker como disponible
    alt Hay tareas en cola
        WM->>WM: queue.shift()
        WM->>W: Procesar siguiente tarea
    end
```

---

## 4. Flujo de Rotación de Tokens JWT

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant Redis as Redis
    participant DB as MongoDB

    Note over U,DB: Fase 1: Login Inicial
    U->>FE: Login (email, password, 2FA)
    FE->>BE: POST /api/auth/login
    BE->>BE: Verificar credenciales + 2FA
    BE->>BE: jwt.sign(accessToken, { exp: 15m })
    BE->>BE: jwt.sign(refreshToken, { exp: 7d })
    BE-->>FE: { accessToken, refreshToken (httpOnly cookie) }
    FE->>FE: Guardar accessToken en memoria
    Note right of FE: NO localStorage (seguridad XSS)

    Note over U,DB: Fase 2: Uso Normal (Access Token Válido)
    loop Requests API (< 15 minutos)
        U->>FE: Acción (enviar mensaje, subir archivo)
        FE->>BE: API Request + Authorization: Bearer {accessToken}
        BE->>BE: jwt.verify(accessToken)
        alt Token válido
            BE->>BE: Ejecutar acción
            BE-->>FE: { success: true, data }
        else Token expirado
            BE-->>FE: 401 Unauthorized { error: "Token expired" }
            Note over FE: Trigger renovación automática
        end
    end

    Note over U,DB: Fase 3: Renovación Automática (Access Token Expirado)
    FE->>FE: Interceptor detecta 401
    FE->>BE: POST /api/auth/refresh (refreshToken en cookie)
    BE->>BE: jwt.verify(refreshToken)
    alt Refresh Token válido
        BE->>Redis: GET blacklist:{refreshToken}
        alt No está en blacklist
            BE->>DB: User.findById(decoded.userId)
            BE->>BE: jwt.sign(newAccessToken, { exp: 15m })
            BE->>BE: jwt.sign(newRefreshToken, { exp: 7d })
            BE->>Redis: SETEX blacklist:{oldRefreshToken} 604800 "1"
            Note right of BE: 7 días = 604800 segundos
            BE-->>FE: { accessToken: newAccessToken, refreshToken: newRefreshToken }
            FE->>FE: Actualizar accessToken en memoria
            FE->>BE: Reintentar request original
            BE-->>FE: { success: true, data }
        else Token en blacklist (revocado)
            BE-->>FE: 401 Unauthorized { error: "Token revoked" }
            FE->>FE: Limpiar tokens
            FE->>U: Redirigir a /login
        end
    else Refresh Token inválido/expirado
        BE-->>FE: 401 Unauthorized { error: "Invalid refresh token" }
        FE->>FE: Limpiar tokens
        FE->>U: Redirigir a /login
    end

    Note over U,DB: Fase 4: Logout Manual
    U->>FE: Click "Cerrar Sesión"
    FE->>BE: POST /api/auth/logout (refreshToken en cookie)
    BE->>Redis: SETEX blacklist:{refreshToken} 604800 "1"
    BE->>BE: res.clearCookie('refreshToken')
    BE-->>FE: { success: true }
    FE->>FE: Limpiar accessToken de memoria
    FE->>U: Redirigir a /login

    Note over U,DB: Fase 5: Rotación de Secret (Mensual)
    Note over BE: CronJob ejecuta cada 1er día del mes
    BE->>BE: crypto.randomBytes(64).toString('hex')
    BE->>BE: Actualizar JWT_SECRET en .env
    BE->>Redis: FLUSHDB (limpiar blacklist)
    BE->>DB: Session.deleteMany({}) (invalidar todas las sesiones)
    Note over BE: Todos los usuarios deben re-login
```

---

## 5. Flujo de Verificación de Integridad de Audit Logs

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant FE as Frontend
    participant BE as Backend
    participant AL as AuditLogService
    participant DB as MongoDB

    Note over Admin,DB: Fase 1: Creación de Log (Hash Chain)
    Admin->>FE: Acción (login, upload, delete)
    FE->>BE: Ejecutar acción
    BE->>AL: createLog({ action, actor, details })
    AL->>DB: AuditLog.countDocuments()
    DB-->>AL: count = N
    AL->>DB: AuditLog.findOne().sort({ blockNumber: -1 })
    DB-->>AL: { blockNumber: N-1, hash: prevHash }
    AL->>AL: Calcular nuevo hash:
    Note right of AL: SHA-256(<br/>  blockNumber + <br/>  timestamp + <br/>  action + <br/>  actor + <br/>  prevHash<br/>)
    AL->>DB: AuditLog.create({ blockNumber: N, hash, previousHash: prevHash })
    DB-->>AL: Log guardado (inmutable)
    AL-->>BE: { blockNumber: N }

    Note over Admin,DB: Fase 2: Intento de Modificación (Pre-save Hook)
    Note over BE: Atacante intenta modificar log existente
    BE->>DB: AuditLog.updateOne({ _id }, { action: 'MODIFIED' })
    DB->>DB: Trigger pre-save hook
    alt isNew === false
        DB->>DB: throw Error('Logs are immutable')
        DB-->>BE: Error: Operación denegada
    end

    Note over Admin,DB: Fase 3: Verificación Manual de Integridad
    Admin->>FE: Click "Verificar Audit Logs"
    FE->>BE: GET /api/audit/verify-integrity
    BE->>AL: verifyChainIntegrity()
    AL->>DB: AuditLog.find({}).sort({ blockNumber: 1 })
    DB-->>AL: [log0, log1, log2, ..., logN]

    loop Por cada log (excepto génesis)
        AL->>AL: Verificar hash actual:
        AL->>AL: recalculatedHash = SHA-256(log.data + log.previousHash)
        alt recalculatedHash === log.hash
            Note right of AL: Hash correcto
        else Hash no coincide
            AL->>AL: errors.push({ block: i, error: 'Hash mismatch' })
        end

        AL->>AL: Verificar enlace con anterior:
        alt log.previousHash === prevLog.hash
            Note right of AL: Cadena intacta
        else previousHash no coincide
            AL->>AL: errors.push({ block: i, error: 'Broken chain' })
        end
    end

    alt errors.length === 0
        AL-->>BE: { isValid: true, totalBlocks: N, errors: [] }
        BE-->>FE: { integrity: 'PASS' }
        FE->>Admin: ✅ "Audit logs íntegros (N bloques)"
    else errors.length > 0
        AL-->>BE: { isValid: false, errors: [...] }
        BE-->>FE: { integrity: 'FAIL', errors }
        FE->>Admin: ❌ "¡ALERTA! Logs comprometidos"
        FE->>Admin: Mostrar bloques afectados
    end
```

---

## Notas Técnicas

### Leyenda de Símbolos
- `🔒` Operación cifrada
- `✅` Verificación exitosa
- `❌` Error o rechazo
- `⚠️` Advertencia

### Tiempos Promedio
- **2FA Setup**: ~30 segundos
- **Login con 2FA**: ~10 segundos
- **Cifrado E2E (mensaje)**: <50ms
- **Análisis esteganografía (1MB)**: ~200ms
- **Renovación JWT**: <100ms
- **Verificación audit chain (1000 logs)**: ~500ms

### Dependencias Críticas
- `speakeasy` v2.0.0 (2FA/TOTP)
- `jsonwebtoken` v9.0.2 (JWT)
- Node.js `crypto` module (SHA-256, AES-256-GCM)
- `worker_threads` (procesamiento paralelo)

---

**Última actualización**: Enero 2025  
**Versión**: 2.0
