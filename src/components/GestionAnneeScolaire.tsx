import React, { useState, useEffect } from 'react';
import { anneeScolaireService } from '../services/anneeScolaire';
import { AnneeScolaire, PeriodeScolaire, JourSpecial, JoursOuvrables } from '../types/anneeScolaire';
import { useAuth } from '../contexts/AuthContext';
import TransitionAnnee from './TransitionAnnee';
import { migrationElevesService } from '../services/migrationEleves';

// Fonction utilitaire pour formater les dates en toute sécurité
const formatDateSafe = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return 'Date non définie';
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return 'Date invalide';
  }
};

// Fonction pour récupérer la date de début (gestion des deux formats)
const getDateDebut = (annee: any): string => {
  return annee.dateDebut || annee.date_debut || '';
};

// Fonction pour récupérer la date de fin (gestion des deux formats)
const getDateFin = (annee: any): string => {
  return annee.dateFin || annee.date_fin || '';
};

const GestionAnneeScolaire: React.FC = () => {
  const { userData } = useAuth();
  const [anneesScolaires, setAnneesScolaires] = useState<AnneeScolaire[]>([]);
  const [anneeScolaireActive, setAnneeScolaireActive] = useState<AnneeScolaire | null>(null);
  const [joursOuvrables, setJoursOuvrables] = useState<JoursOuvrables | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showVacancesForm, setShowVacancesForm] = useState(false);
  const [showJourFerieForm, setShowJourFerieForm] = useState(false);
  const [showTransitionWizard, setShowTransitionWizard] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // États pour les formulaires
  const [newAnnee, setNewAnnee] = useState({
    nom: '',
    dateDebut: '',
    dateFin: ''
  });

  const [newVacances, setNewVacances] = useState({
    nom: '',
    dateDebut: '',
    dateFin: ''
  });

  const [newJourFerie, setNewJourFerie] = useState({
    date: '',
    nom: '',
    type: 'ferie' as 'ferie' | 'pont' | 'fermeture'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [annees, anneActive] = await Promise.all([
        anneeScolaireService.getToutesLesAnneesScolaires(),
        anneeScolaireService.getAnneeScolaireActive()
      ]);
      
      setAnneesScolaires(annees);
      setAnneeScolaireActive(anneActive);
      
      // Debug : afficher les données chargées
      console.log('Données chargées:', { annees, anneActive });
      
      if (anneActive) {
        const jours = await anneeScolaireService.calculerJoursOuvrables();
        setJoursOuvrables(jours);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showMessage('error', 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateAnnee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.id) return;

    try {
      setLoading(true);
      await anneeScolaireService.createAnneeScolaire(
        newAnnee.nom,
        newAnnee.dateDebut,
        newAnnee.dateFin,
        userData.id
      );
      
      showMessage('success', 'Année scolaire créée avec succès');
      setShowCreateForm(false);
      setNewAnnee({ nom: '', dateDebut: '', dateFin: '' });
      await loadData();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      showMessage('error', 'Erreur lors de la création de l\'année scolaire');
    } finally {
      setLoading(false);
    }
  };

  const handleActiverAnnee = async (anneeScolaireId: string) => {
    try {
      setLoading(true);
      await anneeScolaireService.activerAnneeScolaire(anneeScolaireId, userData?.id || '');
      showMessage('success', 'Année scolaire activée. L\'ancienne année active a été verrouillée.');
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'activation:', error);
      showMessage('error', 'Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVacances = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anneeScolaireActive?.id) return;

    try {
      setLoading(true);
      await anneeScolaireService.ajouterPeriodeVacances(
        anneeScolaireActive.id,
        newVacances.nom,
        newVacances.dateDebut,
        newVacances.dateFin
      );
      
      showMessage('success', 'Période de vacances ajoutée');
      setShowVacancesForm(false);
      setNewVacances({ nom: '', dateDebut: '', dateFin: '' });
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout des vacances:', error);
      showMessage('error', 'Erreur lors de l\'ajout des vacances');
    } finally {
      setLoading(false);
    }
  };

  const handleAddJourFerie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anneeScolaireActive?.id) return;

    // Vérifier si la date est un weekend
    const selectedDate = new Date(newJourFerie.date);
    const dayOfWeek = selectedDate.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      showMessage('error', 'Impossible d\'ajouter un jour férié le weekend (samedi ou dimanche)');
      return;
    }

    try {
      setLoading(true);
      await anneeScolaireService.ajouterJourFerie(
        anneeScolaireActive.id,
        newJourFerie.date,
        newJourFerie.nom,
        newJourFerie.type
      );
      
      showMessage('success', 'Jour férié ajouté');
      setShowJourFerieForm(false);
      setNewJourFerie({ date: '', nom: '', type: 'ferie' });
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du jour férié:', error);
      showMessage('error', 'Erreur lors de l\'ajout du jour férié');
    } finally {
      setLoading(false);
    }
  };

  const generateAnneeNom = () => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    return `${currentYear}-${nextYear}`;
  };

  const generateDefaultDates = () => {
    const currentYear = new Date().getFullYear();
    const dateDebut = `${currentYear}-09-04`; // Premier lundi de septembre approximatif
    const dateFin = `${currentYear + 1}-07-07`; // Début juillet
    return { dateDebut, dateFin };
  };

  // Fonction utilitaire pour formater les dates en toute sécurité
  const formatDateSafe = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Date non définie';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      return date.toLocaleDateString('fr-FR');
    } catch (error) {
      return 'Date invalide';
    }
  };

  // Fonction utilitaire pour formater les dates avec options en toute sécurité
  const formatDateWithOptionsSafe = (dateString: string | undefined | null, options: Intl.DateTimeFormatOptions): string => {
    if (!dateString) return 'Date non définie';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      return date.toLocaleDateString('fr-FR', options);
    } catch (error) {
      return 'Date invalide';
    }
  };

  const handleDeletePeriode = async (index: number) => {
    if (!anneeScolaireActive?.id) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette période de vacances ?')) {
      try {
        setLoading(true);
        await anneeScolaireService.supprimerPeriodeVacances(anneeScolaireActive.id, index);
        showMessage('success', 'Période de vacances supprimée');
        await loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showMessage('error', 'Erreur lors de la suppression');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteJourFerie = async (index: number) => {
    if (!anneeScolaireActive?.id) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce jour férié ?')) {
      try {
        setLoading(true);
        await anneeScolaireService.supprimerJourFerie(anneeScolaireActive.id, index);
        showMessage('success', 'Jour férié supprimé');
        await loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showMessage('error', 'Erreur lors de la suppression');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNettoyagePeriodes = async () => {
    if (!anneeScolaireActive?.id) return;
    
    if (window.confirm('Voulez-vous nettoyer les données incorrectes (périodes scolaires et jours fériés avec de mauvaises dates) ?')) {
      try {
        setLoading(true);
        await anneeScolaireService.nettoyerPeriodesIncorrectes(anneeScolaireActive.id);
        showMessage('success', 'Données nettoyées avec succès');
        await loadData();
      } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
        showMessage('error', 'Erreur lors du nettoyage');
      } finally {
        setLoading(false);
      }
    }
  };


  const handleMigrationEleves = async () => {
    if (window.confirm('Voulez-vous migrer les élèves existants pour corriger les statistiques ? Cette opération ajoutera l\'année scolaire manquante aux élèves.')) {
      try {
        setLoading(true);
        const result = await migrationElevesService.migrerElevesVersAnneeScolaire();
        
        if (result.success) {
          showMessage('success', result.message);
        } else {
          showMessage('error', result.message);
        }
      } catch (error) {
        console.error('Erreur lors de la migration:', error);
        showMessage('error', 'Erreur lors de la migration des élèves');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="gestion-annee-scolaire">
      <div className="header">
        <h2>Gestion de l'Année Scolaire</h2>
        <div className="header-buttons">
          {anneeScolaireActive && (
            <button 
              onClick={() => setShowTransitionWizard(true)}
              className="btn-success"
              title="Assistant de transition pour dupliquer classes et progresser les élèves"
            >
              🔄 Préparer Nouvelle Année
            </button>
          )}
          {(!anneeScolaireActive || (anneeScolaireActive && anneeScolaireActive.dateFin && new Date() >= new Date(anneeScolaireActive.dateFin))) && (
            <button 
              onClick={() => {
                const dates = generateDefaultDates();
                setNewAnnee({
                  nom: generateAnneeNom(),
                  dateDebut: dates.dateDebut,
                  dateFin: dates.dateFin
                });
                setShowCreateForm(true);
              }}
              className="btn-primary"
              title={anneeScolaireActive ? 
                "Créer une nouvelle année (année actuelle terminée)" : 
                "Créer la première année scolaire"
              }
            >
              Créer année vide
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Année scolaire active */}
      {anneeScolaireActive && (
        <div className="annee-active-section">
          <div className="annee-active-card">
            <div className="card-header">
              <h3>📅 Année Scolaire Active</h3>
              <span className="active-badge">ACTIVE</span>
            </div>
            
            <div className="annee-info">
              <div className="info-row">
                <span className="label">Année :</span>
                <span className="value">{anneeScolaireActive.nom}</span>
              </div>
              <div className="info-row">
                <span className="label">Période :</span>
                <span className="value">
                  {formatDateSafe(getDateDebut(anneeScolaireActive))} 
                  {' au '}
                  {formatDateSafe(getDateFin(anneeScolaireActive))}
                </span>
              </div>
            </div>

            {joursOuvrables && (
              <div className="jours-ouvrables-stats">
                <h4>📊 Statistiques des jours ouvrables</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-number">{joursOuvrables.totalJours}</div>
                    <div className="stat-label">Jours de cours</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{joursOuvrables.joursEcoules}</div>
                    <div className="stat-label">Jours écoulés</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{joursOuvrables.joursRestants}</div>
                    <div className="stat-label">Jours restants</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{joursOuvrables.periodesVacances}</div>
                    <div className="stat-label">Jours de vacances</div>
                  </div>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button 
                onClick={() => setShowVacancesForm(true)}
                className="btn-secondary"
              >
                Ajouter vacances
              </button>
              <button 
                onClick={() => setShowJourFerieForm(true)}
                className="btn-secondary"
              >
                Ajouter jour férié
              </button>
              <button 
                onClick={handleNettoyagePeriodes}
                className="btn-warning"
                title="Nettoyer les périodes incorrectes"
              >
                🧹 Nettoyer données
              </button>
              <button 
                onClick={handleMigrationEleves}
                className="btn-info"
                title="Migrer les élèves pour corriger les statistiques"
              >
                🔄 Migrer élèves
              </button>
            </div>

            {/* Liste des périodes de vacances */}
            {anneeScolaireActive.periodes && anneeScolaireActive.periodes.filter(p => p.type === 'vacances').length > 0 && (
              <div className="periodes-list">
                <h4>📅 Périodes de vacances</h4>
                <div className="periodes-table">
                  {anneeScolaireActive.periodes
                    .map((periode, originalIndex) => ({ periode, originalIndex }))
                    .filter(({ periode }) => periode.type === 'vacances')
                    .map(({ periode, originalIndex }) => (
                    <div key={originalIndex} className="periode-item">
                      <div className="periode-info">
                        <span className="periode-nom">{periode.nom}</span>
                        <span className="periode-dates">
                          {formatDateSafe(periode.dateDebut)} 
                          {' au '}
                          {formatDateSafe(periode.dateFin)}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeletePeriode(originalIndex)}
                        className="btn-delete-small"
                        title="Supprimer cette période"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Liste des jours fériés */}
            {anneeScolaireActive.joursSpeciaux && anneeScolaireActive.joursSpeciaux.length > 0 && (
              <div className="jours-feries-list">
                <h4>🏛️ Jours fériés et fermetures</h4>
                <div className="jours-feries-table">
                  {anneeScolaireActive.joursSpeciaux.map((jour, index) => (
                    <div key={index} className="jour-ferie-item">
                      <div className="jour-ferie-info">
                        <span className="jour-ferie-nom">{jour.nom}</span>
                        <span className="jour-ferie-date">
                          {formatDateWithOptionsSafe(jour.date, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                        <span className={`jour-ferie-type type-${jour.type}`}>
                          {jour.type === 'ferie' ? 'Jour férié' : 
                           jour.type === 'pont' ? 'Pont' : 'Fermeture'}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteJourFerie(index)}
                        className="btn-delete-small"
                        title="Supprimer ce jour"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste des années scolaires */}
      <div className="annees-list-section">
        <h3>Toutes les années scolaires</h3>
        <div className="annees-table-container">
          <table className="annees-table">
            <thead>
              <tr>
                <th>Année</th>
                <th>Période</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {anneesScolaires.map(annee => (
                <tr key={annee.id} className={annee.active ? 'active-row' : ''}>
                  <td className="annee-nom">{annee.nom}</td>
                  <td className="periode">
                    {formatDateSafe(annee.dateDebut)} 
                    {' - '}
                    {formatDateSafe(annee.dateFin)}
                  </td>
                  <td className="statut">
                    {annee.active ? (
                      <span className="status-active">Active</span>
                    ) : annee.verrouillee ? (
                      <span className="status-locked">
                        🔒 Verrouillée
                        {annee.date_verrouillage && (
                          <small className="lock-date">
                            {formatDateSafe(annee.date_verrouillage)}
                          </small>
                        )}
                      </span>
                    ) : (
                      <span className="status-inactive">Inactive</span>
                    )}
                  </td>
                  <td className="actions">
                    {!annee.active && !annee.verrouillee && (
                      <button 
                        onClick={() => handleActiverAnnee(annee.id)}
                        className="btn-activate"
                        disabled={loading}
                      >
                        Activer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulaire création année */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Créer une nouvelle année scolaire</h3>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateAnnee}>
              <div className="form-group">
                <label>Nom de l'année :</label>
                <input
                  type="text"
                  value={newAnnee.nom}
                  onChange={(e) => setNewAnnee({...newAnnee, nom: e.target.value})}
                  placeholder="2024-2025"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Date de début :</label>
                <input
                  type="date"
                  value={newAnnee.dateDebut}
                  onChange={(e) => setNewAnnee({...newAnnee, dateDebut: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Date de fin :</label>
                <input
                  type="date"
                  value={newAnnee.dateFin}
                  onChange={(e) => setNewAnnee({...newAnnee, dateFin: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulaire ajout vacances */}
      {showVacancesForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Ajouter une période de vacances</h3>
              <button 
                onClick={() => setShowVacancesForm(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddVacances}>
              <div className="form-group">
                <label>Nom des vacances :</label>
                <input
                  type="text"
                  value={newVacances.nom}
                  onChange={(e) => setNewVacances({...newVacances, nom: e.target.value})}
                  placeholder="Vacances de Toussaint"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Date de début :</label>
                <input
                  type="date"
                  value={newVacances.dateDebut}
                  onChange={(e) => setNewVacances({...newVacances, dateDebut: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Date de fin :</label>
                <input
                  type="date"
                  value={newVacances.dateFin}
                  onChange={(e) => setNewVacances({...newVacances, dateFin: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowVacancesForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulaire ajout jour férié */}
      {showJourFerieForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Ajouter un jour férié</h3>
              <button 
                onClick={() => setShowJourFerieForm(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddJourFerie}>
              <div className="form-group">
                <label>Date :</label>
                <input
                  type="date"
                  value={newJourFerie.date}
                  onChange={(e) => setNewJourFerie({...newJourFerie, date: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Nom :</label>
                <input
                  type="text"
                  value={newJourFerie.nom}
                  onChange={(e) => setNewJourFerie({...newJourFerie, nom: e.target.value})}
                  placeholder="Toussaint"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Type :</label>
                <select
                  value={newJourFerie.type}
                  onChange={(e) => setNewJourFerie({...newJourFerie, type: e.target.value as 'ferie' | 'pont' | 'fermeture'})}
                >
                  <option value="ferie">Jour férié</option>
                  <option value="pont">Pont</option>
                  <option value="fermeture">Fermeture école</option>
                </select>
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowJourFerieForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assistant de transition */}
      {showTransitionWizard && (
        <TransitionAnnee
          onClose={() => setShowTransitionWizard(false)}
          onComplete={() => {
            setShowTransitionWizard(false);
            loadData(); // Recharger les données après la transition
            showMessage('success', 'Transition terminée ! N\'oubliez pas d\'assigner les enseignants aux nouvelles classes.');
          }}
        />
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default GestionAnneeScolaire;