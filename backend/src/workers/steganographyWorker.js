const { parentPort } = require('worker_threads');
const steganographyDetector = require('../services/steganographyDetector');

/**
 * Worker para análisis de esteganografía en paralelo
 * Recibe archivos y retorna resultados del análisis
 */
parentPort.on('message', async (task) => {
  try {
    const { type, buffer, filename, mimetype } = task;
    
    if (type === 'analyze') {
      const startTime = Date.now();
      
      // Analizar archivo
      const result = await steganographyDetector.analyzeFile(buffer, filename, mimetype);
      
      const executionTime = Date.now() - startTime;
      
      // Retornar resultado
      parentPort.postMessage({
        success: true,
        result: {
          ...result,
          workerExecutionTime: executionTime
        }
      });
    } else {
      throw new Error(`Tipo de tarea desconocido: ${type}`);
    }
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
