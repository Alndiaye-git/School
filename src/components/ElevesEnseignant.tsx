import React, { useState, useEffect } from 'react';
import { Eleve, Classe } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getActiveEleves, getActiveClassesByAnneeScolaire } from '../services/softDelete';
import { anneeScolaireService } from '../services/anneeScolaire';
import HistoriqueAbsencesEleve from './HistoriqueAbsencesEleve';
import { sortElevesByNom } from '../utils/sorting';

const ElevesEnseignant: React.FC = () => {
  const { userData } = useAuth();
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [mesClasses, setMesClasses] = useState<Classe[]>([]);
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const [selectedEleveId, setSelectedEleveId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [userData]);

  const loadData = async () => {
    if (!userData?.id) return;
    
    try {
      setLoading(true);
      
      // Récupérer l'année scolaire active
      const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
      if (!anneeScolaireActive) {
        console.warn('Aucune année scolaire active');
        return;
      }

      // Récupérer toutes les classes de l'année active puis filtrer par enseignant
      const toutesLesClasses = await getActiveClassesByAnneeScolaire(anneeScolaireActive.id);
      const classesEnseignant = toutesLesClasses.filter(classe => classe.enseignant_id === userData.id);
      // Tri naturel des classes par nom (comprend les nombres)
      const classesSorted = classesEnseignant.sort((a, b) =>
        a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' })
      );
      setMesClasses(classesSorted);

      // Récupérer tous les élèves des classes de l'enseignant
      const elevesData = await getActiveEleves();
      const classesIds = classesEnseignant.map(c => c.id);
      const elevesDesMesClasses = elevesData.filter(e => classesIds.includes(e.classe_id));
      
      setEleves(elevesDesMesClasses);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleVoirAbsences = (eleveId: string) => {
    setSelectedEleveId(eleveId);
    setShowHistorique(true);
  };

  const getClasseNom = (classeId: string) => {
    const classe = mesClasses.find(c => c.id === classeId);
    return classe ? classe.nom : 'Classe inconnue';
  };

  const getClasseNiveau = (classeId: string) => {
    const classe = mesClasses.find(c => c.id === classeId);
    return classe ? classe.niveau : '';
  };

  const filteredEleves = eleves.filter(eleve => {
    // Filtre par classe sélectionnée
    const matchesClasse = selectedClasse === '' || eleve.classe_id === selectedClasse;
    
    // Filtre par recherche (seulement si une classe est sélectionnée)
    const matchesSearch = !selectedClasse || searchTerm === '' || 
      eleve.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eleve.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eleve.numero_eleve?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesClasse && matchesSearch;
  });

  // Si une classe est sélectionnée, afficher seulement cette classe
  const elevesParClasse = selectedClasse 
    ? mesClasses
        .filter(classe => classe.id === selectedClasse)
        .map(classe => ({
          classe,
          eleves: sortElevesByNom(filteredEleves)
        }))
    : [];

  const totalEleves = filteredEleves.length;

  if (loading) {
    return (
      <div className="eleves-enseignant">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement de vos élèves...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="eleves-enseignant">
      <div className="header">
        <h2>
          👥 Mes Élèves
          <span className="eleves-count">({totalEleves} élèves)</span>
        </h2>
        <div className="header-info">
          <span className="classes-count">
            📚 {mesClasses.length} classe{mesClasses.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filtres */}
      <div className="filters-section-enseignant">
        <div className="filter-classe">
          <label htmlFor="classe-select">📋 Sélectionner une classe :</label>
          <select
            id="classe-select"
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            className="classe-select"
          >
            <option value="">-- Choisir une classe --</option>
            {mesClasses.map(classe => (
              <option key={classe.id} value={classe.id}>
                {classe.nom} ({classe.niveau})
              </option>
            ))}
          </select>
        </div>
        
        {selectedClasse && (
          <div className="search-container">
            <div className="search-icon">🔍</div>
            <input
              type="text"
              placeholder="Rechercher un élève dans cette classe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input-main"
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm('')}
                title="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Statistiques rapides */}
      <div className="stats-overview-horizontal">
        <div className="stat-item-horizontal">
          <span className="stat-icon-horizontal">👥</span>
          <span className="stat-number-horizontal">{totalEleves}</span>
          <span className="stat-label-horizontal">Élèves</span>
        </div>
        <div className="stat-item-horizontal">
          <span className="stat-icon-horizontal">📚</span>
          <span className="stat-number-horizontal">{mesClasses.length}</span>
          <span className="stat-label-horizontal">Classes</span>
        </div>
        <div className="stat-item-horizontal">
          <span className="stat-icon-horizontal">📅</span>
          <span className="stat-number-horizontal">{new Date().toLocaleDateString('fr-FR', { month: 'long' })}</span>
          <span className="stat-label-horizontal">Mois actuel</span>
        </div>
      </div>

      {/* Liste des élèves par classe */}
      {!selectedClasse ? (
        <div className="no-students">
          <div className="no-students-icon">📋</div>
          <div className="no-students-content">
            <h3>Sélectionnez une classe</h3>
            <p>Choisissez une de vos classes dans le menu déroulant ci-dessus pour voir la liste des élèves.</p>
            <div className="classes-disponibles">
              <p><strong>Vos classes :</strong></p>
              <ul>
                {mesClasses.map(classe => (
                  <li key={classe.id}>
                    📚 {classe.nom} ({classe.niveau})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : elevesParClasse.length === 0 || elevesParClasse[0]?.eleves.length === 0 ? (
        <div className="no-students">
          <div className="no-students-icon">🔍</div>
          <div className="no-students-content">
            <h3>Aucun élève trouvé</h3>
            <p>
              {searchTerm ? 
                'Aucun élève ne correspond aux critères de recherche dans cette classe.' :
                'Cette classe ne contient aucun élève.'
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="classes-sections">
          {elevesParClasse.map(({ classe, eleves }) => (
            <div key={classe.id} className="classe-section">
              <div className="classe-header">
                <h3>
                  📋 Classe {classe.nom}
                  <span className="classe-niveau">({classe.niveau})</span>
                  <span className="eleves-count-classe">
                    {eleves.length} élève{eleves.length > 1 ? 's' : ''}
                  </span>
                </h3>
              </div>
              
              <div className="eleves-list">
                {eleves.map((eleve, index) => (
                  <div key={eleve.id} className="eleve-item">
                    <div className="eleve-number">{index + 1}</div>
                    <div className="eleve-avatar">
                      {eleve.prenom.charAt(0)}{eleve.nom.charAt(0)}
                    </div>
                    <div className="eleve-info">
                      <div className="eleve-nom">{eleve.prenom} {eleve.nom}</div>
                      <div className="eleve-details">
                        <span className="numero-eleve">N° {eleve.numero_eleve || 'N/A'}</span>
                        <span className="eleve-naissance">
                          Né(e) le {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <div className="eleve-actions">
                      <button 
                        onClick={() => handleVoirAbsences(eleve.id)} 
                        className="btn-view-absences"
                        title="Voir l'historique des absences"
                      >
                        📊 Absences
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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

export default ElevesEnseignant;