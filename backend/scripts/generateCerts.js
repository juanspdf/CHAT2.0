const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

/**
 * Script para generar certificados SSL self-signed
 * para desarrollo local con HTTPS
 */

console.log('🔐 Generando certificados SSL self-signed...');

// Generar par de claves RSA
const keys = forge.pki.rsa.generateKeyPair(2048);

// Crear certificado
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // 1 año

// Configurar atributos del certificado
const attrs = [{
  name: 'commonName',
  value: 'localhost'
}, {
  name: 'countryName',
  value: 'US'
}, {
  shortName: 'ST',
  value: 'State'
}, {
  name: 'localityName',
  value: 'City'
}, {
  name: 'organizationName',
  value: 'CHAT2.0 Development'
}, {
  shortName: 'OU',
  value: 'Development'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// Extensiones para SANs (Subject Alternative Names)
cert.setExtensions([{
  name: 'basicConstraints',
  cA: true
}, {
  name: 'keyUsage',
  keyCertSign: true,
  digitalSignature: true,
  nonRepudiation: true,
  keyEncipherment: true,
  dataEncipherment: true
}, {
  name: 'extKeyUsage',
  serverAuth: true,
  clientAuth: true,
  codeSigning: true,
  emailProtection: true,
  timeStamping: true
}, {
  name: 'nsCertType',
  server: true,
  client: true,
  email: true,
  objsign: true,
  sslCA: true,
  emailCA: true,
  objCA: true
}, {
  name: 'subjectAltName',
  altNames: [{
    type: 2, // DNS
    value: 'localhost'
  }, {
    type: 7, // IP
    ip: '127.0.0.1'
  }]
}]);

// Auto-firmar el certificado
cert.sign(keys.privateKey, forge.md.sha256.create());

// Convertir a PEM
const pemCert = forge.pki.certificateToPem(cert);
const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

// Crear directorio certs si no existe
const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Guardar certificados
const certPath = path.join(certsDir, 'cert.pem');
const keyPath = path.join(certsDir, 'key.pem');

fs.writeFileSync(certPath, pemCert);
fs.writeFileSync(keyPath, pemKey);

console.log('✅ Certificados generados exitosamente:');
console.log(`   📄 Certificado: ${certPath}`);
console.log(`   🔑 Clave privada: ${keyPath}`);
console.log('');
console.log('⚠️  NOTA: Estos son certificados self-signed para desarrollo.');
console.log('    El navegador mostrará una advertencia de seguridad.');
console.log('    En producción, usa certificados de Let\'s Encrypt o una CA confiable.');
