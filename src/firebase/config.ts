import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBoTBPtNDRzTaXh8GwwsF7UBkN99jnT3dA",
  authDomain: "school-absence-da786.firebaseapp.com",
  projectId: "school-absence-da786",
  storageBucket: "school-absence-da786.firebasestorage.app",
  messagingSenderId: "846152854659",
  appId: "1:846152854659:web:2916989dbab72895cabfb6",
  measurementId: "G-27B4VJ3PVW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);