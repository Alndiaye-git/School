import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { AbsenceEleve, Eleve, Classe } from '../types';
import { AnneeScolaire } from '../types/anneeScolaire';
// Note: xlsx doit être installé avec npm install xlsx
// import * as XLSX from 'xlsx';

export interface AbsenceExportData {
  eleve: Eleve;
  classe: Classe;
  absences: AbsenceEleve[];
  totalAbsences: number;
  tauxAbsenteisme: number;
}

export interface RapportAnnuelData {
  anneeScolaire: AnneeScolaire;
  classes: {
    classe: Classe;
    eleves: AbsenceExportData[];
    totalAbsencesClasse: number;
    tauxMoyenClasse: number;
  }[];
  totalAbsencesAnnee: number;
  totalElevesAnnee: number;
  tauxMoyenAnnee: number;
  dateGeneration: string;
}

export class ExportAbsencesService {

  /**
   * Génère les données d'export pour une année scolaire
   */
  async genererDonneesExport(anneeScolaireId: string): Promise<RapportAnnuelData> {
    try {
      // Récupérer l'année scolaire
      const anneeScolaireQuery = query(
        collection(db, 'annees_scolaires'),
        where('__name__', '==', anneeScolaireId)
      );
      const anneeScolaireSnapshot = await getDocs(anneeScolaireQuery);
      
      if (anneeScolaireSnapshot.empty) {
        throw new Error('Année scolaire non trouvée');
      }
      
      const anneeScolaire = { 
        id: anneeScolaireSnapshot.docs[0].id, 
        ...anneeScolaireSnapshot.docs[0].data() 
      } as AnneeScolaire;

      // Récupérer toutes les classes de l'année
      const classesQuery = query(
        collection(db, 'classes'),
        where('annee_scolaire_id', '==', anneeScolaireId),
        where('active', '!=', false),
        orderBy('active'),
        orderBy('nom')
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classes = classesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Classe));

      // Récupérer tous les élèves de l'année
      const elevesQuery = query(
        collection(db, 'eleves'),
        where('annee_scolaire_id', '==', anneeScolaireId),
        where('active', '!=', false),
        orderBy('active'),
        orderBy('nom'),
        orderBy('prenom')
      );
      const elevesSnapshot = await getDocs(elevesQuery);
      const eleves = elevesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Eleve));

      // Récupérer toutes les absences de l'année
      const absencesQuery = query(
        collection(db, 'absences_eleves'),
        where('date', '>=', anneeScolaire.dateDebut),
        where('date', '<=', anneeScolaire.dateFin),
        orderBy('date', 'desc')
      );
      const absencesSnapshot = await getDocs(absencesQuery);
      const absences = absencesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AbsenceEleve));

      // Calculer les jours ouvrables de l'année
      const joursOuvrables = await this.calculerJoursOuvrables(anneeScolaire);

      // Organiser les données par classe
      const classesData = await Promise.all(classes.map(async (classe) => {
        const elevesClasse = eleves.filter(e => e.classe_id === classe.id);
        
        const elevesData: AbsenceExportData[] = elevesClasse.map(eleve => {
          const absencesEleve = absences.filter(a => a.eleve_id === eleve.id);
          const totalAbsences = absencesEleve.length; // Nombre de demi-journées d'absence
          const totalDemiJournees = joursOuvrables * 2; // Multiplier par 2 pour les demi-journées
          const tauxAbsenteisme = totalDemiJournees > 0 ?
            Math.round((totalAbsences / totalDemiJournees) * 10000) / 100 : 0;

          return {
            eleve,
            classe,
            absences: absencesEleve,
            totalAbsences,
            tauxAbsenteisme
          };
        });

        const totalAbsencesClasse = elevesData.reduce((sum, e) => sum + e.totalAbsences, 0);
        const tauxMoyenClasse = elevesData.length > 0 ? 
          Math.round((elevesData.reduce((sum, e) => sum + e.tauxAbsenteisme, 0) / elevesData.length) * 100) / 100 : 0;

        return {
          classe,
          eleves: elevesData,
          totalAbsencesClasse,
          tauxMoyenClasse
        };
      }));

      // Calculer les totaux de l'année
      const totalAbsencesAnnee = classesData.reduce((sum, c) => sum + c.totalAbsencesClasse, 0);
      const totalElevesAnnee = eleves.length;
      const tauxMoyenAnnee = classesData.length > 0 ? 
        Math.round((classesData.reduce((sum, c) => sum + c.tauxMoyenClasse, 0) / classesData.length) * 100) / 100 : 0;

      return {
        anneeScolaire,
        classes: classesData,
        totalAbsencesAnnee,
        totalElevesAnnee,
        tauxMoyenAnnee,
        dateGeneration: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erreur lors de la génération des données d\'export:', error);
      throw error;
    }
  }

  /**
   * Génère un fichier CSV avec les données d'absences
   */
  async genererCSV(anneeScolaireId: string): Promise<string> {
    const data = await this.genererDonneesExport(anneeScolaireId);

    let csv = 'Classe,Élève (Nom),Élève (Prénom),Numéro Élève,Demi-journées d\'absence,Taux Absentéisme (%),Détail des Absences\n';

    data.classes.forEach(classeData => {
      classeData.eleves.forEach(eleveData => {
        const detailAbsences = eleveData.absences
          .map(abs => {
            const date = new Date(abs.date).toLocaleDateString('fr-FR');
            const periode = abs.periode === 'matin' ? 'Matin' : 'Après-midi';
            return `${date} (${periode})`;
          })
          .join('; ');

        csv += `"${classeData.classe.nom}","${eleveData.eleve.nom}","${eleveData.eleve.prenom}","${eleveData.eleve.numero_eleve || ''}",${eleveData.totalAbsences},${eleveData.tauxAbsenteisme},"${detailAbsences}"\n`;
      });
    });

    return csv;
  }

  /**
   * Génère un fichier Excel avec les données d'absences
   * Note: Nécessite l'installation de la librairie xlsx (npm install xlsx)
   */
  async genererExcel(anneeScolaireId: string): Promise<Blob> {
    const data = await this.genererDonneesExport(anneeScolaireId);
    
    // Simulation de génération Excel en attendant l'installation de xlsx
    // TODO: Remplacer par une vraie génération Excel avec XLSX
    const csvContent = await this.genererCSV(anneeScolaireId);
    
    // Pour l'instant, on retourne un CSV avec le bon type MIME Excel
    const blob = new Blob([csvContent], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    return blob;
  }

  /**
   * Génère un vrai fichier Excel (quand xlsx sera installé)
   */
  private async genererVraiExcel(data: RapportAnnuelData): Promise<Blob> {
    // Code pour quand xlsx sera disponible :
    /*
    const workbook = XLSX.utils.book_new();
    
    // Onglet résumé
    const resumeData = [
      ['Rapport d\'Absences Scolaires'],
      ['Année Scolaire', data.anneeScolaire.nom],
      ['Période', `Du ${new Date(data.anneeScolaire.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(data.anneeScolaire.dateFin).toLocaleDateString('fr-FR')}`],
      [''],
      ['RÉSUMÉ GÉNÉRAL'],
      ['Total élèves', data.totalElevesAnnee],
      ['Total absences', data.totalAbsencesAnnee],
      ['Taux moyen d\'absentéisme', `${data.tauxMoyenAnnee}%`],
      ['Date de génération', new Date(data.dateGeneration).toLocaleDateString('fr-FR')]
    ];
    
    const resumeWorksheet = XLSX.utils.aoa_to_sheet(resumeData);
    XLSX.utils.book_append_sheet(workbook, resumeWorksheet, 'Résumé');
    
    // Onglet détaillé par classe
    const detailData = [['Classe', 'Nom', 'Prénom', 'N° Élève', 'Total Absences', 'Taux (%)', 'Dates d\'absence']];
    
    data.classes.forEach(classeData => {
      classeData.eleves.forEach(eleveData => {
        const datesAbsences = eleveData.absences
          .map(abs => new Date(abs.date).toLocaleDateString('fr-FR'))
          .join(', ');
        
        detailData.push([
          classeData.classe.nom,
          eleveData.eleve.nom,
          eleveData.eleve.prenom,
          eleveData.eleve.numero_eleve || '',
          eleveData.totalAbsences,
          eleveData.tauxAbsenteisme,
          datesAbsences
        ]);
      });
    });
    
    const detailWorksheet = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Détail par élève');
    
    // Onglet par classe
    data.classes.forEach(classeData => {
      const classeSheetData = [
        [`Classe ${classeData.classe.nom} (${classeData.classe.niveau})`],
        ['Effectif', classeData.eleves.length],
        ['Total absences', classeData.totalAbsencesClasse],
        ['Taux moyen', `${classeData.tauxMoyenClasse}%`],
        [''],
        ['Nom', 'Prénom', 'N° Élève', 'Total Absences', 'Taux (%)', 'Dates d\'absence']
      ];
      
      classeData.eleves.forEach(eleveData => {
        const datesAbsences = eleveData.absences
          .map(abs => new Date(abs.date).toLocaleDateString('fr-FR'))
          .join(', ');
        
        classeSheetData.push([
          eleveData.eleve.nom,
          eleveData.eleve.prenom,
          eleveData.eleve.numero_eleve || '',
          eleveData.totalAbsences,
          eleveData.tauxAbsenteisme,
          datesAbsences
        ]);
      });
      
      const classeWorksheet = XLSX.utils.aoa_to_sheet(classeSheetData);
      XLSX.utils.book_append_sheet(workbook, classeWorksheet, classeData.classe.nom);
    });
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    */
    
    // Placeholder - retourne un CSV pour l'instant
    const csvContent = await this.genererCSV(data.anneeScolaire.id);
    return new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Génère un rapport HTML pour impression PDF
   */
  async genererRapportHTML(anneeScolaireId: string): Promise<string> {
    const data = await this.genererDonneesExport(anneeScolaireId);
    
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Absences - ${data.anneeScolaire.nom}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 15px; margin-bottom: 30px; border-radius: 5px; }
        .classe-section { margin-bottom: 40px; page-break-inside: avoid; }
        .classe-title { background: #333; color: white; padding: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #666; }
        @media print { 
            .classe-section { page-break-inside: avoid; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rapport d'Absences Scolaires</h1>
        <h2>Année ${data.anneeScolaire.nom}</h2>
        <p>Du ${new Date(data.anneeScolaire.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(data.anneeScolaire.dateFin).toLocaleDateString('fr-FR')}</p>
    </div>

    <div class="summary">
        <h3>📊 Résumé de l'année</h3>
        <p><strong>Total élèves :</strong> ${data.totalElevesAnnee}</p>
        <p><strong>Total demi-journées d'absence :</strong> ${data.totalAbsencesAnnee}</p>
        <p><strong>Taux moyen d'absentéisme :</strong> ${data.tauxMoyenAnnee}%</p>
        <p><strong>Note :</strong> Chaque jour compte pour 2 demi-journées (matin + après-midi)</p>
        <p><strong>Rapport généré le :</strong> ${new Date(data.dateGeneration).toLocaleDateString('fr-FR')} à ${new Date(data.dateGeneration).toLocaleTimeString('fr-FR')}</p>
    </div>

    ${data.classes.map(classeData => `
    <div class="classe-section">
        <div class="classe-title">
            <h3>📚 Classe ${classeData.classe.nom} (${classeData.classe.niveau})</h3>
        </div>
        
        <p><strong>Effectif :</strong> ${classeData.eleves.length} élèves |
           <strong>Total demi-journées d'absence :</strong> ${classeData.totalAbsencesClasse} |
           <strong>Taux moyen :</strong> ${classeData.tauxMoyenClasse}%</p>

        <table>
            <thead>
                <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>N° Élève</th>
                    <th class="text-center">Demi-journées d'absence</th>
                    <th class="text-center">Taux (%)</th>
                    <th>Dates d'absence (avec période)</th>
                </tr>
            </thead>
            <tbody>
                ${classeData.eleves.map(eleveData => `
                <tr>
                    <td>${eleveData.eleve.nom}</td>
                    <td>${eleveData.eleve.prenom}</td>
                    <td class="text-center">${eleveData.eleve.numero_eleve || 'N/A'}</td>
                    <td class="text-center">${eleveData.totalAbsences}</td>
                    <td class="text-center">${eleveData.tauxAbsenteisme}%</td>
                    <td>${eleveData.absences.map(abs => {
                      const date = new Date(abs.date).toLocaleDateString('fr-FR');
                      const periode = abs.periode === 'matin' ? 'Matin' : 'Après-midi';
                      return `${date} (${periode})`;
                    }).join(', ')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    `).join('')}

    <div class="footer">
        <p>Rapport généré automatiquement par le système de gestion des absences scolaires</p>
        <p>Document d'archive - Année ${data.anneeScolaire.nom}</p>
    </div>
</body>
</html>`;
    
    return html;
  }

  /**
   * Télécharge un fichier CSV
   */
  telechargerCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Télécharge un fichier HTML (pour impression PDF)
   */
  telechargerHTML(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Ouvre le rapport HTML dans une nouvelle fenêtre pour impression
   */
  ouvrirPourImpression(content: string) {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(content);
      newWindow.document.close();
      // Lancer automatiquement l'impression
      newWindow.onload = () => {
        newWindow.print();
      };
    }
  }

  /**
   * Calcule le nombre de jours ouvrables approximatif
   */
  private async calculerJoursOuvrables(anneeScolaire: AnneeScolaire): Promise<number> {
    const dateDebut = new Date(anneeScolaire.dateDebut);
    const dateFin = new Date(anneeScolaire.dateFin);
    
    let totalJours = 0;
    const currentDate = new Date(dateDebut);
    
    while (currentDate <= dateFin) {
      const dayOfWeek = currentDate.getDay();
      // Compter seulement les jours de semaine (lundi à vendredi)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalJours++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Soustraire approximativement les vacances (à ajuster selon le calendrier)
    const vacancesApproximatives = Math.floor(totalJours * 0.15); // 15% de vacances
    return Math.max(totalJours - vacancesApproximatives, 1);
  }
}

export const exportAbsencesService = new ExportAbsencesService();