// Script pour créer des données de démonstration
// À exécuter dans la console du navigateur sur votre application

// Données de démonstration
const demoData = {
  anneeScolaire: {
    nom: "2024-2025",
    date_debut: "2024-09-02",
    date_fin: "2025-07-15",
    active: true
  },
  
  enseignants: [
    { nom: "Dubois", email: "marie.dubois@ecole.fr", password: "Enseignant123!" },
    { nom: "Martin", email: "pierre.martin@ecole.fr", password: "Enseignant123!" },
    { nom: "Leroy", email: "sophie.leroy@ecole.fr", password: "Enseignant123!" },
    { nom: "Bernard", email: "jean.bernard@ecole.fr", password: "Enseignant123!" },
    { nom: "Moreau", email: "claire.moreau@ecole.fr", password: "Enseignant123!" }
  ],
  
  classes: [
    { nom: "CP A", niveau: "CP" },
    { nom: "CP B", niveau: "CP" },
    { nom: "CE1 A", niveau: "CE1" },
    { nom: "CE2 A", niveau: "CE2" },
    { nom: "CM1 A", niveau: "CM1" },
    { nom: "CM2 A", niveau: "CM2" }
  ],
  
  eleves: [
    // CP A
    { nom: "Petit", prenom: "Lucas", date_naissance: "2017-03-15" },
    { nom: "Durand", prenom: "Emma", date_naissance: "2017-05-22" },
    { nom: "Michel", prenom: "Hugo", date_naissance: "2017-01-08" },
    { nom: "Roux", prenom: "Léa", date_naissance: "2017-07-12" },
    { nom: "Garcia", prenom: "Nathan", date_naissance: "2017-04-30" },
    
    // CP B  
    { nom: "Blanc", prenom: "Chloé", date_naissance: "2017-02-18" },
    { nom: "Lopez", prenom: "Louis", date_naissance: "2017-06-25" },
    { nom: "Fournier", prenom: "Inès", date_naissance: "2017-09-03" },
    { nom: "Girard", prenom: "Tom", date_naissance: "2017-11-14" },
    { nom: "Andre", prenom: "Zoé", date_naissance: "2017-08-07" },
    
    // CE1 A
    { nom: "Mercier", prenom: "Arthur", date_naissance: "2016-04-12" },
    { nom: "Lefevre", prenom: "Manon", date_naissance: "2016-01-28" },
    { nom: "Simon", prenom: "Théo", date_naissance: "2016-10-05" },
    { nom: "Laurent", prenom: "Alice", date_naissance: "2016-07-19" },
    { nom: "Bertrand", prenom: "Jules", date_naissance: "2016-03-22" },
    
    // CE2 A
    { nom: "Morel", prenom: "Camille", date_naissance: "2015-05-16" },
    { nom: "Vincent", prenom: "Gabriel", date_naissance: "2015-12-01" },
    { nom: "Rousseau", prenom: "Lola", date_naissance: "2015-02-14" },
    { nom: "Nicolas", prenom: "Maxime", date_naissance: "2015-08-29" },
    { nom: "Prevost", prenom: "Eva", date_naissance: "2015-06-11" },
    
    // CM1 A
    { nom: "Richard", prenom: "Antoine", date_naissance: "2014-09-07" },
    { nom: "Gauthier", prenom: "Lucie", date_naissance: "2014-03-24" },
    { nom: "Dupont", prenom: "Raphaël", date_naissance: "2014-11-18" },
    { nom: "Caron", prenom: "Sarah", date_naissance: "2014-01-13" },
    { nom: "Meunier", prenom: "Paul", date_naissance: "2014-07-26" },
    
    // CM2 A
    { nom: "Brun", prenom: "Mathilde", date_naissance: "2013-04-09" },
    { nom: "Dufour", prenom: "Victor", date_naissance: "2013-12-22" },
    { nom: "Marchand", prenom: "Juliette", date_naissance: "2013-08-15" },
    { nom: "Lemoine", prenom: "Adrien", date_naissance: "2013-02-28" },
    { nom: "Roussel", prenom: "Nina", date_naissance: "2013-10-03" }
  ]
};

// Fonction pour générer des absences aléatoires
function generateRandomAbsences(eleveId, anneeScolaireId, currentUserId) {
  const absences = [];
  const startDate = new Date('2024-09-02');
  const endDate = new Date();
  
  // Générer 2-8 absences par élève
  const numAbsences = Math.floor(Math.random() * 7) + 2;
  
  for (let i = 0; i < numAbsences; i++) {
    // Date aléatoire entre le début de l'année et maintenant
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const randomDate = new Date(randomTime);
    
    // Éviter les weekends
    if (randomDate.getDay() !== 0 && randomDate.getDay() !== 6) {
      const motifs = [
        "Maladie",
        "Rendez-vous médical",
        "Problème familial", 
        "Problème de transport",
        "Maladie (gastro)",
        "Fièvre",
        "Consultation médicale"
      ];
      
      absences.push({
        eleve_id: eleveId,
        date: randomDate.toISOString().split('T')[0],
        commentaire: motifs[Math.floor(Math.random() * motifs.length)],
        saisi_par: currentUserId,
        annee_scolaire_id: anneeScolaireId
      });
    }
  }
  
  return absences;
}

// Fonction principale pour créer toutes les données
async function createDemoData() {
  try {
    console.log("🚀 Début de la création des données de démonstration...");
    
    // Import des services (à adapter selon votre structure)
    const { anneeScolaireService } = window; // Supposant que les services sont disponibles globalement
    const { authService } = window;
    const { firestoreService } = window;
    
    // 1. Créer l'année scolaire
    console.log("📅 Création de l'année scolaire 2024-2025...");
    const anneeScolaireId = await anneeScolaireService.createAnneeScolaire(demoData.anneeScolaire);
    console.log(`✅ Année scolaire créée avec l'ID: ${anneeScolaireId}`);
    
    // 2. Créer les enseignants
    console.log("👨‍🏫 Création des enseignants...");
    const enseignantIds = [];
    for (const enseignant of demoData.enseignants) {
      try {
        const result = await authService.createUser({
          ...enseignant,
          role: 'enseignant'
        });
        if (result.success) {
          enseignantIds.push(result.userId);
          console.log(`✅ Enseignant créé: ${enseignant.nom} (${enseignant.email})`);
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${enseignant.nom}:`, error);
      }
    }
    
    // 3. Créer les classes
    console.log("🏫 Création des classes...");
    const classeIds = [];
    for (let i = 0; i < demoData.classes.length; i++) {
      const classe = demoData.classes[i];
      const enseignantId = enseignantIds[i % enseignantIds.length]; // Répartir les enseignants
      
      const classeData = {
        ...classe,
        annee_scolaire_id: anneeScolaireId,
        enseignant_id: enseignantId,
        active: true
      };
      
      const classeId = await firestoreService.create('classes', classeData);
      classeIds.push({ id: classeId, niveau: classe.niveau });
      console.log(`✅ Classe créée: ${classe.nom}`);
    }
    
    // 4. Créer les élèves
    console.log("👦👧 Création des élèves...");
    const eleveIds = [];
    let eleveIndex = 0;
    
    for (const classe of classeIds) {
      // 5 élèves par classe
      for (let i = 0; i < 5; i++) {
        if (eleveIndex < demoData.eleves.length) {
          const eleve = demoData.eleves[eleveIndex];
          
          // Générer un numéro d'élève unique
          const numeroEleve = `${new Date().getFullYear()}${String(eleveIndex + 1).padStart(4, '0')}`;
          
          const eleveData = {
            ...eleve,
            classe_id: classe.id,
            annee_scolaire_id: anneeScolaireId,
            numero_eleve: numeroEleve,
            active: true
          };
          
          const eleveId = await firestoreService.create('eleves', eleveData);
          eleveIds.push(eleveId);
          console.log(`✅ Élève créé: ${eleve.prenom} ${eleve.nom} (${classe.niveau})`);
          eleveIndex++;
        }
      }
    }
    
    // 5. Créer des absences aléatoires
    console.log("📋 Création des absences...");
    const currentUser = firebase.auth().currentUser;
    let totalAbsences = 0;
    
    for (const eleveId of eleveIds) {
      const absences = generateRandomAbsences(eleveId, anneeScolaireId, currentUser.uid);
      
      for (const absence of absences) {
        await firestoreService.create('absences_eleves', absence);
        totalAbsences++;
      }
    }
    
    console.log(`✅ ${totalAbsences} absences créées`);
    
    // 6. Activer l'année scolaire
    console.log("🎯 Activation de l'année scolaire...");
    await anneeScolaireService.setAnneeScolaireActive(anneeScolaireId);
    
    console.log("🎉 SUCCÈS ! Données de démonstration créées:");
    console.log(`📅 1 année scolaire: 2024-2025`);
    console.log(`👨‍🏫 ${enseignantIds.length} enseignants`);
    console.log(`🏫 ${classeIds.length} classes`);
    console.log(`👦👧 ${eleveIds.length} élèves`);
    console.log(`📋 ${totalAbsences} absences`);
    
    // Recharger la page pour voir les nouvelles données
    console.log("🔄 Rechargement de la page dans 3 secondes...");
    setTimeout(() => {
      window.location.reload();
    }, 3000);
    
  } catch (error) {
    console.error("❌ Erreur lors de la création des données:", error);
  }
}

// Instructions d'utilisation
console.log(`
🎯 INSTRUCTIONS POUR CRÉER LES DONNÉES DE DÉMONSTRATION

1. Copiez cette fonction entière
2. Ouvrez la console de développement (F12)
3. Naviguez vers votre application (connecté en tant que directeur)
4. Collez le code dans la console
5. Exécutez: createDemoData()

⚠️ ATTENTION: Assurez-vous d'être connecté en tant que directeur !

Pour exécuter maintenant, tapez: createDemoData()
`);

// Exporter la fonction
window.createDemoData = createDemoData;