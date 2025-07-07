# 🚀 Déploiement Firebase

## ⚡ Déploiement Rapide

### **Prérequis**
- Compte Firebase avec le projet `school-absence-da786`
- Firebase CLI installé ✅

### **Commandes de Déploiement**

```bash
# 1. Se connecter à Firebase (si pas encore fait)
firebase login

# 2. Sélectionner le projet
firebase use school-absence-da786

# 3. Build de production
npm run build

# 4. Déployer
firebase deploy --only hosting
```

## 🔧 Configuration Actuelle

### **Fichiers de Configuration Créés :**

**`firebase.json`** :
```json
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{"source": "**", "destination": "/index.html"}],
    "headers": [
      {
        "source": "/static/**",
        "headers": [{"key": "Cache-Control", "value": "public,max-age=31536000,immutable"}]
      }
    ]
  }
}
```

**`.firebaserc`** :
```json
{
  "projects": {
    "default": "school-absence-da786"
  }
}
```

## 🌐 Accès à l'Application

Après déploiement, l'application sera accessible à :
- **URL principale** : `https://school-absence-da786.web.app`
- **URL alternative** : `https://school-absence-da786.firebaseapp.com`

## 🔄 Workflow de Mise à Jour

Pour mettre à jour l'application :

```bash
# 1. Faire les modifications dans le code
# 2. Build
npm run build

# 3. Déployer
firebase deploy --only hosting
```

## 🛡️ Sécurité

### **Variables d'Environnement**
Les variables dans `.env` sont incluses dans le build :
- `REACT_APP_SCHOOL_NAME`
- `REACT_APP_APP_TITLE`
- Configuration Firebase (publique par nature)

### **Règles de Sécurité**
Les règles Firestore sont configurées dans la console Firebase.

## 📊 Monitoring

### **Console Firebase**
- **Hosting** : Statistiques d'utilisation
- **Performance** : Temps de chargement
- **Analytics** : Données d'utilisation (si activé)

### **Logs**
```bash
# Voir les logs de déploiement
firebase hosting:channel:list

# Voir l'historique des déploiements
firebase deploy:history
```

## 🐛 Dépannage

### **Erreurs Communes**

**1. Erreur de permissions :**
```bash
firebase login --reauth
```

**2. Projet non trouvé :**
```bash
firebase projects:list
firebase use --add
```

**3. Build échoue :**
```bash
# Nettoyer et reconstruire
rm -rf node_modules package-lock.json
npm install
npm run build
```

### **Cache Browser**
Si les changements n'apparaissent pas :
- **Ctrl+F5** (refresh forcé)
- **Mode incognito**
- **Vider le cache du navigateur**

## 📝 Notes

- **Domaine personnalisé** : Peut être configuré dans Firebase Console
- **HTTPS** : Automatiquement activé par Firebase
- **CDN** : Distribution mondiale automatique
- **Rollback** : Possible via Firebase Console

## 🎯 Prochaines Étapes

1. **Déployer avec `firebase deploy`**
2. **Tester l'URL de production**
3. **Configurer un domaine personnalisé** (optionnel)
4. **Activer Analytics** (optionnel)
5. **Mettre en place CI/CD** (optionnel)