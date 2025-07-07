import { 
  collection, 
  getDocs, 
  doc, 
  query, 
  where, 
  writeBatch,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { deleteUser as deleteAuthUser } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { DatabaseClearOptions, AuditLog, User } from '../types';

class SuperAdminService {
  // Vérifier si l'utilisateur est super admin
  isSuperAdmin(user: User): boolean {
    return user.role === 'super_admin';
  }

  // Vérifier si l'utilisateur peut effectuer des opérations de nettoyage
  canClearDatabase(user: User): boolean {
    return this.isSuperAdmin(user);
  }

  // Créer un log d'audit pour les opérations de super admin
  private async createAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    entityName: string,
    performedBy: string,
    details?: any
  ): Promise<void> {
    try {
      const auditLog: Omit<AuditLog, 'id'> = {
        action: action as any,
        entity_type: entityType as any,
        entity_id: entityId,
        entity_name: entityName,
        performed_by: performedBy,
        performed_at: new Date(),
        details: details || {}
      };

      await addDoc(collection(db, 'audit_logs'), {
        ...auditLog,
        performed_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la création du log d\'audit:', error);
    }
  }

  // Obtenir les statistiques de la base de données avant nettoyage
  async getDatabaseStats(): Promise<{
    users: number;
    directors: number;
    teachers: number;
    students: number;
    classes: number;
    absences: number;
    schoolYears: number;
  }> {
    try {
      const [
        usersSnapshot,
        directorsSnapshot,
        teachersSnapshot,
        studentsSnapshot,
        classesSnapshot,
        absencesSnapshot,
        schoolYearsSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'directeur'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'enseignant'))),
        getDocs(collection(db, 'eleves')),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'absences_eleves')),
        getDocs(collection(db, 'annees_scolaires'))
      ]);

      return {
        users: usersSnapshot.size,
        directors: directorsSnapshot.size,
        teachers: teachersSnapshot.size,
        students: studentsSnapshot.size,
        classes: classesSnapshot.size,
        absences: absencesSnapshot.size,
        schoolYears: schoolYearsSnapshot.size
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw new Error('Impossible de récupérer les statistiques de la base de données');
    }
  }

  // Nettoyer la base de données selon les options spécifiées
  async clearDatabase(
    options: DatabaseClearOptions,
    currentUser: User
  ): Promise<{
    success: boolean;
    deletedCounts: {
      students: number;
      teachers: number;
      classes: number;
      absences: number;
      schoolYears: number;
    };
    errors: string[];
  }> {
    if (!this.canClearDatabase(currentUser)) {
      throw new Error('Accès non autorisé: seuls les super administrateurs peuvent nettoyer la base de données');
    }

    const result = {
      success: true,
      deletedCounts: {
        students: 0,
        teachers: 0,
        classes: 0,
        absences: 0,
        schoolYears: 0
      },
      errors: [] as string[]
    };

    const batch = writeBatch(db);
    let batchCount = 0;

    try {
      // Log de début d'opération
      await this.createAuditLog(
        'database_clear',
        'database',
        'full_database',
        'Nettoyage complet de la base de données',
        currentUser.id,
        { options, dryRun: options.dryRun || false }
      );

      // 1. Nettoyer les absences d'élèves
      if (options.clearAbsences) {
        const absencesSnapshot = await getDocs(collection(db, 'absences_eleves'));
        for (const docSnapshot of absencesSnapshot.docs) {
          if (!options.dryRun) {
            batch.delete(doc(db, 'absences_eleves', docSnapshot.id));
            batchCount++;
          }
          result.deletedCounts.absences++;

          // Commit par batch de 500 (limite Firestore)
          if (batchCount >= 500) {
            if (!options.dryRun) await batch.commit();
            batchCount = 0;
          }
        }
      }

      // 2. Nettoyer les élèves
      if (options.clearStudents) {
        const studentsSnapshot = await getDocs(collection(db, 'eleves'));
        for (const docSnapshot of studentsSnapshot.docs) {
          if (!options.dryRun) {
            batch.delete(doc(db, 'eleves', docSnapshot.id));
            batchCount++;
          }
          result.deletedCounts.students++;

          if (batchCount >= 500) {
            if (!options.dryRun) await batch.commit();
            batchCount = 0;
          }
        }
      }

      // 3. Nettoyer les classes
      if (options.clearClasses) {
        const classesSnapshot = await getDocs(collection(db, 'classes'));
        for (const docSnapshot of classesSnapshot.docs) {
          if (!options.dryRun) {
            batch.delete(doc(db, 'classes', docSnapshot.id));
            batchCount++;
          }
          result.deletedCounts.classes++;

          if (batchCount >= 500) {
            if (!options.dryRun) await batch.commit();
            batchCount = 0;
          }
        }
      }

      // 4. Nettoyer les enseignants (en préservant les directeurs si demandé)
      if (options.clearTeachers) {
        const teachersQuery = options.preserveDirectors 
          ? query(collection(db, 'users'), where('role', '==', 'enseignant'))
          : collection(db, 'users');

        const teachersSnapshot = await getDocs(teachersQuery);
        for (const docSnapshot of teachersSnapshot.docs) {
          const userData = docSnapshot.data() as User;
          
          // Ne pas supprimer l'utilisateur actuel si demandé
          if (options.preserveCurrentUser && docSnapshot.id === currentUser.id) {
            continue;
          }

          // Ne pas supprimer les directeurs si demandé
          if (options.preserveDirectors && userData.role === 'directeur') {
            continue;
          }

          // Ne jamais supprimer les super admins
          if (userData.role === 'super_admin') {
            continue;
          }

          if (!options.dryRun) {
            batch.delete(doc(db, 'users', docSnapshot.id));
            batchCount++;
          }
          result.deletedCounts.teachers++;

          if (batchCount >= 500) {
            if (!options.dryRun) await batch.commit();
            batchCount = 0;
          }
        }
      }

      // 5. Nettoyer les années scolaires
      if (options.clearSchoolYears) {
        const schoolYearsSnapshot = await getDocs(collection(db, 'annees_scolaires'));
        for (const docSnapshot of schoolYearsSnapshot.docs) {
          if (!options.dryRun) {
            batch.delete(doc(db, 'annees_scolaires', docSnapshot.id));
            batchCount++;
          }
          result.deletedCounts.schoolYears++;

          if (batchCount >= 500) {
            if (!options.dryRun) await batch.commit();
            batchCount = 0;
          }
        }
      }

      // Commit final du batch
      if (batchCount > 0 && !options.dryRun) {
        await batch.commit();
      }

      // 6. Avertissement pour Firebase Authentication
      if (options.clearFirebaseAuth) {
        // IMPORTANT: La suppression des comptes Firebase Auth nécessite l'Admin SDK
        // ou que chaque utilisateur soit connecté individuellement pour se supprimer
        result.errors.push(
          "⚠️ ATTENTION: Les comptes Firebase Authentication ne peuvent pas être supprimés " +
          "depuis le client web. Utilisez la Console Firebase ou l'Admin SDK pour les supprimer manuellement."
        );
        
        await this.createAuditLog(
          'database_clear',
          'auth',
          'warning_issued',
          'Avertissement Firebase Auth émis',
          currentUser.id,
          { 
            message: "Firebase Auth cleanup requires Admin SDK or manual deletion",
            usersToDelete: result.deletedCounts.teachers 
          }
        );
      }

      // Log de fin d'opération
      await this.createAuditLog(
        'database_clear',
        'database',
        'operation_completed',
        'Nettoyage de base de données terminé',
        currentUser.id,
        { 
          options, 
          deletedCounts: result.deletedCounts,
          dryRun: options.dryRun || false 
        }
      );

    } catch (error) {
      console.error('Erreur lors du nettoyage de la base de données:', error);
      result.success = false;
      result.errors.push(`Erreur lors du nettoyage: ${error}`);

      // Log d'erreur
      await this.createAuditLog(
        'database_clear',
        'database',
        'operation_failed',
        'Échec du nettoyage de base de données',
        currentUser.id,
        { options, error: error instanceof Error ? error.message : String(error) }
      );
    }

    return result;
  }

  // Créer un compte super admin (uniquement par un autre super admin)
  async createSuperAdmin(
    newAdminData: {
      nom: string;
      email: string;
      password: string;
    },
    currentUser: User
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    if (!this.isSuperAdmin(currentUser)) {
      throw new Error('Seuls les super administrateurs peuvent créer d\'autres super administrateurs');
    }

    try {
      // La création d'utilisateur Firebase doit être faite côté client ou avec l'Admin SDK
      // Pour l'instant, nous retournons une structure qui indique qu'il faut implémenter
      // la création via Firebase Auth Admin SDK ou côté client
      
      await this.createAuditLog(
        'create',
        'user',
        'pending',
        `Tentative de création super admin: ${newAdminData.email}`,
        currentUser.id,
        { email: newAdminData.email, nom: newAdminData.nom }
      );

      return {
        success: false,
        error: 'La création de super admin nécessite une implémentation Firebase Auth Admin SDK'
      };

    } catch (error) {
      console.error('Erreur lors de la création du super admin:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  // Obtenir la liste des logs d'audit pour les opérations de super admin
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    try {
      const auditSnapshot = await getDocs(collection(db, 'audit_logs'));
      const logs = auditSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AuditLog))
        .sort((a, b) => b.performed_at.getTime() - a.performed_at.getTime())
        .slice(0, limit);

      return logs;
    } catch (error) {
      console.error('Erreur lors de la récupération des logs d\'audit:', error);
      return [];
    }
  }

  // Créer des données de démonstration
  async createDemoData(currentUser: User): Promise<{
    success: boolean;
    message: string;
    createdCounts: {
      anneeScolaire: number;
      enseignants: number;
      classes: number;
      eleves: number;
      absences: number;
    };
    errors: string[];
  }> {
    if (!this.isSuperAdmin(currentUser)) {
      throw new Error('Seuls les super administrateurs peuvent créer des données de démonstration');
    }

    const result = {
      success: true,
      message: '',
      createdCounts: {
        anneeScolaire: 0,
        enseignants: 0,
        classes: 0,
        eleves: 0,
        absences: 0
      },
      errors: [] as string[]
    };

    try {
      // Log de début
      await this.createAuditLog(
        'create',
        'database',
        'demo_data_creation',
        'Création des données de démonstration',
        currentUser.id,
        { started: true }
      );

      // 1. Créer l'année scolaire 2024-2025 avec la structure correcte
      const anneeScolaireData = {
        nom: "2024-2025",
        dateDebut: "2024-09-02",
        dateFin: "2025-07-15", 
        active: true,
        periodes: [
          // Ajouter quelques périodes de cours et vacances par défaut
          {
            id: "periode_1",
            nom: "Période 1",
            dateDebut: "2024-09-02",
            dateFin: "2024-10-18",
            type: "cours"
          },
          {
            id: "vacances_toussaint",
            nom: "Vacances de Toussaint",
            dateDebut: "2024-10-19",
            dateFin: "2024-11-03",
            type: "vacances"
          },
          {
            id: "periode_2", 
            nom: "Période 2",
            dateDebut: "2024-11-04",
            dateFin: "2024-12-20",
            type: "cours"
          },
          {
            id: "vacances_noel",
            nom: "Vacances de Noël",
            dateDebut: "2024-12-21",
            dateFin: "2025-01-05",
            type: "vacances"
          },
          {
            id: "periode_3",
            nom: "Période 3", 
            dateDebut: "2025-01-06",
            dateFin: "2025-02-14",
            type: "cours"
          },
          {
            id: "vacances_hiver",
            nom: "Vacances d'hiver",
            dateDebut: "2025-02-15",
            dateFin: "2025-03-02",
            type: "vacances"
          },
          {
            id: "periode_4",
            nom: "Période 4",
            dateDebut: "2025-03-03", 
            dateFin: "2025-04-11",
            type: "cours"
          },
          {
            id: "vacances_printemps",
            nom: "Vacances de printemps",
            dateDebut: "2025-04-12",
            dateFin: "2025-04-27",
            type: "vacances"
          },
          {
            id: "periode_5",
            nom: "Période 5",
            dateDebut: "2025-04-28",
            dateFin: "2025-07-15",
            type: "cours"
          }
        ],
        joursSpeciaux: [
          // Ajouter quelques jours fériés
          {
            id: "armistice_2024",
            date: "2024-11-11",
            nom: "Armistice",
            type: "ferie"
          },
          {
            id: "paques_2025",
            date: "2025-04-21",
            nom: "Lundi de Pâques", 
            type: "ferie"
          },
          {
            id: "fete_travail_2025",
            date: "2025-05-01",
            nom: "Fête du Travail",
            type: "ferie"
          },
          {
            id: "victoire_2025",
            date: "2025-05-08", 
            nom: "Fête de la Victoire",
            type: "ferie"
          },
          {
            id: "ascension_2025",
            date: "2025-05-29",
            nom: "Ascension",
            type: "ferie"
          },
          {
            id: "pentecote_2025",
            date: "2025-06-09",
            nom: "Lundi de Pentecôte",
            type: "ferie"
          }
        ],
        created_at: new Date().toISOString(),
        created_by: currentUser.id
      };

      const anneeScolaireRef = await addDoc(collection(db, 'annees_scolaires'), anneeScolaireData);
      result.createdCounts.anneeScolaire = 1;

      // 2. Créer les enseignants (données Firestore seulement)
      const enseignants = [
        { nom: "Marie Dubois", email: "marie.dubois@ecole.fr", matricule: "ENS001" },
        { nom: "Pierre Martin", email: "pierre.martin@ecole.fr", matricule: "ENS002" },
        { nom: "Sophie Leroy", email: "sophie.leroy@ecole.fr", matricule: "ENS003" },
        { nom: "Jean Bernard", email: "jean.bernard@ecole.fr", matricule: "ENS004" },
        { nom: "Claire Moreau", email: "claire.moreau@ecole.fr", matricule: "ENS005" }
      ];

      const enseignantIds = [];
      for (const enseignant of enseignants) {
        const enseignantData = {
          ...enseignant,
          role: 'enseignant',
          active: true,
          forcePasswordChange: true,
          created_at: serverTimestamp()
        };
        
        const enseignantRef = await addDoc(collection(db, 'users'), enseignantData);
        enseignantIds.push(enseignantRef.id);
        result.createdCounts.enseignants++;
      }

      // 3. Créer les classes
      const classesData = [
        { nom: "CP A", niveau: "CP", enseignant_id: enseignantIds[0] },
        { nom: "CP B", niveau: "CP", enseignant_id: enseignantIds[1] },
        { nom: "CE1 A", niveau: "CE1", enseignant_id: enseignantIds[2] },
        { nom: "CE2 A", niveau: "CE2", enseignant_id: enseignantIds[3] },
        { nom: "CM1 A", niveau: "CM1", enseignant_id: enseignantIds[4] },
        { nom: "CM2 A", niveau: "CM2", enseignant_id: enseignantIds[0] }
      ];

      const classeIds = [];
      for (const classe of classesData) {
        const classeDataComplete = {
          ...classe,
          annee_scolaire_id: anneeScolaireRef.id,
          active: true,
          created_at: serverTimestamp()
        };
        
        const classeRef = await addDoc(collection(db, 'classes'), classeDataComplete);
        classeIds.push(classeRef.id);
        result.createdCounts.classes++;
      }

      // 4. Créer les élèves
      const elevesData = [
        // CP A
        { nom: "Petit", prenom: "Lucas", date_naissance: "2017-03-15", classe_index: 0 },
        { nom: "Durand", prenom: "Emma", date_naissance: "2017-05-22", classe_index: 0 },
        { nom: "Michel", prenom: "Hugo", date_naissance: "2017-01-08", classe_index: 0 },
        // CP B
        { nom: "Blanc", prenom: "Chloé", date_naissance: "2017-02-18", classe_index: 1 },
        { nom: "Lopez", prenom: "Louis", date_naissance: "2017-06-25", classe_index: 1 },
        { nom: "Fournier", prenom: "Inès", date_naissance: "2017-09-03", classe_index: 1 },
        // CE1 A
        { nom: "Mercier", prenom: "Arthur", date_naissance: "2016-04-12", classe_index: 2 },
        { nom: "Lefevre", prenom: "Manon", date_naissance: "2016-01-28", classe_index: 2 },
        { nom: "Simon", prenom: "Théo", date_naissance: "2016-10-05", classe_index: 2 },
        // CE2 A
        { nom: "Morel", prenom: "Camille", date_naissance: "2015-05-16", classe_index: 3 },
        { nom: "Vincent", prenom: "Gabriel", date_naissance: "2015-12-01", classe_index: 3 },
        { nom: "Rousseau", prenom: "Lola", date_naissance: "2015-02-14", classe_index: 3 },
        // CM1 A
        { nom: "Richard", prenom: "Antoine", date_naissance: "2014-09-07", classe_index: 4 },
        { nom: "Gauthier", prenom: "Lucie", date_naissance: "2014-03-24", classe_index: 4 },
        { nom: "Dupont", prenom: "Raphaël", date_naissance: "2014-11-18", classe_index: 4 },
        // CM2 A
        { nom: "Brun", prenom: "Mathilde", date_naissance: "2013-04-09", classe_index: 5 },
        { nom: "Dufour", prenom: "Victor", date_naissance: "2013-12-22", classe_index: 5 },
        { nom: "Marchand", prenom: "Juliette", date_naissance: "2013-08-15", classe_index: 5 }
      ];

      const eleveIds = [];
      for (let i = 0; i < elevesData.length; i++) {
        const eleve = elevesData[i];
        const numeroEleve = `2024${String(i + 1).padStart(4, '0')}`;
        
        const eleveData = {
          nom: eleve.nom,
          prenom: eleve.prenom,
          date_naissance: eleve.date_naissance,
          numero_eleve: numeroEleve,
          classe_id: classeIds[eleve.classe_index],
          annee_scolaire_id: anneeScolaireRef.id,
          active: true,
          created_at: serverTimestamp()
        };
        
        const eleveRef = await addDoc(collection(db, 'eleves'), eleveData);
        eleveIds.push(eleveRef.id);
        result.createdCounts.eleves++;
      }

      // 5. Créer quelques absences aléatoires
      const motifs = ["Maladie", "Rendez-vous médical", "Problème familial", "Fièvre", "Gastro"];
      const today = new Date();
      const startSchool = new Date('2024-09-02');
      
      for (const eleveId of eleveIds) {
        // 1-3 absences par élève
        const numAbsences = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numAbsences; i++) {
          // Date aléatoire entre le début d'année et aujourd'hui
          const randomTime = startSchool.getTime() + Math.random() * (today.getTime() - startSchool.getTime());
          const randomDate = new Date(randomTime);
          
          // Éviter les weekends
          if (randomDate.getDay() !== 0 && randomDate.getDay() !== 6) {
            const absenceData = {
              eleve_id: eleveId,
              date: randomDate.toISOString().split('T')[0],
              commentaire: motifs[Math.floor(Math.random() * motifs.length)],
              saisi_par: currentUser.id,
              annee_scolaire_id: anneeScolaireRef.id,
              created_at: serverTimestamp()
            };
            
            await addDoc(collection(db, 'absences_eleves'), absenceData);
            result.createdCounts.absences++;
          }
        }
      }

      // Log de succès
      await this.createAuditLog(
        'create',
        'database',
        'demo_data_completed',
        'Données de démonstration créées avec succès',
        currentUser.id,
        { createdCounts: result.createdCounts }
      );

      result.message = `Données créées avec succès ! ${result.createdCounts.eleves} élèves, ${result.createdCounts.classes} classes, ${result.createdCounts.enseignants} enseignants, ${result.createdCounts.absences} absences.`;

    } catch (error) {
      console.error('Erreur lors de la création des données de démonstration:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));

      // Log d'erreur
      await this.createAuditLog(
        'create',
        'database',
        'demo_data_failed',
        'Échec de la création des données de démonstration',
        currentUser.id,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    return result;
  }
}

export const superAdminService = new SuperAdminService();
export default superAdminService;