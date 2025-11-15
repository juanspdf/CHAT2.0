import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isValidPin, isValidNickname } from '../utils/helpers';
import '../styles/JoinRoom.css';

function JoinRoom() {
  const [roomCode, setRoomCode] = useState('');
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!roomCode.trim()) {
      setError('El código de sala es requerido');
      return;
    }

    if (!isValidPin(pin)) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }

    if (!isValidNickname(nickname)) {
      setError('El nickname debe tener entre 3 y 20 caracteres');
      return;
    }

    // Guardar datos y navegar al chat
    localStorage.setItem('currentRoom', JSON.stringify({
      roomCode: roomCode.toUpperCase().trim(),
      pin,
      nickname: nickname.trim()
    }));

    navigate('/chat');
  };

  return (
    <div className="join-container">
      <div className="card join-card">
        <h1 className="join-title">Unirse a una Sala</h1>
        <p className="join-subtitle">Ingresa el código de sala y tu nickname para comenzar</p>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="roomCode">Código de Sala</label>
            <input
              type="text"
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              maxLength="8"
              required
            />
            <small>Solicita el código al administrador de la sala</small>
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN de Acceso</label>
            <input
              type="password"
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="1234"
              pattern="\d*"
              required
            />
            <small>Mínimo 4 dígitos</small>
          </div>

          <div className="form-group">
            <label htmlFor="nickname">Tu Nickname</label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="JuanP"
              minLength="3"
              maxLength="20"
              required
            />
            <small>Entre 3 y 20 caracteres</small>
          </div>

          <button type="submit" className="btn btn-primary w-full">
            Unirse a la Sala
          </button>
        </form>

        <div className="mt-2 text-center">
          <button
            onClick={() => navigate('/admin/login')}
            className="btn btn-secondary"
          >
            ¿Administrador? Inicia sesión aquí
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinRoom;
