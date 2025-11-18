import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import { roomAPI } from '../services/api';
import { formatDate, formatFileSize } from '../utils/helpers';
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
  const hasJoinedRef = useRef(false); // Guard para prevenir múltiples llamadas
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('currentRoom') || '{}');
  const { roomCode, pin, nickname } = currentUser;

  // Debug: Verificar que el nickname no sea un hash
  useEffect(() => {
    if (nickname && nickname.length === 8 && /^[a-f0-9]+$/.test(nickname)) {
      console.error('⚠️ ADVERTENCIA: El nickname parece ser un hash:', nickname);
      console.log('🔧 Limpiando localStorage corrupto...');
      localStorage.removeItem('currentRoom');
      alert('Tu sesión se corrompió. Por favor, vuelve a unirte a la sala.');
      navigate('/join');
    }
  }, [nickname, navigate]);

  useEffect(() => {
    if (!roomCode || !pin || !nickname) {
      navigate('/join');
      return;
    }

    // Prevenir múltiples llamadas a joinRoom
    if (hasJoinedRef.current) {
      console.log('⚠️ Ya se intentó unir a la sala, ignorando duplicado');
      return;
    }
    hasJoinedRef.current = true;

    // Conectar socket
    const socket = socketService.connect();

    // Event listeners
    const handleJoinedRoom = (data) => {
      console.log('✅ Unido a la sala:', data);
      console.log('👤 Mi nickname (localStorage):', nickname);
      console.log('👥 Usuarios conectados:', data.users);
      
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
          data.errorCode === 'ROOM_NOT_FOUND' ||
          data.errorCode === 'SESSION_REPLACED') {
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
      // Mensaje del sistema con nickname hasheado
      const displayName = data.users.find(u => u.nickname === data.nickname)?.displayName || data.nickname;
      setMessages(prev => [...prev, {
        type: 'SYSTEM',
        content: `${displayName} se unió a la sala`,
        createdAt: new Date()
      }]);
    };

    const handleUserLeft = (data) => {
      setUsers(data.users);
      // Mostrar nickname hasheado en mensaje de sistema
      const displayName = data.displayName || data.nicknameHash || data.nickname;
      setMessages(prev => [...prev, {
        type: 'SYSTEM',
        content: `${displayName} dejó la sala`,
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

    // Unirse a la sala (el backend ahora maneja el deviceId automáticamente)
    socketService.joinRoom(roomCode, pin, nickname);

    // Cleanup
    return () => {
      socket.off('joined_room', handleJoinedRoom);
      socket.off('error', handleError);
      socket.off('new_message', handleNewMessage);
      socket.off('messages_history', handleMessagesHistory);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      // Resetear el flag cuando el componente se desmonta
      hasJoinedRef.current = false;
      // NO desconectar el socket aquí - solo remover listeners
      // El socket se desconectará automáticamente cuando el usuario cierre la pestaña
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
    
    // Debug logs simplificados
    console.log(`📨 [${msg.content?.substring(0, 15)}...] msgNick="${msg.nickname}" | myNick="${nickname}" | ¿EsMío? ${isOwnMessage}`);
    
    // Mostrar nickname: 
    // - Si es mensaje propio: SIEMPRE mostrar el nickname real de localStorage
    // - Si es de otro: mostrar hash de la lista de usuarios
    let displayNickname;
    if (isOwnMessage) {
      displayNickname = nickname; // Nickname real desde localStorage
      console.log(`✅ ES MI MENSAJE - Mostrando: "${displayNickname}"`);
    } else {
      // Para otros usuarios, buscar su hash en la lista de usuarios conectados
      const user = users.find(u => u.nickname === msg.nickname);
      // Si no está en la lista (desconectado), mostrar solo el hash o nickname del mensaje
      displayNickname = user?.displayName || user?.nicknameHash || msg.nickname;
      console.log(`👤 Es de otro usuario - Mostrando: "${displayNickname}" (original: "${msg.nickname}")`);
    }
    
    console.log(`🎯 FINAL displayNickname para "${msg.content?.substring(0, 10)}": "${displayNickname}"`);

    if (msg.type === 'FILE') {
      const isImage = msg.fileMimeType?.startsWith('image/');
      const isVideo = msg.fileMimeType?.startsWith('video/');
      const isAudio = msg.fileMimeType?.startsWith('audio/');
      
      // Construir URL dinámica del archivo
      const protocol = window.location.protocol;
      const host = window.location.hostname;
      const port = host === 'localhost' || host === '127.0.0.1' ? '3001' : '3001';
      const fileUrl = `${protocol}//${host}:${port}${msg.fileUrl}`;

      return (
        <div key={msg.messageId || index} className={`message ${isOwnMessage ? 'message-own' : 'message-other'}`}>
          <div className="message-header">
            <strong>{displayNickname}</strong>
            <span className="message-time">{formatDate(msg.createdAt)}</span>
          </div>
          
          {isImage && (
            <div className="message-image">
              <img 
                src={fileUrl} 
                alt={msg.content}
                loading="lazy"
                onClick={() => window.open(fileUrl, '_blank')}
              />
              <small className="file-name">{msg.content}</small>
            </div>
          )}

          {isVideo && (
            <div className="message-video">
              <video controls width="100%">
                <source src={fileUrl} type={msg.fileMimeType} />
                Tu navegador no soporta videos.
              </video>
              <small className="file-name">{msg.content}</small>
            </div>
          )}

          {isAudio && (
            <div className="message-audio">
              <audio controls>
                <source src={fileUrl} type={msg.fileMimeType} />
                Tu navegador no soporta audio.
              </audio>
              <small className="file-name">{msg.content}</small>
            </div>
          )}

          {!isImage && !isVideo && !isAudio && (
            <div className="message-file">
              <div className="file-icon">📎</div>
              <div className="file-info">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  {msg.content}
                </a>
                <small>{formatFileSize(msg.fileSizeBytes)}</small>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={msg.messageId || index} className={`message ${isOwnMessage ? 'message-own' : 'message-other'}`}>
        <div className="message-header">
          <strong>{displayNickname}</strong>
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
            {users.map((user, index) => {
              // El usuario actual siempre ve su nickname real
              const isCurrentUser = user.nickname === nickname || user.nicknameHash === nickname;
              const displayText = isCurrentUser ? nickname : (user.displayName || user.nicknameHash || user.nickname);
              
              return (
                <li key={index} className={isCurrentUser ? 'user-own' : ''}>
                  <span className="user-status">●</span>
                  {displayText}
                  {isCurrentUser && ' (tú)'}
                </li>
              );
            })}
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
