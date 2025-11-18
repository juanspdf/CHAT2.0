import axios from 'axios';
import tokenService from './tokenService';

// Obtener la IP del host actual (funciona en PC y móvil)
const getApiUrl = () => {
  // Si estás en desarrollo local, usa localhost
  // Si accedes desde otro dispositivo, usa la IP de tu PC
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  
  // En Docker, el frontend está en puerto 5173 y backend en 5000
  // En desarrollo local con HTTPS, backend está en puerto 3001
  let port = '5000'; // Default para Docker
  
  // Si detectamos HTTPS o estamos en puerto 5174 (dev HTTPS), usar 3001
  if (protocol === 'https:' || window.location.port === '5174') {
    port = '3001';
  }
  
  return `${protocol}//${host}:${port}/api`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Habilitar cookies de sesión
});

// Interceptor para añadir token y manejar renovación automática
api.interceptors.request.use(async (config) => {
  let token = tokenService.getAccessToken();
  
  // Si el token está expirado, renovarlo automáticamente
  if (token && tokenService.isTokenExpired(token)) {
    console.log('⚠️ Token expirado, renovando automáticamente...');
    token = await tokenService.refreshAccessToken();
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar respuestas 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si recibimos 401 y no hemos reintentado ya
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        console.log('🔄 Token rechazado, intentando renovar...');
        const newToken = await tokenService.refreshAccessToken();
        
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('❌ Error renovando token:', refreshError);
        tokenService.clearTokens();
        window.location.href = '/admin/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Admin endpoints
export const adminAPI = {
  login: async (username, password) => {
    const response = await api.post('/admin/login', { username, password });
    return response.data;
  },
  
  register: async (username, password) => {
    const response = await api.post('/admin/register', { username, password });
    return response.data;
  }
};

// Room endpoints
export const roomAPI = {
  createRoom: async (type, pin, maxFileSizeMB = 10) => {
    const response = await api.post('/rooms', { type, pin, maxFileSizeMB });
    return response.data;
  },
  
  getRooms: async () => {
    const response = await api.get('/rooms');
    return response.data;
  },
  
  getRoomInfo: async (roomCode) => {
    const response = await api.get(`/rooms/${roomCode}`);
    return response.data;
  },
  
  uploadFile: async (roomCode, file, nickname) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nickname', nickname);
    
    const response = await axios.post(
      `${API_URL}/rooms/${roomCode}/files`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  }
};

export default api;
