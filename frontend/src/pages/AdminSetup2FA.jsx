import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';

function AdminSetup2FA() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: QR, 2: Verify, 3: Backup codes
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tempToken = localStorage.getItem('tempToken');
    
    if (!tempToken) {
      navigate('/admin/login');
      return;
    }

    // Obtener el QR code
    fetchQRCode(tempToken);
  }, []);

  const fetchQRCode = async (token) => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.post(
        '/api/2fa/setup',
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          withCredentials: true
        }
      );

      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
      setLoading(false);
    } catch (err) {
      console.error('Error al obtener QR:', err);
      setError(err.response?.data?.error || 'Error al generar código QR');
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const tempToken = localStorage.getItem('tempToken');

    try {
      const response = await axios.post(
        '/api/2fa/verify-setup',
        { token: code },
        {
          headers: {
            'Authorization': `Bearer ${tempToken}`
          },
          withCredentials: true
        }
      );

      if (response.data.success) {
        setBackupCodes(response.data.backupCodes);
        setStep(3);
      }
    } catch (err) {
      console.error('Error al verificar código:', err);
      setError(err.response?.data?.error || 'Código de verificación incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    localStorage.removeItem('tempToken');
    navigate('/admin/login');
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !qrCode) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card">
          <h1>Cargando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        {step === 1 && (
          <>
            <h1>Configurar Autenticación 2FA</h1>
            <p className="setup-instructions">
              Escanea este código QR con Google Authenticator o similar:
            </p>
            
            {qrCode && (
              <div className="qr-code-container">
                <img src={qrCode} alt="QR Code" />
              </div>
            )}

            {secret && (
              <div className="secret-container">
                <p><strong>O ingresa manualmente:</strong></p>
                <code className="secret-code">{secret}</code>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <button
              className="login-button"
              onClick={() => setStep(2)}
              disabled={!qrCode}
            >
              Siguiente
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Verificar Configuración</h1>
            <p className="setup-instructions">
              Ingresa el código de 6 dígitos de tu aplicación:
            </p>

            <form onSubmit={handleVerify}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                  className="code-input"
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="button-group">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="login-button"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h1>¡2FA Configurado!</h1>
            <p className="setup-instructions">
              Guarda estos códigos de respaldo en un lugar seguro. Los necesitarás si pierdes acceso a tu aplicación de autenticación.
            </p>

            <div className="backup-codes-container">
              {backupCodes.map((code, index) => (
                <div key={index} className="backup-code">
                  {code}
                </div>
              ))}
            </div>

            <div className="button-group">
              <button
                className="secondary-button"
                onClick={downloadBackupCodes}
              >
                Descargar Códigos
              </button>
              <button
                className="login-button"
                onClick={handleComplete}
              >
                Completar
              </button>
            </div>

            <div className="warning-message">
              ⚠️ Estos códigos solo se mostrarán una vez. Asegúrate de guardarlos antes de continuar.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminSetup2FA;
