# Système de Gestion des Absences Scolaires

Application web complète pour la gestion des absences dans un établissement scolaire, développée avec React, TypeScript et Firebase.

## 🎯 Fonctionnalités principales

- **Gestion multi-rôles** : Enseignants, Directeurs et Super-administrateurs
- **Suivi des absences** : Élèves et enseignants avec justificatifs
- **Statistiques avancées** : Tableaux de bord, analyses temporelles, alertes automatiques
- **Export de données** : Rapports Excel et PDF
- **Gestion des années scolaires** : Transition automatique, archives

## 📋 Prérequis

### Outils à installer

1. **Node.js** (version 14 ou supérieure)
   - Télécharger depuis [nodejs.org](https://nodejs.org/)
   - Vérifier l'installation : `node --version`

2. **npm** (installé avec Node.js)
   - Vérifier l'installation : `npm --version`

3. **Git** (optionnel, pour cloner le projet)
   - Télécharger depuis [git-scm.com](https://git-scm.com/)

4. **Éditeur de code** (recommandé : VS Code)
   - Télécharger depuis [code.visualstudio.com](https://code.visualstudio.com/)

## 🚀 Installation et configuration

### Étape 1 : Cloner ou télécharger le projet

```bash
# Option A : Cloner avec Git
git clone https://github.com/votre-repo/absence-school.git
cd absence-school

# Option B : Télécharger le ZIP et extraire
# Puis naviguer vers le dossier dans le terminal
cd chemin/vers/absence-school
```

### Étape 2 : Installer les dépendances

```bash
npm install
```

Cette commande installera toutes les bibliothèques nécessaires listées dans `package.json`.

### Étape 3 : Créer et configurer un projet Firebase

#### 3.1. Créer un compte Firebase
1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Se connecter avec un compte Google
3. Cliquer sur "Create a project" ou "Créer un projet"

#### 3.2. Configurer le projet Firebase
1. **Nom du projet** : Choisir un nom (ex: "gestion-absences-ecole")
2. **Google Analytics** : Désactiver (pas nécessaire)
3. Cliquer sur "Create project"

#### 3.3. Activer l'authentification
1. Dans le menu gauche, cliquer sur **Authentication**
2. Cliquer sur **Get started**
3. Dans l'onglet **Sign-in method**, activer **Email/Password**
4. Cliquer sur **Enable** puis **Save**

#### 3.4. Configurer Firestore Database
1. Dans le menu gauche, cliquer sur **Firestore Database**
2. Cliquer sur **Create database**
3. Choisir **Start in production mode**
4. Sélectionner une région (ex: `europe-west3` pour la France)
5. Cliquer sur **Enable**

#### 3.5. Configurer les règles de sécurité Firestore
1. Dans Firestore, aller sur l'onglet **Rules**
2. Remplacer le contenu par :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lecture pour tous les utilisateurs authentifiés
    match /{document=**} {
      allow read: if request.auth != null;
    }
    
    // Règles d'écriture selon le rôle
    match /users/{userId} {
      allow write: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['directeur', 'super_admin']);
    }
    
    // Collections principales - écriture pour directeurs et super_admin
    match /{collection}/{document} {
      allow write: if request.auth != null && 
        collection in ['classes', 'eleves', 'absences_eleves', 'absences_enseignants', 'annees_scolaires', 'audit_logs'] &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['directeur', 'super_admin'];
    }
    
    // Enseignants peuvent créer/modifier leurs propres absences d'élèves
    match /absences_eleves/{absence} {
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'enseignant';
    }
  }
}
```

3. Cliquer sur **Publish**

#### 3.6. Obtenir la configuration Firebase
1. Cliquer sur l'engrenage ⚙️ → **Project settings**
2. Descendre jusqu'à **Your apps**
3. Cliquer sur l'icône Web **</>**
4. **App nickname** : "Absence School Web"
5. Cliquer sur **Register app**
6. Copier la configuration qui apparaît

### Étape 4 : Configurer l'application

#### 4.1. Mettre à jour la configuration Firebase
1. Ouvrir le fichier `src/firebase/config.ts`
2. Remplacer la configuration existante par celle copiée depuis Firebase :

```typescript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  projectId: "VOTRE_PROJET",
  storageBucket: "VOTRE_PROJET.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};
```

#### 4.2. Créer le fichier .env (optionnel)
1. Copier `.env.example` vers `.env`
2. Modifier les valeurs selon vos besoins :

```bash
REACT_APP_SCHOOL_NAME=Nom de votre école
REACT_APP_APP_TITLE=Gestion des Absences
```

### Étape 5 : Créer le premier utilisateur (Directeur/Super Admin)

#### 5.1. Dans Firebase Console
1. Aller dans **Authentication** → **Users**
2. Cliquer sur **Add user**
3. Créer un utilisateur :
   - Email : `directeur@votre-ecole.com`
   - Password : Choisir un mot de passe fort
4. Noter l'**User UID** qui apparaît après création

#### 5.2. Créer le document utilisateur dans Firestore
1. Aller dans **Firestore Database**
2. Cliquer sur **Start collection**
3. **Collection ID** : `users`
4. **Document ID** : Coller l'UID copié précédemment
5. Ajouter ces champs :
   - `email` (string) : `directeur@votre-ecole.com`
   - `nom` (string) : `Directeur Principal`
   - `role` (string) : `super_admin`
   - `active` (boolean) : `true`
   - `forcePasswordChange` (boolean) : `false`
   - `created_at` (timestamp) : Cliquer sur l'icône horloge
6. Cliquer sur **Save**

### Étape 6 : Initialiser les collections

Dans Firestore, créer ces collections vides (juste le nom, sans documents) :
- `classes`
- `eleves`
- `absences_eleves`
- `absences_enseignants`
- `annees_scolaires`
- `audit_logs`

### Étape 7 : Créer la première année scolaire

1. Dans la collection `annees_scolaires`
2. Cliquer sur **Add document** → **Auto-ID**
3. Ajouter ces champs :
   - `nom` (string) : `2023-2024`
   - `dateDebut` (string) : `2023-09-04`
   - `dateFin` (string) : `2024-07-05`
   - `active` (boolean) : `true`
   - `periodes` (array) : Laisser vide `[]`
   - `joursSpeciaux` (array) : Laisser vide `[]`
   - `created_at` (timestamp) : Cliquer sur l'icône horloge
   - `created_by` (string) : Coller l'UID du directeur
4. Cliquer sur **Save**

## 🎮 Lancer l'application

```bash
# Mode développement
npm start
```

L'application s'ouvrira automatiquement dans votre navigateur à l'adresse [http://localhost:3000](http://localhost:3000)

### Première connexion
1. Email : `directeur@votre-ecole.com`
2. Mot de passe : Celui créé dans Firebase
3. Vous accéderez au tableau de bord Super Admin

## 📦 Build pour production

```bash
# Créer une version optimisée
npm run build

# Le dossier 'build' contiendra les fichiers à déployer
```

## 🔧 Commandes disponibles

- `npm start` : Lance l'application en mode développement
- `npm test` : Lance les tests
- `npm run build` : Crée une version de production
- `npm run eject` : Éjecte la configuration (⚠️ irréversible)

## 📱 Utilisation de base

### Rôles et permissions

1. **Super Admin**
   - Gestion complète de la base de données
   - Création/suppression en masse
   - Accès aux outils de maintenance

2. **Directeur**
   - Gestion des enseignants, classes et élèves
   - Accès aux statistiques complètes
   - Export des données
   - Gestion des années scolaires

3. **Enseignant**
   - Saisie des absences de ses élèves
   - Consultation de ses classes
   - Accès limité aux statistiques

### Workflow typique

1. **Début d'année** : Le directeur crée les classes et affecte les enseignants
2. **Inscription** : Ajout des élèves dans les classes
3. **Quotidien** : Les enseignants saisissent les absences
4. **Suivi** : Le directeur consulte les statistiques et intervient si nécessaire
5. **Fin d'année** : Export des données et transition vers l'année suivante

## 🆘 Dépannage

### L'application ne démarre pas
- Vérifier que Node.js est installé : `node --version`
- Supprimer `node_modules` et réinstaller : `rm -rf node_modules && npm install`

### Erreur de connexion Firebase
- Vérifier la configuration dans `src/firebase/config.ts`
- Vérifier que l'authentification Email/Password est activée
- Vérifier les règles de sécurité Firestore

### Utilisateur créé mais ne peut pas se connecter
- Vérifier que le document existe dans la collection `users` avec le bon UID
- Vérifier que le champ `active` est à `true`
- Vérifier que le `role` est correctement défini

## 🔒 Sécurité

- Ne jamais commiter le fichier `.env` avec des vraies valeurs
- Utiliser des mots de passe forts pour tous les comptes
- Sauvegarder régulièrement les données via l'export
- Limiter le nombre de super admins

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## 🤝 Support

Pour toute question ou problème :
1. Vérifier la documentation ci-dessus
2. Consulter les logs de la console du navigateur (F12)
3. Vérifier les logs Firebase Console
4. Créer une issue sur le repository GitHub