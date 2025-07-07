import * as XLSX from 'xlsx';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Eleve, Classe, AbsenceEleve } from '../types';
import { AnneeScolaire } from '../types/anneeScolaire';

interface AbsenceStats {
  eleve: Eleve;
  totalAbsences: number;
  absencesParMois: { [mois: string]: number };
  absencesParDate: { date: string; commentaire?: string }[];
}

interface RapportClasse {
  classe: Classe;
  absencesEleves: AbsenceStats[];
  totalAbsencesClasse: number;
  moyenneAbsencesEleve: number;
}

export class RapportFinAnneeService {
  
  /**
   * Génère le rapport de fin d'année pour toutes les classes
   */
  static async genererRapportFinAnnee(anneeScolaire: AnneeScolaire): Promise<{
    rapportExcel: Blob;
    donnees: RapportClasse[];
  }> {
    try {
      // Récupérer toutes les classes de l'année scolaire
      const classesQuery = query(
        collection(db, 'classes'),
        where('annee_scolaire_id', '==', anneeScolaire.id),
        where('active', '!=', false),
        orderBy('nom')
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classes: Classe[] = classesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Classe));

      const rapportsClasses: RapportClasse[] = [];

      // Traiter chaque classe
      for (const classe of classes) {
        const rapportClasse = await this.genererRapportClasse(classe, anneeScolaire);
        rapportsClasses.push(rapportClasse);
      }

      // Générer le fichier Excel
      const rapportExcel = await this.genererFichierExcel(rapportsClasses, anneeScolaire);

      return {
        rapportExcel,
        donnees: rapportsClasses
      };
    } catch (error) {
      console.error('Erreur lors de la génération du rapport de fin d\'année:', error);
      throw error;
    }
  }

  /**
   * Génère le rapport pour une classe spécifique
   */
  private static async genererRapportClasse(
    classe: Classe, 
    anneeScolaire: AnneeScolaire
  ): Promise<RapportClasse> {
    // Récupérer les élèves de la classe
    const elevesQuery = query(
      collection(db, 'eleves'),
      where('classe_id', '==', classe.id),
      where('annee_scolaire_id', '==', anneeScolaire.id),
      where('active', '!=', false),
      orderBy('nom'),
      orderBy('prenom')
    );
    const elevesSnapshot = await getDocs(elevesQuery);
    const eleves: Eleve[] = elevesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Eleve));

    const absencesEleves: AbsenceStats[] = [];
    let totalAbsencesClasse = 0;

    // Traiter chaque élève
    for (const eleve of eleves) {
      const absenceStats = await this.calculerAbsencesEleve(eleve, anneeScolaire);
      absencesEleves.push(absenceStats);
      totalAbsencesClasse += absenceStats.totalAbsences;
    }

    const moyenneAbsencesEleve = eleves.length > 0 ? totalAbsencesClasse / eleves.length : 0;

    return {
      classe,
      absencesEleves,
      totalAbsencesClasse,
      moyenneAbsencesEleve
    };
  }

  /**
   * Calcule les statistiques d'absence pour un élève
   */
  private static async calculerAbsencesEleve(
    eleve: Eleve, 
    anneeScolaire: AnneeScolaire
  ): Promise<AbsenceStats> {
    const absencesQuery = query(
      collection(db, 'absences_eleves'),
      where('eleve_id', '==', eleve.id),
      where('annee_scolaire_id', '==', anneeScolaire.id),
      orderBy('date')
    );
    const absencesSnapshot = await getDocs(absencesQuery);
    const absences: AbsenceEleve[] = absencesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AbsenceEleve));

    const absencesParMois: { [mois: string]: number } = {};
    const absencesParDate: { date: string; commentaire?: string }[] = [];

    absences.forEach(absence => {
      const date = new Date(absence.date);
      const moisCle = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      absencesParMois[moisCle] = (absencesParMois[moisCle] || 0) + 1;
      absencesParDate.push({
        date: absence.date,
        commentaire: absence.commentaire
      });
    });

    return {
      eleve,
      totalAbsences: absences.length,
      absencesParMois,
      absencesParDate
    };
  }

  /**
   * Génère le fichier Excel
   */
  private static async genererFichierExcel(
    rapportsClasses: RapportClasse[], 
    anneeScolaire: AnneeScolaire
  ): Promise<Blob> {
    const workbook = XLSX.utils.book_new();

    // Feuille de synthèse
    const synthese = this.creerFeuilleSynthese(rapportsClasses, anneeScolaire);
    XLSX.utils.book_append_sheet(workbook, synthese, 'Synthèse');

    // Une feuille par classe
    rapportsClasses.forEach(rapport => {
      const feuilleClasse = this.creerFeuilleClasse(rapport);
      const nomFeuille = rapport.classe.nom.substring(0, 31); // Limite Excel
      XLSX.utils.book_append_sheet(workbook, feuilleClasse, nomFeuille);
    });

    // Convertir en blob
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Crée la feuille de synthèse Excel
   */
  private static creerFeuilleSynthese(
    rapportsClasses: RapportClasse[], 
    anneeScolaire: AnneeScolaire
  ): XLSX.WorkSheet {
    const data = [
      ['RAPPORT DE FIN D\'ANNÉE SCOLAIRE'],
      ['Année scolaire:', anneeScolaire.nom],
      ['Date de génération:', new Date().toLocaleDateString('fr-FR')],
      [],
      ['SYNTHÈSE PAR CLASSE'],
      ['Classe', 'Nombre d\'élèves', 'Total absences', 'Moyenne par élève'],
      ...rapportsClasses.map(rapport => [
        rapport.classe.nom,
        rapport.absencesEleves.length,
        rapport.totalAbsencesClasse,
        Math.round(rapport.moyenneAbsencesEleve * 100) / 100
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Styling basique
    const range = XLSX.utils.decode_range(ws['!ref']!);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cell_address]) continue;
        
        if (R === 0 || R === 4) { // Titres
          ws[cell_address].s = { font: { bold: true } };
        }
      }
    }

    return ws;
  }

  /**
   * Crée la feuille détaillée pour une classe
   */
  private static creerFeuilleClasse(rapport: RapportClasse): XLSX.WorkSheet {
    const data = [
      [`CLASSE: ${rapport.classe.nom}`],
      [`Nombre d'élèves: ${rapport.absencesEleves.length}`],
      [`Total absences: ${rapport.totalAbsencesClasse}`],
      [`Moyenne par élève: ${Math.round(rapport.moyenneAbsencesEleve * 100) / 100}`],
      [],
      ['DÉTAIL PAR ÉLÈVE'],
      ['Nom', 'Prénom', 'Total absences', 'Dates d\'absence', 'Commentaires']
    ];

    rapport.absencesEleves.forEach(stats => {
      const datesAbsence = stats.absencesParDate.map(a => a.date).join(', ');
      const commentaires = stats.absencesParDate
        .filter(a => a.commentaire)
        .map(a => `${a.date}: ${a.commentaire}`)
        .join('; ');

      data.push([
        stats.eleve.nom,
        stats.eleve.prenom,
        stats.totalAbsences.toString(),
        datesAbsence,
        commentaires
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Ajuster les largeurs de colonnes
    const colWidths = [
      { wch: 15 }, // Nom
      { wch: 15 }, // Prénom
      { wch: 12 }, // Total absences
      { wch: 30 }, // Dates
      { wch: 40 }  // Commentaires
    ];
    ws['!cols'] = colWidths;

    return ws;
  }


  /**
   * Télécharge un fichier blob
   */
  static telechargerFichier(blob: Blob, nomFichier: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Génère le nom de fichier pour le rapport
   */
  static genererNomFichier(anneeScolaire: AnneeScolaire, extension: string): string {
    const dateGeneration = new Date().toISOString().split('T')[0];
    return `Rapport_Absences_${anneeScolaire.nom.replace('/', '-')}_${dateGeneration}.${extension}`;
  }
}