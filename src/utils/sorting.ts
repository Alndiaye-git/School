import { Eleve } from '../types';

/**
 * Trie une liste d'élèves par nom de famille (ordre alphabétique français)
 * @param eleves - Liste des élèves à trier
 * @returns Liste triée par nom de famille
 */
export const sortElevesByNom = <T extends Eleve>(eleves: T[]): T[] => {
  return [...eleves].sort((a, b) => 
    a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' })
  );
};

/**
 * Trie une liste d'élèves par prénom (ordre alphabétique français)
 * @param eleves - Liste des élèves à trier
 * @returns Liste triée par prénom
 */
export const sortElevesByPrenom = <T extends Eleve>(eleves: T[]): T[] => {
  return [...eleves].sort((a, b) => 
    a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'accent' })
  );
};

/**
 * Trie une liste d'élèves par nom complet (nom puis prénom)
 * @param eleves - Liste des élèves à trier
 * @returns Liste triée par nom complet
 */
export const sortElevesByNomComplet = <T extends Eleve>(eleves: T[]): T[] => {
  return [...eleves].sort((a, b) => {
    const nomComparison = a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' });
    if (nomComparison !== 0) return nomComparison;
    return a.prenom.localeCompare(b.prenom, 'fr', { sensitivity: 'accent' });
  });
};