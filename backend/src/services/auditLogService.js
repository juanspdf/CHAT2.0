const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

/**
 * Servicio de Logs de Auditoría Inmutables
 */
class AuditLogService {
  constructor() {
    this.secretKey = process.env.AUDIT_SECRET_KEY || 'audit-secret-key-change-in-production';
    this.genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  }

  /**
   * Obtiene el último bloque de la cadena
   * @returns {Promise<Object>} Último bloque o null si es el primero
   */
  async getLastBlock() {
    try {
      const lastBlock = await AuditLog.findOne()
        .sort({ blockNumber: -1 })
        .lean();
      
      return lastBlock;
    } catch (error) {
      console.error('Error obteniendo último bloque:', error);
      return null;
    }
  }

  /**
   * Calcula el hash de un bloque
   * @param {Object} blockData - Datos del bloque
   * @returns {string} Hash SHA-256
   */
  calculateBlockHash(blockData) {
    const content = JSON.stringify({
      blockNumber: blockData.blockNumber,
      timestamp: blockData.timestamp,
      action: blockData.action,
      actor: blockData.actor,
      ipAddress: blockData.ipAddress,
      eventData: blockData.eventData,
      previousHash: blockData.previousHash
    });
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Genera una firma digital (HMAC) del bloque
   * @param {string} blockHash - Hash del bloque
   * @returns {string} Firma HMAC
   */
  signBlock(blockHash) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(blockHash)
      .digest('hex');
  }

  /**
   * Hashea el user agent para fingerprinting
   * @param {string} userAgent - User agent del cliente
   * @returns {string} Hash del user agent
   */
  hashUserAgent(userAgent) {
    if (!userAgent) return null;
    return crypto.createHash('sha256').update(userAgent).digest('hex');
  }

  /**
   * Crea un nuevo log de auditoría (bloque en la cadena)
   * @param {Object} logData - Datos del log
   * @returns {Promise<Object>} Log creado
   */
  async createLog(logData) {
    try {
      // Contar documentos para obtener el siguiente blockNumber
      const count = await AuditLog.countDocuments();
      const blockNumber = count;
      
      // Obtener el bloque anterior para el previousHash
      const lastBlock = blockNumber > 0 
        ? await AuditLog.findOne().sort({ blockNumber: -1 })
        : null;
      
      const previousHash = lastBlock ? lastBlock.hash : '0';
      
      const timestamp = new Date();
      
      // Construir datos para hash
      const hashData = [
        blockNumber,
        timestamp.toISOString(),
        logData.action,
        logData.actor,
        logData.target || '',
        logData.ipAddress || '',
        JSON.stringify(logData.details || {}),
        previousHash
      ].join('|');
      
      const hash = crypto.createHash('sha256').update(hashData).digest('hex');
      
      // Crear el log
      const auditLog = new AuditLog({
        blockNumber,
        timestamp,
        action: logData.action,
        actor: logData.actor,
        target: logData.target,
        ipAddress: logData.ipAddress,
        deviceFingerprint: logData.deviceFingerprint,
        details: logData.details || {},
        previousHash,
        hash
      });
      
      await auditLog.save();
      
      console.log(`📝 Log de auditoría creado: Bloque #${blockNumber} - ${logData.action}`);
      
      return auditLog.toObject();
    } catch (error) {
      console.error('Error creando log de auditoría:', error);
      throw error;
    }
  }

  /**
   * Verifica la integridad de la cadena de logs
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verifyChainIntegrity() {
    try {
      const blocks = await AuditLog.find({}).sort({ blockNumber: 1 });
      
      if (blocks.length === 0) {
        return { 
          isValid: true, 
          totalBlocks: 0, 
          errors: [],
          message: 'No hay bloques para verificar' 
        };
      }
      
      const errors = [];
      
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        
        // Recalcular hash del bloque
        const recalculatedHash = block.recalculateHash();
        
        // Verificar que el hash coincida
        if (recalculatedHash !== block.hash) {
          errors.push({
            block: block.blockNumber,
            error: 'Hash del bloque no coincide',
            expected: recalculatedHash,
            actual: block.hash
          });
        }
        
        // Verificar enlace con bloque anterior (excepto el génesis)
        if (i > 0) {
          const previousBlock = blocks[i - 1];
          if (block.previousHash !== previousBlock.hash) {
            errors.push({
              block: block.blockNumber,
              error: 'Cadena rota: previousHash no coincide',
              expected: previousBlock.hash,
              actual: block.previousHash
            });
          }
        }
      }
      
      return {
        isValid: errors.length === 0,
        totalBlocks: blocks.length,
        errors,
        message: errors.length === 0 
          ? '✅ Integridad de la cadena verificada correctamente'
          : `❌ Se encontraron ${errors.length} errores de integridad`
      };
    } catch (error) {
      console.error('Error verificando integridad:', error);
      throw error;
    }
  }

  /**
   * Obtiene logs por acción
   * @param {string} action - Tipo de acción
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Logs encontrados
   */
  async getLogsByAction(action, limit = 100) {
    return await AuditLog.find({ action })
      .sort({ blockNumber: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Obtiene logs por actor
   * @param {string} actorId - ID del actor
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Logs encontrados
   */
  async getLogsByActor(actorId, limit = 100) {
    return await AuditLog.find({ actor: actorId })
      .sort({ blockNumber: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Obtiene logs en un rango de fechas
   * @param {Date} startDate - Fecha inicio
   * @param {Date} endDate - Fecha fin
   * @returns {Promise<Array>} Logs encontrados
   */
  async getLogsByDateRange(startDate, endDate) {
    return await AuditLog.find({
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ blockNumber: -1 }).lean();
  }
}

module.exports = new AuditLogService();
