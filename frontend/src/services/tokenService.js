/**
 * Servicio de gestión de tokens JWT con refresh automático
 */

const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const API_BASE = '/api';

class TokenService {
  constructor() {
    this.refreshTimeout = null;
  }

  /**
   * Guarda los tokens en localStorage
   */
  setTokens(accessToken, refreshToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    this.scheduleTokenRefresh(accessToken);
  }

  /**
   * Obtiene el access token
   */
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Obtiene el refresh token
   */
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * Elimina los tokens
   */
  clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Decodifica un JWT sin verificar (solo para obtener payload)
   */
  decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decodificando token:', error);
      return null;
    }
  }

  /**
   * Verifica si el token está expirado
   */
  isTokenExpired(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    // Verificar si expira en los próximos 5 minutos
    const now = Date.now() / 1000;
    return decoded.exp < (now + 300); // 5 minutos de buffer
  }

  /**
   * Programa la renovación automática del token
   */
  scheduleTokenRefresh(token) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return;

    // Renovar 5 minutos antes de expirar
    const expiresIn = decoded.exp * 1000 - Date.now() - 5 * 60 * 1000;
    
    if (expiresIn > 0) {
      console.log(`🔄 Token se renovará en ${Math.floor(expiresIn / 1000 / 60)} minutos`);
      this.refreshTimeout = setTimeout(() => {
        this.refreshAccessToken();
      }, expiresIn);
    } else {
      // Token ya expirado o por expirar pronto, renovar inmediatamente
      this.refreshAccessToken();
    }
  }

  /**
   * Renueva el access token usando el refresh token
   */
  async refreshAccessToken() {
    try {
      const refreshToken = this.getRefreshToken();
      
      if (!refreshToken) {
        console.warn('⚠️ No hay refresh token, requiere login');
        this.clearTokens();
        window.location.href = '/admin/login';
        return null;
      }

      console.log('🔄 Renovando access token...');

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          // Token reuse detectado o token inválido
          console.error('❌ Refresh token inválido, requiere login');
          this.clearTokens();
          window.location.href = '/admin/login';
          return null;
        }
        throw new Error('Error renovando token');
      }

      const data = await response.json();
      
      console.log('✅ Token renovado exitosamente');
      this.setTokens(data.accessToken, data.refreshToken);
      
      return data.accessToken;
    } catch (error) {
      console.error('Error renovando token:', error);
      this.clearTokens();
      window.location.href = '/admin/login';
      return null;
    }
  }

  /**
   * Hace una petición HTTP con renovación automática de token
   */
  async fetchWithAuth(url, options = {}) {
    let token = this.getAccessToken();

    // Si el token está expirado, renovar primero
    if (token && this.isTokenExpired(token)) {
      console.log('⚠️ Token expirado, renovando...');
      token = await this.refreshAccessToken();
      if (!token) {
        throw new Error('No se pudo renovar el token');
      }
    }

    // Agregar el token al header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Si recibimos 401, intentar renovar el token una vez
    if (response.status === 401) {
      console.log('🔄 Token rechazado, intentando renovar...');
      token = await this.refreshAccessToken();
      
      if (token) {
        // Reintentar la petición con el nuevo token
        headers['Authorization'] = `Bearer ${token}`;
        return fetch(url, { ...options, headers });
      }
    }

    return response;
  }

  /**
   * Cierra sesión en el dispositivo actual
   */
  async logout() {
    try {
      const refreshToken = this.getRefreshToken();
      
      if (refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      this.clearTokens();
      window.location.href = '/admin/login';
    }
  }

  /**
   * Cierra sesión en todos los dispositivos
   */
  async logoutAll() {
    try {
      const token = this.getAccessToken();
      
      if (token) {
        await fetch(`${API_BASE}/auth/logout-all`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Error en logout-all:', error);
    } finally {
      this.clearTokens();
      window.location.href = '/admin/login';
    }
  }

  /**
   * Inicializa el servicio (llamar al cargar la app)
   */
  initialize() {
    const token = this.getAccessToken();
    if (token && !this.isTokenExpired(token)) {
      this.scheduleTokenRefresh(token);
    } else if (token) {
      // Token expirado, intentar renovar
      this.refreshAccessToken();
    }
  }
}

export default new TokenService();
