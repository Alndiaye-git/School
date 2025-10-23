# Configuration de la page de réinitialisation personnalisée

## Étapes pour configurer Firebase

Pour utiliser votre page de réinitialisation personnalisée au lieu de la page Firebase par défaut, suivez ces étapes :

### 1. Déployer l'application

Assurez-vous que votre application est déployée et accessible en ligne. Par exemple :
- `https://votre-domaine.com`
- `https://votre-projet.web.app` (si hébergé sur Firebase Hosting)

### 2. Configurer l'URL d'action dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **samuel-wallis**
3. Dans le menu de gauche, cliquez sur **Authentication**
4. Allez dans l'onglet **Templates** (Modèles)
5. Cliquez sur **Password reset** (Réinitialisation du mot de passe)

### 3. Personnaliser le template d'email

Dans la section **Action URL** :
- Remplacez l'URL par défaut par : `https://votre-domaine.com/reset-password`
- Par exemple : `https://samuel-wallis.web.app/reset-password`

### 4. Personnaliser le message de l'email (optionnel)

Vous pouvez également modifier :
- Le nom d'expéditeur (Sender name)
- L'adresse email de réponse (Reply-to)
- Le sujet de l'email
- Le contenu de l'email

Exemple de template personnalisé :

```
Bonjour,

Nous avons reçu une demande de réinitialisation de votre mot de passe.

Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
%LINK%

Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.

Ce lien expirera dans 1 heure.

Cordialement,
L'équipe de [Nom de votre école]
```

### 5. Sauvegarder les modifications

Cliquez sur **Save** (Enregistrer) pour appliquer les changements.

## Test de la fonctionnalité

1. Allez sur la page de connexion : `https://votre-domaine.com/login`
2. Cliquez sur "Mot de passe oublié ?"
3. Entrez une adresse email valide
4. Vérifiez votre boîte email
5. Cliquez sur le lien dans l'email
6. Vous devriez être redirigé vers votre page personnalisée : `/reset-password`
7. Entrez un nouveau mot de passe
8. Vous serez redirigé vers la page de connexion

## En développement local

Si vous testez en local (http://localhost:3000), vous devrez :

1. Soit ajouter `http://localhost:3000/reset-password` comme URL d'action temporaire
2. Soit tester directement avec l'URL de production
3. Les liens Firebase peuvent aussi rediriger automatiquement vers localhost si vous testez localement

**Note importante** : Firebase permet d'avoir des configurations différentes pour différents environnements, mais cela nécessite plusieurs projets Firebase.

## Dépannage

### Le lien redirige toujours vers Firebase
- Vérifiez que vous avez bien sauvegardé les modifications dans Firebase Console
- Videz le cache de votre navigateur
- Attendez quelques minutes que les changements se propagent

### L'URL contient des paramètres supplémentaires
C'est normal ! L'URL ressemblera à :
```
https://votre-domaine.com/reset-password?oobCode=ABC123...&mode=resetPassword
```

Le paramètre `oobCode` est le code de réinitialisation que Firebase utilise pour vérifier la validité de la demande.

### La page affiche "Lien invalide"
- Le lien peut avoir expiré (durée de vie : 1 heure)
- Le lien a peut-être déjà été utilisé
- Demandez un nouveau lien de réinitialisation
