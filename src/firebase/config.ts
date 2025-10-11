import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: "AIzaSyBAy6F9fr3KTQ0PVnez8iHC03Rh-tp3dSA",
  authDomain: "samuel-wallis.firebaseapp.com",
  projectId: "samuel-wallis",
  storageBucket: "samuel-wallis.firebasestorage.app",
  messagingSenderId: "668308725434",
  appId: "1:668308725434:web:1d883b3676fae143fd2c83"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);