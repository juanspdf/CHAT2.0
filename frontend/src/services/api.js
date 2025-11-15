import axios from 'axios';

// Obtener la IP del host actual (funciona en PC y móvil)
const getApiUrl = () => {
  // Si estás en desarrollo local, usa localhost
  // Si accedes desde otro dispositivo, usa la IP de tu PC
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' 
    ? 'http://localhost:5000/api'
    : `http://${host}:5000/api`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para añadir token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
