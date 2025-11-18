import React from 'react';
import './SecurityIndicators.css';

/**
 * Componente de indicadores de seguridad
 * Muestra badges visuales para el estado de seguridad de archivos/mensajes
 */

// Indicador de verificación de archivo
export const FileSecurityBadge = ({ verdict, riskScore }) => {
  const getStatusConfig = () => {
    switch (verdict) {
      case 'APROBADO':
        return {
          className: 'security-badge approved',
          icon: '✓',
          label: 'Verificado',
          color: '#10b981'
        };
      case 'ADVERTENCIA':
        return {
          className: 'security-badge warning',
          icon: '⚠',
          label: 'Advertencia',
          color: '#f59e0b'
        };
      case 'ALERTA':
        return {
          className: 'security-badge alert',
          icon: '!',
          label: 'Alerta',
          color: '#ef4444'
        };
      case 'RECHAZADO':
        return {
          className: 'security-badge rejected',
          icon: '✕',
          label: 'Rechazado',
          color: '#dc2626'
        };
      default:
        return {
          className: 'security-badge unknown',
          icon: '?',
          label: 'No analizado',
          color: '#6b7280'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={config.className} title={`Risk Score: ${riskScore || 'N/A'}`}>
      <span className="badge-icon">{config.icon}</span>
      <span className="badge-label">{config.label}</span>
      {riskScore !== undefined && (
        <span className="badge-score">{riskScore}/100</span>
      )}
    </div>
  );
};

// Indicador de cifrado E2E
export const EncryptionBadge = ({ encrypted }) => {
  if (!encrypted) return null;

  return (
    <div className="security-badge encrypted" title="Mensaje cifrado end-to-end">
      <span className="badge-icon">🔒</span>
      <span className="badge-label">Cifrado</span>
    </div>
  );
};

// Indicador de 2FA habilitado
export const TwoFactorBadge = ({ enabled }) => {
  if (!enabled) return null;

  return (
    <div className="security-badge two-factor" title="Autenticación de dos factores activada">
      <span className="badge-icon">🛡️</span>
      <span className="badge-label">2FA</span>
    </div>
  );
};

// Indicador de integridad verificada (HMAC)
export const IntegrityBadge = ({ verified }) => {
  return (
    <div 
      className={`security-badge ${verified ? 'integrity-valid' : 'integrity-invalid'}`}
      title={verified ? 'Integridad verificada' : 'Integridad no verificada'}
    >
      <span className="badge-icon">{verified ? '✓' : '✕'}</span>
      <span className="badge-label">Integridad</span>
    </div>
  );
};

// Panel de seguridad completo para archivos
export const FileSecurityPanel = ({ analysis }) => {
  if (!analysis) return null;

  const { verdict, riskScore, analysisTime, encrypted, integrityVerified } = analysis;

  return (
    <div className="file-security-panel">
      <div className="security-panel-header">
        <h4>Análisis de Seguridad</h4>
      </div>
      <div className="security-panel-body">
        <FileSecurityBadge verdict={verdict} riskScore={riskScore} />
        {encrypted && <EncryptionBadge encrypted={encrypted} />}
        {integrityVerified !== undefined && <IntegrityBadge verified={integrityVerified} />}
      </div>
      {analysisTime && (
        <div className="security-panel-footer">
          <span className="analysis-time">Analizado en {analysisTime}ms</span>
        </div>
      )}
    </div>
  );
};

// Indicador de usuario verificado (nickname hasheado para privacidad)
export const UserPrivacyBadge = ({ nicknameHash }) => {
  return (
    <div className="user-privacy-badge" title="Nickname hasheado para privacidad">
      <span className="user-avatar">{nicknameHash?.substring(0, 2).toUpperCase()}</span>
      <span className="user-hash">{nicknameHash?.substring(0, 8)}</span>
    </div>
  );
};

// Alerta de seguridad
export const SecurityAlert = ({ type, message, onDismiss }) => {
  const getAlertConfig = () => {
    switch (type) {
      case 'error':
        return { className: 'alert-error', icon: '🚨' };
      case 'warning':
        return { className: 'alert-warning', icon: '⚠️' };
      case 'info':
        return { className: 'alert-info', icon: 'ℹ️' };
      case 'success':
        return { className: 'alert-success', icon: '✅' };
      default:
        return { className: 'alert-info', icon: 'ℹ️' };
    }
  };

  const config = getAlertConfig();

  return (
    <div className={`security-alert ${config.className}`}>
      <span className="alert-icon">{config.icon}</span>
      <span className="alert-message">{message}</span>
      {onDismiss && (
        <button className="alert-dismiss" onClick={onDismiss}>×</button>
      )}
    </div>
  );
};

export default {
  FileSecurityBadge,
  EncryptionBadge,
  TwoFactorBadge,
  IntegrityBadge,
  FileSecurityPanel,
  UserPrivacyBadge,
  SecurityAlert
};
