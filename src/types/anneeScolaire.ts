export interface AnneeScolaire {
  id: string;
  nom: string; // Ex: "2023-2024"
  dateDebut: string; // Ex: "2023-09-04"
  dateFin: string; // Ex: "2024-07-05"
  active: boolean; // Une seule année active à la fois
  periodes: PeriodeScolaire[];
  joursSpeciaux: JourSpecial[];
  created_at: string;
  created_by: string;
  verrouillee?: boolean; // true = année en lecture seule
  date_verrouillage?: string; // Date de verrouillage
  verrouille_par?: string; // ID de l'utilisateur qui a verrouillé
}

export interface PeriodeScolaire {
  id: string;
  nom: string; // Ex: "Période 1", "Vacances de Toussaint"
  dateDebut: string;
  dateFin: string;
  type: 'cours' | 'vacances'; // cours = jours où on peut saisir absences
}

export interface JourSpecial {
  id: string;
  date: string;
  nom: string; // Ex: "Toussaint", "Ascension", "Pont"
  type: 'ferie' | 'pont' | 'fermeture'; // Tous ces types = pas de cours
}

// Type pour les calculs de statistiques
export interface JoursOuvrables {
  anneeScolaireId: string;
  totalJours: number; // Nombre total de jours ouvrables dans l'année
  joursEcoules: number; // Nombre de jours écoulés depuis le début
  joursRestants: number; // Nombre de jours restants
  periodesVacances: number; // Nombre de jours de vacances
  joursFeries: number; // Nombre de jours fériés
}