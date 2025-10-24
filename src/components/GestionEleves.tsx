import React, { useState, useEffect } from 'react';
import { Eleve, Classe } from '../types';
import { createEleve, updateEleve } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getActiveEleves, getActiveClassesByAnneeScolaire, softDeleteEleve, createAuditLog } from '../services/softDelete';
import { anneeScolaireService } from '../services/anneeScolaire';
import HistoriqueAbsencesEleve from './HistoriqueAbsencesEleve';
import { sortElevesByNom } from '../utils/sorting';
import TableResponsive from './TableResponsive';
import FormResponsive from './FormResponsive';

const GestionEleves: React.FC = () => {
  const { userData } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null);
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [isAnneeVerrouillee, setIsAnneeVerrouillee] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const [selectedEleveId, setSelectedEleveId] = useState<string>('');
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    classe_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Récupérer l'année scolaire active
      const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();

      if (!anneeScolaireActive) {
        setClasses([]);
        setEleves([]);
        return;
      }
      
      // Vérifier si l'année est verrouillée
      setIsAnneeVerrouillee(anneeScolaireActive.verrouillee || false);
      
      // Charger les classes de l'année scolaire active
      const classesData = await getActiveClassesByAnneeScolaire(anneeScolaireActive.id);
      // Tri naturel des classes par nom (comprend les nombres)
      const classesSorted = classesData.sort((a, b) =>
        a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' })
      );
      setClasses(classesSorted);
      
      // Charger les élèves et filtrer par les classes de l'année active
      const elevesData = await getActiveEleves();
      const classesIds = classesData.map(c => c.id);
      const elevesFiltres = elevesData.filter(e => classesIds.includes(e.classe_id));
      
      setEleves(elevesFiltres);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    }
  };

  const generateNumeroEleve = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `E${year}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier si l'année est verrouillée
    if (isAnneeVerrouillee) {
      alert('🔒 Cette année scolaire est verrouillée. Les modifications sont interdites.');
      return;
    }
    
    try {
      // Récupérer l'année scolaire active pour l'affecter à l'élève
      const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
      if (!anneeScolaireActive) {
        alert('Aucune année scolaire active. Impossible de créer un élève.');
        return;
      }
      
      const dataToSave = {
        ...formData,
        numero_eleve: editingEleve ? editingEleve.numero_eleve : generateNumeroEleve(),
        annee_scolaire_id: anneeScolaireActive.id, // Lier l'élève à l'année active
        active: true
      };
      
      if (editingEleve) {
        await updateEleve(editingEleve.id, dataToSave);
      } else {
        const eleveId = await createEleve(dataToSave);
        
        // Log d'audit pour la création
        await createAuditLog(
          'create',
          'eleve',
          eleveId,
          `${formData.prenom} ${formData.nom}`,
          userData?.id || '',
          {
            prenom: formData.prenom,
            nom: formData.nom,
            date_naissance: formData.date_naissance,
            classe_id: formData.classe_id
          }
        );
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (eleve: Eleve) => {
    setEditingEleve(eleve);
    setFormData({
      nom: eleve.nom,
      prenom: eleve.prenom,
      date_naissance: eleve.date_naissance,
      classe_id: eleve.classe_id
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const eleve = eleves.find(e => e.id === id);
    if (!eleve) return;
    
    // Vérifier si l'année est verrouillée
    if (isAnneeVerrouillee) {
      alert('🔒 Cette année scolaire est verrouillée. Les modifications sont interdites.');
      return;
    }
    
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'élève ${eleve.prenom} ${eleve.nom} ?

Cette action supprimera également toutes ses absences (elles seront archivées).`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const result = await softDeleteEleve(id, userData?.id || '');
        
        if (result.canDelete) {
          // Log d'audit pour la suppression
          await createAuditLog(
            'delete',
            'eleve',
            id,
            `${eleve.prenom} ${eleve.nom}`,
            userData?.id || '',
            { absencesArchived: result.absencesArchived }
          );
          
          alert(result.message);
          await loadData();
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'élève.');
      }
    }
  };

  const resetForm = () => {
    setFormData({ nom: '', prenom: '', date_naissance: '', classe_id: '' });
    setEditingEleve(null);
    setShowForm(false);
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVoirAbsences = (eleveId: string) => {
    setSelectedEleveId(eleveId);
    setShowHistorique(true);
  };

  const getClasseNom = (classeId: string) => {
    const classe = classes.find(c => c.id === classeId);
    return classe ? classe.nom : 'Classe inconnue';
  };

  const filteredEleves = sortElevesByNom(
    selectedClasse 
      ? eleves.filter(eleve => eleve.classe_id === selectedClasse)
      : eleves
  );

  return (
    <div className="gestion-eleves">
      <div className="header">
        <h2>
          Gestion des Élèves
          {isAnneeVerrouillee && (
            <span className="badge-verrouille" title="Année verrouillée - Lecture seule">
              🔒 Année verrouillée
            </span>
          )}
        </h2>
        {!isAnneeVerrouillee && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Ajouter un élève
          </button>
        )}
      </div>

      <div className="filters">
        <div className="form-group">
          <label htmlFor="classe-filter">Filtrer par classe:</label>
          <select
            id="classe-filter"
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {classes.map(classe => (
              <option key={classe.id} value={classe.id}>
                {classe.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="form-container">
          <FormResponsive
            title={editingEleve ? 'Modifier l\'élève' : 'Nouvel élève'}
            fields={[
              {
                name: 'prenom',
                label: 'Prénom',
                type: 'text',
                required: true,
                placeholder: 'Prénom de l\'élève',
                width: 'half'
              },
              {
                name: 'nom',
                label: 'Nom',
                type: 'text',
                required: true,
                placeholder: 'Nom de l\'élève',
                width: 'half'
              },
              {
                name: 'date_naissance',
                label: 'Date de naissance',
                type: 'date',
                required: true,
                width: 'half'
              },
              {
                name: 'classe_id',
                label: 'Classe',
                type: 'select',
                required: true,
                options: [
                  { value: '', label: 'Sélectionner une classe' },
                  ...classes.map(classe => ({
                    value: classe.id,
                    label: classe.nom
                  }))
                ],
                width: 'half'
              }
            ]}
            values={formData}
            onChange={handleFieldChange}
            onSubmit={handleSubmit}
            onCancel={resetForm}
            submitLabel={editingEleve ? 'Modifier' : 'Créer'}
            cancelLabel="Annuler"
            className="eleve-form"
          />
        </div>
      )}

      <div className="eleves-list">
        <TableResponsive
          data={filteredEleves}
          keyField="id"
          columns={[
            {
              key: 'numero_eleve',
              label: 'N° Élève',
              width: '120px',
              render: (value) => (
                <span className="numero-eleve">
                  {value || 'N/A'}
                </span>
              )
            },
            {
              key: 'prenom',
              label: 'Prénom',
              width: '150px'
            },
            {
              key: 'nom',
              label: 'Nom',
              width: '150px'
            },
            {
              key: 'date_naissance',
              label: 'Date de naissance',
              width: '140px',
              render: (value) => new Date(value).toLocaleDateString('fr-FR')
            },
            {
              key: 'classe_id',
              label: 'Classe',
              width: '150px',
              render: (value) => getClasseNom(value)
            }
          ]}
          actions={(eleve: Eleve) => (
            <div className="actions-group">
              <button 
                onClick={() => handleVoirAbsences(eleve.id)} 
                className="btn-view"
                title="Voir l'historique des absences"
              >
                📋 Voir absences
              </button>
              {!isAnneeVerrouillee ? (
                <>
                  <button onClick={() => handleEdit(eleve)} className="btn-edit">
                    Modifier
                  </button>
                  <button onClick={() => handleDelete(eleve.id)} className="btn-delete">
                    Supprimer
                  </button>
                </>
              ) : (
                <span className="text-muted">🔒 Verrouillé</span>
              )}
            </div>
          )}
          emptyMessage="Aucun élève trouvé."
          className="table-eleves"
        />
      </div>

      {/* Modal historique des absences */}
      {showHistorique && selectedEleveId && (
        <HistoriqueAbsencesEleve
          eleveId={selectedEleveId}
          onClose={() => {
            setShowHistorique(false);
            setSelectedEleveId('');
          }}
        />
      )}
    </div>
  );
};

export default GestionEleves;