// Configuration de l'application
export const appConfig = {
  // Nom de l'école - peut être modifié via la variable d'environnement REACT_APP_SCHOOL_NAME
  schoolName: process.env.REACT_APP_SCHOOL_NAME || 'École Primaire Les Petits Savants',
  
  // Titre de l'application - peut être modifié via la variable d'environnement REACT_APP_APP_TITLE
  appTitle: process.env.REACT_APP_APP_TITLE || 'Gestion des Absences',
  
  // Version de l'application
  version: '1.0.0',
  
  // Autres configurations possibles
  maxAbsencesBeforeAlert: 5,
  defaultLanguage: 'fr',
  
  // Fonctions utilitaires
  getFullTitle: () => `${appConfig.appTitle} - ${appConfig.schoolName}`,
  getShortTitle: (isMobile: boolean = false) => {
    return isMobile ? appConfig.schoolName.split(' ')[0] : appConfig.schoolName;
  }
};

export default appConfig;