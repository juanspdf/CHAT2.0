const { parentPort } = require('worker_threads');
const bcrypt = require('bcrypt');

/**
 * Worker para hashing de passwords en paralelo
 * Usa bcrypt para operaciones CPU-intensive
 */
parentPort.on('message', async (task) => {
  try {
    const { operation, password, hash, saltRounds } = task;
    
    let result;
    
    switch (operation) {
      case 'hash':
        // Generar hash de password
        result = await bcrypt.hash(password, saltRounds || 10);
        break;
        
      case 'verify':
        // Verificar password contra hash
        result = await bcrypt.compare(password, hash);
        break;
        
      default:
        throw new Error(`Operación desconocida: ${operation}`);
    }
    
    parentPort.postMessage({
      success: true,
      result
    });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    success: false,
    error: `Uncaught Exception: ${error.message}`,
    stack: error.stack
  });
  process.exit(1);
});
