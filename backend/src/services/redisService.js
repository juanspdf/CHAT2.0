const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    // Verificar si Redis está habilitado
    if (process.env.REDIS_ENABLED === 'false') {
      console.log('ℹ️  Redis deshabilitado - usando solo MongoDB');
      this.connected = false;
      return null;
    }

    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 2) {
            console.log('⚠️  Redis no disponible - usando solo MongoDB');
            return null;
          }
          return null; // No reintentar
        },
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        showFriendlyErrorStack: false,
        connectTimeout: 1000
      });

      this.client.on('connect', () => {
        console.log('✅ Redis conectado');
        this.connected = true;
      });

      this.client.on('error', (err) => {
        // Silenciar todos los errores de conexión
        this.connected = false;
      });

      this.client.on('close', () => {
        this.connected = false;
      });

      // Intentar conectar con timeout corto
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);
      
      return this.client;
    } catch (error) {
      // Silenciar errores, simplemente no usar Redis
      this.connected = false;
      return null;
    }
  }

  // Guardar sesión activa por IP
  async setActiveSession(ip, sessionData, ttl = 3600) {
    if (!this.connected) return false;
    
    try {
      const key = `session:${ip}`;
      await this.client.setex(key, ttl, JSON.stringify(sessionData));
      console.log(`💾 Sesión guardada en Redis para IP: ${ip}`);
      return true;
    } catch (error) {
      console.error('Error guardando sesión en Redis:', error);
      return false;
    }
  }

  // Obtener sesión activa por IP
  async getActiveSession(ip) {
    if (!this.connected) return null;
    
    try {
      const key = `session:${ip}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error obteniendo sesión de Redis:', error);
      return null;
    }
  }

  // Eliminar sesión por IP
  async removeSession(ip) {
    if (!this.connected) return false;
    
    try {
      const key = `session:${ip}`;
      await this.client.del(key);
      console.log(`🗑️ Sesión eliminada de Redis para IP: ${ip}`);
      return true;
    } catch (error) {
      console.error('Error eliminando sesión de Redis:', error);
      return false;
    }
  }

  // Verificar si una IP tiene sesión activa
  async hasActiveSession(ip) {
    if (!this.connected) return false;
    
    try {
      const key = `session:${ip}`;
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Error verificando sesión en Redis:', error);
      return false;
    }
  }

  // Actualizar TTL de sesión
  async refreshSession(ip, ttl = 3600) {
    if (!this.connected) return false;
    
    try {
      const key = `session:${ip}`;
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error('Error actualizando TTL en Redis:', error);
      return false;
    }
  }

  // Obtener todas las IPs con sesiones activas
  async getAllActiveSessions() {
    if (!this.connected) return [];
    
    try {
      const keys = await this.client.keys('session:*');
      const sessions = [];
      
      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          sessions.push(JSON.parse(data));
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error obteniendo sesiones de Redis:', error);
      return [];
    }
  }

  async disconnect() {
    if (this.client && this.connected) {
      try {
        await this.client.quit();
        this.connected = false;
      } catch (err) {
        // Ignorar errores al desconectar (conexión ya cerrada)
      }
    }
  }
}

module.exports = new RedisService();
