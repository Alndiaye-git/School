import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase/config';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!oobCode) {
      setError('Lien de réinitialisation invalide.');
      setValidating(false);
      return;
    }

    // Vérifier que le code est valide
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setValidating(false);
      })
      .catch(() => {
        setError('Ce lien de réinitialisation est invalide ou a expiré.');
        setValidating(false);
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!oobCode) {
      setError('Code de réinitialisation manquant.');
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);

      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      if (error.code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible.');
      } else if (error.code === 'auth/expired-action-code') {
        setError('Ce lien a expiré. Veuillez demander un nouveau lien.');
      } else {
        setError('Erreur lors de la réinitialisation. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h2>Vérification...</h2>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>
            Validation du lien de réinitialisation...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h2>✓ Mot de passe réinitialisé !</h2>
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              marginTop: '1.5rem',
              fontSize: '0.95rem',
              fontWeight: 500,
              backgroundColor: '#d1fae5',
              color: '#065f46',
              border: '1px solid #6ee7b7',
              lineHeight: '1.5',
              textAlign: 'center'
            }}
          >
            Votre mot de passe a été réinitialisé avec succès.
            <br />
            Redirection vers la page de connexion...
          </div>
        </div>
      </div>
    );
  }

  if (error && !oobCode) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h2>Lien invalide</h2>
          <div className="error">{error}</div>
          <button
            onClick={() => navigate('/login')}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Nouveau mot de passe</h2>

        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '1.5rem' }}>
          Réinitialisation pour : <strong>{email}</strong>
        </p>

        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label htmlFor="newPassword">Nouveau mot de passe:</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Au moins 6 caractères"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '0.9rem'
              }}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmer le mot de passe:</label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Retapez le mot de passe"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: loading
              ? '#9ca3af'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '0.5rem'
          }}
        >
          {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Retour à la connexion
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;
