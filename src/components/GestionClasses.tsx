import React, { useState, useEffect } from 'react';
import { Classe, User } from '../types';
import { createClasse, updateClasse, checkClasseNameExists } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getActiveClasses, getActiveUsers, softDeleteClasse, createAuditLog, getActiveClassesByAnneeScolaire } from '../services/softDelete';
import { anneeScolaireService } from '../services/anneeScolaire';
import { AnneeScolaire } from '../types/anneeScolaire';
import TableResponsive from './TableResponsive';
import FormResponsive from './FormResponsive';

const GestionClasses: React.FC = () => {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [enseignants, setEnseignants] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClasse, setEditingClasse] = useState<Classe | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    niveau: '',
    annee_scolaire_id: '',
    enseignant_id: ''
  });
  const [error, setError] = useState<string>('');
  const [anneeScolaireActive, setAnneeScolaireActive] = useState<AnneeScolaire | null>(null);
  const [isAnneeVerrouillee, setIsAnneeVerrouillee] = useState(false);

  function getCurrentSchoolYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Si on est après août, on est dans l'année scolaire year-year+1
    if (month >= 8) {
      return `${year}-${year + 1}`;
    }
    // Sinon on est dans l'année scolaire year-1-year
    return `${year - 1}-${year}`;
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Charger l'année scolaire active
      const anneeActive = await anneeScolaireService.getAnneeScolaireActive();
      setAnneeScolaireActive(anneeActive);
      
      if (anneeActive) {
        // Utiliser l'ID de l'année active
        setFormData(prev => ({ ...prev, annee_scolaire_id: anneeActive.id }));
        
        // Vérifier si l'année est verrouillée
        setIsAnneeVerrouillee(anneeActive.verrouillee || false);
      }
      
      const [classesData, usersData] = await Promise.all([
        anneeActive ? getActiveClassesByAnneeScolaire(anneeActive.id) : getActiveClasses(),
        getActiveUsers()
      ]);
      
      setClasses(classesData);
      setEnseignants(usersData.filter(user => user.role === 'enseignant'));
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Vérifier si l'année est verrouillée
    if (isAnneeVerrouillee) {
      setError('🔒 Cette année scolaire est verrouillée. Les modifications sont interdites.');
      return;
    }
    
    try {
      // Vérifier l'unicité du nom de classe pour l'année scolaire
      if (!editingClasse || (editingClasse && editingClasse.nom !== formData.nom)) {
        const exists = await checkClasseNameExists(formData.nom, formData.annee_scolaire_id);
        if (exists) {
          const anneeScolaireNom = anneeScolaireActive?.nom || 'l\'année scolaire actuelle';
          setError(`Une classe "${formData.nom}" existe déjà pour l'année ${anneeScolaireNom}`);
          return;
        }
      }
      
      if (editingClasse) {
        await updateClasse(editingClasse.id, formData);
      } else {
        const newClasse = await createClasse(formData);
        // Log d'audit pour la création
        await createAuditLog(
          'create',
          'classe',
          newClasse || '',
          formData.nom,
          userData?.id || '',
          { niveau: formData.niveau, annee_scolaire_id: formData.annee_scolaire_id }
        );
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setError('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (classe: Classe) => {
    setEditingClasse(classe);
    setFormData({
      nom: classe.nom,
      niveau: classe.niveau || '',
      annee_scolaire_id: classe.annee_scolaire_id || anneeScolaireActive?.id || getCurrentSchoolYear(),
      enseignant_id: classe.enseignant_id
    });
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    const classe = classes.find(c => c.id === id);
    if (!classe) return;
    
    // Vérifier si l'année est verrouillée
    if (isAnneeVerrouillee) {
      alert('🔒 Cette année scolaire est verrouillée. Les modifications sont interdites.');
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette classe ?')) {
      try {
        const result = await softDeleteClasse(id, userData?.id || '');
        
        if (!result.canDelete) {
          // Afficher un message d'erreur avec les dépendances
          let dependencyMessage = result.message || 'Impossible de supprimer cette classe.';
          if (result.dependencies?.eleves) {
            dependencyMessage += '\n\nÉlèves concernés:';
            result.dependencies.eleves.forEach(eleve => {
              dependencyMessage += `\n- ${eleve.nom} ${eleve.prenom}`;
            });
          }
          alert(dependencyMessage);
          return;
        }
        
        // Log d'audit pour la suppression
        await createAuditLog(
          'delete',
          'classe',
          id,
          classe.nom,
          userData?.id || '',
          { niveau: classe.niveau, annee_scolaire_id: classe.annee_scolaire_id }
        );
        
        alert(result.message || 'Classe supprimée avec succès.');
        await loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la classe.');
      }
    }
  };

  const resetForm = () => {
    setFormData({ 
      nom: '', 
      niveau: '', 
      annee_scolaire_id: anneeScolaireActive?.id || getCurrentSchoolYear(), 
      enseignant_id: '' 
    });
    setEditingClasse(null);
    setShowForm(false);
    setError('');
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getEnseignantNom = (enseignantId: string) => {
    const enseignant = enseignants.find(e => e.id === enseignantId);
    return enseignant ? enseignant.nom : 'Non assigné';
  };

  return (
    <div className="gestion-classes">
      <div className="header">
        <h2>
          Gestion des Classes
          {isAnneeVerrouillee && (
            <span className="badge-verrouille" title="Année verrouillée - Lecture seule">
              🔒 Année verrouillée
            </span>
          )}
        </h2>
        {!isAnneeVerrouillee && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Ajouter une classe
          </button>
        )}
      </div>

      {showForm && (
        <div className="form-container">
          <FormResponsive
            title={editingClasse ? 'Modifier la classe' : 'Nouvelle classe'}
            fields={[
              {
                name: 'nom',
                label: 'Nom de la classe',
                type: 'text',
                required: true,
                placeholder: 'Ex: PS1, PS2, PS3, GS1, GS2, GS3',
                width: 'half'
              },
              {
                name: 'niveau',
                label: 'Niveau',
                type: 'select',
                options: [
                  { value: '', label: 'Sélectionner un niveau' },
                  { value: 'PS1', label: 'PS1' },
                  { value: 'PS2', label: 'PS2' },
                  { value: 'PS3', label: 'PS3' },
                  { value: 'GS1', label: 'GS1' },
                  { value: 'GS2', label: 'GS2' }
                ],
                width: 'half'
              },
              {
                name: 'annee_scolaire_display',
                label: 'Année scolaire',
                type: 'text',
                disabled: true,
                width: 'half',
                validation: {
                  message: !anneeScolaireActive ? '⚠️ Aucune année scolaire active. Veuillez en configurer une.' : undefined
                }
              },
              {
                name: 'enseignant_id',
                label: 'Enseignant',
                type: 'select',
                required: true,
                options: [
                  { value: '', label: 'Sélectionner un enseignant' },
                  ...enseignants.map(enseignant => ({
                    value: enseignant.id,
                    label: `${enseignant.nom} ${enseignant.matricule ? `(${enseignant.matricule})` : ''}`
                  }))
                ],
                width: 'half'
              }
            ]}
            values={{
              ...formData,
              annee_scolaire_display: anneeScolaireActive?.nom || formData.annee_scolaire_id
            }}
            onChange={handleFieldChange}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            submitLabel={editingClasse ? 'Modifier' : 'Créer'}
            cancelLabel="Annuler"
            error={error}
            className="classe-form"
          />
        </div>
      )}

      <div className="classes-list">
        <TableResponsive
          data={classes}
          keyField="id"
          columns={[
            {
              key: 'nom',
              label: 'Nom de la classe',
              width: '200px'
            },
            {
              key: 'niveau',
              label: 'Niveau',
              width: '120px',
              render: (value) => value || '-'
            },
            {
              key: 'annee_scolaire_id',
              label: 'Année scolaire',
              width: '180px',
              render: () => anneeScolaireActive?.nom || getCurrentSchoolYear()
            },
            {
              key: 'enseignant_id',
              label: 'Enseignant',
              width: '200px',
              render: (value) => getEnseignantNom(value)
            }
          ]}
          actions={(classe: Classe) => (
            !isAnneeVerrouillee ? (
              <>
                <button onClick={() => handleEdit(classe)} className="btn-edit">
                  Modifier
                </button>
                <button onClick={() => handleDelete(classe.id)} className="btn-delete">
                  Supprimer
                </button>
              </>
            ) : (
              <span className="text-muted">🔒 Verrouillé</span>
            )
          )}
          emptyMessage="Aucune classe trouvée."
          className="table-classes"
        />
      </div>
    </div>
  );
};

export default GestionClasses;