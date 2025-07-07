import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { AnneeScolaire, PeriodeScolaire, JourSpecial, JoursOuvrables } from '../types/anneeScolaire';

export class AnneeScolaireService {
  
  /**
   * Créer une nouvelle année scolaire
   */
  async createAnneeScolaire(
    nom: string,
    dateDebut: string,
    dateFin: string,
    createdBy: string
  ): Promise<string> {
    try {
      // Désactiver toutes les autres années scolaires
      await this.desactiverToutesLesAnnees();
      
      const anneeScolaire: Omit<AnneeScolaire, 'id'> = {
        nom,
        dateDebut,
        dateFin,
        active: true,
        periodes: [],
        joursSpeciaux: [],
        created_at: new Date().toISOString(),
        created_by: createdBy
      };

      const docRef = await addDoc(collection(db, 'annees_scolaires'), anneeScolaire);
      
      // Créer les périodes par défaut pour la France
      await this.creerPeriodesParDefaut(docRef.id, dateDebut, dateFin);
      
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'année scolaire:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'année scolaire active
   */
  async getAnneeScolaireActive(): Promise<AnneeScolaire | null> {
    try {
      const q = query(
        collection(db, 'annees_scolaires'),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as AnneeScolaire;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'année scolaire active:', error);
      throw error;
    }
  }

  /**
   * Obtenir toutes les années scolaires
   */
  async getToutesLesAnneesScolaires(): Promise<AnneeScolaire[]> {
    try {
      const q = query(
        collection(db, 'annees_scolaires'),
        orderBy('dateDebut', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AnneeScolaire));
    } catch (error) {
      console.error('Erreur lors de la récupération des années scolaires:', error);
      throw error;
    }
  }

  /**
   * Activer une année scolaire spécifique
   */
  async activerAnneeScolaire(anneeScolaireId: string, userId: string): Promise<void> {
    try {
      // Désactiver et verrouiller toutes les autres années
      await this.desactiverEtVerrouillerToutesLesAnnees(userId);
      
      // Activer celle demandée
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { 
        active: true,
        verrouillee: false // S'assurer que l'année active n'est pas verrouillée
      });
    } catch (error) {
      console.error('Erreur lors de l\'activation de l\'année scolaire:', error);
      throw error;
    }
  }

  /**
   * Calculer les jours ouvrables pour une année scolaire
   */
  async calculerJoursOuvrables(anneeScolaireId?: string): Promise<JoursOuvrables> {
    try {
      let anneeScolaire: AnneeScolaire | null;
      
      if (anneeScolaireId) {
        // Récupérer année spécifique (pour les stats historiques)
        const q = query(
          collection(db, 'annees_scolaires'),
          where('__name__', '==', anneeScolaireId)
        );
        const querySnapshot = await getDocs(q);
        anneeScolaire = querySnapshot.empty ? null : 
          { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as AnneeScolaire;
      } else {
        // Récupérer année active
        anneeScolaire = await this.getAnneeScolaireActive();
      }

      if (!anneeScolaire) {
        throw new Error('Aucune année scolaire trouvée');
      }

      // Gestion des deux formats de noms de champs (legacy et nouveau)
      const dateDebutStr = (anneeScolaire as any).dateDebut || (anneeScolaire as any).date_debut;
      const dateFinStr = (anneeScolaire as any).dateFin || (anneeScolaire as any).date_fin;
      
      const dateDebut = new Date(dateDebutStr);
      const dateFin = new Date(dateFinStr);
      const dateActuelle = new Date();

      let totalJours = 0;
      let joursEcoules = 0;
      let periodesVacances = 0;
      let joursFeries = 0;

      // Parcourir chaque jour de l'année scolaire
      const currentDate = new Date(dateDebut);
      while (currentDate <= dateFin) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Vérifier si c'est un jour de cours
        if (this.estJourDeCours(currentDate, anneeScolaire)) {
          totalJours++;
          
          if (currentDate <= dateActuelle) {
            joursEcoules++;
          }
        } else {
          // Compter les types de jours non ouvrables
          if (this.estJourDeVacances(currentDate, anneeScolaire)) {
            periodesVacances++;
          }
          if (this.estJourFerie(currentDate, anneeScolaire)) {
            joursFeries++;
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        anneeScolaireId: anneeScolaire.id,
        totalJours,
        joursEcoules: Math.min(joursEcoules, totalJours),
        joursRestants: Math.max(0, totalJours - joursEcoules),
        periodesVacances,
        joursFeries
      };
    } catch (error) {
      console.error('Erreur lors du calcul des jours ouvrables:', error);
      throw error;
    }
  }

  /**
   * Vérifier si un jour donné est un jour de cours
   */
  estJourDeCours(date: Date, anneeScolaire: AnneeScolaire): boolean {
    const dayOfWeek = date.getDay();
    
    // Exclure samedi (6) et dimanche (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Vérifier si c'est dans une période de vacances
    if (this.estJourDeVacances(date, anneeScolaire)) {
      return false;
    }

    // Vérifier si c'est un jour férié
    if (this.estJourFerie(date, anneeScolaire)) {
      return false;
    }

    return true;
  }

  /**
   * Vérifier si un jour est en vacances
   */
  private estJourDeVacances(date: Date, anneeScolaire: AnneeScolaire): boolean {
    const dateStr = date.toISOString().split('T')[0];
    
    // Vérifier que les périodes existent et sont un tableau
    if (!anneeScolaire.periodes || !Array.isArray(anneeScolaire.periodes)) {
      return false;
    }
    
    return anneeScolaire.periodes.some(periode => 
      periode.type === 'vacances' && 
      dateStr >= periode.dateDebut && 
      dateStr <= periode.dateFin
    );
  }

  /**
   * Vérifier si un jour est férié
   */
  private estJourFerie(date: Date, anneeScolaire: AnneeScolaire): boolean {
    const dateStr = date.toISOString().split('T')[0];
    
    // Vérifier que les jours spéciaux existent et sont un tableau
    if (!anneeScolaire.joursSpeciaux || !Array.isArray(anneeScolaire.joursSpeciaux)) {
      return false;
    }
    
    return anneeScolaire.joursSpeciaux.some(jour => jour.date === dateStr);
  }

  /**
   * Désactiver toutes les années scolaires
   */
  private async desactiverToutesLesAnnees(): Promise<void> {
    const querySnapshot = await getDocs(collection(db, 'annees_scolaires'));
    const updates = querySnapshot.docs.map(docSnap => 
      updateDoc(doc(db, 'annees_scolaires', docSnap.id), { active: false })
    );
    await Promise.all(updates);
  }

  /**
   * Désactiver et verrouiller toutes les années scolaires
   */
  private async desactiverEtVerrouillerToutesLesAnnees(userId: string): Promise<void> {
    const querySnapshot = await getDocs(collection(db, 'annees_scolaires'));
    const dateVerrouillage = new Date().toISOString();
    
    const updates = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Verrouiller seulement si l'année était active
      if (data.active) {
        return updateDoc(doc(db, 'annees_scolaires', docSnap.id), { 
          active: false,
          verrouillee: true,
          date_verrouillage: dateVerrouillage,
          verrouille_par: userId
        });
      } else {
        return updateDoc(doc(db, 'annees_scolaires', docSnap.id), { 
          active: false 
        });
      }
    });
    
    await Promise.all(updates);
  }

  /**
   * Créer les périodes par défaut pour une année scolaire française
   */
  private async creerPeriodesParDefaut(anneeScolaireId: string, dateDebut: string, dateFin: string): Promise<void> {
    // Ne pas créer de périodes par défaut - laisser vide
    // L'utilisateur ajoutera manuellement les vacances
    const periodes: PeriodeScolaire[] = [];
    const joursSpeciaux: JourSpecial[] = [];

    // Mettre à jour l'année scolaire avec des tableaux vides
    const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
    await updateDoc(docRef, {
      periodes,
      joursSpeciaux
    });
  }

  /**
   * Ajouter une période de vacances
   */
  async ajouterPeriodeVacances(
    anneeScolaireId: string,
    nom: string,
    dateDebut: string,
    dateFin: string
  ): Promise<void> {
    try {
      const anneeScolaire = await this.getAnneeScolaireById(anneeScolaireId);
      if (!anneeScolaire) throw new Error('Année scolaire non trouvée');

      const nouvellePeriode: PeriodeScolaire = {
        id: `vacances-${Date.now()}`,
        nom,
        dateDebut,
        dateFin,
        type: 'vacances'
      };

      const nouvesPeriodes = [...anneeScolaire.periodes, nouvellePeriode];
      
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { periodes: nouvesPeriodes });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la période de vacances:', error);
      throw error;
    }
  }

  /**
   * Ajouter un jour férié
   */
  async ajouterJourFerie(
    anneeScolaireId: string,
    date: string,
    nom: string,
    type: 'ferie' | 'pont' | 'fermeture' = 'ferie'
  ): Promise<void> {
    try {
      const anneeScolaire = await this.getAnneeScolaireById(anneeScolaireId);
      if (!anneeScolaire) throw new Error('Année scolaire non trouvée');

      const nouveauJour: JourSpecial = {
        id: `jour-${Date.now()}`,
        date,
        nom,
        type
      };

      const nouveauxJours = [...anneeScolaire.joursSpeciaux, nouveauJour];
      
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { joursSpeciaux: nouveauxJours });
    } catch (error) {
      console.error('Erreur lors de l\'ajout du jour férié:', error);
      throw error;
    }
  }

  /**
   * Supprimer une période de vacances
   */
  async supprimerPeriodeVacances(anneeScolaireId: string, index: number): Promise<void> {
    try {
      const anneeScolaire = await this.getAnneeScolaireById(anneeScolaireId);
      if (!anneeScolaire) throw new Error('Année scolaire non trouvée');

      if (index < 0 || index >= anneeScolaire.periodes.length) {
        throw new Error('Index de période invalide');
      }

      const periodeASupprimer = anneeScolaire.periodes[index];
      
      // Empêcher la suppression des périodes de cours (période scolaire principale)
      if (periodeASupprimer.type === 'cours') {
        throw new Error('Impossible de supprimer la période scolaire principale');
      }

      const nouvesPeriodes = [...anneeScolaire.periodes];
      nouvesPeriodes.splice(index, 1);
      
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { periodes: nouvesPeriodes });
    } catch (error) {
      console.error('Erreur lors de la suppression de la période:', error);
      throw error;
    }
  }

  /**
   * Supprimer un jour férié
   */
  async supprimerJourFerie(anneeScolaireId: string, index: number): Promise<void> {
    try {
      const anneeScolaire = await this.getAnneeScolaireById(anneeScolaireId);
      if (!anneeScolaire) throw new Error('Année scolaire non trouvée');

      if (index < 0 || index >= anneeScolaire.joursSpeciaux.length) {
        throw new Error('Index de jour férié invalide');
      }

      const nouveauxJours = [...anneeScolaire.joursSpeciaux];
      nouveauxJours.splice(index, 1);
      
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { joursSpeciaux: nouveauxJours });
    } catch (error) {
      console.error('Erreur lors de la suppression du jour férié:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les périodes incorrectes (fonction temporaire)
   */
  async nettoyerPeriodesIncorrectes(anneeScolaireId: string): Promise<void> {
    try {
      const anneeScolaire = await this.getAnneeScolaireById(anneeScolaireId);
      if (!anneeScolaire) throw new Error('Année scolaire non trouvée');

      // Filtrer pour ne garder que les vraies périodes de vacances
      const periodesValides = anneeScolaire.periodes.filter(periode => 
        periode.type === 'vacances' && 
        periode.nom !== 'Période scolaire'
      );

      // Nettoyer aussi les jours fériés avec des dates incorrectes (années précédentes)
      const currentYear = new Date().getFullYear();
      const joursValides = anneeScolaire.joursSpeciaux.filter(jour => {
        const anneeJour = new Date(jour.date).getFullYear();
        // Garder seulement les jours de l'année scolaire actuelle ou suivante
        return anneeJour >= currentYear && anneeJour <= currentYear + 1;
      });

      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { 
        periodes: periodesValides,
        joursSpeciaux: joursValides
      });
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      throw error;
    }
  }

  /**
   * Verrouiller manuellement une année scolaire
   */
  async verrouillerAnneeScolaire(anneeScolaireId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { 
        verrouillee: true,
        date_verrouillage: new Date().toISOString(),
        verrouille_par: userId
      });
    } catch (error) {
      console.error('Erreur lors du verrouillage:', error);
      throw error;
    }
  }

  /**
   * Déverrouiller une année scolaire (admin uniquement)
   */
  async deverrouillerAnneeScolaire(anneeScolaireId: string): Promise<void> {
    try {
      const docRef = doc(db, 'annees_scolaires', anneeScolaireId);
      await updateDoc(docRef, { 
        verrouillee: false,
        date_verrouillage: null,
        verrouille_par: null
      });
    } catch (error) {
      console.error('Erreur lors du déverrouillage:', error);
      throw error;
    }
  }

  /**
   * Vérifier si une année scolaire est verrouillée
   */
  async estAnneeScolaireVerrouillee(anneeScolaireId: string): Promise<boolean> {
    const anneeScolaire = await this.getAnneeScolaireById(anneeScolaireId);
    return anneeScolaire?.verrouillee || false;
  }

  /**
   * Récupérer une année scolaire par ID
   */
  private async getAnneeScolaireById(id: string): Promise<AnneeScolaire | null> {
    try {
      const q = query(
        collection(db, 'annees_scolaires'),
        where('__name__', '==', id)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return null;
      
      const docData = querySnapshot.docs[0];
      return { id: docData.id, ...docData.data() } as AnneeScolaire;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'année scolaire:', error);
      return null;
    }
  }
}

// Instance singleton
export const anneeScolaireService = new AnneeScolaireService();