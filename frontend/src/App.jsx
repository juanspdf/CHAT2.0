import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AdminLogin from './pages/AdminLogin';
import AdminSetup2FA from './pages/AdminSetup2FA';
import AdminDashboard from './pages/AdminDashboard';
import JoinRoom from './pages/JoinRoom';
import Chat from './pages/Chat';
import tokenService from './services/tokenService';
import './styles/global.css';

function App() {
  // Inicializar servicio de tokens al cargar la app
  useEffect(() => {
    tokenService.initialize();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/setup-2fa" element={<AdminSetup2FA />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
