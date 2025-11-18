import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import tokenService from '../services/tokenService';
import axios from 'axios';
import '../styles/Login.css';

// Version 2.0 - 2FA Setup Flow Fixed
function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('🔍 Frontend: Enviando credenciales al backend');

    try {
      const response = await adminAPI.login(username, password);
      
      console.log('🔍 Frontend: Respuesta recibida:', response);
      
      // Si requiere configurar 2FA por primera vez
      if (response.requires2FASetup) {
        console.log('✅ Frontend: Redirigiendo a setup 2FA');
        setError('');
        localStorage.setItem('tempToken', response.tempToken);
        localStorage.setItem('adminUsername', response.admin.username);
        // Redirigir a página de setup de 2FA
        navigate('/admin/setup-2fa');
        return;
      }
      
      // Si requiere 2FA, mostrar el formulario de código
      if (response.requires2FA) {
        console.log('✅ Frontend: Mostrando formulario 2FA');
        setRequires2FA(true);
        setError('');
      } else {
        // Login exitoso sin 2FA (no debería pasar con 2FA obligatorio)
        console.log('✅ Frontend: Login exitoso sin 2FA');
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminUsername', response.admin.username);
        navigate('/admin/dashboard');
      }
    } catch (err) {
      console.error('❌ Frontend: Error en login:', err);
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/2fa/verify', {
        token: twoFactorCode,
        isBackupCode: isBackupCode
      }, {
        withCredentials: true
      });

      // Login exitoso con 2FA - guardar tokens
      tokenService.setTokens(response.data.accessToken, response.data.refreshToken);
      localStorage.setItem('adminUsername', response.data.admin.username);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Código de verificación incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setRequires2FA(false);
    setTwoFactorCode('');
    setIsBackupCode(false);
    setError('');
  };

  return (
    <div className="login-container">
      <div className="card login-card">
        <h1 className="login-title">Panel de Administración</h1>
        <p className="login-subtitle">
          {requires2FA 
            ? 'Ingresa el código de autenticación (v2.1)' 
            : 'Inicia sesión para gestionar salas de chat'}
        </p>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {!requires2FA ? (
          // Formulario de credenciales (Paso 1)
          <form onSubmit={handleCredentialsSubmit}>
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        ) : (
          // Formulario de 2FA (Paso 2)
          <form onSubmit={handle2FASubmit}>
            <div className="form-group">
              <label htmlFor="twoFactorCode">
                {isBackupCode ? 'Código de Respaldo' : 'Código de Autenticación'}
              </label>
              <input
                type="text"
                id="twoFactorCode"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder={isBackupCode ? "123456" : "000000"}
                maxLength={isBackupCode ? 6 : 6}
                pattern="[0-9]*"
                required
                autoFocus
                style={{ fontSize: '24px', textAlign: 'center', letterSpacing: '8px' }}
              />
              <small className="text-muted">
                {isBackupCode 
                  ? 'Ingresa uno de tus códigos de respaldo de 6 dígitos' 
                  : 'Ingresa el código de 6 dígitos de tu aplicación de autenticación'}
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isBackupCode}
                  onChange={(e) => {
                    setIsBackupCode(e.target.checked);
                    setTwoFactorCode('');
                  }}
                />
                <span style={{ marginLeft: '8px' }}>Usar código de respaldo</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Verificar Código'}
            </button>

            <button
              type="button"
              onClick={handleBackToCredentials}
              className="btn btn-secondary w-full mt-2"
            >
              ← Volver
            </button>
          </form>
        )}

        {!requires2FA && (
          <div className="mt-2 text-center">
            <button
              onClick={() => navigate('/join')}
              className="btn btn-secondary"
            >
              ¿Usuario? Unirse a una sala
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminLogin;
