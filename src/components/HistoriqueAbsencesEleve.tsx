import React, { useState, useEffect } from 'react';
import { 
  absencesEleveService, 
  AbsenceEleveDetailed, 
  StatistiquesAbsenceEleve 
} from '../services/absencesEleve';
import { Eleve, Classe } from '../types';
import { anneeScolaireService } from '../services/anneeScolaire';
import { AnneeScolaire } from '../types/anneeScolaire';

interface HistoriqueAbsencesEleveProps {
  eleveId: string;
  onClose: () => void;
}

const HistoriqueAbsencesEleve: React.FC<HistoriqueAbsencesEleveProps> = ({ eleveId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eleve, setEleve] = useState<Eleve | null>(null);
  const [classe, setClasse] = useState<Classe | null>(null);
  const [absences, setAbsences] = useState<AbsenceEleveDetailed[]>([]);
  const [statistiques, setStatistiques] = useState<StatistiquesAbsenceEleve | null>(null);
  const [anneeScolaire, setAnneeScolaire] = useState<AnneeScolaire | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('tous');

  useEffect(() => {
    loadData();
  }, [eleveId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer l'élève et sa classe
      const { eleve: eleveData, classe: classeData } = await absencesEleveService.getEleveAvecClasse(eleveId);
      setEleve(eleveData);
      setClasse(classeData);

      // Récupérer l'année scolaire active
      const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
      setAnneeScolaire(anneeScolaireActive);

      if (!anneeScolaireActive) {
        setError('Aucune année scolaire active');
        return;
      }

      // Récupérer les absences et statistiques
      const [absencesData, statistiquesData] = await Promise.all([
        absencesEleveService.getAbsencesEleve(eleveId, anneeScolaireActive.id),
        absencesEleveService.getStatistiquesAbsenceEleve(eleveId, anneeScolaireActive.id)
      ]);

      setAbsences(absencesData);
      setStatistiques(statistiquesData);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAbsences = () => {
    if (selectedMonth === 'tous') return absences;
    return absences.filter(absence => absence.mois === selectedMonth);
  };

  const getMonthsList = () => {
    const monthsSet = new Set(absences.map(a => a.mois));
    const months = Array.from(monthsSet).sort();
    return months;
  };

  const renderStatistiquesCard = () => {
    if (!statistiques) return null;

    const getStatusColor = (taux: number) => {
      if (taux < 5) return 'success';
      if (taux < 10) return 'warning';
      return 'danger';
    };

    return (
      <div className="stats-overview">
        <div className="stats-cards">
          <div className={`stat-card ${getStatusColor(statistiques.tauxAbsenteisme)}`}>
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-number">{statistiques.tauxAbsenteisme}%</div>
              <div className="stat-label">Taux d'absentéisme</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-number">{statistiques.totalAbsences}</div>
              <div className="stat-label">Absences totales</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-number">{statistiques.moyenneAbsencesParMois}</div>
              <div className="stat-label">Moyenne par mois</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🗓️</div>
            <div className="stat-content">
              <div className="stat-number">
                {statistiques.dernièreAbsence ? 
                  new Date(statistiques.dernièreAbsence).toLocaleDateString('fr-FR') : 
                  'Aucune'
                }
              </div>
              <div className="stat-label">Dernière absence</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAbsencesParJour = () => {
    if (!statistiques) return null;

    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
    const maxAbsences = Math.max(...Object.values(statistiques.absencesParJourSemaine));

    return (
      <div className="jour-semaine-chart">
        <h4>📊 Répartition par jour de la semaine</h4>
        <div className="jour-bars">
          {jours.map(jour => {
            const count = statistiques.absencesParJourSemaine[jour] || 0;
            const height = maxAbsences > 0 ? (count / maxAbsences) * 100 : 0;
            
            return (
              <div key={jour} className="jour-bar">
                <div className="jour-name">{jour.slice(0, 3)}</div>
                <div className="bar-container-jour">
                  <div 
                    className="bar-fill-jour" 
                    style={{ height: `${Math.max(height, 10)}%` }}
                  ></div>
                </div>
                <div className="jour-count">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAbsencesList = () => {
    const filteredAbsences = getFilteredAbsences();

    if (filteredAbsences.length === 0) {
      return (
        <div className="no-absences-simple">
          <p>Aucune demi-journée d'absence {selectedMonth !== 'tous' ? `en ${selectedMonth}` : 'cette année'}</p>
        </div>
      );
    }

    return (
      <div className="absences-list-simple">
        <h5>Liste des absences</h5>
        <div className="absences-grid">
          {filteredAbsences.map(absence => (
            <div key={absence.id} className="absence-item">
              <div className="absence-date-simple">
                {new Date(absence.date).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
              <div className="absence-periode" style={{
                marginTop: '4px',
                fontSize: '0.85rem',
                color: '#666',
                fontWeight: 500
              }}>
                {absence.periode === 'matin' ? '🌅 Matin' : '🌇 Après-midi'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPeriodesSansAbsence = () => {
    if (!statistiques || statistiques.periodesSansAbsence.length === 0) return null;

    return (
      <div className="periodes-positives">
        <h4>🌟 Périodes sans absence</h4>
        <div className="periodes-list">
          {statistiques.periodesSansAbsence.map((periode, index) => (
            <div key={index} className="periode-positive">
              <div className="periode-icon">🎯</div>
              <div className="periode-content">
                <div className="periode-dates">
                  {new Date(periode.debut).toLocaleDateString('fr-FR')} - 
                  {new Date(periode.fin).toLocaleDateString('fr-FR')}
                </div>
                <div className="periode-duree">{periode.jours} jours consécutifs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal historique-modal">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Chargement de l'historique...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal historique-modal">
          <div className="modal-header">
            <h3>❌ Erreur</h3>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
          <div className="error-container">
            <p>{error}</p>
            <button onClick={onClose} className="btn-primary">Fermer</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal historique-modal">
        <div className="modal-header">
          <h3>Historique des absences</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-content">
          {/* En-tête élève */}
          <div className="eleve-header-simple">
            <div className="eleve-avatar-simple">
              {eleve?.prenom.charAt(0)}{eleve?.nom.charAt(0)}
            </div>
            <div className="eleve-details-simple">
              <h4>{eleve?.prenom} {eleve?.nom}</h4>
              <p>{classe?.nom || 'Non assigné'} • {anneeScolaire?.nom || 'Non définie'}</p>
            </div>
          </div>

          {/* Résumé des statistiques */}
          <div className="stats-summary">
            <div className="stat-item-simple">
              <span className="stat-number">{statistiques?.totalAbsences || 0}</span>
              <span className="stat-label">demi-journées d'absence</span>
            </div>
            <div className="stat-item-simple">
              <span className="stat-number">{statistiques?.tauxAbsenteisme || 0}%</span>
              <span className="stat-label">taux d'absentéisme</span>
            </div>
            <div className="stat-item-simple">
              <span className="stat-number">{statistiques?.moyenneAbsencesParMois || 0}</span>
              <span className="stat-label">demi-journées par mois</span>
            </div>
          </div>

          {/* Filtre simple */}
          {absences.length > 0 && (
            <div className="filter-simple">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="month-select"
              >
                <option value="tous">Tous les mois ({absences.length} demi-journées)</option>
                {getMonthsList().map(month => (
                  <option key={month} value={month}>
                    {month} ({absences.filter(a => a.mois === month).length} demi-journées)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Liste des absences */}
          {renderAbsencesList()}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="btn-close">Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default HistoriqueAbsencesEleve;