const { parentPort } = require('worker_threads');
const encryptionService = require('../services/encryptionService');

/**
 * Worker para cifrado/descifrado en paralelo
 * Maneja operaciones criptográficas pesadas
 */
parentPort.on('message', async (task) => {
  try {
    const { operation, data, key, iv, tag } = task;
    
    let result;
    
    switch (operation) {
      case 'encrypt':
        // Cifrar mensaje
        if (typeof data === 'string') {
          result = encryptionService.encryptMessage(data, key, iv);
        } else {
          // Cifrar archivo (Buffer)
          result = encryptionService.encryptFile(data, key);
        }
        break;
        
      case 'decrypt':
        // Descifrar mensaje
        result = encryptionService.decryptMessage(data, key, iv, tag);
        break;
        
      case 'hash':
        // Generar hash SHA-256
        result = encryptionService.generateHash(data);
        break;
        
      case 'hmac':
        // Generar HMAC
        result = encryptionService.generateHMAC(data, key);
        break;
        
      case 'verify-hmac':
        // Verificar HMAC
        result = encryptionService.verifyHMAC(data, key, tag);
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
