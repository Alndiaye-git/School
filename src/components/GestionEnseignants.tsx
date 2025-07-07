import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { updateUser } from '../services/firestore';
import { softDeleteUser, getActiveUsers, createAuditLog } from '../services/softDelete';
import { createEnseignant } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import TableResponsive from './TableResponsive';
import FormResponsive from './FormResponsive';

type SortField = 'nom' | 'email' | 'matricule';
type SortOrder = 'asc' | 'desc';

const GestionEnseignants: React.FC = () => {
  const { userData } = useAuth();
  const [enseignants, setEnseignants] = useState<User[]>([]);
  const [filteredEnseignants, setFilteredEnseignants] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEnseignant, setEditingEnseignant] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [directeurPassword, setDirecteurPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingEnseignantData, setPendingEnseignantData] = useState<{nom: string, email: string, password: string} | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    loadEnseignants();
  }, []);

  const loadEnseignants = async () => {
    try {
      const users = await getActiveUsers();
      const enseignantsList = users.filter(user => user.role === 'enseignant');
      setEnseignants(enseignantsList);
    } catch (error) {
      console.error('Erreur lors du chargement des enseignants:', error);
    }
  };

  // Fonction de tri
  const sortEnseignants = (enseignants: User[], field: SortField, order: SortOrder) => {
    return [...enseignants].sort((a, b) => {
      let aValue = '';
      let bValue = '';
      
      switch (field) {
        case 'matricule':
          aValue = a.matricule || '';
          bValue = b.matricule || '';
          break;
        default:
          aValue = a[field] || '';
          bValue = b[field] || '';
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  // Fonction de filtrage/recherche
  const filterEnseignants = (enseignants: User[]) => {
    if (!searchTerm) return enseignants;
    
    const term = searchTerm.toLowerCase();
    return enseignants.filter(enseignant => 
      enseignant.nom.toLowerCase().includes(term) ||
      enseignant.email.toLowerCase().includes(term) ||
      (enseignant.matricule && enseignant.matricule.toLowerCase().includes(term))
    );
  };

  // Appliquer tri et filtre
  useEffect(() => {
    const filtered = filterEnseignants(enseignants);
    const sorted = sortEnseignants(filtered, sortField, sortOrder);
    setFilteredEnseignants(sorted);
  }, [enseignants, sortField, sortOrder, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingEnseignant) {
        // Modification d'un enseignant existant
        await updateUser(editingEnseignant.id, {
          nom: formData.nom,
          email: formData.email
        });
        showMessage('success', 'Enseignant modifié avec succès !');
        await loadEnseignants();
        resetForm();
      } else {
        // Création d'un nouvel enseignant - demander le mot de passe du directeur
        setPendingEnseignantData(formData);
        setShowPasswordDialog(true);
      }
    } catch (error: any) {
      let errorMessage = editingEnseignant 
        ? 'Erreur lors de la modification de l\'enseignant'
        : 'Erreur lors de la création de l\'enseignant';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cette adresse email est déjà utilisée';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Adresse email invalide';
      }
      
      showMessage('error', errorMessage);
    }
    
    setLoading(false);
  };

  const handleCreateEnseignant = async () => {
    if (!pendingEnseignantData || !userData) return;
    
    setLoading(true);
    try {
      const newUserId = await createEnseignant(
        pendingEnseignantData.nom, 
        pendingEnseignantData.email, 
        pendingEnseignantData.password,
        userData.email,
        directeurPassword
      );
      
      // Créer un log d'audit
      await createAuditLog('create', 'user', newUserId, pendingEnseignantData.nom, userData.id, {
        role: 'enseignant',
        email: pendingEnseignantData.email
      });
      
      showMessage('success', 'Enseignant créé avec succès !');
      await loadEnseignants();
      resetForm();
      setShowPasswordDialog(false);
      setDirecteurPassword('');
      setPendingEnseignantData(null);
    } catch (error: any) {
      let errorMessage = 'Erreur lors de la création de l\'enseignant';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cette adresse email est déjà utilisée';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Adresse email invalide';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Mot de passe directeur incorrect';
      }
      
      showMessage('error', errorMessage);
    }
    setLoading(false);
  };

  const cancelPasswordDialog = () => {
    setShowPasswordDialog(false);
    setDirecteurPassword('');
    setPendingEnseignantData(null);
    setLoading(false);
  };

  const handleEdit = (enseignant: User) => {
    setEditingEnseignant(enseignant);
    setFormData({
      nom: enseignant.nom,
      email: enseignant.email,
      password: '' // Ne pas préremplir le mot de passe
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!userData) return;
    
    try {
      const result = await softDeleteUser(id, userData.id);
      
      if (!result.canDelete) {
        // Afficher le dialogue de confirmation avec les dépendances
        const classesNames = result.dependencies?.classes?.map(c => c.nom).join(', ');
        const confirmMessage = `${result.message}\n\nClasses assignées : ${classesNames}\n\nVoulez-vous vraiment continuer ?`;
        
        if (!window.confirm(confirmMessage)) {
          return;
        }
        
        // L'utilisateur veut continuer malgré les dépendances
        showMessage('error', 'Suppression annulée : l\'enseignant a des classes assignées.');
        return;
      }
      
      // Créer un log d'audit
      await createAuditLog('delete', 'user', id, nom, userData.id, {
        role: 'enseignant'
      });
      
      showMessage('success', result.message || 'Enseignant supprimé avec succès');
      await loadEnseignants();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showMessage('error', 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({ nom: '', email: '', password: '' });
    setEditingEnseignant(null);
    setShowForm(false);
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="gestion-enseignants">
      <div className="header">
        <h2>Gestion des Enseignants</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Ajouter un enseignant
        </button>
      </div>

      {message && (
        <div className={`message ${message.type} auto-hide`}>
          {message.text}
        </div>
      )}

      <div className="header-compact">
        <div className="selection-row">
          <div className="input-group">
            <label>Rechercher</label>
            <input
              type="text"
              placeholder="Nom, email ou matricule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="date-input"
            />
          </div>
          
          <div className="stats-inline">
            <div className="classe-title">
              {filteredEnseignants.length} enseignant{filteredEnseignants.length > 1 ? 's' : ''} trouvé{filteredEnseignants.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="form-container">
          <FormResponsive
            title={editingEnseignant ? 'Modifier l\'enseignant' : 'Nouvel enseignant'}
            fields={[
              {
                name: 'nom',
                label: 'Nom complet',
                type: 'text',
                required: true,
                placeholder: 'Nom complet de l\'enseignant',
                width: 'half'
              },
              {
                name: 'email',
                label: 'Email',
                type: 'email',
                required: true,
                placeholder: 'adresse@email.com',
                width: 'half'
              },
              ...(editingEnseignant ? [] : [{
                name: 'password',
                label: 'Mot de passe temporaire',
                type: 'password' as const,
                required: true,
                validation: {
                  min: 6,
                  message: 'Minimum 6 caractères. L\'enseignant pourra le changer après connexion.'
                },
                width: 'full' as const
              }])
            ]}
            values={formData}
            onChange={handleFieldChange}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            submitLabel={loading ? (editingEnseignant ? 'Modification...' : 'Création...') : (editingEnseignant ? 'Modifier' : 'Créer l\'enseignant')}
            cancelLabel="Annuler"
            isLoading={loading}
            className="enseignant-form"
          />
        </div>
      )}

      {filteredEnseignants.length > 0 && (
        <div className="sorting-controls">
          <div className="sort-buttons">
            <button 
              className={`sort-btn ${sortField === 'matricule' ? 'active' : ''}`}
              onClick={() => handleSort('matricule')}
            >
              Matricule {getSortIcon('matricule')}
            </button>
            <button 
              className={`sort-btn ${sortField === 'nom' ? 'active' : ''}`}
              onClick={() => handleSort('nom')}
            >
              Nom {getSortIcon('nom')}
            </button>
            <button 
              className={`sort-btn ${sortField === 'email' ? 'active' : ''}`}
              onClick={() => handleSort('email')}
            >
              Email {getSortIcon('email')}
            </button>
          </div>
        </div>
      )}

      <TableResponsive
        data={filteredEnseignants}
        keyField="id"
        columns={[
          {
            key: 'matricule',
            label: 'Matricule',
            width: '120px',
            render: (value) => (
              <span className="numero-badge">
                {value || 'N/A'}
              </span>
            )
          },
          {
            key: 'nom',
            label: 'Nom',
            width: '200px'
          },
          {
            key: 'email',
            label: 'Email',
            width: '250px'
          },
          {
            key: 'status',
            label: 'Statut',
            width: '100px',
            render: () => (
              <span className="badge-present">Actif</span>
            )
          }
        ]}
        actions={(enseignant: User) => (
          <>
            <button
              onClick={() => handleEdit(enseignant)}
              className="btn-action btn-present"
              style={{marginRight: '8px'}}
            >
              Modifier
            </button>
            <button
              onClick={() => handleDelete(enseignant.id, enseignant.nom)}
              className="btn-action btn-absent"
            >
              Supprimer
            </button>
          </>
        )}
        emptyMessage={
          enseignants.length > 0 ? 
            "Aucun enseignant ne correspond à votre recherche." : 
            "Aucun enseignant enregistré."
        }
        className="table-enseignants"
      />

      {/* Dialogue pour demander le mot de passe du directeur */}
      {showPasswordDialog && (
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
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{marginTop: 0, marginBottom: '20px'}}>Confirmation requise</h3>
            <p style={{marginBottom: '20px', color: '#666'}}>
              Pour créer un nouvel enseignant, veuillez confirmer votre mot de passe de directeur :
            </p>
            <div className="form-group">
              <label htmlFor="directeur-password">Mot de passe directeur :</label>
              <input
                type="password"
                id="directeur-password"
                value={directeurPassword}
                onChange={(e) => setDirecteurPassword(e.target.value)}
                placeholder="Votre mot de passe"
                autoFocus
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px'}}>
              <button
                type="button"
                onClick={cancelPasswordDialog}
                className="btn-secondary"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateEnseignant}
                className="btn-primary"
                disabled={loading || !directeurPassword}
              >
                {loading ? 'Création...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionEnseignants;