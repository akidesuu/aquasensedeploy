import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Dashboard from './Dashboard';
import Login from './Login';
import './index.css';

const AppRoot = () => {
  // Read session status directly out of browser local memory storage cache
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('aquasense_session_active') === 'true';
  });

  const handleLoginSuccess = (username: string) => {
    localStorage.setItem('aquasense_session_active', 'true');
    localStorage.setItem('aquasense_session_user', username);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('aquasense_session_active');
    localStorage.removeItem('aquasense_session_user');
    setIsAuthenticated(false);
  };

  return isAuthenticated ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <Login onLoginSuccess={handleLoginSuccess} />
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);