import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { updateUser } from '../services/firestore';
import { auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

const ForcePasswordChange: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { userData, refreshUserData } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      if (auth.currentUser && userData) {
        // Mettre à jour le mot de passe dans Firebase Auth
        await updatePassword(auth.currentUser, newPassword);
        
        // Supprimer le flag forcePasswordChange dans Firestore
        await updateUser(userData.id, { forcePasswordChange: false });
        
        // Rafraîchir les données utilisateur
        await refreshUserData();
      }
    } catch (error: any) {
      console.error('Erreur lors du changement de mot de passe:', error);
      setError('Erreur lors du changement de mot de passe');
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Changement de mot de passe obligatoire</h2>
        <p style={{color: '#666', marginBottom: '20px', textAlign: 'center'}}>
          Pour des raisons de sécurité, vous devez changer votre mot de passe lors de votre première connexion.
        </p>
        
        {error && <div className="error">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="newPassword">Nouveau mot de passe:</label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Minimum 6 caractères"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmer le mot de passe:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Retapez votre nouveau mot de passe"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !newPassword || !confirmPassword}
          className="btn-primary"
        >
          {loading ? 'Changement...' : 'Changer le mot de passe'}
        </button>
      </form>
    </div>
  );
};

export default ForcePasswordChange;