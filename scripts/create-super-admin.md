# Création d'un Compte Super Administrateur

## Instructions pour créer un super admin

Étant donné que la création d'utilisateurs Firebase nécessite soit l'Admin SDK côté serveur, soit une interface utilisateur côté client, voici les méthodes pour créer un compte super administrateur :

### Méthode 1 : Modification manuelle dans Firestore (Recommandé)

1. **Créer un compte utilisateur normal** via l'interface directeur existante
2. **Modifier le rôle dans Firestore** :
   - Accéder à la console Firebase
   - Aller à Firestore Database
   - Trouver la collection `users`
   - Localiser l'utilisateur que vous voulez promouvoir
   - Modifier le champ `role` de `'directeur'` à `'super_admin'`

### Méthode 2 : Script de console (Avancé)

Si vous avez accès à la console de développement de votre navigateur :

```javascript
// À exécuter dans la console du navigateur sur votre application
// (Assurez-vous d'être connecté en tant que directeur)

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function promoteToSuperAdmin(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: 'super_admin'
    });
    console.log('Utilisateur promu super administrateur avec succès');
  } catch (error) {
    console.error('Erreur lors de la promotion:', error);
  }
}

// Remplacez 'USER_ID_HERE' par l'ID réel de l'utilisateur
promoteToSuperAdmin('USER_ID_HERE');
```

### Méthode 3 : Via Firebase Admin SDK (Production)

Pour un environnement de production, il est recommandé de créer un script Node.js avec Firebase Admin SDK :

```javascript
// scripts/create-super-admin.js
const admin = require('firebase-admin');

// Initialiser Firebase Admin SDK
const serviceAccount = require('./path/to/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createSuperAdmin(email, password, nom) {
  try {
    // Créer l'utilisateur dans Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: nom,
    });

    // Créer le document utilisateur dans Firestore
    await db.collection('users').doc(userRecord.uid).set({
      nom: nom,
      email: email,
      role: 'super_admin',
      active: true,
      forcePasswordChange: true,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Super admin créé avec succès:', userRecord.uid);
    return userRecord.uid;
  } catch (error) {
    console.error('Erreur lors de la création du super admin:', error);
    throw error;
  }
}

// Utilisation
createSuperAdmin('superadmin@ecole.com', 'MotDePasseSecurise123!', 'Super Administrateur')
  .then((uid) => {
    console.log('Super admin créé avec l\'ID:', uid);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Échec de la création:', error);
    process.exit(1);
  });
```

## Fonctionnalités du Super Admin

Une fois le compte super admin créé, il aura accès à :

### 🔧 Tableau de Bord Super Administrateur
- **Statistiques de la base de données** : Vue d'ensemble de tous les données
- **Nettoyage sélectif** : Possibilité de vider la base tout en préservant les comptes directeurs
- **Mode test** : Simulation des opérations avant exécution réelle
- **Logs d'audit** : Traçabilité de toutes les opérations sensibles

### 🛡️ Protections Intégrées
- **Préservation des directeurs** : Les comptes directeurs ne sont jamais supprimés
- **Auto-protection** : Le super admin ne peut pas se supprimer lui-même
- **Confirmation obligatoire** : Phrase de confirmation pour les opérations dangereuses
- **Audit automatique** : Toutes les actions sont enregistrées

### 🗑️ Options de Nettoyage
- Élèves et leurs absences
- Enseignants (sauf directeurs)
- Classes
- Années scolaires
- Mode granulaire pour choisir exactement quoi supprimer

## Sécurité

⚠️ **IMPORTANT** : 
- Les super admins ont un pouvoir destructeur sur la base de données
- Ne créez que le minimum de comptes super admin nécessaires
- Utilisez des mots de passe forts et uniques
- Conservez les logs d'audit pour la traçabilité
- Testez toujours avec le mode "Test" avant les opérations réelles

## Support

En cas de problème :
1. Vérifiez les logs d'audit dans l'interface super admin
2. Consultez la console Firebase pour les erreurs
3. Assurez-vous que les permissions Firestore sont correctes
4. En dernier recours, restaurez depuis une sauvegarde

---

**Compte par défaut suggéré** :
- Email : `superadmin@[votre-domaine].com`
- Nom : `Super Administrateur`
- Mot de passe : À définir de manière sécurisée