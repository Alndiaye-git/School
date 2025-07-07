# 🔐 Guide : Nettoyer Firebase Authentication

## ⚠️ Problème
Quand vous videz la base de données via l'interface Super Admin, seules les données **Firestore** sont supprimées. Les comptes **Firebase Authentication** (email/mot de passe) restent actifs.

## 🎯 Résultat Souhaité
Supprimer aussi les comptes email/password pour éviter les "comptes fantômes".

---

## 🛠️ Méthode 1 : Console Firebase (Recommandé)

### Étapes :
1. **Ouvrir la Console Firebase**
   - Allez sur [console.firebase.google.com](https://console.firebase.google.com)
   - Sélectionnez votre projet

2. **Accéder à Authentication**
   - Dans le menu gauche → **Authentication**
   - Onglet **Users**

3. **Supprimer les utilisateurs**
   - ✅ **Garder** : Les comptes directeurs et super admin
   - ❌ **Supprimer** : Tous les autres comptes
   - Cliquez sur l'icône 🗑️ ou utilisez les actions en lot

### Avantages :
- ✅ Simple et visuel
- ✅ Sélection multiple possible
- ✅ Aucun code requis

---

## 🛠️ Méthode 2 : Script Admin SDK (Avancé)

Si vous avez beaucoup d'utilisateurs à supprimer :

### Prérequis :
- Node.js installé
- Clé de service Firebase Admin

### Script :
```javascript
// scripts/clean-firebase-auth.js
const admin = require('firebase-admin');

// Initialiser avec votre clé de service
const serviceAccount = require('./path/to/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function cleanFirebaseAuth() {
  try {
    // Récupérer tous les utilisateurs
    const listUsersResult = await auth.listUsers();
    
    const usersToDelete = [];
    const usersToKeep = [];

    for (const userRecord of listUsersResult.users) {
      // Vérifier si c'est un directeur ou super admin
      // (vous devrez adapter selon votre logique)
      const customClaims = userRecord.customClaims || {};
      const email = userRecord.email || '';
      
      if (
        email.includes('directeur') || 
        email.includes('superadmin') ||
        customClaims.role === 'directeur' ||
        customClaims.role === 'super_admin'
      ) {
        usersToKeep.push(userRecord.uid);
        console.log(`✅ Préservé: ${email}`);
      } else {
        usersToDelete.push(userRecord.uid);
        console.log(`❌ À supprimer: ${email}`);
      }
    }

    // Supprimer les utilisateurs (par lots de 1000 max)
    if (usersToDelete.length > 0) {
      await auth.deleteUsers(usersToDelete);
      console.log(`🗑️ Supprimé ${usersToDelete.length} utilisateurs`);
    }

    console.log(`✅ Conservé ${usersToKeep.length} utilisateurs`);
    
  } catch (error) {
    console.error('Erreur:', error);
  }
}

cleanFirebaseAuth();
```

### Utilisation :
```bash
npm install firebase-admin
node scripts/clean-firebase-auth.js
```

---

## 🛠️ Méthode 3 : Extension de l'Interface (Future)

Pour automatiser complètement, il faudrait :

1. **Ajouter Firebase Admin SDK côté serveur**
2. **Créer une API** pour la suppression d'utilisateurs
3. **Modifier l'interface** pour appeler cette API

### Architecture suggérée :
```
Interface Web → API Node.js → Firebase Admin SDK → Suppression Auth
```

---

## 🔍 Vérification

Après nettoyage, vérifiez que :
- ✅ Les directeurs peuvent encore se connecter
- ✅ Le super admin peut encore se connecter  
- ❌ Les anciens enseignants ne peuvent plus se connecter

---

## 🚨 Sécurité

### Toujours Préserver :
- **Directeurs** (`role: 'directeur'`)
- **Super Admins** (`role: 'super_admin'`)
- **Votre compte actuel**

### Ne Jamais Supprimer :
- Le compte avec lequel vous êtes connecté
- Les comptes admin système
- Les comptes de test importants

---

## 📝 Recommandation

**Pour l'instant**, utilisez la **Méthode 1** (Console Firebase) :
1. C'est le plus sûr
2. Vous gardez le contrôle visuel
3. Pas de risque de script buggé
4. Interface officielle Firebase

**Dans le futur**, vous pourrez implémenter la **Méthode 3** pour une automation complète.

---

## 🆘 En Cas de Problème

Si vous supprimez accidentellement un compte important :
1. **Recréez-le** via la console Firebase
2. **Ajoutez les données** dans Firestore
3. **Modifiez le rôle** si nécessaire

Les données Firestore et Authentication sont indépendantes, donc vous pouvez recréer les liens.