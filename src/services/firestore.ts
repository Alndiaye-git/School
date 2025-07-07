import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User, Classe, Eleve, AbsenceEleve, AbsenceEnseignant } from '../types';

// Users
export const createUser = async (userData: Omit<User, 'id'>) => {
  const docRef = await addDoc(collection(db, 'users'), userData);
  return docRef.id;
};

export const getUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
};

export const updateUser = async (id: string, data: Partial<User>) => {
  const docRef = doc(db, 'users', id);
  await updateDoc(docRef, data);
};

export const deleteUser = async (id: string) => {
  await deleteDoc(doc(db, 'users', id));
};

// Classes
export const checkClasseNameExists = async (nom: string, anneeScolaireId: string): Promise<boolean> => {
  const q = query(
    collection(db, 'classes'),
    where('nom', '==', nom),
    where('annee_scolaire_id', '==', anneeScolaireId)
  );
  const querySnapshot = await getDocs(q);
  const classes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
  
  // Vérifier seulement parmi les classes actives
  const activeClasses = classes.filter(classe => classe.active !== false);
  return activeClasses.length > 0;
};

export const createClasse = async (classeData: Omit<Classe, 'id'>) => {
  // S'assurer que la classe est active par défaut
  const classeWithDefaults = {
    ...classeData,
    active: classeData.active !== undefined ? classeData.active : true,
    deleted_at: classeData.deleted_at !== undefined ? classeData.deleted_at : null
    // deleted_by n'est défini que lors de la suppression
  };
  
  // Ajouter deleted_by seulement s'il est défini
  if (classeData.deleted_by !== undefined) {
    classeWithDefaults.deleted_by = classeData.deleted_by;
  }
  
  const docRef = await addDoc(collection(db, 'classes'), classeWithDefaults);
  return docRef.id;
};

export const getClasses = async (): Promise<Classe[]> => {
  const querySnapshot = await getDocs(collection(db, 'classes'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
};

export const getActiveClasses = async (): Promise<Classe[]> => {
  const q = query(collection(db, 'classes'), where('active', '==', true));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
};

export const getClassesByEnseignant = async (enseignantId: string): Promise<Classe[]> => {
  const q = query(collection(db, 'classes'), where('enseignant_id', '==', enseignantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
};

export const getActiveClassesByEnseignant = async (enseignantId: string): Promise<Classe[]> => {
  const q = query(
    collection(db, 'classes'), 
    where('enseignant_id', '==', enseignantId),
    where('active', '==', true)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Classe));
};

export const updateClasse = async (id: string, data: Partial<Classe>) => {
  const docRef = doc(db, 'classes', id);
  await updateDoc(docRef, data);
};

export const deleteClasse = async (id: string) => {
  await deleteDoc(doc(db, 'classes', id));
};

// Eleves
export const createEleve = async (eleveData: Omit<Eleve, 'id'>) => {
  // S'assurer que l'élève est actif par défaut
  const eleveWithDefaults = {
    ...eleveData,
    active: eleveData.active !== undefined ? eleveData.active : true,
    deleted_at: eleveData.deleted_at !== undefined ? eleveData.deleted_at : null
    // deleted_by n'est défini que lors de la suppression
  };
  
  // Ajouter deleted_by seulement s'il est défini
  if (eleveData.deleted_by !== undefined) {
    eleveWithDefaults.deleted_by = eleveData.deleted_by;
  }
  
  const docRef = await addDoc(collection(db, 'eleves'), eleveWithDefaults);
  return docRef.id;
};

export const getEleves = async (): Promise<Eleve[]> => {
  const querySnapshot = await getDocs(collection(db, 'eleves'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
};

export const getElevesByClasse = async (classeId: string): Promise<Eleve[]> => {
  const q = query(
    collection(db, 'eleves'), 
    where('classe_id', '==', classeId)
  );
  const querySnapshot = await getDocs(q);
  const eleves = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
  // Tri en mémoire pour éviter les problèmes d'index
  return eleves.sort((a, b) => a.nom.localeCompare(b.nom));
};

export const getActiveElevesByClasse = async (classeId: string): Promise<Eleve[]> => {
  const q = query(
    collection(db, 'eleves'), 
    where('classe_id', '==', classeId),
    where('active', '==', true)
  );
  const querySnapshot = await getDocs(q);
  const eleves = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Eleve));
  // Tri en mémoire pour éviter les problèmes d'index
  return eleves.sort((a, b) => a.nom.localeCompare(b.nom));
};

export const updateEleve = async (id: string, data: Partial<Eleve>) => {
  const docRef = doc(db, 'eleves', id);
  await updateDoc(docRef, data);
};

export const deleteEleve = async (id: string) => {
  await deleteDoc(doc(db, 'eleves', id));
};

// Absences Eleves
export const createAbsenceEleve = async (absenceData: Omit<AbsenceEleve, 'id'>) => {
  // Ajouter automatiquement l'année scolaire active si non spécifiée
  let absenceWithYear = { ...absenceData };
  
  if (!absenceWithYear.annee_scolaire_id) {
    // Importer dynamiquement pour éviter les dépendances circulaires
    const { anneeScolaireService } = await import('./anneeScolaire');
    const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
    
    if (anneeScolaireActive) {
      absenceWithYear.annee_scolaire_id = anneeScolaireActive.id;
    } else {
      throw new Error('Aucune année scolaire active trouvée. Veuillez d\'abord configurer une année scolaire.');
    }
  }
  
  const docRef = await addDoc(collection(db, 'absences_eleves'), absenceWithYear);
  return docRef.id;
};

export const getAbsencesEleves = async (): Promise<AbsenceEleve[]> => {
  const querySnapshot = await getDocs(collection(db, 'absences_eleves'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceEleve));
};

// Nouvelle fonction : obtenir les absences pour une année scolaire spécifique
export const getAbsencesElevesByAnneeScolaire = async (anneeScolaireId?: string): Promise<AbsenceEleve[]> => {
  let targetAnneeScolaireId = anneeScolaireId;
  
  // Si aucune année spécifiée, utiliser l'année active
  if (!targetAnneeScolaireId) {
    const { anneeScolaireService } = await import('./anneeScolaire');
    const anneeScolaireActive = await anneeScolaireService.getAnneeScolaireActive();
    if (anneeScolaireActive) {
      targetAnneeScolaireId = anneeScolaireActive.id;
    } else {
      return []; // Aucune année active, retourner un tableau vide
    }
  }
  
  const q = query(
    collection(db, 'absences_eleves'),
    where('annee_scolaire_id', '==', targetAnneeScolaireId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceEleve));
};

export const getAbsencesElevesByDate = async (date: string): Promise<AbsenceEleve[]> => {
  const q = query(collection(db, 'absences_eleves'), where('date', '==', date));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceEleve));
};

export const getAbsencesElevesByDateAndClasse = async (date: string, eleveIds: string[]): Promise<AbsenceEleve[]> => {
  if (eleveIds.length === 0) return [];
  
  const q = query(
    collection(db, 'absences_eleves'), 
    where('date', '==', date),
    where('eleve_id', 'in', eleveIds)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceEleve));
};

export const deleteAbsenceEleve = async (id: string) => {
  await deleteDoc(doc(db, 'absences_eleves', id));
};

// Absences Enseignants
export const createAbsenceEnseignant = async (absenceData: Omit<AbsenceEnseignant, 'id'>) => {
  const docRef = await addDoc(collection(db, 'absences_enseignants'), absenceData);
  return docRef.id;
};

export const getAbsencesEnseignants = async (): Promise<AbsenceEnseignant[]> => {
  const querySnapshot = await getDocs(collection(db, 'absences_enseignants'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AbsenceEnseignant));
};