# 🐳 Despliegue con Docker

## 🚀 Inicio Rápido

### 1. Instalar Docker

**Windows:**
- Descargar [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Instalar y reiniciar

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**Mac:**
- Descargar [Docker Desktop para Mac](https://www.docker.com/products/docker-desktop)

### 2. Verificar Instalación

```bash
docker --version
docker-compose --version
```

### 3. Desplegar el Proyecto

```bash
# Clonar el repositorio
git clone https://github.com/juanspdf/CHAT2.0.git
cd CHAT2.0

# Levantar todos los servicios
docker-compose up -d
```

Esto levantará:
- ✅ **MongoDB** en puerto 27017
- ✅ **Redis** en puerto 6379
- ✅ **Backend** en puerto 5000
- ✅ **Frontend** en puerto 5173

### 4. Acceder a la Aplicación

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/health

---

## 📋 Comandos Útiles

### Ver logs en tiempo real
```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend
```

### Ver estado de los contenedores
```bash
docker-compose ps
```

### Detener los servicios
```bash
docker-compose stop
```

### Detener y eliminar contenedores
```bash
docker-compose down
```

### Detener y eliminar todo (incluye volúmenes)
```bash
docker-compose down -v
```

### Reiniciar un servicio específico
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Reconstruir imágenes
```bash
# Reconstruir todo
docker-compose build

# Reconstruir solo backend
docker-compose build backend

# Reconstruir y levantar
docker-compose up -d --build
```

### Ejecutar comandos dentro de un contenedor
```bash
# Abrir shell en backend
docker-compose exec backend sh

# Abrir shell en MongoDB
docker-compose exec mongodb mongosh

# Ver logs de npm
docker-compose exec backend npm run dev
```

---

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# JWT Secret (IMPORTANTE: cambiar en producción)
JWT_SECRET=tu-secreto-super-seguro-aqui-cambiar-en-produccion

# Opcional: MongoDB externo (ej: MongoDB Atlas)
# MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/chat-system

# Opcional: Redis password
# REDIS_PASSWORD=tu-password-redis
```

### Cambiar Puertos

Edita `docker-compose.yml` para cambiar los puertos:

```yaml
services:
  backend:
    ports:
      - "8000:5000"  # Puerto externo:interno
  
  frontend:
    ports:
      - "8080:80"
```

---

## 📊 Verificación del Deployment

### 1. Verificar que todos los servicios están corriendo

```bash
docker-compose ps
```

Deberías ver algo como:
```
NAME                IMAGE              STATUS         PORTS
chat-backend        chat20-backend     Up 2 minutes   0.0.0.0:5000->5000/tcp
chat-frontend       chat20-frontend    Up 2 minutes   0.0.0.0:5173->80/tcp
chat-mongodb        mongo:7            Up 2 minutes   0.0.0.0:27017->27017/tcp
chat-redis          redis:7-alpine     Up 2 minutes   0.0.0.0:6379->6379/tcp
```

### 2. Verificar Health Checks

```bash
# Backend
curl http://localhost:5000/health

# Frontend
curl http://localhost:5173
```

### 3. Verificar MongoDB

```bash
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### 4. Verificar Redis

```bash
docker-compose exec redis redis-cli ping
```

### 5. Ver logs del backend

```bash
docker-compose logs backend | tail -20
```

Deberías ver:
```
✅ MongoDB conectado: mongodb
✅ Redis conectado
🚀 Servidor corriendo en puerto 5000
```

---

## 🔄 Actualizar el Deployment

### Después de cambios en el código

```bash
# 1. Detener servicios
docker-compose down

# 2. Reconstruir imágenes
docker-compose build

# 3. Levantar de nuevo
docker-compose up -d

# O todo en un comando:
docker-compose up -d --build
```

### Solo actualizar backend

```bash
docker-compose up -d --build backend
```

### Solo actualizar frontend

```bash
docker-compose up -d --build frontend
```

---

## 🗄️ Gestión de Datos

### Backup de MongoDB

```bash
# Crear backup
docker-compose exec mongodb mongodump --out=/data/backup

# Copiar backup a host
docker cp chat-mongodb:/data/backup ./mongodb-backup
```

### Restaurar MongoDB

```bash
# Copiar backup al contenedor
docker cp ./mongodb-backup chat-mongodb:/data/backup

# Restaurar
docker-compose exec mongodb mongorestore /data/backup
```

### Ver archivos subidos

```bash
ls -la backend/uploads/
```

Los archivos persisten en el host en `./backend/uploads/`

---

## 🐛 Troubleshooting

### Error: puerto ya en uso

```bash
# Ver qué está usando el puerto 5000
netstat -ano | findstr :5000  # Windows
lsof -i :5000                  # Linux/Mac

# Cambiar puerto en docker-compose.yml
services:
  backend:
    ports:
      - "5001:5000"  # Usar 5001 externamente
```

### Contenedor se reinicia constantemente

```bash
# Ver logs completos
docker-compose logs backend

# Verificar health check
docker inspect chat-backend | grep -A 10 Health
```

### MongoDB no conecta

```bash
# Verificar que MongoDB está corriendo
docker-compose ps mongodb

# Ver logs de MongoDB
docker-compose logs mongodb

# Reiniciar MongoDB
docker-compose restart mongodb
```

### Frontend no carga

```bash
# Verificar build del frontend
docker-compose logs frontend

# Reconstruir frontend
docker-compose up -d --build frontend
```

### Limpiar todo y empezar de cero

```bash
# Detener todo
docker-compose down -v

# Limpiar imágenes no usadas
docker system prune -a

# Volver a levantar
docker-compose up -d --build
```

---

## 🌐 Acceso desde Otros Dispositivos

Para acceder desde otro dispositivo en la misma red:

### 1. Obtener tu IP local

**Windows:**
```powershell
ipconfig
# Buscar "Dirección IPv4"
```

**Linux/Mac:**
```bash
ifconfig
# Buscar "inet"
```

### 2. Acceder desde otro dispositivo

Si tu IP es `192.168.1.100`:

- Frontend: `http://192.168.1.100:5173`
- Backend: `http://192.168.1.100:5000`

El frontend detectará automáticamente el host y se conectará al backend correcto.

---

## 📦 Crear Administrador

Una vez levantado el proyecto:

```bash
curl -X POST http://localhost:5000/api/admin/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

O desde el navegador:
1. Ir a http://localhost:5173/admin/login
2. Usar Postman/Thunder Client para crear el primer admin

---

## 🚀 Deployment en Producción

### Opción 1: Docker Swarm (Simple)

```bash
# Inicializar swarm
docker swarm init

# Deploy
docker stack deploy -c docker-compose.yml chat-app
```

### Opción 2: Kubernetes (Avanzado)

Usar los Dockerfiles para crear imágenes y deployar en Kubernetes.

### Opción 3: Cloud Hosting

**AWS ECS, Google Cloud Run, Azure Container Instances:**

```bash
# 1. Construir imágenes
docker build -t tu-usuario/chat-backend ./backend
docker build -t tu-usuario/chat-frontend ./frontend

# 2. Subir a Docker Hub
docker push tu-usuario/chat-backend
docker push tu-usuario/chat-frontend

# 3. Deployar en tu plataforma cloud
```

---

## 📊 Monitoreo

### Ver uso de recursos

```bash
docker stats
```

### Ver tamaño de imágenes

```bash
docker images
```

### Ver volúmenes

```bash
docker volume ls
```

### Inspeccionar un contenedor

```bash
docker inspect chat-backend
```

---

## ✅ Checklist de Deployment

- [ ] Docker instalado y funcionando
- [ ] `docker-compose up -d` ejecutado exitosamente
- [ ] Todos los contenedores en estado "Up"
- [ ] Health checks pasando
- [ ] Frontend accesible en http://localhost:5173
- [ ] Backend respondiendo en http://localhost:5000/health
- [ ] MongoDB conectado (ver logs del backend)
- [ ] Redis conectado (ver logs del backend)
- [ ] Administrador creado
- [ ] Sala de prueba creada
- [ ] Chat funcionando correctamente
- [ ] Subida de archivos funcionando (en salas MULTIMEDIA)

---

**¡Listo! Tu aplicación de chat está corriendo en Docker 🎉**

Para cualquier problema, revisa los logs con `docker-compose logs -f`
