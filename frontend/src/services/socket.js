import { io } from 'socket.io-client';

// Obtener la URL del socket dinámicamente
const getSocketUrl = () => {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1'
    ? 'http://localhost:5000'
    : `http://${host}:5000`;
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

  joinRoom(roomCode, pin, nickname, deviceId) {
    if (this.socket) {
      this.socket.emit('join_room', {
        roomCode,
        pin,
        nickname,
        deviceId
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
