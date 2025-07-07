# 🎯 Guide : Créer des Données de Démonstration

## 📋 Plan des Données à Créer

### 📅 Année Scolaire
**2024-2025** : du 02/09/2024 au 15/07/2025

### 👨‍🏫 Enseignants (5)
1. Marie Dubois - `marie.dubois@ecole.fr`
2. Pierre Martin - `pierre.martin@ecole.fr` 
3. Sophie Leroy - `sophie.leroy@ecole.fr`
4. Jean Bernard - `jean.bernard@ecole.fr`
5. Claire Moreau - `claire.moreau@ecole.fr`

### 🏫 Classes (6)
- **CP A** (Marie Dubois)
- **CP B** (Pierre Martin)
- **CE1 A** (Sophie Leroy)
- **CE2 A** (Jean Bernard)
- **CM1 A** (Claire Moreau)
- **CM2 A** (Marie Dubois)

### 👦👧 Élèves (30 total - 5 par classe)

#### CP A
1. Lucas Petit (15/03/2017)
2. Emma Durand (22/05/2017)
3. Hugo Michel (08/01/2017)
4. Léa Roux (12/07/2017)
5. Nathan Garcia (30/04/2017)

#### CP B
1. Chloé Blanc (18/02/2017)
2. Louis Lopez (25/06/2017)
3. Inès Fournier (03/09/2017)
4. Tom Girard (14/11/2017)
5. Zoé Andre (07/08/2017)

#### CE1 A
1. Arthur Mercier (12/04/2016)
2. Manon Lefevre (28/01/2016)
3. Théo Simon (05/10/2016)
4. Alice Laurent (19/07/2016)
5. Jules Bertrand (22/03/2016)

#### CE2 A
1. Camille Morel (16/05/2015)
2. Gabriel Vincent (01/12/2015)
3. Lola Rousseau (14/02/2015)
4. Maxime Nicolas (29/08/2015)
5. Eva Prevost (11/06/2015)

#### CM1 A
1. Antoine Richard (07/09/2014)
2. Lucie Gauthier (24/03/2014)
3. Raphaël Dupont (18/11/2014)
4. Sarah Caron (13/01/2014)
5. Paul Meunier (26/07/2014)

#### CM2 A
1. Mathilde Brun (09/04/2013)
2. Victor Dufour (22/12/2013)
3. Juliette Marchand (15/08/2013)
4. Adrien Lemoine (28/02/2013)
5. Nina Roussel (03/10/2013)

---

## 🛠️ Méthode de Création Manuelle

### Étape 1 : Créer l'Année Scolaire
1. Connectez-vous en tant que **directeur**
2. Allez à **Administration** → **Année Scolaire**
3. Cliquez **"Créer une nouvelle année"**
4. Remplissez :
   - **Nom** : `2024-2025`
   - **Date début** : `02/09/2024`
   - **Date fin** : `15/07/2025`
5. **Activez** l'année scolaire

### Étape 2 : Créer les Enseignants
1. Allez à **Gestion** → **Enseignants**
2. Pour chaque enseignant, cliquez **"Ajouter un enseignant"** :

**Marie Dubois**
- Nom : `Marie Dubois`
- Email : `marie.dubois@ecole.fr`
- Mot de passe : `Enseignant123!`

**Pierre Martin**
- Nom : `Pierre Martin`
- Email : `pierre.martin@ecole.fr`
- Mot de passe : `Enseignant123!`

**Sophie Leroy**
- Nom : `Sophie Leroy`
- Email : `sophie.leroy@ecole.fr`
- Mot de passe : `Enseignant123!`

**Jean Bernard**
- Nom : `Jean Bernard`
- Email : `jean.bernard@ecole.fr`
- Mot de passe : `Enseignant123!`

**Claire Moreau**
- Nom : `Claire Moreau`
- Email : `claire.moreau@ecole.fr`
- Mot de passe : `Enseignant123!`

### Étape 3 : Créer les Classes
1. Allez à **Gestion** → **Classes**
2. Pour chaque classe, cliquez **"Ajouter une classe"** :

- **CP A** → Enseignant : Marie Dubois
- **CP B** → Enseignant : Pierre Martin  
- **CE1 A** → Enseignant : Sophie Leroy
- **CE2 A** → Enseignant : Jean Bernard
- **CM1 A** → Enseignant : Claire Moreau
- **CM2 A** → Enseignant : Marie Dubois

### Étape 4 : Créer les Élèves
1. Allez à **Gestion** → **Élèves**
2. Pour chaque élève, cliquez **"Ajouter un élève"**
3. Utilisez la liste ci-dessus pour remplir les informations

### Étape 5 : Ajouter des Absences
1. Allez à **Absences Élèves**
2. Sélectionnez différentes classes et dates
3. Ajoutez quelques absences avec des motifs comme :
   - "Maladie"
   - "Rendez-vous médical"
   - "Problème familial"
   - "Fièvre"

---

## ⚡ Méthode Rapide (Script Console)

Si vous préférez automatiser, ouvrez la console de développement (F12) et utilisez le script que j'ai créé dans `create-demo-data.js`.

---

## 🎯 Résultat Attendu

Après création, vous devriez avoir :
- ✅ 1 année scolaire active (2024-2025)
- ✅ 5 enseignants
- ✅ 6 classes 
- ✅ 30 élèves (5 par classe)
- ✅ Quelques absences pour tester les fonctionnalités

Cela vous permettra de tester toutes les fonctionnalités :
- Saisie d'absences
- Statistiques par classe
- Rapports
- Transition d'année
- Fonctions super admin

## 🚀 Prêt à Commencer ?

Commencez par l'**Étape 1** (Année Scolaire) et suivez l'ordre ! 

**Temps estimé** : 15-20 minutes pour tout créer manuellement.