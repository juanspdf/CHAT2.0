const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

/**
 * Pool de Worker Threads para procesamiento paralelo
 * Maneja tareas pesadas de forma concurrente
 */
class WorkerPool {
  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.activeWorkers = 0;
    
    this.initializePool();
  }

  /**
   * Inicializa el pool de workers
   */
  initializePool() {
    for (let i = 0; i < this.poolSize; i++) {
      this.workers.push({
        id: i,
        busy: false,
        worker: null
      });
    }
    
    console.log(`🔧 Worker Pool inicializado con ${this.poolSize} workers`);
  }

  /**
   * Ejecuta una tarea en un worker disponible
   * @param {Object} data - Datos para el worker
   * @returns {Promise} Resultado de la tarea
   */
  async runTask(data) {
    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };
      
      // Buscar worker disponible
      const availableWorker = this.workers.find(w => !w.busy);
      
      if (availableWorker) {
        this.executeTask(availableWorker, task);
      } else {
        // Encolar tarea si no hay workers disponibles
        this.queue.push(task);
      }
    });
  }

  /**
   * Ejecuta una tarea en un worker específico
   * @param {Object} workerInfo - Información del worker
   * @param {Object} task - Tarea a ejecutar
   */
  executeTask(workerInfo, task) {
    workerInfo.busy = true;
    this.activeWorkers++;
    
    const worker = new Worker(this.workerScript);
    workerInfo.worker = worker;
    
    worker.on('message', (result) => {
      // Manejar respuesta estructurada del worker
      if (result && result.success === false) {
        task.reject(new Error(result.error || 'Error en worker'));
      } else if (result && result.hasOwnProperty('result')) {
        task.resolve(result.result);
      } else {
        task.resolve(result);
      }
      this.workerCompleted(workerInfo);
    });
    
    worker.on('error', (error) => {
      task.reject(error);
      this.workerCompleted(workerInfo);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        task.reject(new Error(`Worker detuvo con código ${code}`));
      }
      this.workerCompleted(workerInfo);
    });
    
    worker.postMessage(task.data);
  }

  /**
   * Maneja la finalización de un worker
   * @param {Object} workerInfo - Información del worker
   */
  workerCompleted(workerInfo) {
    workerInfo.busy = false;
    workerInfo.worker = null;
    this.activeWorkers--;
    
    // Procesar siguiente tarea en cola
    if (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      this.executeTask(workerInfo, nextTask);
    }
  }

  /**
   * Termina todos los workers
   */
  async terminate() {
    const promises = this.workers
      .filter(w => w.worker)
      .map(w => w.worker.terminate());
    
    await Promise.all(promises);
    this.workers = [];
    this.queue = [];
    console.log('🛑 Worker Pool terminado');
  }

  /**
   * Obtiene estadísticas del pool
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      poolSize: this.poolSize,
      activeWorkers: this.activeWorkers,
      availableWorkers: this.poolSize - this.activeWorkers,
      queuedTasks: this.queue.length
    };
  }
}

/**
 * Manager de Worker Pools
 */
class WorkerManager {
  constructor() {
    this.pools = {
      steganography: null,
      encryption: null,
      hashing: null
    };
  }

  /**
   * Inicializa todos los pools de workers
   */
  initialize() {
    // Pool para análisis de esteganografía
    this.pools.steganography = new WorkerPool(
      path.join(__dirname, '../workers/steganographyWorker.js'),
      Math.max(2, os.cpus().length - 2)
    );
    
    // Pool para cifrado/descifrado
    this.pools.encryption = new WorkerPool(
      path.join(__dirname, '../workers/encryptionWorker.js'),
      Math.max(2, os.cpus().length - 2)
    );
    
    // Pool para hashing intensivo
    this.pools.hashing = new WorkerPool(
      path.join(__dirname, '../workers/hashingWorker.js'),
      2
    );
    
    console.log('✅ Worker Manager inicializado');
  }

  /**
   * Analiza un archivo en busca de esteganografía (paralelo)
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} filename - Nombre del archivo
   * @param {string} mimetype - Tipo MIME
   * @returns {Promise<Object>} Resultado del análisis
   */
  async analyzeSteganography(fileBuffer, filename, mimetype) {
    if (!this.pools.steganography) {
      throw new Error('Pool de esteganografía no inicializado');
    }
    
    return await this.pools.steganography.runTask({
      type: 'analyze',
      buffer: fileBuffer,
      filename,
      mimetype
    });
  }

  /**
   * Cifra datos en paralelo
   * @param {string|Buffer} data - Datos a cifrar
   * @param {string} key - Clave de cifrado
   * @param {string} iv - Vector de inicialización
   * @returns {Promise<Object>} Datos cifrados
   */
  async encrypt(data, key, iv) {
    if (!this.pools.encryption) {
      throw new Error('Pool de cifrado no inicializado');
    }
    
    return await this.pools.encryption.runTask({
      operation: 'encrypt',
      data,
      key,
      iv
    });
  }

  /**
   * Descifra datos en paralelo
   * @param {string} encryptedData - Datos cifrados
   * @param {string} key - Clave de descifrado
   * @param {string} iv - Vector de inicialización
   * @param {string} tag - Tag de autenticación
   * @returns {Promise<string>} Datos descifrados
   */
  async decrypt(encryptedData, key, iv, tag) {
    if (!this.pools.encryption) {
      throw new Error('Pool de descifrado no inicializado');
    }
    
    return await this.pools.encryption.runTask({
      operation: 'decrypt',
      data: encryptedData,
      key,
      iv,
      tag
    });
  }

  /**
   * Genera hash en paralelo
   * @param {string} password - Password a hashear
   * @param {number} saltRounds - Rounds de sal (default: 10)
   * @returns {Promise<string>} Hash generado
   */
  async hashPassword(password, saltRounds = 10) {
    if (!this.pools.hashing) {
      throw new Error('Pool de hashing no inicializado');
    }
    
    return await this.pools.hashing.runTask({
      operation: 'hash',
      password,
      saltRounds
    });
  }

  /**
   * Verifica hash en paralelo
   * @param {string} password - Password a verificar
   * @param {string} hash - Hash a comparar
   * @returns {Promise<boolean>} True si coincide
   */
  async verifyPassword(password, hash) {
    if (!this.pools.hashing) {
      throw new Error('Pool de hashing no inicializado');
    }
    
    return await this.pools.hashing.runTask({
      operation: 'verify',
      password,
      hash
    });
  }

  /**
   * Genera hash simple (alias para hashPassword)
   * @param {string} data - Datos a hashear
   * @returns {Promise<string>} Hash generado
   */
  async hash(data) {
    return await this.hashPassword(data, 10);
  }

  /**
   * Obtiene estadísticas de todos los pools
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      steganography: this.pools.steganography?.getStats(),
      encryption: this.pools.encryption?.getStats(),
      hashing: this.pools.hashing?.getStats()
    };
  }

  /**
   * Termina todos los pools
   */
  async shutdown() {
    const promises = [];
    
    if (this.pools.steganography) {
      promises.push(this.pools.steganography.terminate());
    }
    if (this.pools.encryption) {
      promises.push(this.pools.encryption.terminate());
    }
    if (this.pools.hashing) {
      promises.push(this.pools.hashing.terminate());
    }
    
    await Promise.all(promises);
    console.log('✅ Todos los worker pools terminados');
  }
}

module.exports = new WorkerManager();
