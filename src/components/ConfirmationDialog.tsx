import React from 'react';
import { User, Classe, Eleve } from '../types';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type: 'user' | 'classe' | 'eleve';
  dependencies?: {
    classes?: Classe[];
    eleves?: Eleve[];
  };
  loading?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type,
  dependencies,
  loading = false
}) => {
  if (!isOpen) return null;

  const renderDependencies = () => {
    if (!dependencies) return null;

    return (
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ Éléments affectés :</h4>
        
        {dependencies.classes && dependencies.classes.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <strong>Classes assignées ({dependencies.classes.length}) :</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              {dependencies.classes.map(classe => (
                <li key={classe.id}>
                  {classe.nom} - {classe.niveau} ({classe.annee_scolaire_id})
                </li>
              ))}
            </ul>
          </div>
        )}

        {dependencies.eleves && dependencies.eleves.length > 0 && (
          <div>
            <strong>Élèves dans la classe ({dependencies.eleves.length}) :</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px', maxHeight: '150px', overflowY: 'auto' }}>
              {dependencies.eleves.map(eleve => (
                <li key={eleve.id}>
                  {eleve.prenom} {eleve.nom}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8d7da', borderRadius: '4px', color: '#721c24' }}>
          <strong>⚠️ Action requise :</strong>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
            {type === 'user' && 'Vous devez d\'abord réassigner ces classes à un autre enseignant.'}
            {type === 'classe' && 'Vous devez d\'abord transférer ces élèves vers une autre classe.'}
          </p>
        </div>
      </div>
    );
  };

  const getActionText = () => {
    if (dependencies?.classes?.length || dependencies?.eleves?.length) {
      return 'Suppression impossible';
    }
    return loading ? 'Suppression...' : 'Confirmer la suppression';
  };

  const canConfirm = !loading && !(dependencies?.classes?.length || dependencies?.eleves?.length);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#dc3545' }}>
          {title}
        </h3>
        
        <p style={{ marginBottom: '20px', color: '#666', lineHeight: '1.5' }}>
          {message}
        </p>

        {renderDependencies()}

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'flex-end', 
          marginTop: '30px' 
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
            style={{ minWidth: '100px' }}
          >
            Annuler
          </button>
          
          {canConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="btn-primary"
              disabled={loading}
              style={{ 
                minWidth: '100px',
                backgroundColor: loading ? '#6c757d' : '#dc3545',
                borderColor: loading ? '#6c757d' : '#dc3545'
              }}
            >
              {getActionText()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;