const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Servicio de Detección de Esteganografía
 * Analiza archivos multimedia en busca de manipulación y datos ocultos
 */
class SteganographyDetector {
  constructor() {
    // Umbrales ajustados por tipo de archivo
    this.entropyThresholds = {
      'image/png': 7.95,  // PNG tiene alta entropía natural por compresión
      'image/jpeg': 7.95, // JPEG altamente comprimido puede tener entropía muy alta
      'default': 7.5
    };
  }

  /**
   * Obtiene el umbral de entropía según el tipo de archivo
   * @param {string} mimetype - Tipo MIME del archivo
   * @returns {number} Umbral de entropía
   */
  getEntropyThreshold(mimetype) {
    return this.entropyThresholds[mimetype] || this.entropyThresholds.default;
  }

  /**
   * Calcula la entropía de Shannon de un buffer
   * Entropía > 7.5 indica alta aleatoriedad (posible esteganografía)
   * @param {Buffer} buffer - Buffer del archivo
   * @returns {number} Valor de entropía (0-8)
   */
  calculateEntropy(buffer) {
    const frequency = new Map();
    const length = buffer.length;

    // Contar frecuencia de cada byte
    for (let i = 0; i < length; i++) {
      const byte = buffer[i];
      frequency.set(byte, (frequency.get(byte) || 0) + 1);
    }

    // Calcular entropía
    let entropy = 0;
    frequency.forEach(count => {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    });

    return entropy;
  }

  /**
   * Analiza la distribución de LSB (Least Significant Bits)
   * Esteganografía LSB altera los bits menos significativos
   * OpenStego y herramientas similares crean patrones detectables
   * @param {Buffer} buffer - Buffer del archivo
   * @returns {Object} { lsbRatio: number, suspicious: boolean }
   */
  analyzeLSB(buffer) {
    let lsbOnes = 0;
    let bitPairChanges = 0;
    let sequentialChanges = 0;
    const sampleSize = Math.min(buffer.length, 50000); // Muestra más grande

    for (let i = 0; i < sampleSize; i++) {
      // Verificar bit menos significativo
      if (buffer[i] & 1) {
        lsbOnes++;
      }
      
      // Detectar cambios en pares de bits (patrón de OpenStego)
      if (i > 0) {
        const currentLsb = buffer[i] & 1;
        const prevLsb = buffer[i - 1] & 1;
        if (currentLsb !== prevLsb) {
          bitPairChanges++;
        }
        
        // Detectar cambios secuenciales en LSB (muy sospechoso)
        if (i > 1) {
          const prevPrevLsb = buffer[i - 2] & 1;
          if (currentLsb !== prevLsb && prevLsb !== prevPrevLsb) {
            sequentialChanges++;
          }
        }
      }
    }

    const lsbRatio = lsbOnes / sampleSize;
    const bitPairChangeRatio = bitPairChanges / (sampleSize - 1);
    const sequentialChangeRatio = sequentialChanges / (sampleSize - 2);
    
    // Ratio ideal es ~0.5, desviación pequeña pero con muchos cambios es sospechoso
    const deviation = Math.abs(lsbRatio - 0.5);
    
    // OpenStego produce: ratio cercano a 0.5 PERO muchos cambios de bit
    // Hacemos la detección más específica para evitar falsos positivos
    const suspicious = (
      (deviation < 0.015 && bitPairChangeRatio > 0.48) || // MUY uniforme + muchos cambios
      (sequentialChangeRatio > 0.24 && bitPairChangeRatio > 0.48) || // Cambios secuenciales Y muchos cambios
      (lsbRatio > 0.50 && lsbRatio < 0.52 && bitPairChangeRatio > 0.48 && sequentialChangeRatio > 0.24) // Patrón OpenStego preciso
    );

    return {
      lsbRatio: parseFloat(lsbRatio.toFixed(4)),
      deviation: parseFloat(deviation.toFixed(4)),
      bitPairChangeRatio: parseFloat(bitPairChangeRatio.toFixed(4)),
      sequentialChangeRatio: parseFloat(sequentialChangeRatio.toFixed(4)),
      suspicious
    };
  }

  /**
   * Analiza Chi-Square para detectar patrones anómalos
   * @param {Buffer} buffer - Buffer del archivo
   * @returns {Object} { chiSquare: number, suspicious: boolean }
   */
  chiSquareTest(buffer) {
    const observed = new Array(256).fill(0);
    const length = buffer.length;

    // Contar ocurrencias de cada byte
    for (let i = 0; i < length; i++) {
      observed[buffer[i]]++;
    }

    // Frecuencia esperada (distribución uniforme)
    const expected = length / 256;

    // Calcular Chi-Square
    let chiSquare = 0;
    for (let i = 0; i < 256; i++) {
      const diff = observed[i] - expected;
      chiSquare += (diff * diff) / expected;
    }

    // Chi-Square crítico para 255 grados de libertad (α=0.05) ≈ 293.25
    const suspicious = chiSquare > 350;

    return {
      chiSquare,
      suspicious
    };
  }

  /**
   * Detecta patrones repetitivos sospechosos
   * @param {Buffer} buffer - Buffer del archivo
   * @returns {Object} { patterns: number, suspicious: boolean }
   */
  detectPatterns(buffer) {
    const chunkSize = 16;
    const chunks = new Map();
    let repetitions = 0;

    for (let i = 0; i < buffer.length - chunkSize; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize).toString('hex');
      const count = (chunks.get(chunk) || 0) + 1;
      chunks.set(chunk, count);
      
      if (count > 3) {
        repetitions++;
      }
    }

    const suspicious = repetitions > buffer.length / (chunkSize * 100);

    return {
      patterns: repetitions,
      suspicious
    };
  }

  /**
   * Analiza correlación entre píxeles adyacentes
   * OpenStego rompe la correlación natural de imágenes
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} mimetype - Tipo MIME
   * @returns {Object} Análisis de correlación
   */
  analyzePixelCorrelation(buffer, mimetype) {
    // Solo para imágenes PNG
    if (!mimetype.includes('png')) {
      return { correlation: 1.0, suspicious: false };
    }

    let sumDiff = 0;
    let count = 0;
    const sampleSize = Math.min(buffer.length - 1, 10000);

    // Analizar diferencias entre bytes adyacentes
    for (let i = 0; i < sampleSize; i++) {
      const diff = Math.abs(buffer[i] - buffer[i + 1]);
      sumDiff += diff;
      count++;
    }

    const avgDiff = sumDiff / count;
    
    // En imágenes naturales, píxeles adyacentes son similares (avgDiff bajo)
    // OpenStego rompe esto, creando diferencias más altas
    const correlation = 1 - (avgDiff / 255);
    const suspicious = correlation < 0.75; // Correlación muy baja es sospechosa (OpenStego ~0.66)

    return {
      correlation: parseFloat(correlation.toFixed(4)),
      averageDifference: parseFloat(avgDiff.toFixed(2)),
      suspicious
    };
  }

  /**
   * Análisis completo de esteganografía
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} filename - Nombre del archivo
   * @param {string} mimetype - Tipo MIME
   * @returns {Promise<Object>} Resultado completo del análisis
   */
  async analyzeFile(buffer, filename, mimetype) {
    const startTime = Date.now();

    console.log('\n========================================');
    console.log(`📊 ANÁLISIS ESTEGANOGRÁFICO: ${filename}`);
    console.log('========================================');

    // Análisis de entropía con umbral dinámico
    const entropy = this.calculateEntropy(buffer);
    const entropyThreshold = this.getEntropyThreshold(mimetype);
    const entropyAlert = entropy > entropyThreshold;
    console.log(`\n🔢 ENTROPÍA:`);
    console.log(`   Valor: ${entropy.toFixed(4)}`);
    console.log(`   Umbral: ${entropyThreshold}`);
    console.log(`   Sospechoso: ${entropyAlert ? '⚠️ SÍ' : '✅ NO'}`);

    // Análisis LSB
    const lsbAnalysis = this.analyzeLSB(buffer);
    console.log(`\n🔍 ANÁLISIS LSB:`);
    console.log(`   Ratio LSB: ${lsbAnalysis.lsbRatio}`);
    console.log(`   Desviación: ${lsbAnalysis.deviation}`);
    console.log(`   BitPairChangeRatio: ${lsbAnalysis.bitPairChangeRatio}`);
    console.log(`   SequentialChangeRatio: ${lsbAnalysis.sequentialChangeRatio}`);
    console.log(`   Sospechoso: ${lsbAnalysis.suspicious ? '⚠️ SÍ' : '✅ NO'}`);

    // Chi-Square Test
    const chiSquare = this.chiSquareTest(buffer);
    console.log(`\n📐 CHI-SQUARE TEST:`);
    console.log(`   Valor: ${chiSquare.value}`);
    console.log(`   Sospechoso: ${chiSquare.suspicious ? '⚠️ SÍ' : '✅ NO'}`);

    // Detección de patrones
    const patterns = this.detectPatterns(buffer);
    console.log(`\n🔄 PATRONES:`);
    console.log(`   Repeticiones: ${patterns.patterns}`);
    console.log(`   Sospechoso: ${patterns.suspicious ? '⚠️ SÍ' : '✅ NO'}`);

    // Análisis de correlación de píxeles (OpenStego específico)
    const pixelCorrelation = this.analyzePixelCorrelation(buffer, mimetype);
    console.log(`\n🎨 CORRELACIÓN DE PÍXELES:`);
    console.log(`   Correlación: ${pixelCorrelation.correlation}`);
    console.log(`   Diferencia Promedio: ${pixelCorrelation.averageDifference}`);
    console.log(`   Sospechoso: ${pixelCorrelation.suspicious ? '⚠️ SÍ (OpenStego detectado)' : '✅ NO'}`);

    // Verificar metadatos (para imágenes)
    const metadata = this.extractMetadata(buffer, mimetype);
    console.log(`\n📝 METADATA:`);
    console.log(`   Sospechoso: ${metadata.suspicious ? '⚠️ SÍ' : '✅ NO'}`);

    // Score de riesgo (0-100) - Ajustado para detectar OpenStego
    let riskScore = 0;
    const scoreBreakdown = [];
    
    // PNG y JPEG tienen naturalmente alta entropía por compresión - peso mínimo
    const entropyWeight = (mimetype.includes('png') || mimetype.includes('jpeg') || mimetype.includes('jpg')) ? 5 : 25;
    if (entropyAlert) {
      riskScore += entropyWeight;
      scoreBreakdown.push(`Entropía: +${entropyWeight}`);
    }
    
    // LSB es el indicador más confiable de esteganografía - más peso
    if (lsbAnalysis.suspicious) {
      riskScore += 35;
      scoreBreakdown.push(`LSB: +35`);
    }
    
    // Chi-Square puede dar falsos positivos en imágenes complejas
    if (chiSquare.suspicious) {
      riskScore += 20;
      scoreBreakdown.push(`Chi-Square: +20`);
    }
    
    if (patterns.suspicious) {
      riskScore += 20;
      scoreBreakdown.push(`Patrones: +20`);
    }
    
    // Correlación de píxeles baja = OpenStego (indicador fuerte)
    if (pixelCorrelation.suspicious) {
      riskScore += 30;
      scoreBreakdown.push(`Correlación Píxeles: +30`);
    }
    
    if (metadata.suspicious) {
      riskScore += 10;
      scoreBreakdown.push(`Metadata: +10`);
    }

    const verdict = this.getVerdict(riskScore);
    const analysisTime = Date.now() - startTime;

    console.log(`\n📊 PUNTUACIÓN DE RIESGO:`);
    console.log(`   Desglose: ${scoreBreakdown.join(', ') || 'Sin alertas'}`);
    console.log(`   Total: ${riskScore}/100`);
    console.log(`   Veredicto: ${verdict}`);
    console.log('========================================\n');

    return {
      filename,
      mimetype,
      size: buffer.length,
      timestamp: new Date(),
      analysis: {
        entropy: {
          value: entropy.toFixed(3),
          threshold: entropyThreshold,
          alert: entropyAlert
        },
        lsb: lsbAnalysis,
        chiSquare: chiSquare,
        patterns: patterns,
        pixelCorrelation: pixelCorrelation,
        metadata: metadata
      },
      riskScore,
      verdict: this.getVerdict(riskScore),
      analysisTime: `${analysisTime}ms`
    };
  }

  /**
   * Extrae y analiza metadatos básicos
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} mimetype - Tipo MIME
   * @returns {Object} Análisis de metadatos
   */
  extractMetadata(buffer, mimetype) {
    const metadata = {
      hasExifData: false,
      suspicious: false,
      details: {}
    };

    // Verificar firma de archivo (magic bytes)
    const magicBytes = buffer.slice(0, 4).toString('hex');
    
    // Firmas conocidas
    const signatures = {
      'ffd8ffe0': 'JPEG/JFIF',
      'ffd8ffe1': 'JPEG/EXIF',
      '89504e47': 'PNG',
      '47494638': 'GIF',
      '25504446': 'PDF',
      '504b0304': 'ZIP/Office'
    };

    metadata.magicBytes = magicBytes;
    metadata.detectedType = signatures[magicBytes.slice(0, 8)] || 'Unknown';
    
    // Verificar inconsistencia entre magic bytes y mimetype
    if (mimetype.includes('image/jpeg') && !magicBytes.startsWith('ffd8')) {
      metadata.suspicious = true;
      metadata.reason = 'MIME type no coincide con firma del archivo';
    }

    return metadata;
  }

  /**
   * Determina el veredicto basado en el score de riesgo
   * @param {number} riskScore - Score de riesgo (0-100)
   * @returns {string} Veredicto
   */
  getVerdict(riskScore) {
    if (riskScore >= 70) return 'RECHAZADO - Alto riesgo de manipulación';
    if (riskScore >= 40) return 'ALERTA - Riesgo moderado detectado';
    if (riskScore >= 20) return 'ADVERTENCIA - Posibles anomalías';
    return 'APROBADO - Sin anomalías significativas';
  }
}

module.exports = new SteganographyDetector();
