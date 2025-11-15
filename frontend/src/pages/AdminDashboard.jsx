import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomAPI } from '../services/api';
import '../styles/Dashboard.css';

function AdminDashboard() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Formulario de nueva sala
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('TEXT');
  const [pin, setPin] = useState('');
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(10);
  
  const navigate = useNavigate();
  const username = localStorage.getItem('adminUsername');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    loadRooms();
  }, [navigate]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await roomAPI.getRooms();
      setRooms(data.rooms);
    } catch (err) {
      setError('Error al cargar las salas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }

    try {
      const data = await roomAPI.createRoom(type, pin, maxFileSizeMB);
      setSuccess(`¡Sala creada! Código: ${data.roomCode}`);
      setShowForm(false);
      setPin('');
      loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear sala');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    navigate('/admin/login');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess(`Copiado: ${text}`);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="container dashboard-container">
      <div className="card">
        <div className="dashboard-header">
          <div>
            <h1>Panel de Administración</h1>
            <p className="welcome-text">Bienvenido, {username}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary">
            Cerrar Sesión
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="actions">
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-primary"
          >
            {showForm ? 'Cancelar' : '+ Nueva Sala'}
          </button>
        </div>

        {showForm && (
          <div className="card form-card">
            <h2>Crear Nueva Sala</h2>
            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label>Tipo de Sala</label>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="TEXT">Solo Texto</option>
                  <option value="MULTIMEDIA">Multimedia (Texto + Archivos)</option>
                </select>
              </div>

              <div className="form-group">
                <label>PIN de Acceso (mínimo 4 dígitos)</label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  pattern="\d*"
                  required
                />
              </div>

              {type === 'MULTIMEDIA' && (
                <div className="form-group">
                  <label>Tamaño Máximo de Archivo (MB)</label>
                  <input
                    type="number"
                    value={maxFileSizeMB}
                    onChange={(e) => setMaxFileSizeMB(e.target.value)}
                    min="1"
                    max="50"
                  />
                </div>
              )}

              <button type="submit" className="btn btn-success w-full">
                Crear Sala
              </button>
            </form>
          </div>
        )}

        <div className="rooms-section">
          <h2>Salas Creadas ({rooms.length})</h2>
          
          {loading ? (
            <div className="spinner"></div>
          ) : rooms.length === 0 ? (
            <p className="no-rooms">No hay salas creadas aún</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Código de Sala</th>
                  <th>Tipo</th>
                  <th>Tamaño Máx.</th>
                  <th>Fecha Creación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      <strong>{room.roomCode}</strong>
                    </td>
                    <td>
                      <span className={`badge ${room.type === 'MULTIMEDIA' ? 'badge-multimedia' : 'badge-text'}`}>
                        {room.type}
                      </span>
                    </td>
                    <td>{room.maxFileSizeMB} MB</td>
                    <td>{new Date(room.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${room.status === 'ACTIVE' ? 'badge-active' : 'badge-closed'}`}>
                        {room.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => copyToClipboard(room.roomCode)}
                        className="btn-small btn-primary"
                      >
                        Copiar Código
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
