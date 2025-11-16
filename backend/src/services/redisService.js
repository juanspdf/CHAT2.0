const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3
      });

      this.client.on('connect', () => {
        console.log('✅ Redis conectado');
        this.connected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Error en Redis:', err.message);
        this.connected = false;
      });

      this.client.on('close', () => {
        console.log('🔌 Redis desconectado');
        this.connected = false;
      });

      // Esperar a que se conecte
      await this.client.ping();
      return this.client;
    } catch (error) {
      console.warn('⚠️ Redis no disponible, usando solo MongoDB:', error.message);
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
    if (this.client) {
      await this.client.quit();
      this.connected = false;
    }
  }
}

module.exports = new RedisService();
