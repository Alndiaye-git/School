import React, { useState, useEffect } from 'react';
import { AnneeScolaire } from '../types/anneeScolaire';
import { anneeScolaireService } from '../services/anneeScolaire';
import { 
  TransitionAnneeService
} from '../services/transitionAnnee';
import { useAuth } from '../contexts/AuthContext';

interface TransitionAnneeProps {
  onClose: () => void;
  onComplete: () => void;
}

interface YearEndTransitionResult {
  rapportGenere: boolean;
  anneePrecedenteVerrouillee: boolean;
  nouvelleAnneeCreee: boolean;
  elevesTransferes: number;
  classesTransferees: number;
  absencesSupprimees: number;
  erreurs: string[];
}

type Step = 'selection' | 'confirmation' | 'processing' | 'completed';

const TransitionAnnee: React.FC<TransitionAnneeProps> = ({ onClose, onComplete }) => {
  const { userData } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('selection');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Données pour la transition
  const [anneesScolaires, setAnneesScolaires] = useState<AnneeScolaire[]>([]);
  const [anneePrecedente, setAnneePrecedente] = useState<AnneeScolaire | null>(null);
  const [nouvelleAnneeNom, setNouvelleAnneeNom] = useState('');
  const [nouvelleDateDebut, setNouvelleDateDebut] = useState('');
  const [nouvelleDateFin, setNouvelleDateFin] = useState('');
  
  // Vérification des prérequis
  const [verificationResult, setVerificationResult] = useState<{
    peutVerrouiller: boolean;
    raisons: string[];
    details: {
      anneeVerrouillee: boolean;
      anneeTerminee: boolean;
      nombreClasses: number;
      nombreEleves: number;
      nombreAbsences: number;
      dateFin: string;
      dateActuelle: string;
    };
  } | null>(null);
  
  // Résultat final
  const [transitionResult, setTransitionResult] = useState<YearEndTransitionResult | null>(null);

  useEffect(() => {
    loadAnneesScolaires();
    generateDefaultDates();
  }, []);

  const loadAnneesScolaires = async () => {
    try {
      const annees = await anneeScolaireService.getToutesLesAnneesScolaires();
      setAnneesScolaires(annees);
      
      // Sélectionner l'année active par défaut
      const anneActive = annees.find(a => a.active);
      if (anneActive) {
        setAnneePrecedente(anneActive);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des années:', error);
      setError('Erreur lors du chargement des années scolaires');
    }
  };

  const generateDefaultDates = () => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    setNouvelleAnneeNom(`${nextYear}-${nextYear + 1}`);
    setNouvelleDateDebut(`${nextYear}-09-04`);
    setNouvelleDateFin(`${nextYear + 1}-07-07`);
  };

  const handleVerifierPrerequisTransition = async () => {
    if (!anneePrecedente) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const verification = await TransitionAnneeService.peutVerrouillerAnnee(anneePrecedente);
      setVerificationResult(verification);
      
      if (verification.peutVerrouiller) {
        setCurrentStep('confirmation');
      } else {
        // Créer un message d'erreur détaillé
        const messageDetaille = [
          `📊 DIAGNOSTIC DE LA TRANSITION pour ${anneePrecedente.nom}`,
          `📅 Date actuelle: ${verification.details.dateActuelle} | Date de fin: ${verification.details.dateFin}`,
          '',
          '📋 RÉSULTATS DE VÉRIFICATION:',
          ...verification.raisons,
          '',
          '🔍 Pour procéder à la transition, il faut:',
          '✅ Année terminée (date actuelle > date de fin)',
          '✅ Au moins 1 classe active dans l\'année',
          '✅ Au moins 1 élève actif dans l\'année',
          '✅ Année non déjà verrouillée'
        ].join('\n');
        
        setError(messageDetaille);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      setError('Erreur lors de la vérification des prérequis');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuterTransition = async () => {
    if (!anneePrecedente || !userData?.id) return;
    
    setLoading(true);
    setError(null);
    setCurrentStep('processing');
    
    try {
      const nouvelleAnneeData = {
        nom: nouvelleAnneeNom,
        dateDebut: nouvelleDateDebut,
        dateFin: nouvelleDateFin,
        active: true,
        periodes: [],
        joursSpeciaux: []
      };
      
      const result = await TransitionAnneeService.effectuerTransition(
        anneePrecedente,
        nouvelleAnneeData,
        userData.id
      );
      
      setTransitionResult(result);
      setCurrentStep('completed');
      
      if (result.erreurs.length > 0) {
        setError(`Transition terminée avec des erreurs : ${result.erreurs.join(', ')}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'exécution:', error);
      setError('Erreur lors de la transition');
    } finally {
      setLoading(false);
    }
  };


  const renderStepSelection = () => (
    <div className="transition-step">
      <h3>🔄 Transition vers une Nouvelle Année Scolaire</h3>
      <p className="step-description">
        Cet assistant va générer un rapport Excel des absences, créer une nouvelle année scolaire 
        et faire progresser les classes et élèves vers le niveau supérieur (CP→CE1, CE1→CE2, etc.).
        Les élèves de CM2 seront supprimés (diplômés).
      </p>
      
      <div className="form-section">
        <div className="form-group">
          <label>Année scolaire à clôturer :</label>
          <select 
            value={anneePrecedente?.id || ''} 
            onChange={(e) => {
              const annee = anneesScolaires.find(a => a.id === e.target.value);
              setAnneePrecedente(annee || null);
            }}
            className="form-select"
          >
            <option value="">Choisir une année</option>
            {anneesScolaires.map(annee => (
              <option key={annee.id} value={annee.id}>
                {annee.nom} {annee.active ? '(Active)' : ''}
              </option>
            ))}
          </select>
          <small>Cette année sera verrouillée et ne pourra plus être modifiée</small>
        </div>
        
        <div className="form-group">
          <label>Nouvelle année scolaire :</label>
          <input
            type="text"
            value={nouvelleAnneeNom}
            onChange={(e) => setNouvelleAnneeNom(e.target.value)}
            placeholder="2025-2026"
            className="form-input"
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Date de début :</label>
            <input
              type="date"
              value={nouvelleDateDebut}
              onChange={(e) => setNouvelleDateDebut(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Date de fin :</label>
            <input
              type="date"
              value={nouvelleDateFin}
              onChange={(e) => setNouvelleDateFin(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </div>
      
      <div className="warning-section">
        <h4>⚠️ Attention - Actions irréversibles</h4>
        <ul>
          <li>📊 Génération d'un rapport Excel complet des absences</li>
          <li>🔒 Verrouillage définitif de l'année précédente (plus de déverrouillage possible)</li>
          <li>📈 Mise à jour des classes vers le niveau supérieur (CP→CE1, CE1→CE2, etc.)</li>
          <li>🚀 Progression des élèves vers les classes de niveau supérieur</li>
          <li>🎓 Suppression des élèves de CM2 (diplômés vers le collège)</li>
          <li>👨‍🏫 Reset des enseignants assignés (à réassigner manuellement)</li>
          <li>🗑️ Suppression des données d'absence et de l'ancienne année</li>
        </ul>
      </div>
      
      <div className="step-actions">
        <button onClick={onClose} className="btn-secondary">
          Annuler
        </button>
        <button 
          onClick={handleVerifierPrerequisTransition}
          disabled={!anneePrecedente || !nouvelleAnneeNom || loading}
          className="btn-primary"
        >
          {loading ? 'Vérification...' : 'Vérifier les Prérequis'}
        </button>
      </div>
    </div>
  );


  const renderStepConfirmation = () => (
    <div className="transition-step">
      <h3>✅ Confirmation de la Transition</h3>
      <p className="step-description">
        Tous les prérequis sont réunis. Voici ce qui va se passer :
      </p>
      
      <div className="transition-plan">
        <div className="plan-item">
          <h4>📊 Étape 1 : Génération du rapport</h4>
          <p>Création d'un rapport Excel avec toutes les absences de l'année {anneePrecedente?.nom}</p>
          <small>Le fichier Excel sera téléchargé automatiquement</small>
        </div>
        
        <div className="plan-item">
          <h4>🔒 Étape 2 : Verrouillage de l'année précédente</h4>
          <p>L'année {anneePrecedente?.nom} sera verrouillée et ne pourra plus être modifiée</p>
        </div>
        
        <div className="plan-item">
          <h4>🎆 Étape 3 : Création de la nouvelle année</h4>
          <p>Création de l'année {nouvelleAnneeNom} ({nouvelleDateDebut} au {nouvelleDateFin})</p>
        </div>
        
        <div className="plan-item">
          <h4>🚚 Étape 4 : Progression des classes et élèves</h4>
          <p>Mise à jour des classes vers le niveau supérieur et progression des élèves (CP→CE1, CE1→CE2, etc.)</p>
        </div>
        
        <div className="plan-item">
          <h4>🗑️ Étape 5 : Nettoyage</h4>
          <p>Suppression des données d'absence de l'année précédente</p>
        </div>
      </div>
      
      <div className="final-warning">
        <h4>⚠️ Dernière chance</h4>
        <p>Cette opération est <strong>irréversible</strong>. Assurez-vous que :</p>
        <ul>
          <li>Toutes les absences de l'année sont saisies</li>
          <li>Vous avez bien vérifié les données</li>
          <li>Vous êtes prêt à commencer la nouvelle année</li>
        </ul>
      </div>
      
      <div className="step-actions">
        <button onClick={() => setCurrentStep('selection')} className="btn-secondary">
          Retour
        </button>
        <button 
          onClick={handleExecuterTransition}
          disabled={loading}
          className="btn-danger large"
        >
          {loading ? 'Traitement...' : '🚀 Lancer la Transition'}
        </button>
      </div>
    </div>
  );

  const renderStepProcessing = () => (
    <div className="transition-step">
      <div className="processing-animation">
        <div className="loading-spinner large"></div>
        <h3>⚙️ Transition en cours...</h3>
        <p className="step-description">
          Veuillez patienter pendant que nous effectuons la transition.
          Cette opération peut prendre quelques minutes.
        </p>
        
        <div className="processing-steps">
          <div className="processing-step active">
            <span className="step-icon">📊</span>
            <span className="step-text">Génération du rapport...</span>
          </div>
          <div className="processing-step">
            <span className="step-icon">🔒</span>
            <span className="step-text">Verrouillage de l'année précédente...</span>
          </div>
          <div className="processing-step">
            <span className="step-icon">🎆</span>
            <span className="step-text">Création de la nouvelle année...</span>
          </div>
          <div className="processing-step">
            <span className="step-icon">🚚</span>
            <span className="step-text">Progression des classes et élèves...</span>
          </div>
          <div className="processing-step">
            <span className="step-icon">🗑️</span>
            <span className="step-text">Nettoyage...</span>
          </div>
        </div>
      </div>
    </div>
  );


  const renderStepCompleted = () => {
    if (!transitionResult) return null;
    
    return (
      <div className="transition-step">
        <h3>✅ Transition Terminée !</h3>
        <p className="step-description">
          La transition vers la nouvelle année scolaire a été effectuée avec succès.
        </p>
        
        <div className="results-summary">
          <div className="result-card success">
            <h4>📊 Rapport généré</h4>
            <div className="result-status">{transitionResult.rapportGenere ? '✅' : '❌'}</div>
            <p>Fichier Excel téléchargé</p>
          </div>
          
          <div className="result-card success">
            <h4>🔒 Année verrouillée</h4>
            <div className="result-status">{transitionResult.anneePrecedenteVerrouillee ? '✅' : '❌'}</div>
            <p>Année précédente protégée</p>
          </div>
          
          <div className="result-card success">
            <h4>🎆 Nouvelle année</h4>
            <div className="result-status">{transitionResult.nouvelleAnneeCreee ? '✅' : '❌'}</div>
            <p>Année {nouvelleAnneeNom} créée</p>
          </div>
          
          <div className="result-card success">
            <h4>📚 Classes mises à jour</h4>
            <div className="result-number">{transitionResult.classesTransferees}</div>
            <p>Classes progressées vers le niveau supérieur</p>
          </div>
          
          <div className="result-card success">
            <h4>👥 Élèves transférés</h4>
            <div className="result-number">{transitionResult.elevesTransferes}</div>
            <p>Élèves progressés vers les nouvelles classes</p>
          </div>
          
          <div className="result-card info">
            <h4>🗑️ Absences supprimées</h4>
            <div className="result-number">{transitionResult.absencesSupprimees}</div>
            <p>Données d'absence nettoyées</p>
          </div>
        </div>
        
        {transitionResult.erreurs.length > 0 && (
          <div className="errors-section">
            <h4>⚠️ Erreurs rencontrées</h4>
            <ul>
              {transitionResult.erreurs.map((erreur, index) => (
                <li key={index}>{erreur}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="next-steps">
          <h4>📋 Prochaines étapes à faire manuellement :</h4>
          <ul>
            <li>✏️ Assigner les enseignants aux nouvelles classes</li>
            <li>📅 Configurer les vacances et jours fériés pour la nouvelle année</li>
            <li>👥 Ajouter les nouveaux élèves si nécessaire</li>
            <li>🔍 Vérifier les affectations dans chaque classe</li>
            <li>📊 Consulter les rapports générés pour l'analyse</li>
          </ul>
        </div>
        
        <div className="step-actions">
          <button onClick={onComplete} className="btn-primary large">
            Terminer et retourner à la gestion
          </button>
        </div>
      </div>
    );
  };

  const getStepProgress = (): number => {
    const steps = ['selection', 'confirmation', 'processing', 'completed'];
    return ((steps.indexOf(currentStep) + 1) / steps.length) * 100;
  };

  return (
    <div className="modal-overlay">
      <div className="modal transition-modal">
        <div className="modal-header">
          <h2>🔄 Assistant de Transition d'Année Scolaire</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="transition-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${getStepProgress()}%` }}
            ></div>
          </div>
          <div className="progress-steps">
            <span className={currentStep === 'selection' ? 'active' : ''}>1. Sélection</span>
            <span className={currentStep === 'confirmation' ? 'active' : ''}>2. Confirmation</span>
            <span className={currentStep === 'processing' ? 'active' : ''}>3. Traitement</span>
            <span className={currentStep === 'completed' ? 'active' : ''}>4. Terminé</span>
          </div>
        </div>
        
        <div className="modal-content">
          {error && (
            <div className="error-message">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                {error}
              </pre>
            </div>
          )}
          
          {currentStep === 'selection' && renderStepSelection()}
          {currentStep === 'confirmation' && renderStepConfirmation()}
          {currentStep === 'processing' && renderStepProcessing()}
          {currentStep === 'completed' && renderStepCompleted()}
        </div>
      </div>
    </div>
  );
};

export default TransitionAnnee;