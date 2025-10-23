import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resetPassword } from '../services/auth';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (error) {
      setError('Échec de la connexion. Vérifiez vos identifiants.');
    }

    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      setResetMessage('Veuillez entrer votre adresse email.');
      return;
    }

    try {
      setResetLoading(true);
      setResetMessage('');

      // Utiliser la méthode du service auth
      await resetPassword(resetEmail);

      // Fermer le modal
      setShowResetModal(false);
      setResetEmail('');
      setResetMessage('');

      // Afficher le message de succès sur la page principale
      setSuccessMessage('✓ Email envoyé avec succès ! Vérifiez votre boîte de réception (et vos spams) pour réinitialiser votre mot de passe.');

      // Effacer le message après 8 secondes
      setTimeout(() => {
        setSuccessMessage('');
      }, 8000);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setResetMessage('Aucun utilisateur trouvé avec cet email.');
      } else if (error.code === 'auth/invalid-email') {
        setResetMessage('Adresse email invalide.');
      } else {
        setResetMessage('Erreur lors de l\'envoi de l\'email. Veuillez réessayer.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const openResetModal = () => {
    setShowResetModal(true);
    setResetMessage('');
    setResetEmail('');
    setSuccessMessage(''); // Effacer le message de succès précédent
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Connexion</h2>

        {successMessage && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontSize: '0.95rem',
              fontWeight: 500,
              backgroundColor: '#d1fae5',
              color: '#065f46',
              border: '1px solid #6ee7b7',
              lineHeight: '1.5',
              textAlign: 'center'
            }}
          >
            {successMessage}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mot de passe:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={openResetModal}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Mot de passe oublié ?
          </button>
        </div>
      </form>

      {/* Modal de réinitialisation du mot de passe */}
      {showResetModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowResetModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '450px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              position: 'relative'
            }}
          >
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>
                Réinitialiser le mot de passe
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowResetModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  lineHeight: 1,
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePasswordReset}>
              <p style={{ marginBottom: '1.5rem', color: '#6b7280', lineHeight: '1.6' }}>
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              {resetMessage && (
                <div
                  className={resetMessage.includes('✓') ? 'success' : 'error'}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    backgroundColor: resetMessage.includes('✓') ? '#d1fae5' : '#fee2e2',
                    color: resetMessage.includes('✓') ? '#065f46' : '#991b1b',
                    border: resetMessage.includes('✓') ? '1px solid #6ee7b7' : '1px solid #fca5a5',
                    lineHeight: '1.5'
                  }}
                >
                  {resetMessage}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="resetEmail" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Adresse email:
                </label>
                <input
                  type="email"
                  id="resetEmail"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  disabled={resetLoading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    opacity: resetLoading ? 0.7 : 1
                  }}
                >
                  {resetLoading ? 'Envoi...' : 'Envoyer le lien'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;