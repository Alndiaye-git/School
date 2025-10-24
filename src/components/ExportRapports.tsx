import React, { useState, useEffect } from 'react';
import { anneeScolaireService } from '../services/anneeScolaire';
import { exportAbsencesService } from '../services/exportAbsences';
import { AnneeScolaire } from '../types/anneeScolaire';

const ExportRapports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [anneeScolaires, setAnneeScolaires] = useState<AnneeScolaire[]>([]);
  const [selectedAnneeId, setSelectedAnneeId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAnneeScolaires();
  }, []);

  const loadAnneeScolaires = async () => {
    try {
      const annees = await anneeScolaireService.getToutesLesAnneesScolaires();
      setAnneeScolaires(annees);

      // Sélectionner l'année active par défaut
      const anneeActive = annees.find((a: AnneeScolaire) => a.active);
      if (anneeActive) {
        setSelectedAnneeId(anneeActive.id);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des années scolaires:', error);
      setError('Erreur lors du chargement des années scolaires');
    }
  };

  const handleExportCSV = async () => {
    if (!selectedAnneeId) {
      setError('Veuillez sélectionner une année scolaire');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const csv = await exportAbsencesService.genererCSV(selectedAnneeId);
      const annee = anneeScolaires.find(a => a.id === selectedAnneeId);
      const filename = `Absences_${annee?.nom.replace('/', '-')}_${new Date().toISOString().split('T')[0]}.csv`;

      exportAbsencesService.telechargerCSV(csv, filename);
      setSuccess(`✅ Fichier CSV téléchargé : ${filename}`);
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      setError('Erreur lors de la génération du fichier CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleExportHTML = async () => {
    if (!selectedAnneeId) {
      setError('Veuillez sélectionner une année scolaire');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const html = await exportAbsencesService.genererRapportHTML(selectedAnneeId);

      // Ouvrir dans une nouvelle fenêtre pour impression
      exportAbsencesService.ouvrirPourImpression(html);
      setSuccess('✅ Rapport ouvert dans une nouvelle fenêtre. Vous pouvez l\'imprimer en PDF.');
    } catch (error) {
      console.error('Erreur lors de l\'export HTML:', error);
      setError('Erreur lors de la génération du rapport HTML');
    } finally {
      setLoading(false);
    }
  };

  const selectedAnnee = anneeScolaires.find(a => a.id === selectedAnneeId);

  return (
    <div className="export-rapports" style={{
      padding: '2rem',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      <div className="header" style={{
        marginBottom: '2rem',
        borderBottom: '2px solid #667eea',
        paddingBottom: '1rem'
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>
          📥 Export des Rapports d'Absences
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: '0.95rem'
        }}>
          Exportez les données d'absences en CSV ou générez un rapport imprimable
        </p>
      </div>

      {/* Sélection de l'année scolaire */}
      <div style={{
        backgroundColor: '#f9fafb',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        border: '1px solid #e5e7eb'
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '0.75rem'
        }}>
          Sélectionner l'année scolaire
        </label>
        <select
          value={selectedAnneeId}
          onChange={(e) => setSelectedAnneeId(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          <option value="">-- Choisir une année --</option>
          {anneeScolaires.map(annee => (
            <option key={annee.id} value={annee.id}>
              {annee.nom} {annee.active ? '(Année active)' : ''}
            </option>
          ))}
        </select>

        {selectedAnnee && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: '#1e40af'
          }}>
            <strong>Période :</strong> Du {new Date(selectedAnnee.dateDebut).toLocaleDateString('fr-FR')}
            {' '}au {new Date(selectedAnnee.dateFin).toLocaleDateString('fr-FR')}
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid #fecaca'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#d1fae5',
          color: '#065f46',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid #6ee7b7'
        }}>
          {success}
        </div>
      )}

      {/* Options d'export */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Export CSV */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '1rem'
          }}>📄</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: '0.75rem'
          }}>
            Export CSV
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
            lineHeight: '1.5'
          }}>
            Téléchargez un fichier CSV avec toutes les absences (demi-journées) de l'année.
            Idéal pour Excel ou Google Sheets.
          </p>
          <button
            onClick={handleExportCSV}
            disabled={loading || !selectedAnneeId}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading || !selectedAnneeId
                ? '#9ca3af'
                : 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading || !selectedAnneeId ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading && selectedAnneeId) {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? '⏳ Génération...' : '📥 Télécharger CSV'}
          </button>
        </div>

        {/* Export HTML/PDF */}
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '1rem'
          }}>🖨️</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: '0.75rem'
          }}>
            Rapport Imprimable
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
            lineHeight: '1.5'
          }}>
            Générez un rapport HTML détaillé, prêt à être imprimé ou sauvegardé en PDF.
            Inclut toutes les statistiques.
          </p>
          <button
            onClick={handleExportHTML}
            disabled={loading || !selectedAnneeId}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading || !selectedAnneeId
                ? '#9ca3af'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading || !selectedAnneeId ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading && selectedAnneeId) {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? '⏳ Génération...' : '🖨️ Générer Rapport'}
          </button>
        </div>
      </div>

      {/* Informations */}
      <div style={{
        backgroundColor: '#eff6ff',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid #bfdbfe'
      }}>
        <h4 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#1e40af',
          marginBottom: '0.75rem'
        }}>
          ℹ️ À propos des exports
        </h4>
        <ul style={{
          fontSize: '0.875rem',
          color: '#1e40af',
          lineHeight: '1.8',
          marginLeft: '1.25rem'
        }}>
          <li>
            <strong>Demi-journées :</strong> Les absences sont comptabilisées par demi-journée (matin ou après-midi)
          </li>
          <li>
            <strong>Calculs automatiques :</strong> Les taux d'absentéisme sont calculés automatiquement
          </li>
          <li>
            <strong>Fichier CSV :</strong> Contient les détails de chaque absence avec la période
          </li>
          <li>
            <strong>Rapport HTML :</strong> Vue d'ensemble complète avec statistiques par classe et par élève
          </li>
          <li>
            <strong>Sauvegarde PDF :</strong> Utilisez Ctrl+P (ou Cmd+P sur Mac) pour sauvegarder le rapport en PDF
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ExportRapports;
