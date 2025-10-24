import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { AnneeScolaire } from '../types/anneeScolaire';
import { Classe, Eleve } from '../types';
import { anneeScolaireService } from './anneeScolaire';
import { getActiveClassesByAnneeScolaire, getActiveElevesByAnneeScolaire } from './softDelete';

// Types pour la transition
export interface TransitionPreview {
  classesADupliquer: Classe[];
  elevesProgression: EleveProgression[];
  nouveauNiveau: string;
  nouvelleAnnee: string;
}

export interface EleveProgression {
  eleve: Eleve;
  classeActuelle: Classe;
  niveauActuel: string;
  niveauSuivant: string | null; // null = élève sortant (CM2)
  classeSuivante: string | null; // null = élève sortant ou pas de classe correspondante
  statut: 'progression' | 'sortant' | 'redoublant' | 'nouveau';
}

export interface ClasseDupliquee {
  classeOrigine: Classe;
  nouveauNom: string;
  nouveauNiveau: string;
  effectifPrevu: number;
}

export interface TransitionResult {
  classesCrees: string[]; // IDs des nouvelles classes
  elevesTransferes: number;
  elevesNonTransferes: EleveProgression[]; // Cas particuliers à traiter manuellement
}

export class TransitionAnneeService {
  
  // Mapping des niveaux pour la progression
  private niveauxProgression: { [key: string]: string | null } = {
    'PS': 'MS',      // Petite Section → Moyenne Section
    'MS': 'GS',      // Moyenne Section → Grande Section  
    'GS': 'CP',      // Grande Section → CP
    'CP': 'CE1',     // CP → CE1
    'CE1': 'CE2',    // CE1 → CE2
    'CE2': 'CM1',    // CE2 → CM1
    'CM1': 'CM2',    // CM1 → CM2
    'CM2': null      // CM2 → Sortant (collège)
  };

  /**
   * Analyser une année scolaire pour préparer la transition
   */
  async analyserTransition(anneeScolaireSourceId: string, nouvelleAnneeNom: string): Promise<TransitionPreview> {
    try {
      // Récupérer les classes de l'année source
      const classesActuelles = await getActiveClassesByAnneeScolaire(anneeScolaireSourceId);
      
      // Récupérer tous les élèves de l'année source
      const elevesActuels = await getActiveElevesByAnneeScolaire(anneeScolaireSourceId);
      
      // Analyser la progression de chaque élève
      const elevesProgression: EleveProgression[] = [];
      
      for (const eleve of elevesActuels) {
        const classeActuelle = classesActuelles.find(c => c.id === eleve.classe_id);
        if (!classeActuelle) continue;
        
        const niveauActuel = classeActuelle.niveau || '';
        const niveauSuivant = this.niveauxProgression[niveauActuel] || null;
        
        // Déterminer la classe suivante (même nom mais niveau suivant)
        let classeSuivante: string | null = null;
        if (niveauSuivant) {
          // Chercher une classe avec le même nom de base mais le niveau suivant
          const nomBase = this.extraireNomBase(classeActuelle.nom);
          classeSuivante = `${nomBase}`; // On gardera le même nom de classe
        }
        
        const statut: EleveProgression['statut'] = 
          niveauSuivant === null ? 'sortant' : 'progression';
        
        elevesProgression.push({
          eleve,
          classeActuelle,
          niveauActuel,
          niveauSuivant,
          classeSuivante,
          statut
        });
      }
      
      return {
        classesADupliquer: classesActuelles,
        elevesProgression,
        nouveauNiveau: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
        nouvelleAnnee: nouvelleAnneeNom
      };
    } catch (error) {
      console.error('Erreur lors de l\'analyse de transition:', error);
      throw error;
    }
  }

  /**
   * Prévisualiser les classes qui seront créées
   */
  previsualiserClasses(classesSource: Classe[], elevesProgression: EleveProgression[]): ClasseDupliquee[] {
    const classesACreer: ClasseDupliquee[] = [];
    
    // Grouper les niveaux cibles
    const niveauxCibles = new Set<string>();
    elevesProgression.forEach(ep => {
      if (ep.niveauSuivant) {
        niveauxCibles.add(ep.niveauSuivant);
      }
    });
    
    // Pour chaque niveau cible, créer les classes nécessaires
    niveauxCibles.forEach(niveau => {
      // Trouver les classes source qui correspondent à ce niveau
      const classesCorrespondantes = classesSource.filter(c => {
        const niveauActuel = c.niveau || '';
        return this.niveauxProgression[niveauActuel] === niveau;
      });
      
      classesCorrespondantes.forEach(classeSource => {
        const elevesVersClasse = elevesProgression.filter(ep => 
          ep.classeActuelle.id === classeSource.id && ep.niveauSuivant === niveau
        );
        
        if (elevesVersClasse.length > 0) {
          classesACreer.push({
            classeOrigine: classeSource,
            nouveauNom: this.genererNouveauNomClasse(classeSource.nom, classeSource.niveau || '', niveau),
            nouveauNiveau: niveau,
            effectifPrevu: elevesVersClasse.length
          });
        }
      });
    });
    
    return classesACreer;
  }

  /**
   * Exécuter la transition complète
   */
  async executerTransition(
    nouvelleAnneeScolaireId: string,
    classesDupliquees: ClasseDupliquee[],
    elevesProgression: EleveProgression[],
    ajustements: { [eleveId: string]: { statut: 'redoublant' | 'progression' | 'exclus', classeId?: string } } = {}
  ): Promise<TransitionResult> {
    try {
      const batch = writeBatch(db);
      const classesCrees: string[] = [];
      const elevesNonTransferes: EleveProgression[] = [];
      
      // Étape 1: Créer les nouvelles classes
      const mapClassesAnciennesVersNouvelles: { [ancienId: string]: string } = {};
      
      for (const classeDup of classesDupliquees) {
        const nouvelleClasseData = {
          nom: classeDup.nouveauNom,
          niveau: classeDup.nouveauNiveau,
          annee_scolaire_id: nouvelleAnneeScolaireId,
          enseignant_id: '', // Pas d'enseignant assigné - à faire manuellement
          active: true,
          created_at: new Date().toISOString()
        };
        
        // Créer la classe
        const nouvelleClasseRef = doc(collection(db, 'classes'));
        batch.set(nouvelleClasseRef, nouvelleClasseData);
        
        classesCrees.push(nouvelleClasseRef.id);
        mapClassesAnciennesVersNouvelles[classeDup.classeOrigine.id] = nouvelleClasseRef.id;
      }
      
      // Valider la création des classes d'abord
      await batch.commit();
      
      // Étape 2: Transférer les élèves
      const batchEleves = writeBatch(db);
      let elevesTransferes = 0;
      
      for (const eleveProgression of elevesProgression) {
        const ajustement = ajustements[eleveProgression.eleve.id];
        
        // Traiter les ajustements manuels
        if (ajustement) {
          if (ajustement.statut === 'exclus') {
            continue; // Ne pas transférer cet élève
          }
          
          if (ajustement.statut === 'redoublant') {
            // Chercher une classe du même niveau dans la nouvelle année
            const classeMemeNiveau = classesCrees.find(newClasseId => {
              const classeDup = classesDupliquees.find(cd => 
                mapClassesAnciennesVersNouvelles[cd.classeOrigine.id] === newClasseId
              );
              return classeDup?.nouveauNiveau === eleveProgression.niveauActuel;
            });
            
            if (classeMemeNiveau) {
              const eleveRef = doc(db, 'eleves', eleveProgression.eleve.id);
              batchEleves.update(eleveRef, {
                classe_id: classeMemeNiveau,
                annee_scolaire_id: nouvelleAnneeScolaireId
              });
              elevesTransferes++;
              continue;
            }
          }
          
          if (ajustement.statut === 'progression' && ajustement.classeId) {
            const eleveRef = doc(db, 'eleves', eleveProgression.eleve.id);
            batchEleves.update(eleveRef, {
              classe_id: ajustement.classeId,
              annee_scolaire_id: nouvelleAnneeScolaireId
            });
            elevesTransferes++;
            continue;
          }
        }
        
        // Progression normale
        if (eleveProgression.statut === 'progression' && eleveProgression.niveauSuivant) {
          const nouvelleClasseId = mapClassesAnciennesVersNouvelles[eleveProgression.classeActuelle.id];
          
          if (nouvelleClasseId) {
            const eleveRef = doc(db, 'eleves', eleveProgression.eleve.id);
            batchEleves.update(eleveRef, {
              classe_id: nouvelleClasseId,
              annee_scolaire_id: nouvelleAnneeScolaireId
            });
            elevesTransferes++;
          } else {
            elevesNonTransferes.push(eleveProgression);
          }
        } else if (eleveProgression.statut === 'sortant') {
          // Les élèves sortants (CM2) ne sont pas transférés
          elevesNonTransferes.push(eleveProgression);
        }
      }
      
      // Valider les transferts d'élèves
      if (elevesTransferes > 0) {
        await batchEleves.commit();
      }
      
      return {
        classesCrees,
        elevesTransferes,
        elevesNonTransferes
      };
    } catch (error) {
      console.error('Erreur lors de l\'exécution de la transition:', error);
      throw error;
    }
  }

  /**
   * Générer le nouveau nom de classe en adaptant le niveau
   */
  private genererNouveauNomClasse(nomActuel: string, niveauActuel: string, nouveauNiveau: string): string {
    // Si le nom contient déjà le niveau actuel, le remplacer
    if (niveauActuel && nomActuel.includes(niveauActuel)) {
      return nomActuel.replace(new RegExp(niveauActuel, 'gi'), nouveauNiveau);
    }
    
    // Si le nom commence par le niveau actuel (ex: "CE1-A" -> "CE2-A")
    if (niveauActuel && nomActuel.toLowerCase().startsWith(niveauActuel.toLowerCase())) {
      return nomActuel.replace(new RegExp(`^${niveauActuel}`, 'i'), nouveauNiveau);
    }
    
    // Sinon, garder le nom original
    return nomActuel;
  }

  /**
   * Extraire le nom de base d'une classe (sans suffixes)
   */
  private extraireNomBase(nomClasse: string): string {
    // Enlever les suffixes comme -A, -B, etc.
    return nomClasse.replace(/-[A-Z]$/, '').trim();
  }

  /**
   * Obtenir le niveau suivant pour un niveau donné
   */
  getNiveauSuivant(niveauActuel: string): string | null {
    return this.niveauxProgression[niveauActuel] || null;
  }

  /**
   * Vérifier si un niveau est un niveau sortant
   */
  estNiveauSortant(niveau: string): boolean {
    return this.niveauxProgression[niveau] === null;
  }

  /**
   * Vérifie si une année peut être verrouillée
   */
  static async peutVerrouillerAnnee(anneeScolaire: AnneeScolaire): Promise<{
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
  }> {
    const raisons: string[] = [];
    const maintenant = new Date();
    const dateFin = new Date(anneeScolaire.dateFin);
    
    // Vérifier si l'année est déjà verrouillée
    const anneeVerrouillee = !!anneeScolaire.verrouillee;
    if (anneeVerrouillee) {
      raisons.push(`✅ Année déjà verrouillée (${anneeScolaire.date_verrouillage ? new Date(anneeScolaire.date_verrouillage).toLocaleDateString('fr-FR') : 'date inconnue'})`);
    }
    
    // Vérifier si l'année est terminée
    const anneeTerminee = maintenant >= dateFin;
    if (!anneeTerminee) {
      const joursRestants = Math.ceil((dateFin.getTime() - maintenant.getTime()) / (1000 * 60 * 60 * 24));
      raisons.push(`❌ Année pas encore terminée (se termine le ${dateFin.toLocaleDateString('fr-FR')}, dans ${joursRestants} jour(s))`);
    }
    
    // Vérifier s'il y a des données importantes
    let nombreClasses = 0;
    let nombreEleves = 0;
    let nombreAbsences = 0;
    
    try {
      const [classes, eleves, absences] = await Promise.all([
        getDocs(query(
          collection(db, 'classes'),
          where('annee_scolaire_id', '==', anneeScolaire.id),
          where('active', '!=', false)
        )),
        getDocs(query(
          collection(db, 'eleves'),
          where('annee_scolaire_id', '==', anneeScolaire.id),
          where('active', '!=', false)
        )),
        getDocs(query(
          collection(db, 'absences_eleves'),
          where('annee_scolaire_id', '==', anneeScolaire.id)
        ))
      ]);
      
      nombreClasses = classes.size;
      nombreEleves = eleves.size;
      nombreAbsences = absences.size;
      
      if (nombreClasses === 0) {
        raisons.push('❌ Aucune classe active trouvée pour cette année');
      } else {
        raisons.push(`✅ ${nombreClasses} classe(s) trouvée(s)`);
      }
      
      if (nombreEleves === 0) {
        raisons.push('❌ Aucun élève actif trouvé pour cette année');
      } else {
        raisons.push(`✅ ${nombreEleves} élève(s) trouvé(s)`);
      }
      
      raisons.push(`📊 ${nombreAbsences} absence(s) trouvée(s)`);

    } catch (error) {
      console.error('Erreur lors de la vérification des données:', error);
      raisons.push('❌ Erreur technique lors de la vérification des données');
      raisons.push(`Détail: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
    
    const details = {
      anneeVerrouillee,
      anneeTerminee,
      nombreClasses,
      nombreEleves,
      nombreAbsences,
      dateFin: dateFin.toLocaleDateString('fr-FR'),
      dateActuelle: maintenant.toLocaleDateString('fr-FR')
    };
    
    // La transition est possible si l'année n'est pas verrouillée, est terminée, et a des données
    const peutVerrouiller = !anneeVerrouillee && anneeTerminee && nombreClasses > 0 && nombreEleves > 0;
    
    return {
      peutVerrouiller,
      raisons,
      details
    };
  }

  /**
   * Effectue la transition complète vers une nouvelle année scolaire avec génération de rapport
   */
  static async effectuerTransition(
    anneePrecedente: AnneeScolaire,
    nouvelleAnnee: Omit<AnneeScolaire, 'id' | 'created_at' | 'created_by'>,
    utilisateurId: string
  ): Promise<{
    rapportGenere: boolean;
    anneePrecedenteVerrouillee: boolean;
    nouvelleAnneeCreee: boolean;
    elevesTransferes: number;
    classesTransferees: number;
    absencesSupprimees: number;
    erreurs: string[];
  }> {
    // Import the RapportFinAnneeService dynamically to avoid circular dependency
    const { RapportFinAnneeService } = await import('./rapportFinAnnee');
    
    const result: {
      rapportGenere: boolean;
      anneePrecedenteVerrouillee: boolean;
      nouvelleAnneeCreee: boolean;
      elevesTransferes: number;
      classesTransferees: number;
      absencesSupprimees: number;
      erreurs: string[];
    } = {
      rapportGenere: false,
      anneePrecedenteVerrouillee: false,
      nouvelleAnneeCreee: false,
      elevesTransferes: 0,
      classesTransferees: 0,
      absencesSupprimees: 0,
      erreurs: []
    };

    try {
      // 1. Générer le rapport de fin d'année
      const rapport = await RapportFinAnneeService.genererRapportFinAnnee(anneePrecedente);

      // Télécharger automatiquement le fichier Excel
      const nomExcel = RapportFinAnneeService.genererNomFichier(anneePrecedente, 'xlsx');
      RapportFinAnneeService.telechargerFichier(rapport.rapportExcel, nomExcel);

      result.rapportGenere = true;

      // 2. Verrouiller l'année précédente
      await this.verrouillerAnneePrecedente(anneePrecedente, utilisateurId);
      result.anneePrecedenteVerrouillee = true;

      // 3. Créer la nouvelle année scolaire
      const nouvelleAnneeDoc = await this.creerNouvelleAnnee(nouvelleAnnee, utilisateurId);
      result.nouvelleAnneeCreee = true;

      // 4. Transférer les classes
      const classesTransferees = await this.transfererClasses(anneePrecedente.id, nouvelleAnneeDoc.id);
      result.classesTransferees = classesTransferees;

      // 5. Transférer les élèves
      const elevesTransferes = await this.transfererEleves(anneePrecedente.id, nouvelleAnneeDoc.id);
      result.elevesTransferes = elevesTransferes;

      // 6. Supprimer les absences de l'année précédente
      const absencesSupprimees = await this.supprimerAbsencesAnneePrecedente(anneePrecedente.id);
      result.absencesSupprimees = absencesSupprimees;

      // 7. Supprimer l'ancienne année scolaire
      await this.supprimerAnneePrecedente(anneePrecedente.id);

      return result;

    } catch (error) {
      console.error('Erreur lors de la transition:', error);
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      result.erreurs.push(message);
      return result;
    }
  }

  /**
   * Verrouille l'année précédente pour empêcher les modifications
   */
  private static async verrouillerAnneePrecedente(
    anneePrecedente: AnneeScolaire, 
    utilisateurId: string
  ): Promise<void> {
    const anneeRef = doc(db, 'annees_scolaires', anneePrecedente.id);
    await updateDoc(anneeRef, {
      verrouillee: true,
      date_verrouillage: Timestamp.now().toDate().toISOString(),
      verrouille_par: utilisateurId,
      active: false
    });
  }

  /**
   * Crée une nouvelle année scolaire
   */
  private static async creerNouvelleAnnee(
    nouvelleAnnee: Omit<AnneeScolaire, 'id' | 'created_at' | 'created_by'>,
    utilisateurId: string
  ): Promise<{ id: string }> {
    // Désactiver toutes les autres années
    const anneesQuery = query(
      collection(db, 'annees_scolaires'),
      where('active', '==', true)
    );
    const anneesSnapshot = await getDocs(anneesQuery);
    
    const batch = writeBatch(db);
    anneesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { active: false });
    });
    await batch.commit();

    // Créer la nouvelle année
    const nouvelleAnneeData = {
      ...nouvelleAnnee,
      created_at: Timestamp.now().toDate().toISOString(),
      created_by: utilisateurId,
      active: true,
      verrouillee: false
    };

    const docRef = await addDoc(collection(db, 'annees_scolaires'), nouvelleAnneeData);
    return { id: docRef.id };
  }

  /**
   * Met à jour les classes avec progression automatique des niveaux
   */
  private static async transfererClasses(
    ancienneAnneeId: string, 
    nouvelleAnneeId: string
  ): Promise<number> {
    const classesQuery = query(
      collection(db, 'classes'),
      where('annee_scolaire_id', '==', ancienneAnneeId),
      where('active', '!=', false)
    );
    const classesSnapshot = await getDocs(classesQuery);
    
    let compteur = 0;
    
    // Mapping des niveaux pour la progression
    const progressionNiveaux: { [key: string]: string } = {
      'CP': 'CE1',
      'CE1': 'CE2', 
      'CE2': 'CM1',
      'CM1': 'CM2'
      // CM2 ne progresse pas (élèves sortants)
    };
    
    const batch = writeBatch(db);
    
    for (const docSnapshot of classesSnapshot.docs) {
      const classeData = docSnapshot.data() as Classe;

      // Supprimer les classes CM2 (élèves sortants)
      if (classeData.niveau === 'CM2') {
        batch.delete(docSnapshot.ref);
        continue;
      }

      // Calculer le nouveau niveau
      const niveauActuel = classeData.niveau || '';
      const nouveauNiveau = progressionNiveaux[niveauActuel] || niveauActuel;

      // Générer le nouveau nom de classe
      const nouveauNom = this.genererNouveauNomClasse(classeData.nom, niveauActuel, nouveauNiveau);

      // Mettre à jour la classe existante
      batch.update(docSnapshot.ref, {
        nom: nouveauNom,
        niveau: nouveauNiveau,
        annee_scolaire_id: nouvelleAnneeId,
        enseignant_id: '', // Reset enseignant - devra être réassigné
        updated_at: Timestamp.now().toDate().toISOString()
      });
      
      compteur++;
    }
    
    await batch.commit();
    return compteur;
  }

  /**
   * Génère le nouveau nom de classe avec progression de niveau
   */
  private static genererNouveauNomClasse(nomActuel: string, niveauActuel: string, nouveauNiveau: string): string {
    // Si le nom contient le niveau actuel, le remplacer par le nouveau niveau
    if (niveauActuel && nomActuel.includes(niveauActuel)) {
      return nomActuel.replace(new RegExp(niveauActuel, 'gi'), nouveauNiveau);
    }
    
    // Si le nom commence par le niveau actuel (ex: "CP-A" → "CE1-A")
    if (niveauActuel && nomActuel.toLowerCase().startsWith(niveauActuel.toLowerCase())) {
      return nomActuel.replace(new RegExp(`^${niveauActuel}`, 'i'), nouveauNiveau);
    }
    
    // Si pas de correspondance claire, préfixer avec le nouveau niveau
    return `${nouveauNiveau}-${nomActuel}`;
  }

  /**
   * Met à jour les élèves avec progression automatique vers nouvelles classes
   */
  private static async transfererEleves(
    ancienneAnneeId: string, 
    nouvelleAnneeId: string
  ): Promise<number> {
    // Récupérer les élèves de l'ancienne année
    const elevesQuery = query(
      collection(db, 'eleves'),
      where('annee_scolaire_id', '==', ancienneAnneeId),
      where('active', '!=', false)
    );
    const elevesSnapshot = await getDocs(elevesQuery);
    
    // Récupérer les classes de la nouvelle année (déjà mises à jour)
    const nouvellesClassesQuery = query(
      collection(db, 'classes'),
      where('annee_scolaire_id', '==', nouvelleAnneeId)
    );
    const nouvellesClassesSnapshot = await getDocs(nouvellesClassesQuery);

    // Créer un mapping des nouvelles classes par niveau
    const nouvellesClassesParNiveau = new Map<string, Array<Classe & { id: string }>>();
    nouvellesClassesSnapshot.docs.forEach(doc => {
      const classe = doc.data() as Classe;
      const niveau = classe.niveau || '';
      if (!nouvellesClassesParNiveau.has(niveau)) {
        nouvellesClassesParNiveau.set(niveau, []);
      }
      nouvellesClassesParNiveau.get(niveau)!.push({
        ...classe,
        id: doc.id
      });
    });

    // Mapping des niveaux pour la progression
    const progressionNiveaux: { [key: string]: string } = {
      'CP': 'CE1',
      'CE1': 'CE2', 
      'CE2': 'CM1',
      'CM1': 'CM2'
      // CM2 ne progresse pas (élèves sortants)
    };
    
    let compteur = 0;
    const batch = writeBatch(db);
    
    for (const docSnapshot of elevesSnapshot.docs) {
      const eleveData = docSnapshot.data() as Eleve;
      
      // Récupérer la classe actuelle de l'élève pour connaître son niveau
      const classeActuelleRef = doc(db, 'classes', eleveData.classe_id);
      const classeActuelleDoc = await getDoc(classeActuelleRef);

      if (!classeActuelleDoc.exists()) {
        continue;
      }

      const ancienneClasse = classeActuelleDoc.data() as Classe;
      const niveauActuel = ancienneClasse.niveau || '';
      const nouveauNiveau = progressionNiveaux[niveauActuel];

      // Supprimer les élèves de CM2 (sortants)
      if (niveauActuel === 'CM2') {
        batch.delete(docSnapshot.ref);
        continue;
      }

      if (!nouveauNiveau) {
        continue;
      }

      // Trouver une classe correspondante dans le nouveau niveau
      const classesDisponibles = nouvellesClassesParNiveau.get(nouveauNiveau) || [];

      if (classesDisponibles.length === 0) {
        continue;
      }

      // Chercher une classe avec un nom similaire, sinon prendre la première
      let nouvelleClasse = classesDisponibles.find((classe: Classe & { id: string }) => {
        const ancienNomBase = this.extraireNomBase(ancienneClasse.nom);
        const nouveauNomBase = this.extraireNomBase(classe.nom);
        return ancienNomBase === nouveauNomBase;
      });

      // Si pas de correspondance par nom, prendre la première classe disponible
      if (!nouvelleClasse) {
        nouvelleClasse = classesDisponibles[0];
      }

      // Mettre à jour l'élève existant
      batch.update(docSnapshot.ref, {
        annee_scolaire_id: nouvelleAnneeId,
        classe_id: nouvelleClasse.id,
        updated_at: Timestamp.now().toDate().toISOString()
      });
      
      compteur++;
    }
    
    await batch.commit();
    return compteur;
  }

  /**
   * Extraire le nom de base d'une classe (sans niveau)
   */
  private static extraireNomBase(nomClasse: string): string {
    // Enlever les niveaux (CP, CE1, CE2, CM1, CM2) et garder le suffixe (A, B, Rouge, Bleu, etc.)
    return nomClasse
      .replace(/^(CP|CE1|CE2|CM1|CM2)[-\s]?/i, '')
      .trim() || 'A'; // Default à 'A' si pas de suffixe
  }


  /**
   * Supprime les absences de l'année précédente
   */
  private static async supprimerAbsencesAnneePrecedente(
    ancienneAnneeId: string
  ): Promise<number> {
    const absencesQuery = query(
      collection(db, 'absences_eleves'),
      where('annee_scolaire_id', '==', ancienneAnneeId)
    );
    const absencesSnapshot = await getDocs(absencesQuery);
    
    const batch = writeBatch(db);
    let compteur = 0;
    
    absencesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      compteur++;
    });
    
    await batch.commit();
    return compteur;
  }

  /**
   * Supprime l'ancienne année scolaire
   */
  private static async supprimerAnneePrecedente(ancienneAnneeId: string): Promise<void> {
    const anneeRef = doc(db, 'annees_scolaires', ancienneAnneeId);
    
    // Supprimer définitivement l'ancienne année
    await deleteDoc(anneeRef);
  }
}

// Instance singleton
export const transitionAnneeService = new TransitionAnneeService();