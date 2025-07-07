import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User } from '../types';

const generateMatricule = () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `ENS${year}${random}`;
};

export const createEnseignant = async (nom: string, email: string, password: string, currentUserEmail: string, currentUserPassword: string): Promise<string> => {
  try {
    // Créer une instance secondaire de Firebase Auth pour éviter de déconnecter l'utilisateur actuel
    const { initializeApp, deleteApp } = await import('firebase/app');
    const { getAuth, createUserWithEmailAndPassword: createUserSecondary } = await import('firebase/auth');
    
    // Configuration Firebase (réutilise la même config)
    const secondaryApp = initializeApp({
      apiKey: "AIzaSyBoTBPtNDRzTaXh8GwwsF7UBkN99jnT3dA",
      authDomain: "school-absence-da786.firebaseapp.com",
      projectId: "school-absence-da786",
      storageBucket: "school-absence-da786.firebasestorage.app",
      messagingSenderId: "906587307534",
      appId: "1:906587307534:web:b0e9be0b69a2bbfdbed2d7"
    }, 'SecondaryApp');
    
    const secondaryAuth = getAuth(secondaryApp);
    
    // Créer le compte avec l'instance secondaire
    const userCredential = await createUserSecondary(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    
    // Créer le document utilisateur dans Firestore
    const userData: Omit<User, 'id'> = {
      nom,
      email,
      matricule: generateMatricule(),
      role: 'enseignant',
      forcePasswordChange: true,
      active: true,
      deleted_at: null
      // deleted_by n'est pas défini pour les nouveaux utilisateurs
    };
    
    await setDoc(doc(db, 'users', uid), userData);
    
    // Déconnecter de l'instance secondaire
    await secondaryAuth.signOut();
    
    // Supprimer l'app secondaire
    await deleteApp(secondaryApp);
    
    return uid;
  } catch (error) {
    console.error('Erreur lors de la création de l\'enseignant:', error);
    throw error;
  }
};