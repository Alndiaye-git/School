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
      apiKey: "AIzaSyBAy6F9fr3KTQ0PVnez8iHC03Rh-tp3dSA",
      authDomain: "samuel-wallis.firebaseapp.com",
      projectId: "samuel-wallis",
      storageBucket: "samuel-wallis.firebasestorage.app",
      messagingSenderId: "668308725434",
      appId: "1:668308725434:web:1d883b3676fae143fd2c83"
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
      // deleted_by pas défini pr les nouveaux utilisateurs
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