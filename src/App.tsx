import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ForcePasswordChange from './components/ForcePasswordChange';
import { appConfig } from './config/appConfig';
import './App.css';

const AppContent: React.FC = () => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  // Si l'utilisateur doit changer son mot de passe
  if (userData?.forcePasswordChange) {
    return <ForcePasswordChange />;
  }

  return <Dashboard />;
};

function App() {
  // Mettre à jour le titre de la page avec la configuration
  useEffect(() => {
    document.title = `${appConfig.appTitle} - ${appConfig.schoolName}`;
  }, []);

  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;
