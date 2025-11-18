# Frontend Dockerfile - Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Variable de entorno para indicar que estamos en Docker
ENV DOCKER_BUILD=true

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de producción
RUN npm run build

# Stage 2: Servidor de producción con nginx
FROM nginx:alpine

# Instalar OpenSSL para generar certificados
RUN apk add --no-cache openssl

# Copiar build al directorio de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Crear directorio para certificados
RUN mkdir -p /etc/nginx/certs

# Exponer puertos HTTP y HTTPS
EXPOSE 80 443

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]
