# Backend Dockerfile
FROM node:18-alpine

# Instalar dependencias del sistema necesarias para compilar módulos nativos y health checks
RUN apk add --no-cache python3 make g++ curl

# Crear directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias y reconstruir módulos nativos
RUN npm ci --only=production && npm rebuild bcrypt --build-from-source

# Copiar código fuente
COPY . .

# Crear directorios
RUN mkdir -p uploads certs

# Exponer puertos (HTTP y HTTPS)
EXPOSE 5000 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Iniciar aplicación
CMD ["npm", "start"]
