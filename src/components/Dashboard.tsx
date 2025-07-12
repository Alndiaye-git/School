import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { anneeScolaireService } from '../services/anneeScolaire';
import { AnneeScolaire } from '../types/anneeScolaire';
import { appConfig } from '../config/appConfig';
import GestionClasses from './GestionClasses';
import GestionEleves from './GestionEleves';
import GestionEnseignants from './GestionEnseignants';
import SaisieAbsences from './SaisieAbsences';
import Statistiques from './Statistiques';
import GestionAnneeScolaire from './GestionAnneeScolaire';
import ElevesEnseignant from './ElevesEnseignant';
import SuperAdminDashboard from './SuperAdminDashboard';

type ActiveView = 'home' | 'classes' | 'eleves' | 'enseignants' | 'absences-eleves' | 'absences-enseignants' | 'statistiques' | 'export' | 'annee-scolaire' | 'mes-eleves' | 'super-admin';

const Dashboard: React.FC = () => {
  const { userData, logout } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [anneeScolaireActive, setAnneeScolaireActive] = useState<AnneeScolaire | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024 && window.innerWidth > 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    // Sur mobile, toujours collapsed par défaut
    if (window.innerWidth <= 768) return true;
    return saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    const loadAnneeScolaireActive = async () => {
      try {
        const anneeActive = await anneeScolaireService.getAnneeScolaireActive();
        setAnneeScolaireActive(anneeActive);
      } catch (error) {
        console.error('Erreur lors du chargement de l\'année scolaire active:', error);
      }
    };

    loadAnneeScolaireActive();
  }, []);

  // Gestion du redimensionnement de fenêtre
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width <= 1024 && width > 768);
      
      // Sur mobile, forcer la sidebar à être collapsed
      if (width <= 768) {
        setSidebarCollapsed(true);
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gestion du swipe sur mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isMobile) return;
    
    const currentTouch = e.targetTouches[0].clientX;
    const diff = touchStart - currentTouch;
    
    // Swipe vers la droite pour ouvrir (si pas déjà ouvert)
    if (diff < -50 && !mobileMenuOpen && touchStart < 50) {
      setMobileMenuOpen(true);
      setTouchStart(null);
    }
    // Swipe vers la gauche pour fermer (si ouvert)
    else if (diff > 50 && mobileMenuOpen) {
      setMobileMenuOpen(false);
      setTouchStart(null);
    }
  };

  // Recharger l'année scolaire active quand on revient à la vue principale
  useEffect(() => {
    if (activeView !== 'annee-scolaire') {
      return;
    }
    
    const loadAnneeScolaireActive = async () => {
      try {
        const anneeActive = await anneeScolaireService.getAnneeScolaireActive();
        setAnneeScolaireActive(anneeActive);
      } catch (error) {
        console.error('Erreur lors du rechargement de l\'année scolaire active:', error);
      }
    };

    loadAnneeScolaireActive();
  }, [activeView]);

  // Fonction pour changer de vue et fermer le menu mobile
  const handleViewChange = (view: ActiveView) => {
    setActiveView(view);
    // Fermer le menu mobile après navigation
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };


  if (!userData) {
    return <div>Chargement...</div>;
  }

  const renderContent = () => {
    switch (activeView) {
      case 'classes':
        return <GestionClasses />;
      case 'eleves':
        return <GestionEleves />;
      case 'enseignants':
        return <GestionEnseignants />;
      case 'absences-eleves':
        return <SaisieAbsences />;
      case 'absences-enseignants':
        return <div>Gestion des absences enseignants (à implémenter)</div>;
      case 'statistiques':
        return <Statistiques />;
      case 'annee-scolaire':
        return <GestionAnneeScolaire />;
      case 'mes-eleves':
        return <ElevesEnseignant />;
      case 'super-admin':
        return <SuperAdminDashboard />;
      case 'export':
        return <div>Export CSV (à implémenter)</div>;
      default:
        return (
          <div className="home-content">
            <h2>Bienvenue à {appConfig.schoolName}</h2>
            <p>Système de {appConfig.appTitle.toLowerCase()} - Sélectionnez une action dans le menu pour commencer.</p>
          </div>
        );
    }
  };

  return (
    <div 
      className="dashboard-layout"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <header className="top-header">
        <div className="header-content">
          <div className="header-left">
            <button 
              className="sidebar-toggle"
              onClick={() => {
                if (isMobile) {
                  // Sur mobile, toggle le menu overlay
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  // Sur desktop/tablet, toggle collapsed state
                  const newCollapsed = !sidebarCollapsed;
                  setSidebarCollapsed(newCollapsed);
                  localStorage.setItem('sidebarCollapsed', newCollapsed.toString());
                }
              }}
              title={isMobile ? 
                (mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu") :
                (sidebarCollapsed ? "Ouvrir le menu" : "Fermer le menu")
              }
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1>{isMobile ? appConfig.getShortTitle(true) : appConfig.schoolName}</h1>
          </div>
          <div className="header-user-info">
            {!isMobile && <span className="welcome-text">Bonjour, {userData.nom}</span>}
            <span className="role-badge">{isMobile ? userData.nom.charAt(0).toUpperCase() : userData.role}</span>
          </div>
        </div>
      </header>
      <div className={`main-layout ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
        {/* Overlay pour mobile */}
        {isMobile && mobileMenuOpen && (
          <div 
            className="mobile-overlay" 
            onClick={() => setMobileMenuOpen(false)}
          ></div>
        )}
        
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''} ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          {(!sidebarCollapsed || isMobile) ? (
            <div className="sidebar-year-info">
              {anneeScolaireActive ? (
                <>
                  <h3>Année Scolaire</h3>
                  <div className="year-badge">📅 {anneeScolaireActive.nom}</div>
                </>
              ) : (
                <>
                  <h3>Année Scolaire</h3>
                  <div className="year-badge no-year">⚠️ Aucune année active</div>
                </>
              )}
            </div>
          ) : (
            <div className="sidebar-year-icon" title={anneeScolaireActive ? anneeScolaireActive.nom : "Aucune année active"}>
              📅
            </div>
          )}
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={activeView === 'home' ? 'active' : ''}
            onClick={() => handleViewChange('home')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 7z"></path>
              <polyline points="8,21 8,14 16,14 16,21"></polyline>
              <polyline points="10,9 14,9"></polyline>
              <polyline points="12,7 12,9"></polyline>
            </svg>
            {(!sidebarCollapsed || isMobile) && <span>Accueil</span>}
          </button>
          
          <button 
            className={activeView === 'absences-eleves' ? 'active' : ''}
            onClick={() => handleViewChange('absences-eleves')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
              <line x1="9" y1="14" x2="15" y2="20"></line>
              <line x1="15" y1="14" x2="9" y2="20"></line>
            </svg>
            {(!sidebarCollapsed || isMobile) && <span>Absences Élèves</span>}
          </button>

          {userData.role === 'enseignant' && (
            <>
              <button 
                className={activeView === 'mes-eleves' ? 'active' : ''}
                onClick={() => handleViewChange('mes-eleves')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                {(!sidebarCollapsed || isMobile) && <span>Mes Élèves</span>}
              </button>
              
              {/* Section Utilisateur et Déconnexion pour Enseignant */}
              <div className="nav-section user-section">
                {(!sidebarCollapsed || isMobile) && <h3>👤 Mon Compte</h3>}
                <div className="user-info-nav">
                  {(!sidebarCollapsed || isMobile) ? (
                    <>
                      <div className="user-profile-nav">
                        <div className="user-avatar">{userData.nom.charAt(0).toUpperCase()}</div>
                        <div className="user-details">
                          <span className="user-name">{userData.nom}</span>
                          <span className="user-role">{userData.role}</span>
                        </div>
                      </div>
                      <button onClick={logout} className="logout-btn" title="Déconnexion">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Déconnexion</span>
                      </button>
                    </>
                  ) : (
                    <div className="user-info-collapsed">
                      <div className="user-avatar-small">{userData.nom.charAt(0).toUpperCase()}</div>
                      <button onClick={logout} className="logout-btn-icon" title="Déconnexion">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {userData.role === 'directeur' && (
            <>
              <div className="nav-section">
                {(!sidebarCollapsed || isMobile) && <h3>Gestion</h3>}
                <button 
                  className={activeView === 'enseignants' ? 'active' : ''}
                  onClick={() => handleViewChange('enseignants')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="12" rx="1"></rect>
                    <path d="M7 8h6"></path>
                    <path d="M7 12h8"></path>
                    <path d="M7 16h4"></path>
                    <path d="M21 16v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4"></path>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Enseignants</span>}
                </button>
                <button 
                  className={activeView === 'classes' ? 'active' : ''}
                  onClick={() => handleViewChange('classes')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <path d="M3 9h18"></path>
                    <path d="M9 3v18"></path>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Classes</span>}
                </button>
                <button 
                  className={activeView === 'eleves' ? 'active' : ''}
                  onClick={() => handleViewChange('eleves')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Élèves</span>}
                </button>
              </div>
              
              <div className="nav-section">
                {(!sidebarCollapsed || isMobile) && <h3>Administration</h3>}
                <button 
                  className={activeView === 'annee-scolaire' ? 'active' : ''}
                  onClick={() => handleViewChange('annee-scolaire')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Année Scolaire</span>}
                </button>
                <button 
                  className={activeView === 'absences-enseignants' ? 'active' : ''}
                  onClick={() => handleViewChange('absences-enseignants')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="9" y1="12" x2="15" y2="12"></line>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Absences Enseignants</span>}
                </button>
                <button 
                  className={activeView === 'statistiques' ? 'active' : ''}
                  onClick={() => handleViewChange('statistiques')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Statistiques</span>}
                </button>
                <button 
                  className={activeView === 'export' ? 'active' : ''}
                  onClick={() => handleViewChange('export')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Export</span>}
                </button>
              </div>
              
              {/* Section Utilisateur et Déconnexion */}
              <div className="nav-section user-section">
                {(!sidebarCollapsed || isMobile) && <h3>👤 Mon Compte</h3>}
                <div className="user-info-nav">
                  {(!sidebarCollapsed || isMobile) ? (
                    <>
                      <div className="user-profile-nav">
                        <div className="user-avatar">{userData.nom.charAt(0).toUpperCase()}</div>
                        <div className="user-details">
                          <span className="user-name">{userData.nom}</span>
                          <span className="user-role">{userData.role}</span>
                        </div>
                      </div>
                      <button onClick={logout} className="logout-btn" title="Déconnexion">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Déconnexion</span>
                      </button>
                    </>
                  ) : (
                    <div className="user-info-collapsed">
                      <div className="user-avatar-small">{userData.nom.charAt(0).toUpperCase()}</div>
                      <button onClick={logout} className="logout-btn-icon" title="Déconnexion">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {userData.role === 'super_admin' && (
            <>
              <div className="nav-section super-admin-section">
                {(!sidebarCollapsed || isMobile) && <h3>🔧 Super Administration</h3>}
                <button 
                  className={activeView === 'super-admin' ? 'active' : ''}
                  onClick={() => handleViewChange('super-admin')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"></path>
                    <path d="M9 12l2 2 4-4"></path>
                  </svg>
                  {(!sidebarCollapsed || isMobile) && <span>Gestion Base de Données</span>}
                </button>
              </div>
              
              {/* Section Utilisateur et Déconnexion pour Super Admin */}
              <div className="nav-section user-section">
                {(!sidebarCollapsed || isMobile) && <h3>👤 Mon Compte</h3>}
                <div className="user-info-nav">
                  {(!sidebarCollapsed || isMobile) ? (
                    <>
                      <div className="user-profile-nav">
                        <div className="user-avatar">{userData.nom.charAt(0).toUpperCase()}</div>
                        <div className="user-details">
                          <span className="user-name">{userData.nom}</span>
                          <span className="user-role">{userData.role}</span>
                        </div>
                      </div>
                      <button onClick={logout} className="logout-btn" title="Déconnexion">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Déconnexion</span>
                      </button>
                    </>
                  ) : (
                    <div className="user-info-collapsed">
                      <div className="user-avatar-small">{userData.nom.charAt(0).toUpperCase()}</div>
                      <button onClick={logout} className="logout-btn-icon" title="Déconnexion">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </nav>
      </aside>
      
        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;