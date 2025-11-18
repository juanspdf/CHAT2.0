import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import tokenService from '../services/tokenService';
import '../styles/AdminAlerts.css';

function AdminAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Conectar socket solo para admin
    const token = tokenService.getAccessToken();
    if (!token) {
      console.log('⚠️ No hay token de admin, no se conectarán alertas');
      return;
    }

    console.log('🔌 Iniciando conexión de alertas para administrador...');

    // Usar la misma URL que el socket principal
    const host = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const port = host === 'localhost' || host === '127.0.0.1' ? '3001' : '3001';
    const socketUrl = `${protocol}//${host}:${port}`;

    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: token
      }
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket de alertas conectado - ID:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket de alertas desconectado');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión socket alertas:', error);
    });

    // Escuchar alertas de manipulación
    newSocket.on('admin_alert', (alert) => {
      console.log('🚨 ¡ALERTA RECIBIDA!', alert);
      
      const newAlert = {
        ...alert,
        id: Date.now(),
        read: false
      };

      setAlerts(prev => {
        console.log('📝 Agregando alerta al estado. Total alertas:', prev.length + 1);
        return [newAlert, ...prev];
      });
      
      setUnreadCount(prev => {
        console.log('📊 Incrementando contador de no leídas:', prev + 1);
        return prev + 1;
      });

      // Reproducir sonido de alerta
      playAlertSound(alert.severity);

      // Mostrar notificación del navegador
      if (Notification.permission === 'granted') {
        new Notification('🚨 Alerta de Seguridad', {
          body: `${alert.severity === 'HIGH' ? 'ALTA' : 'MEDIA'} - Manipulación detectada en sala ${alert.data.roomCode}`,
          icon: '/alert-icon.png',
          requireInteraction: true
        });
      }
    });

    setSocket(newSocket);

    // Solicitar permiso para notificaciones
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Permiso de notificaciones:', permission);
      });
    }

    return () => {
      console.log('🔌 Desconectando socket de alertas...');
      newSocket.disconnect();
    };
  }, [tokenService.getAccessToken()]); // Re-conectar cuando cambie el token

  const playAlertSound = (severity) => {
    const audio = new Audio(severity === 'HIGH' ? '/alert-high.mp3' : '/alert-medium.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('No se pudo reproducir sonido:', err));
  };

  const markAsRead = (alertId) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
    setUnreadCount(0);
  };

  const clearAlerts = () => {
    setAlerts([]);
    setUnreadCount(0);
  };

  // Función de prueba para simular alerta
  const testAlert = () => {
    const mockAlert = {
      type: 'STEGANOGRAPHY_DETECTED',
      severity: 'HIGH',
      timestamp: new Date(),
      data: {
        roomCode: 'TEST123',
        filename: 'test.png',
        uploadedBy: 'Usuario Test',
        verdict: 'RECHAZADO',
        riskScore: 95,
        analysis: {
          entropy: { value: '7.95', threshold: 7.9, alert: true },
          lsb: { lsbRatio: 0.51, bitPairChangeRatio: 0.49, sequentialChangeRatio: 0.25, suspicious: true },
          pixelCorrelation: { correlation: 0.66, averageDifference: 85, suspicious: true }
        }
      }
    };

    const newAlert = { ...mockAlert, id: Date.now(), read: false };
    setAlerts(prev => [newAlert, ...prev]);
    setUnreadCount(prev => prev + 1);
    console.log('🧪 Alerta de prueba creada');
  };

  const getSeverityClass = (severity) => {
    return severity === 'HIGH' ? 'severity-high' : 'severity-medium';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
    return date.toLocaleString();
  };

  return (
    <>
      {/* Botón flotante de alertas */}
      <div className="alert-button-container">
        <button 
          className={`alert-button ${unreadCount > 0 ? 'has-alerts' : ''}`}
          onClick={() => setShowPanel(!showPanel)}
          onDoubleClick={testAlert}
          title="Alertas de seguridad (doble clic para prueba)"
        >
          🚨
          {unreadCount > 0 && (
            <span className="alert-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>

      {/* Panel de alertas */}
      {showPanel && (
        <div className="alert-panel">
          <div className="alert-panel-header">
            <h3>🚨 Alertas de Seguridad</h3>
            <div className="alert-actions">
              {alerts.length > 0 && (
                <>
                  <button onClick={markAllAsRead} className="btn-link">
                    Marcar todas como leídas
                  </button>
                  <button onClick={clearAlerts} className="btn-link">
                    Limpiar
                  </button>
                </>
              )}
              <button onClick={() => setShowPanel(false)} className="btn-close">
                ✕
              </button>
            </div>
          </div>

          <div className="alert-panel-body">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <p>✅ No hay alertas</p>
                <small>Se te notificará cuando se detecte manipulación</small>
              </div>
            ) : (
              <div className="alerts-list">
                {alerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`alert-item ${alert.read ? 'read' : 'unread'} ${getSeverityClass(alert.severity)}`}
                    onClick={() => !alert.read && markAsRead(alert.id)}
                  >
                    <div className="alert-header">
                      <span className="alert-severity">
                        {alert.severity === 'HIGH' ? '🔴 ALTA' : '🟡 MEDIA'}
                      </span>
                      <span className="alert-time">{formatTimestamp(alert.timestamp)}</span>
                    </div>

                    <div className="alert-content">
                      <h4>Manipulación Detectada</h4>
                      <div className="alert-details">
                        <p><strong>Sala:</strong> {alert.data.roomCode}</p>
                        <p><strong>Archivo:</strong> {alert.data.filename}</p>
                        <p><strong>Usuario:</strong> {alert.data.uploadedBy}</p>
                        <p><strong>Veredicto:</strong> <span className="verdict-badge">{alert.data.verdict}</span></p>
                        <p><strong>Riesgo:</strong> {alert.data.riskScore}%</p>
                      </div>

                      {alert.data.analysis && (
                        <details className="analysis-details">
                          <summary>Ver análisis técnico</summary>
                          <div className="technical-data">
                            {alert.data.analysis.entropy && (
                              <p>Entropía: {alert.data.analysis.entropy.value} (umbral: {alert.data.analysis.entropy.threshold})</p>
                            )}
                            {alert.data.analysis.lsb && (
                              <>
                                <p>LSB Ratio: {alert.data.analysis.lsb.lsbRatio}</p>
                                <p>BitPair Change: {alert.data.analysis.lsb.bitPairChangeRatio}</p>
                                <p>Sequential Change: {alert.data.analysis.lsb.sequentialChangeRatio}</p>
                              </>
                            )}
                            {alert.data.analysis.pixelCorrelation && (
                              <p>Correlación Píxeles: {alert.data.analysis.pixelCorrelation.correlation} (⚠️ OpenStego detectado)</p>
                            )}
                          </div>
                        </details>
                      )}
                    </div>

                    {!alert.read && <div className="unread-indicator"></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AdminAlerts;
