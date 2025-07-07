import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Eleve, Classe } from '../types';
import { anneeScolaireService } from './anneeScolaire';

/**
 * Service de migration pour ajouter annee_scolaire_id aux élèves existants
 */
export class MigrationElevesService {

  /**
   * Migrer tous les élèves sans annee_scolaire_id
   */
  async migrerElevesVersAnneeScolaire(): Promise<{ success: boolean; elevesMigres: number; message: string }> {
    try {
      console.log('🔄 Début de la migration des élèves...');
      
      // Récupérer tous les élèves
      const elevesSnapshot = await getDocs(collection(db, 'eleves'));
      const eleves = elevesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
      
      // Récupérer toutes les classes
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
      
      // Récupérer l'année scolaire active comme fallback
      const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
      
      if (!anneeScolaireActive) {
        return {
          success: false,
          elevesMigres: 0,
          message: 'Aucune année scolaire active trouvée. Migration impossible.'
        };
      }
      
      // Filtrer les élèves qui n'ont pas d'annee_scolaire_id
      const elevesAMigrer = eleves.filter(eleve => !eleve.annee_scolaire_id);
      
      if (elevesAMigrer.length === 0) {
        return {
          success: true,
          elevesMigres: 0,
          message: 'Aucun élève à migrer. Tous les élèves ont déjà un annee_scolaire_id.'
        };
      }
      
      console.log(`📊 ${elevesAMigrer.length} élèves à migrer`);
      
      // Migration par batch (max 500 opérations par batch)
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < elevesAMigrer.length; i += batchSize) {
        const batch = writeBatch(db);
        const elevesChunk = elevesAMigrer.slice(i, i + batchSize);
        
        for (const eleve of elevesChunk) {
          // Trouver la classe de l'élève
          const classeEleve = classes.find(c => c.id === eleve.classe_id);
          
          // Déterminer l'année scolaire
          let anneeScolaireId: string;
          
          if (classeEleve?.annee_scolaire_id) {
            // Si la classe a une année scolaire, l'utiliser
            anneeScolaireId = classeEleve.annee_scolaire_id;
          } else {
            // Sinon, utiliser l'année active
            anneeScolaireId = anneeScolaireActive.id;
            console.log(`⚠️ Élève ${eleve.prenom} ${eleve.nom} : classe sans année, affectation à l'année active`);
          }
          
          // Mettre à jour l'élève
          const eleveRef = doc(db, 'eleves', eleve.id);
          batch.update(eleveRef, {
            annee_scolaire_id: anneeScolaireId
          });
        }
        
        batches.push(batch);
      }
      
      // Exécuter tous les batches
      console.log(`💾 Exécution de ${batches.length} batch(es)...`);
      await Promise.all(batches.map(batch => batch.commit()));
      
      console.log('✅ Migration terminée avec succès');
      
      return {
        success: true,
        elevesMigres: elevesAMigrer.length,
        message: `Migration réussie : ${elevesAMigrer.length} élèves mis à jour avec leur année scolaire.`
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la migration:', error);
      return {
        success: false,
        elevesMigres: 0,
        message: `Erreur lors de la migration : ${error}`
      };
    }
  }

  /**
   * Vérifier l'état de la migration
   */
  async verifierEtatMigration(): Promise<{ 
    totalEleves: number; 
    elevesAvecAnnee: number; 
    elevesSansAnnee: number; 
    migrationNecessaire: boolean 
  }> {
    try {
      const elevesSnapshot = await getDocs(collection(db, 'eleves'));
      const eleves = elevesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
      
      const totalEleves = eleves.length;
      const elevesAvecAnnee = eleves.filter(e => e.annee_scolaire_id).length;
      const elevesSansAnnee = totalEleves - elevesAvecAnnee;
      
      return {
        totalEleves,
        elevesAvecAnnee,
        elevesSansAnnee,
        migrationNecessaire: elevesSansAnnee > 0
      };
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      throw error;
    }
  }
}

export const migrationElevesService = new MigrationElevesService();