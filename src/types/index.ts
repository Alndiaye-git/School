export interface User {
  id: string;
  nom: string;
  email: string;
  matricule?: string; // Matricule unique pour les enseignants
  role: 'enseignant' | 'directeur' | 'super_admin';
  forcePasswordChange?: boolean; // Forcer le changement de mot de passe à la première connexion
  active?: boolean; // Optionnel pour compatibilité avec les données existantes
  deleted_at?: Date | null;
  deleted_by?: string;
}

export interface Classe {
  id: string;
  nom: string;
  niveau?: string; // CE1, CE2, CM1, etc.
  annee_scolaire_id: string; // ID de l'année scolaire
  enseignant_id: string;
  active?: boolean; // Optionnel pour compatibilité avec les données existantes
  deleted_at?: Date | null;
  deleted_by?: string;
}

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  numero_eleve?: string; // Numéro unique auto-généré
  classe_id: string;
  annee_scolaire_id: string; // Obligatoire : lien avec l'année scolaire
  active?: boolean; // Optionnel pour compatibilité avec les données existantes
  deleted_at?: Date | null;
  deleted_by?: string;
}

export interface AbsenceEleve {
  id: string;
  eleve_id: string;
  date: string;
  commentaire?: string;
  saisi_par: string;
  annee_scolaire_id?: string; // Lier l'absence à une année scolaire
}

export interface AbsenceEnseignant {
  id: string;
  enseignant_id: string;
  date: string;
  commentaire?: string;
}

// Audit trail pour tracer les suppressions
export interface AuditLog {
  id: string;
  action: 'delete' | 'update' | 'create' | 'database_clear';
  entity_type: 'user' | 'classe' | 'eleve' | 'database';
  entity_id: string;
  entity_name: string;
  performed_by: string;
  performed_at: Date;
  details?: any;
}

// Interface pour les opérations de nettoyage de base de données
export interface DatabaseClearOptions {
  preserveDirectors: boolean;
  preserveCurrentUser: boolean;
  clearStudents: boolean;
  clearTeachers: boolean;
  clearClasses: boolean;
  clearAbsences: boolean;
  clearSchoolYears: boolean;
  clearFirebaseAuth: boolean; // Nettoyer aussi Firebase Authentication
  dryRun?: boolean; // Pour tester sans vraiment supprimer
}