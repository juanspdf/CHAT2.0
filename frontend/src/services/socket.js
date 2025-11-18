import { io } from 'socket.io-client';

// Obtener la URL del socket dinámicamente
const getSocketUrl = () => {
  const host = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  
  // En Docker, el frontend está en puerto 5173 y backend en 5000
  // En desarrollo local con HTTPS, backend está en puerto 3001
  let port = '5000'; // Default para Docker
  
  // Si detectamos HTTPS o estamos en puerto 5174 (dev HTTPS), usar 3001
  if (protocol === 'https:' || window.location.port === '5174') {
    port = '3001';
  }
  
  return `${protocol}//${host}:${port}`;
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomCode, pin, nickname) {
    if (this.socket) {
      this.socket.emit('join_room', {
        roomCode,
        pin,
        nickname
      });
    }
  }

  sendMessage(roomCode, content) {
    if (this.socket) {
      this.socket.emit('send_message', {
        roomCode,
        content
      });
    }
  }

  getMessages(roomCode, limit = 50) {
    if (this.socket) {
      this.socket.emit('get_messages', {
        roomCode,
        limit
      });
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();
