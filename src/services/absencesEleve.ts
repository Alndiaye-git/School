import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { AbsenceEleve, Eleve, Classe } from '../types';
import { anneeScolaireService } from './anneeScolaire';

export interface AbsenceEleveDetailed extends AbsenceEleve {
  jourSemaine: string;
  mois: string;
  semaine: number;
}

export interface StatistiquesAbsenceEleve {
  totalAbsences: number;
  tauxAbsenteisme: number;
  absencesParMois: { [mois: string]: number };
  absencesParJourSemaine: { [jour: string]: number };
  periodesSansAbsence: { debut: string; fin: string; jours: number }[];
  dernièreAbsence?: string;
  premièreAbsence?: string;
  moyenneAbsencesParMois: number;
}

export class AbsencesEleveService {

  /**
   * Récupérer toutes les absences d'un élève pour une année scolaire
   */
  async getAbsencesEleve(
    eleveId: string, 
    anneeScolaireId?: string
  ): Promise<AbsenceEleveDetailed[]> {
    try {
      // Si pas d'année spécifiée, utiliser l'année active
      if (!anneeScolaireId) {
        const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
        if (!anneeScolaireActive) {
          throw new Error('Aucune année scolaire active');
        }
        anneeScolaireId = anneeScolaireActive.id;
      }

      // Récupérer les dates de l'année scolaire
      const anneeScolaireQuery = query(
        collection(db, 'annees_scolaires'),
        where('__name__', '==', anneeScolaireId)
      );
      const anneeScolaireSnapshot = await getDocs(anneeScolaireQuery);
      
      if (anneeScolaireSnapshot.empty) {
        throw new Error('Année scolaire non trouvée');
      }
      
      const anneeScolaire = { id: anneeScolaireSnapshot.docs[0].id, ...anneeScolaireSnapshot.docs[0].data() } as any;

      const dateDebut = new Date(anneeScolaire.dateDebut);
      const dateFin = new Date(anneeScolaire.dateFin);

      // Query pour récupérer les absences de l'élève dans la période
      const absencesQuery = query(
        collection(db, 'absences_eleves'),
        where('eleve_id', '==', eleveId),
        where('date', '>=', anneeScolaire.dateDebut),
        where('date', '<=', anneeScolaire.dateFin),
        orderBy('date', 'desc')
      );

      const absencesSnapshot = await getDocs(absencesQuery);
      
      const absences: AbsenceEleveDetailed[] = absencesSnapshot.docs.map(doc => {
        const absence = { id: doc.id, ...doc.data() } as AbsenceEleve;
        const dateAbsence = new Date(absence.date);
        
        return {
          ...absence,
          jourSemaine: dateAbsence.toLocaleDateString('fr-FR', { weekday: 'long' }),
          mois: dateAbsence.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          semaine: this.getWeekNumber(dateAbsence)
        };
      });

      return absences;
    } catch (error) {
      console.error('Erreur lors de la récupération des absences:', error);
      throw error;
    }
  }

  /**
   * Calculer les statistiques d'absence d'un élève
   */
  async getStatistiquesAbsenceEleve(
    eleveId: string, 
    anneeScolaireId?: string
  ): Promise<StatistiquesAbsenceEleve> {
    try {
      // Récupérer les absences
      const absences = await this.getAbsencesEleve(eleveId, anneeScolaireId);
      
      // Récupérer l'année scolaire pour le calcul de la moyenne
      let anneeScolaire: any = null;
      if (anneeScolaireId) {
        const anneeScolaireQuery3 = query(
          collection(db, 'annees_scolaires'),
          where('__name__', '==', anneeScolaireId)
        );
        const anneeScolaireSnapshot3 = await getDocs(anneeScolaireQuery3);
        anneeScolaire = anneeScolaireSnapshot3.empty ? null : 
          { id: anneeScolaireSnapshot3.docs[0].id, ...anneeScolaireSnapshot3.docs[0].data() };
      } else {
        anneeScolaire = await anneeScolaireService.getAnneeScolaireActive();
      }
      
      // Calculer le nombre de jours ouvrables dans l'année
      const joursOuvrables = await anneeScolaireService.calculerJoursOuvrables(anneeScolaireId);
      
      // Statistiques de base
      const totalAbsences = absences.length;
      const tauxAbsenteisme = joursOuvrables.totalJours > 0 ? 
        Math.round((totalAbsences / joursOuvrables.totalJours) * 10000) / 100 : 0;

      // Grouper par mois
      const absencesParMois: { [mois: string]: number } = {};
      absences.forEach(absence => {
        absencesParMois[absence.mois] = (absencesParMois[absence.mois] || 0) + 1;
      });

      // Grouper par jour de la semaine
      const absencesParJourSemaine: { [jour: string]: number } = {};
      absences.forEach(absence => {
        absencesParJourSemaine[absence.jourSemaine] = (absencesParJourSemaine[absence.jourSemaine] || 0) + 1;
      });

      // Dates importantes
      const dates = absences.map(a => a.date).sort();
      const dernièreAbsence = dates[dates.length - 1];
      const premièreAbsence = dates[0];

      // Moyenne par mois (sur tous les mois écoulés de l'année scolaire)
      let moyenneAbsencesParMois = 0;
      if (anneeScolaire) {
        const dateActuelle = new Date();
        const dateDebutAnnee = new Date(anneeScolaire.dateDebut);
        const moisEcoules = this.calculerMoisEcoules(dateDebutAnnee, dateActuelle);
        moyenneAbsencesParMois = moisEcoules > 0 ? 
          Math.round((totalAbsences / moisEcoules) * 100) / 100 : 0;
      }

      // Calculer les périodes sans absence
      const periodesSansAbsence = this.calculerPeriodesSansAbsence(absences, anneeScolaireId);

      return {
        totalAbsences,
        tauxAbsenteisme,
        absencesParMois,
        absencesParJourSemaine,
        periodesSansAbsence: await periodesSansAbsence,
        dernièreAbsence,
        premièreAbsence,
        moyenneAbsencesParMois
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw error;
    }
  }

  /**
   * Calculer les périodes sans absence
   */
  private async calculerPeriodesSansAbsence(
    absences: AbsenceEleveDetailed[], 
    anneeScolaireId?: string
  ): Promise<{ debut: string; fin: string; jours: number }[]> {
    try {
      if (absences.length === 0) {
        return [];
      }

      // Récupérer l'année scolaire
      let anneeScolaire: any = null;
      
      if (anneeScolaireId) {
        const anneeScolaireQuery2 = query(
          collection(db, 'annees_scolaires'),
          where('__name__', '==', anneeScolaireId)
        );
        const anneeScolaireSnapshot2 = await getDocs(anneeScolaireQuery2);
        anneeScolaire = anneeScolaireSnapshot2.empty ? null : 
          { id: anneeScolaireSnapshot2.docs[0].id, ...anneeScolaireSnapshot2.docs[0].data() };
      } else {
        anneeScolaire = await anneeScolaireService.getAnneeScolaireActive();
      }

      if (!anneeScolaire) return [];

      // Trier les absences par date
      const datesAbsences = absences.map(a => a.date).sort();
      const periodes: { debut: string; fin: string; jours: number }[] = [];

      // Période avant la première absence
      if (datesAbsences[0] > anneeScolaire.dateDebut) {
        const jours = this.compterJoursOuvrables(anneeScolaire.dateDebut, datesAbsences[0]);
        if (jours > 7) { // Seulement si plus d'une semaine
          periodes.push({
            debut: anneeScolaire.dateDebut,
            fin: datesAbsences[0],
            jours
          });
        }
      }

      // Périodes entre les absences
      for (let i = 0; i < datesAbsences.length - 1; i++) {
        const debut = datesAbsences[i];
        const fin = datesAbsences[i + 1];
        const jours = this.compterJoursOuvrables(debut, fin);
        
        if (jours > 7) { // Seulement si plus d'une semaine
          periodes.push({ debut, fin, jours });
        }
      }

      // Période après la dernière absence
      const dernièreDate = datesAbsences[datesAbsences.length - 1];
      if (dernièreDate < anneeScolaire.dateFin) {
        const jours = this.compterJoursOuvrables(dernièreDate, anneeScolaire.dateFin);
        if (jours > 7) {
          periodes.push({
            debut: dernièreDate,
            fin: anneeScolaire.dateFin,
            jours
          });
        }
      }

      return periodes.slice(0, 3); // Limiter aux 3 plus longues périodes
    } catch (error) {
      console.error('Erreur calcul périodes sans absence:', error);
      return [];
    }
  }

  /**
   * Compter les jours ouvrables entre deux dates
   */
  private compterJoursOuvrables(dateDebut: string, dateFin: string): number {
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    let count = 0;
    
    const currentDate = new Date(debut);
    while (currentDate < fin) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclure weekend
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Obtenir le numéro de semaine
   */
  private getWeekNumber(date: Date): number {
    const onejan = new Date(date.getFullYear(), 0, 1);
    const millisecsInDay = 86400000;
    return Math.ceil((((date.getTime() - onejan.getTime()) / millisecsInDay) + onejan.getDay() + 1) / 7);
  }

  /**
   * Calculer le nombre de mois écoulés depuis le début de l'année scolaire
   */
  private calculerMoisEcoules(dateDebut: Date, dateActuelle: Date): number {
    const debut = new Date(dateDebut.getFullYear(), dateDebut.getMonth(), 1);
    const actuelle = new Date(dateActuelle.getFullYear(), dateActuelle.getMonth(), 1);
    
    let moisEcoules = 0;
    const currentDate = new Date(debut);
    
    while (currentDate <= actuelle) {
      moisEcoules++;
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return moisEcoules;
  }

  /**
   * Récupérer les informations complètes d'un élève avec sa classe
   */
  async getEleveAvecClasse(eleveId: string): Promise<{ eleve: Eleve; classe: Classe | null }> {
    try {
      // Récupérer l'élève
      const eleveSnapshot = await getDocs(
        query(collection(db, 'eleves'), where('__name__', '==', eleveId))
      );
      
      if (eleveSnapshot.empty) {
        throw new Error('Élève non trouvé');
      }
      
      const eleve = { id: eleveSnapshot.docs[0].id, ...eleveSnapshot.docs[0].data() } as Eleve;
      
      // Récupérer sa classe
      let classe: Classe | null = null;
      if (eleve.classe_id) {
        const classeSnapshot = await getDocs(
          query(collection(db, 'classes'), where('__name__', '==', eleve.classe_id))
        );
        
        if (!classeSnapshot.empty) {
          classe = { id: classeSnapshot.docs[0].id, ...classeSnapshot.docs[0].data() } as Classe;
        }
      }
      
      return { eleve, classe };
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'élève:', error);
      throw error;
    }
  }
}

export const absencesEleveService = new AbsencesEleveService();