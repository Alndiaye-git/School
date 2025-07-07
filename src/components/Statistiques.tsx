import React, { useState, useEffect } from 'react';
import { 
  statisticsService, 
  GlobalStats, 
  ClasseStats, 
  TemporalStats, 
  IndividualStats 
} from '../services/statistics';
import { anneeScolaireService } from '../services/anneeScolaire';
import { AnneeScolaire } from '../types/anneeScolaire';

const Statistiques: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'classes' | 'temporal' | 'individual'>('classes');
  
  // États pour les différentes statistiques
  const [classeStats, setClasseStats] = useState<ClasseStats[]>([]);
  const [temporalStats, setTemporalStats] = useState<TemporalStats | null>(null);
  const [individualStats, setIndividualStats] = useState<IndividualStats | null>(null);

  // États pour la gestion des années scolaires
  const [anneesScolaires, setAnneesScolaires] = useState<AnneeScolaire[]>([]);
  const [selectedAnneeScolaire, setSelectedAnneeScolaire] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedAnneeScolaire) {
      loadStatistics();
    }
  }, [selectedAnneeScolaire]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Charger les années scolaires
      const annees = await anneeScolaireService.getToutesLesAnneesScolaires();
      setAnneesScolaires(annees);
      
      // Sélectionner l'année active par défaut
      const anneActive = annees.find(a => a.active);
      if (anneActive) {
        setSelectedAnneeScolaire(anneActive.id);
      } else if (annees.length > 0) {
        setSelectedAnneeScolaire(annees[0].id);
      }
    } catch (error) {
      console.error('Erreur lors du chargement initial:', error);
      setError('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    if (!selectedAnneeScolaire) return;
    
    try {
      setLoading(true);
      setError(null);

      const anneeScolaireId = selectedAnneeScolaire === 'all' ? undefined : selectedAnneeScolaire;

      // Récupérer les infos de l'année scolaire pour les logs
      const anneeScolaireInfo = anneesScolaires.find(a => a.id === anneeScolaireId);
      console.log('📊 === DÉBUT CALCUL STATISTIQUES ===');
      console.log('🗓️ Année scolaire sélectionnée:', anneeScolaireInfo?.nom, anneeScolaireInfo?.id);
      
      // Calculer les jours ouvrables pour l'année
      const joursOuvrables = await anneeScolaireService.calculerJoursOuvrables(anneeScolaireId);
      console.log('📅 Jours ouvrables de l\'année:', joursOuvrables);

      const [classes, temporal, individual] = await Promise.all([
        statisticsService.getClasseStatistics(anneeScolaireId),
        statisticsService.getTemporalStatistics(anneeScolaireId),
        statisticsService.getIndividualStatistics(anneeScolaireId)
      ]);
      
      console.log('🏫 Statistiques classes:', classes);
      console.log('📅 Statistiques temporelles:', temporal);
      console.log('👤 Statistiques individuelles:', individual);
      console.log('📊 === FIN CALCUL STATISTIQUES ===');
      
      setClasseStats(classes);
      setTemporalStats(temporal);
      setIndividualStats(individual);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };



  const renderClasseStats = () => {
    if (!classeStats.length) return null;

    // Calculer quelques statistiques d'analyse
    const moyenneTaux = Math.round((classeStats.reduce((sum, c) => sum + c.tauxAbsenteisme, 0) / classeStats.length) * 100) / 100;
    const classesProblematiques = classeStats.filter(c => c.tauxAbsenteisme > 15).length;
    const classesMeilleures = classeStats.filter(c => c.tauxAbsenteisme < 8).length;

    return (
      <div className="stats-section">
        <div className="classe-header">
          <h3>🏫 Analyse des Classes</h3>
          <p className="section-description">
            Vue d'ensemble de l'assiduité par classe avec analyse comparative et suivi temporel
          </p>
        </div>

        {/* Résumé analytique */}
        <div className="classe-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <div className="card-number">{classeStats.length}</div>
                <div className="card-label">Classes analysées</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <div className="card-number">{moyenneTaux}%</div>
                <div className="card-label">Taux moyen école</div>
              </div>
            </div>
            <div className="summary-card critical">
              <div className="card-icon">⚠️</div>
              <div className="card-content">
                <div className="card-number">{classesProblematiques}</div>
                <div className="card-label">Classes à surveiller</div>
                <div className="card-note">(&gt;15% d'absences)</div>
              </div>
            </div>
            <div className="summary-card success">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <div className="card-number">{classesMeilleures}</div>
                <div className="card-label">Classes exemplaires</div>
                <div className="card-note">(&lt;8% d'absences)</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Classement des classes */}
        <div className="classe-ranking">
          <div className="subsection-header">
            <h4>📊 Classement par taux d'absentéisme</h4>
            <div className="explanation-box">
              <div className="explanation-icon">💡</div>
              <div className="explanation-content">
                <p><strong>Analyse comparative</strong> - Classement de toutes les classes selon leur taux d'absentéisme annuel</p>
                <p>🎯 <strong>Calcul :</strong> (Total absences élèves ÷ Total jours possibles) × 100</p>
                <p>📌 <strong>Seuils :</strong> Normal &lt;8% • Attention 8-15% • Critique &gt;15%</p>
              </div>
            </div>
          </div>
          
          <div className="ranking-table-container">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Classe</th>
                  <th>Effectif</th>
                  <th>Total absences</th>
                  <th>Taux d'absentéisme</th>
                  <th>Évaluation</th>
                </tr>
              </thead>
              <tbody>
                {classeStats.map((classe, index) => (
                  <tr key={classe.classe.id} className={`ranking-row ${
                    classe.tauxAbsenteisme > 15 ? 'critical' :
                    classe.tauxAbsenteisme > 8 ? 'warning' : 'success'
                  }`}>
                    <td className="rank-cell">
                      <span className={`rank-badge ${index < 3 ? `top-rank` : ''}`}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="classe-cell">
                      <div className="classe-name-full">
                        <strong>{classe.classe.nom}</strong>
                        <span className="niveau-badge">{classe.classe.niveau}</span>
                      </div>
                    </td>
                    <td className="effectif-cell">{classe.totalEleves} élèves</td>
                    <td className="absences-cell">{classe.totalAbsences}</td>
                    <td className="taux-cell">
                      <span className={`taux-badge ${
                        classe.tauxAbsenteisme > 15 ? 'danger' :
                        classe.tauxAbsenteisme > 8 ? 'warning' : 'success'
                      }`}>
                        {classe.tauxAbsenteisme}%
                      </span>
                    </td>
                    <td className="evaluation-cell">
                      <span className={`evaluation-text ${
                        classe.tauxAbsenteisme > 15 ? 'critical' :
                        classe.tauxAbsenteisme > 8 ? 'attention' : 'good'
                      }`}>
                        {classe.tauxAbsenteisme > 15 ? 'Intervention requise' :
                         classe.tauxAbsenteisme > 8 ? 'Surveillance nécessaire' : 'Situation normale'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Évolution détaillée pour les 3 premières classes */}
        {classeStats.length > 0 && (
          <div className="evolution-details">
            <div className="subsection-header">
              <h4>📈 Suivi temporel des classes prioritaires</h4>
              <div className="explanation-box">
                <div className="explanation-icon">🔍</div>
                <div className="explanation-content">
                  <p><strong>Analyse des tendances</strong> - Évolution sur 4 mois des classes ayant les taux les plus élevés</p>
                  <p>📊 <strong>Objectif :</strong> Identifier si la situation s'améliore, se stabilise ou se dégrade</p>
                  <p>⚡ <strong>Action :</strong> Les tendances à la hausse nécessitent une intervention immédiate</p>
                </div>
              </div>
            </div>
            
            <div className="evolution-grid">
              {classeStats.slice(0, 3).map((classe, index) => (
                <div key={classe.classe.id} className="evolution-card">
                  <div className="evolution-header">
                    <div className="evolution-rank">#{index + 1}</div>
                    <div className="evolution-classe">
                      <h5>{classe.classe.nom} - {classe.classe.niveau}</h5>
                      <span className="current-rate">Taux actuel : {classe.tauxAbsenteisme}%</span>
                    </div>
                  </div>
                  
                  <div className="evolution-chart">
                    {classe.evolution.map((periode, periodeIndex) => (
                      <div key={periodeIndex} className="evolution-bar">
                        <div className="periode-label">{periode.periode}</div>
                        <div className="bar-container-small">
                          <div 
                            className="bar-fill-small"
                            style={{ 
                              height: `${Math.max(8, periode.tauxAbsenteisme * 3)}px`,
                              backgroundColor: periode.tauxAbsenteisme > 15 ? '#dc2626' : 
                                             periode.tauxAbsenteisme > 8 ? '#d97706' : '#059669'
                            }}
                          ></div>
                        </div>
                        <div className="periode-value">{periode.tauxAbsenteisme}%</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="evolution-trend">
                    {(() => {
                      const dernierMois = classe.evolution[classe.evolution.length - 1]?.tauxAbsenteisme || 0;
                      const premierMois = classe.evolution[0]?.tauxAbsenteisme || 0;
                      const tendance = dernierMois - premierMois;
                      
                      if (Math.abs(tendance) < 2) {
                        return <span className="trend-stable">📊 Situation stable</span>;
                      } else if (tendance > 0) {
                        return <span className="trend-up">📈 Tendance à la hausse (+{Math.round(tendance * 10) / 10}%)</span>;
                      } else {
                        return <span className="trend-down">📉 Amélioration ({Math.round(tendance * 10) / 10}%)</span>;
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTemporalStats = () => {
    if (!temporalStats) return null;

    // Trouver le jour avec le plus d'absences
    const jourMax = temporalStats.parJourSemaine.reduce((max, jour) => 
      jour.tauxAbsenteisme > max.tauxAbsenteisme ? jour : max
    );

    return (
      <div className="stats-section">
        <div className="temporal-header">
          <h3>📅 Analyse Temporelle des Absences</h3>
          <p className="section-description">
            Découvrez les patterns d'absences pour identifier les tendances comportementales et les événements exceptionnels
          </p>
        </div>
        
        {/* Statistiques par jour de la semaine */}
        <div className="weekday-stats">
          <div className="subsection-header">
            <h4>📊 Tendances par jour de la semaine</h4>
            <div className="explanation-box">
              <div className="explanation-icon">💡</div>
              <div className="explanation-content">
                <p><strong>Analyse sur toute l'année scolaire</strong> - Quel jour les élèves s'absentent-ils le plus ?</p>
                <p>🎯 <strong>Résultat :</strong> Le <span className="highlight">{jourMax.jour.toLowerCase()}</span> est le jour avec le plus d'absences ({jourMax.tauxAbsenteisme}%)</p>
              </div>
            </div>
          </div>
          
          <div className="weekday-chart-container">
            <div className="weekday-chart">
              {temporalStats.parJourSemaine.map((jour) => (
                <div key={jour.jourNum} className={`weekday-bar ${jour.jour === jourMax.jour ? 'highest' : ''}`}>
                  <div className="weekday-name">{jour.jour}</div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill"
                      style={{ 
                        height: `${Math.max(15, jour.tauxAbsenteisme * 8)}px`,
                        backgroundColor: jour.tauxAbsenteisme > 12 ? '#dc2626' : 
                                        jour.tauxAbsenteisme > 8 ? '#d97706' : '#059669'
                      }}
                    ></div>
                    {jour.jour === jourMax.jour && (
                      <div className="highest-indicator">👑</div>
                    )}
                  </div>
                  <div className="weekday-value">{jour.tauxAbsenteisme}%</div>
                  <div className="weekday-count">{jour.absences} absences</div>
                  <div className="weekday-total">sur {temporalStats.parJourSemaine[0].presents + temporalStats.parJourSemaine[0].absences} possibles</div>
                </div>
              ))}
            </div>
            
            <div className="legend">
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#059669'}}></div>
                <span>Normal (&lt;8%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#d97706'}}></div>
                <span>Élevé (8-12%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#dc2626'}}></div>
                <span>Très élevé (&gt;12%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pics d'absences */}
        <div className="peaks-section">
          <div className="subsection-header">
            <h4>🚨 Événements exceptionnels détectés</h4>
            <div className="explanation-box">
              <div className="explanation-icon">🔍</div>
              <div className="explanation-content">
                <p><strong>Détection automatique</strong> - Jours où plus de 20% des élèves étaient absents</p>
                <p>📈 <strong>Utilité :</strong> Identifier les événements inhabituels, congés groupés ou problèmes ponctuels</p>
              </div>
            </div>
          </div>
          
          {temporalStats.picsAbsences.length > 0 ? (
            <div className="peaks-list">
              {temporalStats.picsAbsences.slice(0, 5).map((pic, index) => (
                <div key={index} className={`peak-item ${pic.tauxAbsenteisme > 50 ? 'critical' : 'high'}`}>
                  <div className="peak-rank">#{index + 1}</div>
                  <div className="peak-content">
                    <div className="peak-date">
                      📅 {new Date(pic.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="peak-stats">
                      <div className="peak-metric">
                        <span className="metric-value">{pic.absences}</span>
                        <span className="metric-label">élèves absents</span>
                      </div>
                      <div className="peak-metric">
                        <span className={`metric-value rate-badge ${pic.tauxAbsenteisme > 50 ? 'critical' : 'high'}`}>
                          {pic.tauxAbsenteisme}%
                        </span>
                        <span className="metric-label">de l'école</span>
                      </div>
                    </div>
                    {pic.commentaire && (
                      <div className="peak-comment">
                        {pic.tauxAbsenteisme > 50 ? '📊' : '📈'} {pic.commentaire}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-peaks">
              <div className="no-peaks-icon">✅</div>
              <div className="no-peaks-content">
                <h5>Excellente nouvelle !</h5>
                <p>Aucun pic d'absences exceptionnel détecté cette année</p>
                <small>L'école maintient un taux d'absence stable</small>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIndividualStats = () => {
    if (!individualStats) return null;

    return (
      <div className="stats-section">
        <h3>👤 Statistiques individuelles</h3>
        
        {/* Alertes */}
        {individualStats.alertes.length > 0 && (
          <div className="alerts-section">
            <h4>🚨 Alertes - Élèves nécessitant un suivi</h4>
            <div className="alerts-list">
              {individualStats.alertes.map((alerte, index) => (
                <div key={index} className={`alert-item ${alerte.niveau}`}>
                  <div className="alert-icon">
                    {alerte.niveau === 'danger' ? '🔴' : '⚠️'}
                  </div>
                  <div className="alert-content">
                    <div className="alert-name">
                      {alerte.eleve.prenom} {alerte.eleve.nom}
                    </div>
                    <div className="alert-class">{alerte.classeName}</div>
                    <div className="alert-reason">{alerte.raison}</div>
                  </div>
                  <div className="alert-count">
                    {alerte.absencesRecentes} récentes
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top élèves les moins assidus */}
        <div className="top-absents">
          <h4>📊 Élèves les moins assidus (taux d'absentéisme le plus élevé)</h4>
          <div className="absents-table-container">
            <table className="absents-table">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Taux d'absentéisme</th>
                  <th>Total absences</th>
                  <th>Dernière absence</th>
                </tr>
              </thead>
              <tbody>
                {individualStats.topAssidus.slice().reverse().slice(0, 15).map((eleve, index) => (
                  <tr key={eleve.eleve.id} className={`row-${index < 3 ? 'critical' : index < 7 ? 'warning' : 'normal'}`}>
                    <td className="rank-cell">#{index + 1}</td>
                    <td className="name-cell">
                      <div className="student-name">
                        <strong>{eleve.eleve.prenom} {eleve.eleve.nom}</strong>
                      </div>
                    </td>
                    <td className="class-cell">{eleve.classeName}</td>
                    <td className="rate-cell">
                      <span className={`rate-badge ${eleve.tauxAbsenteisme > 15 ? 'high' : eleve.tauxAbsenteisme > 8 ? 'medium' : 'low'}`}>
                        {eleve.tauxAbsenteisme}%
                      </span>
                    </td>
                    <td className="count-cell">{eleve.totalAbsences}</td>
                    <td className="date-cell">
                      {eleve.derniereAbsence ? 
                        new Date(eleve.derniereAbsence).toLocaleDateString('fr-FR') : 
                        'Aucune'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Élèves à suivre */}
        {individualStats.elevesSuivi.length > 0 && (
          <div className="suivi-section">
            <h4>👀 Élèves nécessitant un suivi particulier (&gt;10% d'absences)</h4>
            <div className="suivi-table-container">
              <table className="suivi-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Classe</th>
                    <th>Taux d'absentéisme</th>
                    <th>Total absences</th>
                    <th>Dernière absence</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {individualStats.elevesSuivi.map((eleve) => (
                    <tr key={eleve.eleve.id} className={`suivi-row ${eleve.tauxAbsenteisme > 20 ? 'critical' : 'warning'}`}>
                      <td className="suivi-name-cell">
                        <strong>{eleve.eleve.prenom} {eleve.eleve.nom}</strong>
                      </td>
                      <td className="suivi-class-cell">{eleve.classeName}</td>
                      <td className="suivi-rate-cell">
                        <span className={`rate-badge ${eleve.tauxAbsenteisme > 20 ? 'high' : 'medium'}`}>
                          {eleve.tauxAbsenteisme}%
                        </span>
                      </td>
                      <td className="suivi-count-cell">{eleve.totalAbsences}</td>
                      <td className="suivi-date-cell">
                        {eleve.derniereAbsence ? 
                          new Date(eleve.derniereAbsence).toLocaleDateString('fr-FR') : 
                          'Aucune'
                        }
                      </td>
                      <td className="suivi-status-cell">
                        <span className={`status-indicator ${eleve.tauxAbsenteisme > 20 ? 'urgent' : 'attention'}`}>
                          {eleve.tauxAbsenteisme > 20 ? 'Urgent' : 'À surveiller'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderExplanationModal = () => {
    if (!showExplanationModal) return null;

    const anneeScolaireInfo = anneesScolaires.find(a => a.id === selectedAnneeScolaire);

    return (
      <div className="modal-overlay">
        <div className="modal explanation-modal">
          <div className="modal-header">
            <h3>📊 Comment sont calculées les statistiques ?</h3>
            <button 
              onClick={() => setShowExplanationModal(false)}
              className="close-btn"
            >
              ×
            </button>
          </div>
          
          <div className="modal-content">
            <div className="explanation-section">
              <h4>🗓️ Base de calcul : Année scolaire active</h4>
              <div className="info-box">
                <strong>Année sélectionnée :</strong> {anneeScolaireInfo?.nom || 'Non définie'}<br/>
                <strong>Période :</strong> {anneeScolaireInfo ? `${new Date(anneeScolaireInfo.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(anneeScolaireInfo.dateFin).toLocaleDateString('fr-FR')}` : 'Non définie'}<br/>
                <strong>Jours de cours :</strong> Seuls les jours ouvrables (hors weekends, vacances, jours fériés) sont comptés
              </div>
            </div>

            <div className="explanation-section">
              <h4>🏫 Statistiques par classe</h4>
              <div className="formula-box">
                <strong>Formule :</strong> Taux d'absentéisme = (Total absences classe ÷ Total jours possibles) × 100<br/>
                <strong>Total jours possibles :</strong> Nombre d'élèves × Jours de cours dans l'année
              </div>
              <div className="example-box">
                <strong>Exemple :</strong><br/>
                • Classe avec 4 élèves<br/>
                • 214 jours de cours dans l'année<br/>
                • 5 absences enregistrées<br/>
                • Calcul : 5 ÷ (4 × 214) × 100 = 0,58%
              </div>
            </div>

            <div className="explanation-section">
              <h4>📅 Statistiques temporelles</h4>
              <div className="formula-box">
                <strong>Par jour de semaine :</strong><br/>
                • Compte le nombre réel de chaque jour (lundi, mardi...) dans l'année scolaire<br/>
                • Taux = (Absences ce jour ÷ (Élèves × Nombre de ces jours)) × 100
              </div>
              <div className="example-box">
                <strong>Exemple pour les mercredis :</strong><br/>
                • 43 mercredis de cours dans l'année<br/>
                • 6 élèves au total<br/>
                • 6 absences le mercredi<br/>
                • Calcul : 6 ÷ (6 × 43) × 100 = 2,33%
              </div>
              <div className="formula-box">
                <strong>Pics d'absences :</strong><br/>
                • Détecte les jours où plus de 20% des élèves sont absents<br/>
                • Permet d'identifier des événements exceptionnels
              </div>
            </div>

            <div className="explanation-section">
              <h4>👤 Statistiques individuelles</h4>
              <div className="formula-box">
                <strong>Taux individuel :</strong> (Absences élève ÷ Jours de cours totaux) × 100<br/>
                <strong>Seuils d'alerte :</strong><br/>
                • Normal : &lt; 8%<br/>
                • Surveillance : 8-15%<br/>
                • Intervention : &gt; 15%<br/>
                • Alerte récente : 3+ absences en 2 semaines
              </div>
              <div className="example-box">
                <strong>Exemple :</strong><br/>
                • Élève avec 4 absences<br/>
                • Sur 214 jours de cours<br/>
                • Calcul : 4 ÷ 214 × 100 = 1,87%<br/>
                • Statut : Normal (pas de suivi nécessaire)
              </div>
            </div>

            <div className="explanation-section">
              <h4>🎯 Points importants</h4>
              <div className="info-box">
                • Les weekends ne sont jamais comptés<br/>
                • Les vacances et jours fériés sont exclus<br/>
                • Seules les absences de l'année scolaire sélectionnée sont prises en compte<br/>
                • Les élèves inactifs (supprimés) ne sont pas inclus<br/>
                • Les calculs sont mis à jour en temps réel
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              onClick={() => setShowExplanationModal(false)} 
              className="btn-primary"
            >
              Compris !
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Calcul des statistiques en cours...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h3>❌ Erreur</h3>
          <p>{error}</p>
          <button onClick={loadStatistics} className="btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="statistiques-container">
      <div className="stats-header">
        <h2>📈 Statistiques et Analyse</h2>
        <div className="header-controls">
          <div className="annee-selector">
            <label htmlFor="annee-select">Année scolaire :</label>
            <select 
              id="annee-select"
              value={selectedAnneeScolaire} 
              onChange={(e) => setSelectedAnneeScolaire(e.target.value)}
              className="annee-select"
            >
              {anneesScolaires.map(annee => (
                <option key={annee.id} value={annee.id}>
                  {annee.nom} {annee.active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button onClick={loadStatistics} className="btn-secondary refresh-btn">
            🔄 Actualiser
          </button>
          <button 
            onClick={() => setShowExplanationModal(true)} 
            className="btn-info explanation-btn"
          >
            ❓ Comment ça marche ?
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="stats-tabs">
        <button 
          className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          🏫 Classes
        </button>
        <button 
          className={`tab ${activeTab === 'temporal' ? 'active' : ''}`}
          onClick={() => setActiveTab('temporal')}
        >
          📅 Temporel
        </button>
        <button 
          className={`tab ${activeTab === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveTab('individual')}
        >
          👤 Individuel
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="stats-content">
        {activeTab === 'classes' && renderClasseStats()}
        {activeTab === 'temporal' && renderTemporalStats()}
        {activeTab === 'individual' && renderIndividualStats()}
      </div>

      {/* Modal d'explication */}
      {renderExplanationModal()}
    </div>
  );
};

export default Statistiques;