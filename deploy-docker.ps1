# Script de deployment con Docker para Windows
# Uso: .\deploy-docker.ps1

Write-Host "🐳 Iniciando deployment con Docker..." -ForegroundColor Cyan
Write-Host ""

# Verificar que Docker está instalado
Write-Host "📦 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker no está instalado" -ForegroundColor Red
    Write-Host "Descarga Docker Desktop desde: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Verificar que Docker Compose está instalado
try {
    $composeVersion = docker-compose --version
    Write-Host "✅ $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose no está instalado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verificar que Docker Desktop está corriendo
Write-Host "🔍 Verificando que Docker Desktop está corriendo..." -ForegroundColor Yellow
$retries = 0
$maxRetries = 30

while ($retries -lt $maxRetries) {
    try {
        docker ps | Out-Null
        Write-Host "✅ Docker Desktop está corriendo" -ForegroundColor Green
        break
    } catch {
        $retries++
        if ($retries -eq 1) {
            Write-Host "⏳ Docker Desktop no está corriendo. Iniciándolo..." -ForegroundColor Yellow
            Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        }
        Write-Host "   Esperando... ($retries/$maxRetries)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if ($retries -eq $maxRetries) {
    Write-Host "❌ No se pudo conectar con Docker Desktop" -ForegroundColor Red
    Write-Host "Por favor, inicia Docker Desktop manualmente y vuelve a ejecutar este script" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Preguntar si quiere limpiar contenedores anteriores
Write-Host "🧹 ¿Deseas limpiar contenedores anteriores?" -ForegroundColor Yellow
$clean = Read-Host "Escribe 'si' para limpiar, 'no' para continuar (default: no)"

if ($clean -eq "si") {
    Write-Host "Deteniendo y eliminando contenedores..." -ForegroundColor Yellow
    docker-compose down -v
    Write-Host "✅ Limpieza completada" -ForegroundColor Green
}

Write-Host ""

# Construir y levantar contenedores
Write-Host "🏗️  Construyendo imágenes..." -ForegroundColor Cyan
Write-Host ""

docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al construir las imágenes" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Levantando servicios..." -ForegroundColor Cyan
Write-Host ""

docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al levantar los servicios" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Esperando que los servicios estén listos..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verificar estado de los servicios
Write-Host ""
Write-Host "📊 Estado de los servicios:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "✅ Deployment completado!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Accede a la aplicación:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:   http://localhost:5000" -ForegroundColor White
Write-Host "   API Docs:  http://localhost:5000/health" -ForegroundColor White
Write-Host ""
Write-Host "📋 Comandos útiles:" -ForegroundColor Cyan
Write-Host "   Ver logs:           docker-compose logs -f" -ForegroundColor White
Write-Host "   Detener:            docker-compose stop" -ForegroundColor White
Write-Host "   Reiniciar:          docker-compose restart" -ForegroundColor White
Write-Host "   Eliminar todo:      docker-compose down -v" -ForegroundColor White
Write-Host ""
Write-Host "📝 Próximo paso: Crear un administrador" -ForegroundColor Yellow
Write-Host "   Abre http://localhost:5173 y usa la API para registrar el primer admin" -ForegroundColor White
Write-Host ""
