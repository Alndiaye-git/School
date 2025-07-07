import { 
  collection, 
  doc, 
  updateDoc, 
  query, 
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User, Classe, Eleve, AbsenceEleve, AuditLog } from '../types';

// Fonction pour créer un log d'audit
export const createAuditLog = async (
  action: 'delete' | 'update' | 'create',
  entityType: 'user' | 'classe' | 'eleve',
  entityId: string,
  entityName: string,
  performedBy: string,
  details?: any
) => {
  const auditData: any = {
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    performed_by: performedBy,
    performed_at: serverTimestamp()
  };
  
  // Ajouter details seulement s'il est défini et non null
  if (details !== undefined && details !== null) {
    auditData.details = details;
  }
  
  await addDoc(collection(db, 'audit_logs'), auditData);
};

// Soft delete pour User (Enseignant)
export const softDeleteUser = async (userId: string, deletedBy: string): Promise<{
  canDelete: boolean;
  message?: string;
  dependencies?: {
    classes: Classe[];
  };
}> => {
  // Vérifier les dépendances - classes assignées
  const classesQuery = query(
    collection(db, 'classes'),
    where('enseignant_id', '==', userId)
  );
  const classesSnapshot = await getDocs(classesQuery);
  const allClasses = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
  // Filtrer les classes actives (active !== false pour compatibilité)
  const activeClasses = allClasses.filter(classe => classe.active !== false);

  if (activeClasses.length > 0) {
    return {
      canDelete: false,
      message: `Cet enseignant est assigné à ${activeClasses.length} classe(s) active(s). Veuillez d'abord réassigner ces classes.`,
      dependencies: {
        classes: activeClasses
      }
    };
  }

  // Si pas de dépendances, procéder au soft delete
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    active: false,
    deleted_at: serverTimestamp(),
    deleted_by: deletedBy
  });

  return {
    canDelete: true,
    message: 'Enseignant supprimé avec succès.'
  };
};

// Soft delete pour Classe
export const softDeleteClasse = async (classeId: string, deletedBy: string): Promise<{
  canDelete: boolean;
  message?: string;
  dependencies?: {
    eleves: Eleve[];
  };
}> => {
  // Vérifier les dépendances - élèves dans la classe
  const elevesQuery = query(
    collection(db, 'eleves'),
    where('classe_id', '==', classeId)
  );
  const elevesSnapshot = await getDocs(elevesQuery);
  const allEleves = elevesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
  // Filtrer les élèves actifs (active !== false pour compatibilité)
  const activeEleves = allEleves.filter(eleve => eleve.active !== false);

  if (activeEleves.length > 0) {
    return {
      canDelete: false,
      message: `Cette classe contient ${activeEleves.length} élève(s) actif(s). Veuillez d'abord transférer ces élèves vers une autre classe.`,
      dependencies: {
        eleves: activeEleves
      }
    };
  }

  // Si pas d'élèves actifs, procéder au soft delete
  const classeRef = doc(db, 'classes', classeId);
  await updateDoc(classeRef, {
    active: false,
    deleted_at: serverTimestamp(),
    deleted_by: deletedBy
  });

  return {
    canDelete: true,
    message: 'Classe supprimée avec succès.'
  };
};

// Soft delete pour Eleve avec suppression des absences
export const softDeleteEleve = async (eleveId: string, deletedBy: string): Promise<{
  canDelete: boolean;
  message?: string;
  absencesArchived?: number;
}> => {
  // D'abord, archiver les absences de l'élève
  const absencesQuery = query(
    collection(db, 'absences_eleves'),
    where('eleve_id', '==', eleveId)
  );
  const absencesSnapshot = await getDocs(absencesQuery);
  
  let absencesCount = 0;
  // Archiver chaque absence
  for (const absenceDoc of absencesSnapshot.docs) {
    await updateDoc(doc(db, 'absences_eleves', absenceDoc.id), {
      archived: true,
      archived_at: serverTimestamp()
    });
    absencesCount++;
  }

  // Soft delete de l'élève
  const eleveRef = doc(db, 'eleves', eleveId);
  await updateDoc(eleveRef, {
    active: false,
    deleted_at: serverTimestamp(),
    deleted_by: deletedBy
  });

  return {
    canDelete: true,
    message: `Élève supprimé avec succès. ${absencesCount} absence(s) ont été archivées.`,
    absencesArchived: absencesCount
  };
};

// Fonction pour obtenir uniquement les enregistrements actifs
export const getActiveUsers = async (): Promise<User[]> => {
  // Récupérer tous les users d'abord, puis filtrer en mémoire pour compatibilité
  const querySnapshot = await getDocs(collection(db, 'users'));
  const allUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  // Filtrer : actif = true OU undefined (pour compatibilité avec données existantes)
  return allUsers.filter(user => user.active !== false);
};

export const getActiveClasses = async (): Promise<Classe[]> => {
  // Récupérer toutes les classes d'abord, puis filtrer en mémoire pour compatibilité
  const querySnapshot = await getDocs(collection(db, 'classes'));
  const allClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
  // Filtrer : actif = true OU undefined (pour compatibilité avec données existantes)
  return allClasses.filter(classe => classe.active !== false);
};

// Nouvelle fonction : obtenir les classes actives par année scolaire
export const getActiveClassesByAnneeScolaire = async (anneeScolaireId?: string): Promise<Classe[]> => {
  if (!anneeScolaireId) {
    // Si pas d'année spécifiée, utiliser l'année active
    const { anneeScolaireService } = await import('./anneeScolaire');
    const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
    if (anneeScolaireActive) {
      anneeScolaireId = anneeScolaireActive.id;
    } else {
      return []; // Aucune année active
    }
  }
  
  const querySnapshot = await getDocs(collection(db, 'classes'));
  const allClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
  
  // Filtrer par année scolaire ET classes actives
  return allClasses.filter(classe => 
    classe.active !== false && 
    classe.annee_scolaire_id === anneeScolaireId
  );
};

export const getActiveEleves = async (): Promise<Eleve[]> => {
  // Récupérer tous les élèves d'abord, puis filtrer en mémoire pour compatibilité
  const querySnapshot = await getDocs(collection(db, 'eleves'));
  const allEleves = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
  // Filtrer : actif = true OU undefined (pour compatibilité avec données existantes)
  return allEleves.filter(eleve => eleve.active !== false);
};

// Nouvelle fonction : obtenir les élèves actifs par année scolaire
export const getActiveElevesByAnneeScolaire = async (anneeScolaireId?: string): Promise<Eleve[]> => {
  if (!anneeScolaireId) {
    // Si pas d'année spécifiée, utiliser l'année active
    const { anneeScolaireService } = await import('./anneeScolaire');
    const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
    if (anneeScolaireActive) {
      anneeScolaireId = anneeScolaireActive.id;
    } else {
      return []; // Aucune année active
    }
  }
  
  // Récupérer tous les élèves
  const querySnapshot = await getDocs(collection(db, 'eleves'));
  const allEleves = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
  
  // Filtrer directement par année scolaire ET élèves actifs
  return allEleves.filter(eleve => 
    eleve.active !== false && 
    eleve.annee_scolaire_id === anneeScolaireId
  );
};

export const getActiveElevesByClasse = async (classeId: string): Promise<Eleve[]> => {
  const q = query(
    collection(db, 'eleves'), 
    where('classe_id', '==', classeId)
  );
  const querySnapshot = await getDocs(q);
  const allEleves = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
  // Filtrer : actif = true OU undefined (pour compatibilité avec données existantes)
  const activeEleves = allEleves.filter(eleve => eleve.active !== false);
  return activeEleves.sort((a, b) => a.nom.localeCompare(b.nom));
};

export const getActiveClassesByEnseignant = async (enseignantId: string): Promise<Classe[]> => {
  const q = query(
    collection(db, 'classes'), 
    where('enseignant_id', '==', enseignantId)
  );
  const querySnapshot = await getDocs(q);
  const allClasses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
  // Filtrer : actif = true OU undefined (pour compatibilité avec données existantes)
  return allClasses.filter(classe => classe.active !== false);
};