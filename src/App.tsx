import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ForcePasswordChange from './components/ForcePasswordChange';
import ResetPassword from './components/ResetPassword';
import { appConfig } from './config/appConfig';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Si l'utilisateur doit changer son mot de passe
  if (userData?.forcePasswordChange) {
    return <ForcePasswordChange />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  // Mettre à jour le titre de la page avec la configuration
  useEffect(() => {
    document.title = `${appConfig.appTitle} - ${appConfig.schoolName}`;
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="App">
          <AppContent />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
