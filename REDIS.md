# Redis para Caching de Sesiones

## 📋 Descripción

El sistema usa Redis como cache de alta velocidad para gestionar sesiones únicas por dispositivo (IP). Esto mejora significativamente el rendimiento al evitar consultas constantes a MongoDB.

## 🚀 Instalación de Redis

### Windows

1. **Descargar Redis para Windows:**
   - Descarga desde: https://github.com/microsoftarchive/redis/releases
   - O usa WSL2 con Ubuntu

2. **Instalar con WSL2 (Recomendado):**
   ```bash
   wsl --install
   # Después de reiniciar:
   wsl
   sudo apt update
   sudo apt install redis-server
   ```

3. **Instalar con Chocolatey:**
   ```powershell
   choco install redis-64
   ```

### Iniciar Redis

**WSL2/Linux:**
```bash
sudo service redis-server start
```

**Windows (nativo):**
```powershell
redis-server
```

### Verificar que Redis está corriendo

```bash
redis-cli ping
# Debería responder: PONG
```

## ⚙️ Configuración

El archivo `.env` ya tiene las configuraciones necesarias:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SESSION_TTL=1800
```

### Variables de entorno:

- **REDIS_HOST**: Host de Redis (default: localhost)
- **REDIS_PORT**: Puerto de Redis (default: 6379)
- **REDIS_PASSWORD**: Contraseña de Redis (opcional)
- **REDIS_SESSION_TTL**: Tiempo de vida de sesiones en segundos (default: 1800 = 30 min)

## 🔧 Funcionamiento

### Flujo de validación de sesiones:

1. **Usuario intenta unirse a sala**
   ```
   Cliente → Backend → Redis (check cache)
   ```

2. **Si está en Redis (CACHE HIT)**
   ```
   Redis → Sesión encontrada → Validar y responder
   ⚡ Ultra rápido (~1ms)
   ```

3. **Si NO está en Redis (CACHE MISS)**
   ```
   Redis → Not found → MongoDB → Buscar sesión
   → Si existe → Guardar en Redis para próxima vez
   🐢 Más lento (~10-50ms) solo la primera vez
   ```

### Operaciones en Redis:

- **SET**: `session:{IP}` → Guarda sesión activa
- **GET**: `session:{IP}` → Obtiene sesión activa
- **DEL**: `session:{IP}` → Elimina sesión al desconectar
- **EXPIRE**: Actualiza TTL en cada actividad

## 📊 Beneficios

✅ **Rendimiento**: 10-50x más rápido que MongoDB para sesiones  
✅ **Escalabilidad**: Maneja miles de sesiones concurrentes  
✅ **Auto-expiración**: TTL automático, no requiere limpieza manual  
✅ **Fallback**: Si Redis falla, usa MongoDB automáticamente  

## 🔍 Monitoreo

### Ver sesiones activas en Redis:

```bash
redis-cli
> KEYS session:*
> GET session:192.168.1.100
```

### Ver estadísticas:

```bash
redis-cli
> INFO stats
> DBSIZE
```

### Limpiar todas las sesiones:

```bash
redis-cli
> FLUSHDB
```

## 🛠️ Comandos útiles

```bash
# Ver logs de Redis
redis-cli MONITOR

# Ver memoria usada
redis-cli INFO memory

# Ver todas las claves
redis-cli KEYS *

# Borrar sesión específica
redis-cli DEL session:192.168.1.100

# Ver tiempo restante de una sesión
redis-cli TTL session:192.168.1.100
```

## ⚠️ Notas importantes

- Redis es **opcional**: Si no está disponible, el sistema funciona con MongoDB
- Las sesiones en Redis se **auto-eliminan** después del TTL
- Redis guarda datos en **RAM**: Es volátil, se pierde al reiniciar
- Para producción, configura Redis con persistencia (RDB o AOF)

## 🐛 Troubleshooting

### Redis no conecta:

```bash
# Verificar si está corriendo
redis-cli ping

# Si no responde, iniciar:
sudo service redis-server start  # Linux/WSL
redis-server                      # Windows
```

### Error de conexión:

```
⚠️ Redis no disponible, usando solo MongoDB
```

Esto es **normal** si Redis no está instalado. El sistema funciona sin problemas con MongoDB.

### Cambiar puerto o host:

Edita el archivo `.env`:
```env
REDIS_HOST=tu-servidor-redis.com
REDIS_PORT=6380
REDIS_PASSWORD=tu-password-seguro
```

## 📈 Producción

Para ambiente de producción:

1. **Habilitar persistencia:**
   ```bash
   # Editar redis.conf
   save 900 1
   save 300 10
   save 60 10000
   ```

2. **Configurar contraseña:**
   ```bash
   # redis.conf
   requirepass tu-password-seguro
   ```

3. **Usar Redis Cluster** para alta disponibilidad

4. **Monitorear con Redis Insight** o similar
