import React, { useState, useEffect } from 'react';
import { Classe, Eleve, AbsenceEleve } from '../types';
import { 
  getActiveClassesByEnseignant,
  getActiveClasses,
  getActiveElevesByClasse,
  createAbsenceEleve, 
  getAbsencesElevesByDateAndClasse,
  deleteAbsenceEleve 
} from '../services/firestore';
import { getActiveClassesByAnneeScolaire } from '../services/softDelete';
import { anneeScolaireService } from '../services/anneeScolaire';
import { AnneeScolaire } from '../types/anneeScolaire';
import { useAuth } from '../contexts/AuthContext';
import TableResponsive from './TableResponsive';

interface EleveWithAbsence extends Eleve {
  absence?: AbsenceEleve;
}

type SortField = 'nom' | 'prenom' | 'numero_eleve' | 'status';
type SortOrder = 'asc' | 'desc';
type FilterStatus = 'all' | 'present' | 'absent';

const SaisieAbsences: React.FC = () => {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [elevesWithAbsence, setElevesWithAbsence] = useState<EleveWithAbsence[]>([]);
  const [filteredEleves, setFilteredEleves] = useState<EleveWithAbsence[]>([]);
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, absents: 0, presents: 0 });
  const [anneeScolaireActive, setAnneeScolaireActive] = useState<AnneeScolaire | null>(null);
  const [isJourDeCours, setIsJourDeCours] = useState(true);
  const [isAnneeVerrouillee, setIsAnneeVerrouillee] = useState(false);
  
  // États pour tri et filtre
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadClasses = async () => {
    try {
      // Charger l'année scolaire active
      const anneeActive = await anneeScolaireService.getAnneeScolaireActive();
      setAnneeScolaireActive(anneeActive);
      
      if (!anneeActive) {
        showMessage('error', 'Aucune année scolaire active. Veuillez en configurer une.');
        return;
      }
      
      // Vérifier si l'année est verrouillée
      setIsAnneeVerrouillee(anneeActive.verrouillee || false);
      if (anneeActive.verrouillee) {
        showMessage('error', '🔒 Cette année scolaire est verrouillée. Les modifications sont interdites.');
      }
      
      if (userData?.role === 'directeur') {
        const classesData = await getActiveClassesByAnneeScolaire(anneeActive.id);
        setClasses(classesData);
      } else if (userData?.id) {
        // Pour les enseignants, filtrer leurs classes par année scolaire
        const allClassesEnseignant = await getActiveClassesByEnseignant(userData.id);
        const classesData = allClassesEnseignant.filter(c => c.annee_scolaire_id === anneeActive.id);
        setClasses(classesData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des classes:', error);
    }
  };

  const loadElevesAndAbsences = async () => {
    if (!selectedClasse || !selectedDate) return;
    
    setLoading(true);
    try {
      // Charger uniquement les élèves actifs
      const eleves = await getActiveElevesByClasse(selectedClasse);
      
      // Charger les absences existantes
      const eleveIds = eleves.map(e => e.id);
      const absences = await getAbsencesElevesByDateAndClasse(selectedDate, eleveIds);
      
      // Associer les absences aux élèves
      const elevesWithAbs: EleveWithAbsence[] = eleves.map(eleve => {
        const absence = absences.find(a => a.eleve_id === eleve.id);
        return { ...eleve, absence };
      });
      
      setElevesWithAbsence(elevesWithAbs);
      updateStats(elevesWithAbs);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showMessage('error', 'Erreur lors du chargement des données');
    }
    setLoading(false);
  };

  const updateStats = (elevesData: EleveWithAbsence[]) => {
    const total = elevesData.length;
    const absents = elevesData.filter(e => e.absence).length;
    const presents = total - absents;
    setStats({ total, absents, presents });
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    // Auto-disparition après 3 secondes
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const handleAbsenceToggle = async (eleve: EleveWithAbsence) => {
    if (!userData?.id) return;
    
    // Vérifier si l'année est verrouillée
    if (isAnneeVerrouillee) {
      showMessage('error', '🔒 Cette année scolaire est verrouillée. Les modifications sont interdites.');
      return;
    }
    
    // Vérifier si la date est dans l'année scolaire et est un jour de cours
    if (!isJourDeCours) {
      showMessage('error', 'Impossible de modifier les absences sur un jour non scolaire');
      return;
    }
    
    setLoading(true);
    
    try {
      if (eleve.absence) {
        // Supprimer l'absence
        await deleteAbsenceEleve(eleve.absence.id);
        showMessage('success', `${eleve.prenom} ${eleve.nom} marqué(e) présent(e)`);
      } else {
        // Créer l'absence
        await createAbsenceEleve({
          eleve_id: eleve.id,
          date: selectedDate,
          saisi_par: userData.id,
          commentaire: ''
        });
        showMessage('error', `${eleve.prenom} ${eleve.nom} marqué(e) absent(e)`);
      }
      
      // Recharger les données
      await loadElevesAndAbsences();
    } catch (error) {
      console.error('Erreur:', error);
      showMessage('error', 'Erreur lors de l\'enregistrement');
    }
    
    setLoading(false);
  };

  // Fonction de tri
  const sortEleves = (eleves: EleveWithAbsence[], field: SortField, order: SortOrder) => {
    return [...eleves].sort((a, b) => {
      let aValue: string | boolean;
      let bValue: string | boolean;
      
      switch (field) {
        case 'status':
          aValue = !!a.absence;
          bValue = !!b.absence;
          break;
        case 'numero_eleve':
          aValue = a.numero_eleve || '';
          bValue = b.numero_eleve || '';
          break;
        default:
          aValue = a[field];
          bValue = b[field];
      }
      
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return order === 'asc' ? 
          (aValue === bValue ? 0 : aValue ? 1 : -1) : 
          (aValue === bValue ? 0 : aValue ? -1 : 1);
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      return order === 'asc' ? 
        aStr.localeCompare(bStr, 'fr', { sensitivity: 'accent' }) : 
        bStr.localeCompare(aStr, 'fr', { sensitivity: 'accent' });
    });
  };

  // Fonction de filtrage
  const filterEleves = (eleves: EleveWithAbsence[]) => {
    let filtered = eleves;
    
    // Filtre par statut
    if (filterStatus !== 'all') {
      filtered = filtered.filter(eleve => {
        if (filterStatus === 'absent') return !!eleve.absence;
        if (filterStatus === 'present') return !eleve.absence;
        return true;
      });
    }
    
    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(eleve => 
        eleve.nom.toLowerCase().includes(term) ||
        eleve.prenom.toLowerCase().includes(term) ||
        (eleve.numero_eleve && eleve.numero_eleve.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  };

  // Appliquer tri et filtre
  useEffect(() => {
    const filtered = filterEleves(elevesWithAbsence);
    const sorted = sortEleves(filtered, sortField, sortOrder);
    setFilteredEleves(sorted);
  }, [elevesWithAbsence, sortField, sortOrder, filterStatus, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  useEffect(() => {
    if (userData) {
      loadClasses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  useEffect(() => {
    loadElevesAndAbsences();
    checkIfJourDeCours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasse, selectedDate]);

  const checkIfJourDeCours = async () => {
    if (!selectedDate || !anneeScolaireActive) return;
    
    const date = new Date(selectedDate);
    const estJourDeCours = anneeScolaireService.estJourDeCours(date, anneeScolaireActive);
    setIsJourDeCours(estJourDeCours);
    
    if (!estJourDeCours) {
      showMessage('error', 'Attention : Cette date n\'est pas un jour de cours (weekend, vacances ou jour férié)');
    }
  };

  const getClasseInfo = () => {
    const classe = classes.find(c => c.id === selectedClasse);
    return classe ? `${classe.nom} ${classe.niveau ? `- ${classe.niveau}` : ''}` : '';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="saisie-absences">
      <div className="header">
        <h2>
          Saisie des Absences
          {isAnneeVerrouillee && (
            <span className="badge-verrouille" title="Année verrouillée - Lecture seule">
              🔒 Année verrouillée
            </span>
          )}
        </h2>
      </div>
      
      <div className="header-compact">
        <div className="selection-row">
          <div className="input-group">
            <label>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={anneeScolaireActive?.dateDebut || undefined}
              max={anneeScolaireActive?.dateFin || new Date().toISOString().split('T')[0]}
              className="date-input"
            />
          </div>
          
          <div className="input-group">
            <label>Classe</label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="classe-select"
            >
              <option value="">Choisir une classe</option>
              // TODO sort by first number
              // Get first number from {classe.nom}
              // then filter
              {classes.map(classe => (
                <option key={classe.id} value={classe.id}>
                  {classe.nom} {classe.niveau ? `- ${classe.niveau}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedClasse && elevesWithAbsence.length > 0 && (
            <div className="stats-inline">
              <div className="classe-title">
                {getClasseInfo()} • {formatDate(selectedDate)}
              </div>
              <div className="stats-badges">
                <span className="badge-total">{stats.total} élèves</span>
                <span className="badge-present">{stats.presents} présents</span>
                <span className="badge-absent">{stats.absents} absents</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`message ${message.type} auto-hide`}>
          {message.text}
        </div>
      )}

      {selectedClasse && elevesWithAbsence.length > 0 && (
        <>
          {!isJourDeCours && (
            <div className="warning-banner">
              ⚠️ Attention : Cette date n'est pas un jour de cours. Les saisies d'absences sont déconseillées.
            </div>
          )}
          
          <div className="list-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Rechercher un élève..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="filter-select"
              >
                <option value="all">Tous les élèves</option>
                <option value="present">Présents uniquement</option>
                <option value="absent">Absents uniquement</option>
              </select>
            </div>
          </div>

          <div className="sorting-controls">
            <div className="sort-buttons">
              <button 
                className={`sort-btn ${sortField === 'status' ? 'active' : ''}`}
                onClick={() => handleSort('status')}
              >
                Statut {getSortIcon('status')}
              </button>
              <button 
                className={`sort-btn ${sortField === 'numero_eleve' ? 'active' : ''}`}
                onClick={() => handleSort('numero_eleve')}
              >
                N° Élève {getSortIcon('numero_eleve')}
              </button>
              <button 
                className={`sort-btn ${sortField === 'prenom' ? 'active' : ''}`}
                onClick={() => handleSort('prenom')}
              >
                Prénom {getSortIcon('prenom')}
              </button>
              <button 
                className={`sort-btn ${sortField === 'nom' ? 'active' : ''}`}
                onClick={() => handleSort('nom')}
              >
                Nom {getSortIcon('nom')}
              </button>
            </div>
          </div>

          <TableResponsive
            data={filteredEleves}
            keyField="id"
            columns={[
              {
                key: 'status',
                label: 'Statut',
                width: '120px',
                render: (_, eleve: EleveWithAbsence) => (
                  <div className={`status-badge ${eleve.absence ? 'status-absent' : 'status-present'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {eleve.absence ? (
                        <>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="8" y1="8" x2="16" y2="16"></line>
                          <line x1="16" y1="8" x2="8" y2="16"></line>
                        </>
                      ) : (
                        <>
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="8 12 12 16 16 8"></polyline>
                        </>
                      )}
                    </svg>
                    <span>{eleve.absence ? 'Absent' : 'Présent'}</span>
                  </div>
                )
              },
              {
                key: 'numero_eleve',
                label: 'N° Élève',
                width: '100px',
                render: (value) => (
                  <span className="numero-badge">
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
              }
            ]}
            actions={(eleve: EleveWithAbsence) => (
              <button
                onClick={() => handleAbsenceToggle(eleve)}
                disabled={loading || !isJourDeCours || isAnneeVerrouillee}
                className={`btn-action ${eleve.absence ? 'btn-present' : 'btn-absent'}`}
                title={
                  isAnneeVerrouillee ? 'Année verrouillée - modification impossible' :
                  !isJourDeCours ? 'Jour non scolaire - modification impossible' : ''
                }
              >
                {eleve.absence ? 'Marquer présent' : 'Marquer absent'}
              </button>
            )}
            emptyMessage="Aucun élève ne correspond aux critères de recherche."
            className="table-eleves"
          />
        </>
      )}

      {selectedClasse && elevesWithAbsence.length === 0 && !loading && (
        <div className="empty-state">
          <p>Aucun élève trouvé dans cette classe.</p>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <p>Chargement...</p>
        </div>
      )}
    </div>
  );
};

export default SaisieAbsences;