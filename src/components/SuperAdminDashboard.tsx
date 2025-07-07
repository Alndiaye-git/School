import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { superAdminService } from '../services/superAdmin';
import { DatabaseClearOptions, AuditLog } from '../types';

const SuperAdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const [dbStats, setDbStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [clearOptions, setClearOptions] = useState<DatabaseClearOptions>({
    preserveDirectors: true,
    preserveCurrentUser: true,
    clearStudents: false,
    clearTeachers: false,
    clearClasses: false,
    clearAbsences: false,
    clearSchoolYears: false,
    clearFirebaseAuth: false,
    dryRun: true
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [clearResult, setClearResult] = useState<any>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [demoResult, setDemoResult] = useState<any>(null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  const CONFIRMATION_PHRASE = 'NETTOYER LA BASE DE DONNEES';

  useEffect(() => {
    if (userData && superAdminService.isSuperAdmin(userData)) {
      loadDatabaseStats();
      loadAuditLogs();
    }
  }, [userData]);

  const loadDatabaseStats = async () => {
    try {
      const stats = await superAdminService.getDatabaseStats();
      setDbStats(stats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await superAdminService.getAuditLogs(20);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Erreur lors du chargement des logs:', error);
    }
  };

  const handleClearDatabase = async () => {
    if (!userData || !superAdminService.canClearDatabase(userData)) {
      alert('Accès non autorisé');
      return;
    }

    if (!clearOptions.dryRun && confirmationPhrase !== CONFIRMATION_PHRASE) {
      alert(`Pour confirmer, veuillez taper exactement: "${CONFIRMATION_PHRASE}"`);
      return;
    }

    setLoading(true);
    setClearResult(null);

    try {
      const result = await superAdminService.clearDatabase(clearOptions, userData);
      setClearResult(result);
      
      if (result.success) {
        await loadDatabaseStats();
        await loadAuditLogs();
        setConfirmationPhrase('');
      }
    } catch (error) {
      setClearResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Erreur inconnue']
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemoData = async () => {
    if (!userData || !superAdminService.canClearDatabase(userData)) {
      alert('Accès non autorisé');
      return;
    }

    const confirm = window.confirm(
      '🎯 Créer des données de démonstration ?\n\n' +
      'Cela va créer :\n' +
      '• 1 année scolaire (2024-2025)\n' +
      '• 5 enseignants\n' +
      '• 6 classes (CP A/B, CE1 A, CE2 A, CM1 A, CM2 A)\n' +
      '• 18 élèves\n' +
      '• Des absences aléatoires\n\n' +
      '⚠️ Note : Les comptes enseignants seront créés dans Firestore uniquement.\n' +
      'Vous devrez créer leurs comptes Firebase Auth manuellement si nécessaire.'
    );

    if (!confirm) return;

    setCreatingDemo(true);
    setDemoResult(null);

    try {
      const result = await superAdminService.createDemoData(userData);
      setDemoResult(result);
      
      if (result.success) {
        await loadDatabaseStats();
        await loadAuditLogs();
      }
    } catch (error) {
      setDemoResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Erreur inconnue']
      });
    } finally {
      setCreatingDemo(false);
    }
  };

  if (!userData || !superAdminService.isSuperAdmin(userData)) {
    return (
      <div className="super-admin-unauthorized">
        <h2>🚫 Accès Non Autorisé</h2>
        <p>Seuls les super administrateurs peuvent accéder à cette section.</p>
      </div>
    );
  }

  return (
    <div className="super-admin-dashboard">
      <div className="super-admin-header">
        <h1>🔧 Tableau de Bord Super Administrateur</h1>
        <div className="warning-banner">
          ⚠️ <strong>ATTENTION:</strong> Les opérations de nettoyage de base de données sont irréversibles.
          Utilisez toujours le mode "Test" d'abord.
        </div>
      </div>

      {/* Statistiques de la base de données */}
      <div className="database-stats">
        <h2>📊 Statistiques de la Base de Données</h2>
        {dbStats ? (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{dbStats.users}</div>
              <div className="stat-label">Utilisateurs Total</div>
            </div>
            <div className="stat-card directors">
              <div className="stat-number">{dbStats.directors}</div>
              <div className="stat-label">Directeurs</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{dbStats.teachers}</div>
              <div className="stat-label">Enseignants</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{dbStats.students}</div>
              <div className="stat-label">Élèves</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{dbStats.classes}</div>
              <div className="stat-label">Classes</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{dbStats.absences}</div>
              <div className="stat-label">Absences</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{dbStats.schoolYears}</div>
              <div className="stat-label">Années Scolaires</div>
            </div>
          </div>
        ) : (
          <div className="loading">Chargement des statistiques...</div>
        )}
        <button onClick={loadDatabaseStats} className="refresh-btn">
          🔄 Actualiser
        </button>
      </div>

      {/* Création de données de démonstration */}
      <div className="demo-data-section">
        <h2>🎯 Données de Démonstration</h2>
        <div className="demo-info">
          <p>Créez rapidement des données de test pour explorer l'application :</p>
          <ul>
            <li>✅ <strong>Année scolaire</strong> : 2024-2025 (02/09/2024 → 15/07/2025)</li>
            <li>✅ <strong>Enseignants</strong> : 5 profils complets</li>
            <li>✅ <strong>Classes</strong> : 6 classes (CP A/B, CE1 A, CE2 A, CM1 A, CM2 A)</li>
            <li>✅ <strong>Élèves</strong> : 18 élèves répartis dans les classes</li>
            <li>✅ <strong>Absences</strong> : Données aléatoires réalistes</li>
          </ul>
          <div className="demo-warning">
            ⚠️ <strong>Note :</strong> Les enseignants seront créés dans Firestore uniquement. 
            Leurs comptes Firebase Auth devront être créés manuellement via l'interface directeur si nécessaire.
          </div>
        </div>
        
        <div className="demo-actions">
          <button 
            onClick={handleCreateDemoData}
            disabled={creatingDemo}
            className="btn-demo"
          >
            {creatingDemo ? '⏳ Création en cours...' : '🎯 Créer les Données de Démo'}
          </button>
        </div>

        {demoResult && (
          <div className={`demo-result ${demoResult.success ? 'success' : 'error'}`}>
            <h3>{demoResult.success ? '✅ Données Créées !' : '❌ Erreur'}</h3>
            
            {demoResult.success && (
              <div className="creation-summary">
                <p><strong>{demoResult.message}</strong></p>
                <div className="counts-grid">
                  <div className="count-item">
                    <span className="count-number">{demoResult.createdCounts.anneeScolaire}</span>
                    <span className="count-label">Année Scolaire</span>
                  </div>
                  <div className="count-item">
                    <span className="count-number">{demoResult.createdCounts.enseignants}</span>
                    <span className="count-label">Enseignants</span>
                  </div>
                  <div className="count-item">
                    <span className="count-number">{demoResult.createdCounts.classes}</span>
                    <span className="count-label">Classes</span>
                  </div>
                  <div className="count-item">
                    <span className="count-number">{demoResult.createdCounts.eleves}</span>
                    <span className="count-label">Élèves</span>
                  </div>
                  <div className="count-item">
                    <span className="count-number">{demoResult.createdCounts.absences}</span>
                    <span className="count-label">Absences</span>
                  </div>
                </div>
              </div>
            )}

            {demoResult.errors && demoResult.errors.length > 0 && (
              <div className="error-list">
                <h4>Erreurs :</h4>
                <ul>
                  {demoResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration du nettoyage */}
      <div className="database-clear-config">
        <h2>🗑️ Configuration du Nettoyage de Base de Données</h2>
        
        <div className="clear-options">
          <div className="option-group">
            <h3>🛡️ Protections</h3>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.preserveDirectors}
                onChange={(e) => setClearOptions({...clearOptions, preserveDirectors: e.target.checked})}
              />
              <span className="checkmark"></span>
              Préserver tous les comptes directeurs
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.preserveCurrentUser}
                onChange={(e) => setClearOptions({...clearOptions, preserveCurrentUser: e.target.checked})}
              />
              <span className="checkmark"></span>
              Préserver mon compte actuel
            </label>
          </div>

          <div className="option-group">
            <h3>🗂️ Données à Nettoyer</h3>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.clearAbsences}
                onChange={(e) => setClearOptions({...clearOptions, clearAbsences: e.target.checked})}
              />
              <span className="checkmark"></span>
              Supprimer toutes les absences ({dbStats?.absences || 0})
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.clearStudents}
                onChange={(e) => setClearOptions({...clearOptions, clearStudents: e.target.checked})}
              />
              <span className="checkmark"></span>
              Supprimer tous les élèves ({dbStats?.students || 0})
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.clearClasses}
                onChange={(e) => setClearOptions({...clearOptions, clearClasses: e.target.checked})}
              />
              <span className="checkmark"></span>
              Supprimer toutes les classes ({dbStats?.classes || 0})
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.clearTeachers}
                onChange={(e) => setClearOptions({...clearOptions, clearTeachers: e.target.checked})}
              />
              <span className="checkmark"></span>
              Supprimer les enseignants ({dbStats?.teachers || 0})
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={clearOptions.clearSchoolYears}
                onChange={(e) => setClearOptions({...clearOptions, clearSchoolYears: e.target.checked})}
              />
              <span className="checkmark"></span>
              Supprimer les années scolaires ({dbStats?.schoolYears || 0})
            </label>
          </div>

          <div className="option-group">
            <h3>🔐 Firebase Authentication</h3>
            <label className="option-label auth-warning">
              <input
                type="checkbox"
                checked={clearOptions.clearFirebaseAuth}
                onChange={(e) => setClearOptions({...clearOptions, clearFirebaseAuth: e.target.checked})}
              />
              <span className="checkmark"></span>
              Nettoyer Firebase Authentication (⚠️ Nécessite action manuelle)
            </label>
            <div className="auth-info">
              <p>⚠️ <strong>Important :</strong> Les comptes email/password ne peuvent pas être supprimés automatiquement depuis l'interface web.</p>
              <p>📋 <strong>Action requise :</strong> Allez dans la Console Firebase → Authentication pour supprimer manuellement les comptes.</p>
            </div>
          </div>

          <div className="option-group">
            <h3>🧪 Mode d'Exécution</h3>
            <label className="option-label">
              <input
                type="radio"
                name="executionMode"
                checked={clearOptions.dryRun}
                onChange={() => setClearOptions({...clearOptions, dryRun: true})}
              />
              <span className="radiomark"></span>
              Mode Test (simulation sans suppression)
            </label>
            <label className="option-label danger">
              <input
                type="radio"
                name="executionMode"
                checked={!clearOptions.dryRun}
                onChange={() => setClearOptions({...clearOptions, dryRun: false})}
              />
              <span className="radiomark"></span>
              Mode Réel (suppression définitive)
            </label>
          </div>
        </div>

        {/* Confirmation pour le mode réel */}
        {!clearOptions.dryRun && (
          <div className="confirmation-section">
            <h3>⚠️ Confirmation Requise</h3>
            <p>Pour procéder au nettoyage réel, tapez exactement la phrase suivante :</p>
            <code>{CONFIRMATION_PHRASE}</code>
            <input
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder="Tapez la phrase de confirmation"
              className="confirmation-input"
            />
          </div>
        )}

        <div className="action-buttons">
          <button 
            onClick={handleClearDatabase}
            disabled={loading || (!clearOptions.dryRun && confirmationPhrase !== CONFIRMATION_PHRASE)}
            className={clearOptions.dryRun ? "btn-test" : "btn-danger"}
          >
            {loading ? '⏳ En cours...' : (clearOptions.dryRun ? '🧪 Simuler le Nettoyage' : '🗑️ Nettoyer la Base de Données')}
          </button>
        </div>
      </div>

      {/* Résultats du nettoyage */}
      {clearResult && (
        <div className={`clear-result ${clearResult.success ? 'success' : 'error'}`}>
          <h3>{clearResult.success ? '✅ Opération Réussie' : '❌ Opération Échouée'}</h3>
          
          {clearResult.success && (
            <div className="deletion-summary">
              <h4>Éléments traités :</h4>
              <ul>
                <li>Élèves : {clearResult.deletedCounts.students}</li>
                <li>Enseignants : {clearResult.deletedCounts.teachers}</li>
                <li>Classes : {clearResult.deletedCounts.classes}</li>
                <li>Absences : {clearResult.deletedCounts.absences}</li>
                <li>Années scolaires : {clearResult.deletedCounts.schoolYears}</li>
              </ul>
            </div>
          )}

          {clearResult.errors && clearResult.errors.length > 0 && (
            <div className="error-list">
              <h4>Erreurs :</h4>
              <ul>
                {clearResult.errors.map((error: string, index: number) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Logs d'audit */}
      <div className="audit-logs">
        <h2>📋 Logs d'Audit Récents</h2>
        <div className="logs-container">
          {auditLogs.length > 0 ? (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Type</th>
                  <th>Nom</th>
                  <th>Effectué par</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.performed_at).toLocaleString('fr-FR')}</td>
                    <td className={`action-${log.action}`}>{log.action}</td>
                    <td>{log.entity_type}</td>
                    <td>{log.entity_name}</td>
                    <td>{log.performed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-logs">Aucun log d'audit disponible</div>
          )}
        </div>
        <button onClick={loadAuditLogs} className="refresh-btn">
          🔄 Actualiser les Logs
        </button>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;