import { 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Classe, Eleve, AbsenceEleve } from '../types';
import { getActiveClasses, getActiveEleves, getActiveClassesByAnneeScolaire, getActiveElevesByAnneeScolaire } from './softDelete';
import { getAbsencesElevesByAnneeScolaire } from './firestore';
import { anneeScolaireService } from './anneeScolaire';
import { JoursOuvrables } from '../types/anneeScolaire';

// Types pour les statistiques
export interface GlobalStats {
  totalEleves: number;
  totalClasses: number;
  tauxAbsenteisme: number;
  tendanceMensuelle: MonthlyTrend[];
  lastUpdate: Date;
}

export interface MonthlyTrend {
  mois: string;
  absences: number;
  presents: number;
  tauxAbsenteisme: number;
}

export interface ClasseStats {
  classe: Classe;
  totalEleves: number;
  totalAbsences: number;
  tauxAbsenteisme: number;
  evolution: EvolutionData[];
}

export interface EvolutionData {
  periode: string;
  absences: number;
  presents: number;
  tauxAbsenteisme: number;
}

export interface TemporalStats {
  parJourSemaine: DayOfWeekStats[];
  picsAbsences: PeakAbsence[];
  evolutionAnnuelle: MonthlyTrend[];
}

export interface DayOfWeekStats {
  jour: string;
  jourNum: number;
  absences: number;
  presents: number;
  tauxAbsenteisme: number;
}

export interface PeakAbsence {
  date: string;
  absences: number;
  tauxAbsenteisme: number;
  commentaire?: string;
}

export interface IndividualStats {
  topAssidus: EleveWithStats[];
  elevesSuivi: EleveWithStats[];
  alertes: AlerteEleve[];
}

export interface EleveWithStats {
  eleve: Eleve;
  totalAbsences: number;
  tauxAbsenteisme: number;
  derniereAbsence?: string;
  classeName: string;
}

export interface AlerteEleve {
  eleve: Eleve;
  raison: string;
  niveau: 'warning' | 'danger';
  absencesRecentes: number;
  classeName: string;
}

// Service principal de statistiques
export class StatisticsService {
  
  /**
   * 1. VUE D'ENSEMBLE GLOBALE
   */
  async getGlobalStatistics(anneeScolaireId?: string): Promise<GlobalStats> {
    try {
      const [classes, eleves, absences] = await Promise.all([
        getActiveClassesByAnneeScolaire(anneeScolaireId),
        getActiveElevesByAnneeScolaire(anneeScolaireId),
        this.getAllAbsences(anneeScolaireId)
      ]);

      const totalEleves = eleves.length;
      const totalClasses = classes.length;
      
      // Calculer le taux d'absentéisme global (en demi-journées)
      const joursEcole = await this.getJoursEcoleAnnee(anneeScolaireId);
      const totalDemiJourneesEleves = totalEleves * joursEcole * 2; // Multiplier par 2 pour avoir les demi-journées
      const totalAbsences = absences.length; // Nombre de demi-journées d'absence
      const tauxAbsenteisme = totalDemiJourneesEleves > 0 ? (totalAbsences / totalDemiJourneesEleves) * 100 : 0;

      // Calculer la tendance mensuelle
      const tendanceMensuelle = await this.calculateMonthlyTrend(absences, eleves, anneeScolaireId);

      return {
        totalEleves,
        totalClasses,
        tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100,
        tendanceMensuelle,
        lastUpdate: new Date()
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques globales:', error);
      throw error;
    }
  }

  /**
   * 2. STATISTIQUES PAR CLASSE
   */
  async getClasseStatistics(anneeScolaireId?: string): Promise<ClasseStats[]> {
    try {
      console.log('🏫 === CALCUL STATS PAR CLASSE ===');
      
      const [classes, eleves, absences] = await Promise.all([
        getActiveClassesByAnneeScolaire(anneeScolaireId),
        getActiveElevesByAnneeScolaire(anneeScolaireId),
        this.getAllAbsences(anneeScolaireId)
      ]);

      console.log('📊 Données chargées:');
      console.log('  - Classes actives:', classes.length);
      console.log('  - Élèves actifs:', eleves.length);
      console.log('  - Absences totales:', absences.length);

      const joursEcole = await this.getJoursEcoleAnnee(anneeScolaireId);
      console.log('📅 Jours d\'école dans l\'année:', joursEcole);

      const stats: ClasseStats[] = [];

      for (const classe of classes) {
        const elevesClasse = eleves.filter(e => e.classe_id === classe.id);
        const absencesClasse = absences.filter(a => 
          elevesClasse.some(e => e.id === a.eleve_id)
        );

        const totalEleves = elevesClasse.length;
        const totalAbsences = absencesClasse.length; // Nombre de demi-journées d'absence

        // Calculer le taux d'absentéisme de la classe (en demi-journées)
        const totalDemiJourneesClasse = totalEleves * joursEcole * 2; // Multiplier par 2 pour les demi-journées
        const tauxAbsenteisme = totalDemiJourneesClasse > 0 ? (totalAbsences / totalDemiJourneesClasse) * 100 : 0;

        console.log(`📝 Classe ${classe.nom}:`);
        console.log(`  - Élèves: ${totalEleves}`);
        console.log(`  - Absences (demi-journées): ${totalAbsences}`);
        console.log(`  - Total demi-journées possibles (${totalEleves} × ${joursEcole} × 2): ${totalDemiJourneesClasse}`);
        console.log(`  - Taux d'absentéisme: ${tauxAbsenteisme}%`);

        // Calculer l'évolution mensuelle
        const evolution = await this.calculateClasseEvolution(absencesClasse, elevesClasse, anneeScolaireId);

        stats.push({
          classe,
          totalEleves,
          totalAbsences,
          tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100,
          evolution
        });
      }

      // Trier par taux d'absentéisme décroissant
      const sortedStats = stats.sort((a, b) => b.tauxAbsenteisme - a.tauxAbsenteisme);
      console.log('🏫 === FIN CALCUL STATS PAR CLASSE ===');
      return sortedStats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques par classe:', error);
      throw error;
    }
  }

  /**
   * 3. STATISTIQUES TEMPORELLES
   */
  async getTemporalStatistics(anneeScolaireId?: string): Promise<TemporalStats> {
    try {
      const [eleves, absences] = await Promise.all([
        getActiveElevesByAnneeScolaire(anneeScolaireId),
        this.getAllAbsences(anneeScolaireId)
      ]);

      const parJourSemaine = await this.calculateDayOfWeekStats(absences, eleves, anneeScolaireId);
      const picsAbsences = await this.calculatePeakAbsences(absences, eleves);
      const evolutionAnnuelle = await this.calculateMonthlyTrend(absences, eleves, anneeScolaireId);

      return {
        parJourSemaine,
        picsAbsences,
        evolutionAnnuelle
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques temporelles:', error);
      throw error;
    }
  }

  /**
   * 4. STATISTIQUES INDIVIDUELLES
   */
  async getIndividualStatistics(anneeScolaireId?: string): Promise<IndividualStats> {
    try {
      console.log('👤 === CALCUL STATS INDIVIDUELLES ===');
      
      const [classes, eleves, absences] = await Promise.all([
        getActiveClassesByAnneeScolaire(anneeScolaireId),
        getActiveElevesByAnneeScolaire(anneeScolaireId),
        this.getAllAbsences(anneeScolaireId)
      ]);

      console.log('📊 Données individuelles:');
      console.log('  - Classes:', classes.length);
      console.log('  - Élèves:', eleves.length);
      console.log('  - Absences:', absences.length);

      const joursEcole = await this.getJoursEcoleAnnee(anneeScolaireId);
      console.log('📅 Jours d\'école pour calcul individuel:', joursEcole);

      const elevesWithStats: EleveWithStats[] = [];

      for (const eleve of eleves) {
        const absencesEleve = absences.filter(a => a.eleve_id === eleve.id);
        const classe = classes.find(c => c.id === eleve.classe_id);

        const totalAbsences = absencesEleve.length; // Nombre de demi-journées d'absence
        const totalDemiJourneesEleve = joursEcole * 2; // Multiplier par 2 pour les demi-journées
        const tauxAbsenteisme = totalDemiJourneesEleve > 0 ? (totalAbsences / totalDemiJourneesEleve) * 100 : 0;

        const derniereAbsence = absencesEleve.length > 0
          ? absencesEleve.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
          : undefined;

        if (totalAbsences > 0) {
          console.log(`📝 Élève ${eleve.prenom} ${eleve.nom}:`);
          console.log(`  - Absences (demi-journées): ${totalAbsences}`);
          console.log(`  - Demi-journées d'école: ${totalDemiJourneesEleve}`);
          console.log(`  - Taux: ${tauxAbsenteisme}%`);
        }

        elevesWithStats.push({
          eleve,
          totalAbsences,
          tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100,
          derniereAbsence,
          classeName: classe ? `${classe.nom} - ${classe.niveau}` : 'Classe inconnue'
        });
      }

      // Top 10 des plus assidus (moins d'absences)
      const topAssidus = elevesWithStats
        .sort((a, b) => a.tauxAbsenteisme - b.tauxAbsenteisme)
        .slice(0, 10);

      // Élèves nécessitant un suivi (>10% d'absences)
      const elevesSuivi = elevesWithStats
        .filter(e => e.tauxAbsenteisme > 10)
        .sort((a, b) => b.tauxAbsenteisme - a.tauxAbsenteisme);

      console.log('🎯 Résultats individuels:');
      console.log('  - Élèves à suivre (>10%):', elevesSuivi.length);
      console.log('  - Top assidus:', topAssidus.length);

      // Générer les alertes
      const alertes = await this.generateAlerts(elevesWithStats, absences);

      console.log('👤 === FIN CALCUL STATS INDIVIDUELLES ===');
      return {
        topAssidus,
        elevesSuivi,
        alertes
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques individuelles:', error);
      throw error;
    }
  }

  // Méthodes utilitaires privées

  private async getAllAbsences(anneeScolaireId?: string): Promise<AbsenceEleve[]> {
    // Utiliser la nouvelle fonction qui filtre par année scolaire
    return await getAbsencesElevesByAnneeScolaire(anneeScolaireId);
  }

  private async getJoursEcoleAnnee(anneeScolaireId?: string): Promise<number> {
    try {
      const joursOuvrables = await anneeScolaireService.calculerJoursOuvrables(anneeScolaireId);
      return joursOuvrables.totalJours;
    } catch (error) {
      console.error('Erreur lors du calcul des jours ouvrables, utilisation de la valeur par défaut:', error);
      // Fallback vers l'ancienne méthode en cas d'erreur
      return 144;
    }
  }

  private async calculateMonthlyTrend(absences: AbsenceEleve[], eleves: Eleve[], anneeScolaireId?: string): Promise<MonthlyTrend[]> {
    const moisNames = [
      'Septembre', 'Octobre', 'Novembre', 'Décembre',
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'
    ];

    const trends: MonthlyTrend[] = [];
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 10; i++) {
      const mois = (i + 8) % 12 + 1; // Septembre = 9, Octobre = 10, ..., Juin = 6
      const annee = i < 4 ? currentYear : currentYear + 1;
      
      const absencesMois = absences.filter(a => {
        const date = new Date(a.date);
        return date.getMonth() + 1 === mois && date.getFullYear() === annee;
      });

      const joursOuvrablesMois = 20; // Approximation
      const totalDemiJourneesMois = eleves.length * joursOuvrablesMois * 2; // Multiplier par 2 pour les demi-journées
      const presents = totalDemiJourneesMois - absencesMois.length;
      const tauxAbsenteisme = totalDemiJourneesMois > 0 ? (absencesMois.length / totalDemiJourneesMois) * 100 : 0;

      trends.push({
        mois: moisNames[i],
        absences: absencesMois.length,
        presents,
        tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100
      });
    }

    return trends;
  }

  private async calculateClasseEvolution(absences: AbsenceEleve[], eleves: Eleve[], anneeScolaireId?: string): Promise<EvolutionData[]> {
    const derniersMois = ['Il y a 3 mois', 'Il y a 2 mois', 'Le mois dernier', 'Ce mois'];
    const evolution: EvolutionData[] = [];

    for (let i = 0; i < 4; i++) {
      const dateDebut = new Date();
      dateDebut.setMonth(dateDebut.getMonth() - (3 - i));
      dateDebut.setDate(1);
      
      const dateFin = new Date(dateDebut);
      dateFin.setMonth(dateFin.getMonth() + 1);
      dateFin.setDate(0);

      const absencesPeriode = absences.filter(a => {
        const date = new Date(a.date);
        return date >= dateDebut && date <= dateFin;
      });

      const joursOuvrables = 20;
      const totalDemiJournees = eleves.length * joursOuvrables * 2; // Multiplier par 2 pour les demi-journées
      const presents = totalDemiJournees - absencesPeriode.length;
      const tauxAbsenteisme = totalDemiJournees > 0 ? (absencesPeriode.length / totalDemiJournees) * 100 : 0;

      evolution.push({
        periode: derniersMois[i],
        absences: absencesPeriode.length,
        presents,
        tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100
      });
    }

    return evolution;
  }

  private async calculateDayOfWeekStats(absences: AbsenceEleve[], eleves: Eleve[], anneeScolaireId?: string): Promise<DayOfWeekStats[]> {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const stats: DayOfWeekStats[] = [];

    console.log('📅 === CALCUL STATS PAR JOUR DE SEMAINE ===');
    console.log('📊 Données d\'entrée:');
    console.log('  - Nombre d\'élèves:', eleves.length);
    console.log('  - Nombre total d\'absences:', absences.length);
    console.log('  - Année scolaire ID:', anneeScolaireId);

    // Récupérer l'année scolaire pour avoir les vraies dates
    const anneeScolaire = await anneeScolaireService.getAnneeScolaireActive();
    if (!anneeScolaire) {
      console.log('❌ Pas d\'année scolaire active trouvée');
      return stats;
    }

    console.log('🗓️ Année scolaire active:', anneeScolaire.nom);
    console.log('📅 Période:', anneeScolaire.dateDebut, 'au', anneeScolaire.dateFin);

    // Calculer le nombre réel de chaque jour de la semaine dans l'année
    const joursParType: { [key: number]: number } = {};
    const dateDebut = new Date(anneeScolaire.dateDebut);
    const dateFin = new Date(anneeScolaire.dateFin);
    
    console.log('🔢 Comptage des jours de cours par type:');
    
    // Compter les jours de cours par type
    for (let d = new Date(dateDebut); d <= dateFin; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      // Seulement les jours de semaine (lundi=1 à vendredi=5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Vérifier si c'est un jour de cours
        if (anneeScolaireService.estJourDeCours(new Date(d), anneeScolaire)) {
          joursParType[dayOfWeek] = (joursParType[dayOfWeek] || 0) + 1;
        }
      }
    }

    Object.keys(joursParType).forEach(dayNum => {
      console.log(`  - ${jours[parseInt(dayNum)]}: ${joursParType[parseInt(dayNum)]} jours de cours`);
    });

    // Calculer les stats pour chaque jour
    for (let dayNum = 1; dayNum <= 5; dayNum++) { // Lundi à Vendredi
      const absencesJour = absences.filter(a => {
        const date = new Date(a.date);
        return date.getDay() === dayNum;
      });

      const nombreJoursDeCeType = joursParType[dayNum] || 0;
      const totalDemiJourneesPossible = eleves.length * nombreJoursDeCeType * 2; // Multiplier par 2 pour les demi-journées
      const presents = totalDemiJourneesPossible - absencesJour.length;
      const tauxAbsenteisme = totalDemiJourneesPossible > 0 ? (absencesJour.length / totalDemiJourneesPossible) * 100 : 0;

      console.log(`📊 ${jours[dayNum]}:`);
      console.log(`  - Absences (demi-journées) ce jour: ${absencesJour.length}`);
      console.log(`  - Jours de ce type dans l'année: ${nombreJoursDeCeType}`);
      console.log(`  - Total demi-journées possible (${eleves.length} élèves × ${nombreJoursDeCeType} jours × 2): ${totalDemiJourneesPossible}`);
      console.log(`  - Présents: ${presents}`);
      console.log(`  - Taux d'absentéisme: ${tauxAbsenteisme}%`);

      stats.push({
        jour: jours[dayNum],
        jourNum: dayNum,
        absences: absencesJour.length,
        presents,
        tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100
      });
    }

    console.log('📅 === FIN CALCUL STATS PAR JOUR DE SEMAINE ===');
    return stats;
  }

  private async calculatePeakAbsences(absences: AbsenceEleve[], eleves: Eleve[]): Promise<PeakAbsence[]> {
    console.log('🚨 === CALCUL PICS D\'ABSENCES ===');
    console.log('📊 Données:');
    console.log('  - Total élèves:', eleves.length);
    console.log('  - Total absences:', absences.length);
    
    // Grouper les absences par date
    const absencesParDate: { [date: string]: number } = {};
    
    absences.forEach(absence => {
      absencesParDate[absence.date] = (absencesParDate[absence.date] || 0) + 1;
    });

    console.log('📅 Absences par date:', absencesParDate);

    // Trouver les pics (plus de 20% de demi-journées d'absence sur une journée)
    const totalDemiJourneesParJour = eleves.length * 2; // 2 demi-journées par jour
    const seuil = Math.max(1, Math.floor(totalDemiJourneesParJour * 0.2));
    console.log('🎯 Seuil pour pic (20% des demi-journées):', seuil);

    const pics: PeakAbsence[] = Object.entries(absencesParDate)
      .filter(([date, count]) => count >= seuil)
      .map(([date, count]) => {
        const tauxAbsenteisme = totalDemiJourneesParJour > 0 ? (count / totalDemiJourneesParJour) * 100 : 0;
        console.log(`📊 ${date}: ${count} demi-journées d'absence / ${totalDemiJourneesParJour} demi-journées possibles = ${tauxAbsenteisme}%`);

        return {
          date,
          absences: count,
          tauxAbsenteisme: Math.round(tauxAbsenteisme * 100) / 100,
          commentaire: count > totalDemiJourneesParJour * 0.5 ? 'Pic majeur - Événement inhabituel' : 'Absence groupée'
        };
      })
      .sort((a, b) => b.absences - a.absences)
      .slice(0, 10); // Top 10 des pics

    console.log('🚨 Pics détectés:', pics.length);
    console.log('🚨 === FIN CALCUL PICS D\'ABSENCES ===');
    return pics;
  }

  private async generateAlerts(elevesWithStats: EleveWithStats[], absences: AbsenceEleve[]): Promise<AlerteEleve[]> {
    const alertes: AlerteEleve[] = [];
    const dateActuelle = new Date();
    const deuxSemainesAvant = new Date(dateActuelle.getTime() - 14 * 24 * 60 * 60 * 1000);

    for (const eleveStats of elevesWithStats) {
      const absencesRecentes = absences.filter(a => 
        a.eleve_id === eleveStats.eleve.id && 
        new Date(a.date) >= deuxSemainesAvant
      ).length;

      let alerte: AlerteEleve | null = null;

      // Seuils adaptés aux demi-journées (doublés par rapport aux anciens seuils par jour)
      if (absencesRecentes >= 10) { // >= 10 demi-journées = 5 jours complets
        alerte = {
          eleve: eleveStats.eleve,
          raison: `${absencesRecentes} demi-journées d'absence dans les 2 dernières semaines`,
          niveau: 'danger',
          absencesRecentes,
          classeName: eleveStats.classeName
        };
      } else if (eleveStats.tauxAbsenteisme > 20) {
        alerte = {
          eleve: eleveStats.eleve,
          raison: `Taux d'absentéisme élevé (${eleveStats.tauxAbsenteisme}%)`,
          niveau: 'warning',
          absencesRecentes,
          classeName: eleveStats.classeName
        };
      } else if (absencesRecentes >= 6) { // >= 6 demi-journées = 3 jours complets
        alerte = {
          eleve: eleveStats.eleve,
          raison: `${absencesRecentes} demi-journées d'absence récentes`,
          niveau: 'warning',
          absencesRecentes,
          classeName: eleveStats.classeName
        };
      }

      if (alerte) {
        alertes.push(alerte);
      }
    }

    return alertes.sort((a, b) => b.absencesRecentes - a.absencesRecentes);
  }
}

// Instance singleton du service
export const statisticsService = new StatisticsService();