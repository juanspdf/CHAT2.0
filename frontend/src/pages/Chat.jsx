import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import { roomAPI } from '../services/api';
import { getDeviceId, formatDate, formatFileSize } from '../utils/helpers';
import '../styles/Chat.css';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('currentRoom') || '{}');
  const { roomCode, pin, nickname } = currentUser;

  useEffect(() => {
    if (!roomCode || !pin || !nickname) {
      navigate('/join');
      return;
    }

    // Conectar socket
    const socket = socketService.connect();
    const deviceId = getDeviceId();

    // Event listeners
    const handleJoinedRoom = (data) => {
      console.log('Unido a la sala:', data);
      setRoomInfo(data);
      setUsers(data.users);
      setConnected(true);
      setError('');
      
      // Solicitar historial de mensajes
      socketService.getMessages(roomCode);
    };

    const handleError = (data) => {
      console.error('Error de socket:', data);
      setError(data.message);
      setConnected(false);
      
      if (data.errorCode === 'ALREADY_IN_ROOM' || 
          data.errorCode === 'INVALID_PIN' ||
          data.errorCode === 'ROOM_NOT_FOUND') {
        setTimeout(() => navigate('/join'), 3000);
      }
    };

    const handleNewMessage = (data) => {
      console.log('Nuevo mensaje:', data);
      setMessages(prev => [...prev, data]);
    };

    const handleMessagesHistory = (data) => {
      console.log('Historial de mensajes:', data);
      setMessages(data.messages);
    };

    const handleUserJoined = (data) => {
      setUsers(data.users);
      // Mensaje del sistema
      setMessages(prev => [...prev, {
        type: 'SYSTEM',
        content: `${data.nickname} se unió a la sala`,
        createdAt: new Date()
      }]);
    };

    const handleUserLeft = (data) => {
      setUsers(data.users);
      setMessages(prev => [...prev, {
        type: 'SYSTEM',
        content: `${data.nickname} dejó la sala`,
        createdAt: new Date()
      }]);
    };

    // Registrar eventos
    socket.on('joined_room', handleJoinedRoom);
    socket.on('error', handleError);
    socket.on('new_message', handleNewMessage);
    socket.on('messages_history', handleMessagesHistory);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);

    // Unirse a la sala
    socketService.joinRoom(roomCode, pin, nickname, deviceId);

    // Cleanup
    return () => {
      socket.off('joined_room', handleJoinedRoom);
      socket.off('error', handleError);
      socket.off('new_message', handleNewMessage);
      socket.off('messages_history', handleMessagesHistory);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socketService.disconnect();
    };
  }, [roomCode, pin, nickname, navigate]);

  // Auto-scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !connected) return;

    socketService.sendMessage(roomCode, messageInput.trim());
    setMessageInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!roomInfo || roomInfo.type !== 'MULTIMEDIA') {
      setError('Esta sala no permite archivos multimedia');
      return;
    }

    setUploading(true);
    setError('');

    try {
      await roomAPI.uploadFile(roomCode, file, nickname);
      // El mensaje del archivo llegará por socket
    } catch (err) {
      setError(err.response?.data?.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLeaveRoom = () => {
    localStorage.removeItem('currentRoom');
    socketService.disconnect();
    navigate('/join');
  };

  const renderMessage = (msg, index) => {
    if (msg.type === 'SYSTEM') {
      return (
        <div key={index} className="message-system">
          <span>{msg.content}</span>
        </div>
      );
    }

    const isOwnMessage = msg.nickname === nickname;

    if (msg.type === 'FILE') {
      return (
        <div key={msg.messageId || index} className={`message ${isOwnMessage ? 'message-own' : 'message-other'}`}>
          <div className="message-header">
            <strong>{msg.nickname}</strong>
            <span className="message-time">{formatDate(msg.createdAt)}</span>
          </div>
          <div className="message-file">
            <div className="file-icon">📎</div>
            <div className="file-info">
              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                {msg.content}
              </a>
              <small>{formatFileSize(msg.fileSizeBytes)}</small>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.messageId || index} className={`message ${isOwnMessage ? 'message-own' : 'message-other'}`}>
        <div className="message-header">
          <strong>{msg.nickname}</strong>
          <span className="message-time">{formatDate(msg.createdAt)}</span>
        </div>
        <div className="message-content">
          {msg.content}
        </div>
      </div>
    );
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div>
          <h2>Sala: {roomCode}</h2>
          <p className="chat-subtitle">
            {connected ? `Conectado como ${nickname}` : 'Conectando...'}
            {roomInfo && ` • ${roomInfo.type}`}
          </p>
        </div>
        <button onClick={handleLeaveRoom} className="btn btn-danger btn-small">
          Salir
        </button>
      </div>

      <div className="chat-body">
        {/* Sidebar de usuarios */}
        <div className="chat-sidebar">
          <h3>Usuarios ({users.length})</h3>
          <ul className="users-list">
            {users.map((user, index) => (
              <li key={index} className={user.nickname === nickname ? 'user-own' : ''}>
                <span className="user-status">●</span>
                {user.nickname}
                {user.nickname === nickname && ' (tú)'}
              </li>
            ))}
          </ul>
        </div>

        {/* Área de mensajes */}
        <div className="chat-main">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No hay mensajes aún. ¡Sé el primero en escribir!</p>
              </div>
            ) : (
              messages.map((msg, index) => renderMessage(msg, index))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de mensaje */}
          <div className="message-input-container">
            <form onSubmit={handleSendMessage} className="message-form">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Escribe un mensaje..."
                disabled={!connected}
                className="message-input"
              />
              
              {roomInfo?.type === 'MULTIMEDIA' && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    disabled={!connected || uploading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary btn-icon"
                    disabled={!connected || uploading}
                    title="Subir archivo"
                  >
                    {uploading ? '⏳' : '📎'}
                  </button>
                </>
              )}
              
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!connected || !messageInput.trim()}
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
