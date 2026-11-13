import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVehicles } from '../store/VehicleStore';
import type { Vehicle } from '../types';
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, X, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function Import() {
  const { importVehicles, vehicles } = useVehicles();
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [preview, setPreview] = useState<Partial<Vehicle>[]>([]);
  const [importCount, setImportCount] = useState(0);

  const createVehicleFromRow = (row: Record<string, unknown>): Partial<Vehicle> => {
    const get = (keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== '') return String(row[key]).trim();
        if (row[key.toUpperCase()] !== undefined && row[key.toUpperCase()] !== '') return String(row[key.toUpperCase()]).trim();
      }
      return '';
    };
    const getNum = (keys: string[]) => {
      const val = get(keys);
      return val ? Number(val) : 0;
    };

    return {
      numero_immatriculation: get(['numero_immatriculation', 'immatriculation', 'plaque', 'N° Immatriculation', 'N° immatriculation']),
      numero_carte_grise: get(['numero_carte_grise', 'carte_grise', 'N° Carte Grise']),
      nom_proprietaire: get(['nom_proprietaire', 'proprietaire', 'Nom du propriétaire', 'Propriétaire']),
      rdc: get(['rdc', 'RDC']),
      marque: get(['marque', 'Marque']),
      type_commercial: get(['type_commercial', 'modele', 'modèle', 'Type commercial', 'Modèle']),
      couleur: get(['couleur', 'Couleur']),
      carrosserie: get(['carrosserie', 'Carrosserie']),
      genre: get(['genre', 'Genre']),
      usage_vehicule: get(['usage_vehicule', 'usage', 'Usage du véhicule']),
      energie: get(['energie', 'énergie', 'Energie', 'Énergie']),
      places_assises: getNum(['places_assises', 'places', 'Places assises']),
      nombre_essieux: getNum(['nombre_essieux', 'essieux', 'Nombre d\'essieux']),
      cylindree_cc: getNum(['cylindree_cc', 'cylindree', 'cylindrée', 'Cylindrée']),
      puissance_fiscale_cv: getNum(['puissance_fiscale_cv', 'puissance_fiscale', 'Puissance fiscale']),
      ptac_kg: getNum(['ptac_kg', 'PTAC']),
      pv_kg: getNum(['pv_kg', 'PV']),
      cu_kg: getNum(['cu_kg', 'CU']),
      vin_chassis: get(['vin_chassis', 'vin', 'VIN', 'N° VIN/Chassis', 'VIN/Chassis']),
      numero_moteur: get(['numero_moteur', 'N° Moteur', 'Moteur']),
      type_technique: get(['type_technique', 'Type technique']),
      date_mise_circulation: get(['date_mise_circulation', 'date_circulation', 'Mise en circulation']),
      date_edition: get(['date_edition', 'Date d\'édition']),
      statut: (get(['statut', 'Statut']) || 'Actif') as 'Actif' | 'En maintenance' | 'Hors service' | 'Réformé',
      kilometrage: getNum(['kilometrage', 'km', 'Kilométrage']),
      date_achat: get(['date_achat', 'Date achat']),
      cout_achat: getNum(['cout_achat', 'cout', 'Coût achat', 'Prix']),
      date_assurance: get(['date_assurance', 'Assurance']),
      date_vignette: get(['date_vignette', 'Vignette']),
      cout_assurance_annuel: getNum(['cout_assurance', 'Assurance_annuel', 'Coût assurance']),
      affectation: get(['affectation', 'Affectation', 'Service']),
      conducteur: get(['conducteur', 'Conducteur', 'Chauffeur']),
      observations: get(['observations', 'notes', 'Observations']),
    };
  };

  const processFile = async (file: File) => {
    setImportStatus('processing');
    setImportMessage('Traitement du fichier...');
    setPreview([]);
    setImportCount(0);

    try {
      let data: Record<string, unknown>[] = [];

      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = result.data as Record<string, unknown>[];
      } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
      } else if (file.name.endsWith('.pdf')) {
        setImportStatus('error');
        setImportMessage('L\'import de fichiers PDF n\'est pas directement supporté. Veuillez convertir le PDF en CSV ou Excel d\'abord, ou saisir manuellement les données.');
        return;
      } else {
        setImportStatus('error');
        setImportMessage('Format de fichier non supporté. Utilisez .csv, .xls ou .xlsx.');
        return;
      }

      if (data.length === 0) {
        setImportStatus('error');
        setImportMessage('Aucune donnée trouvée dans le fichier.');
        return;
      }

      // Transform data
      const transformed = data.map(createVehicleFromRow);

      // Count how many are new
      const existingPlates = new Set(vehicles.map((v) => v.numero_immatriculation));
      const newVehicles = transformed.filter(
        (v) => v.numero_immatriculation && !existingPlates.has(v.numero_immatriculation)
      );

      setPreview(transformed.slice(0, 5));
      setImportCount(newVehicles.length);

      if (newVehicles.length === 0) {
        setImportStatus('error');
        setImportMessage('Tous les véhicules du fichier existent déjà dans la base de données.');
      } else {
        setImportStatus('success');
        setImportMessage(`${newVehicles.length} nouveau(x) véhicule(s) trouvé(s) sur ${transformed.length} ligne(s).`);
      }
    } catch (err) {
      setImportStatus('error');
      setImportMessage('Erreur lors du traitement du fichier: ' + (err as Error).message);
    }
  };

  const handleImport = () => {
    const existingPlates = new Set(vehicles.map((v) => v.numero_immatriculation));
    const validVehicles: Vehicle[] = preview
      .filter((v) => v.numero_immatriculation && !existingPlates.has(v.numero_immatriculation))
      .map((v, i) => ({
        ...v,
        id: 'v' + Date.now() + '_' + i,
        statut: (v.statut as Vehicle['statut']) || 'Actif',
        kilometrage: v.kilometrage || 0,
        cout_achat: v.cout_achat || 0,
        cout_assurance_annuel: v.cout_assurance_annuel || 0,
        places_assises: v.places_assises || 5,
        nombre_essieux: v.nombre_essieux || 2,
        cylindree_cc: v.cylindree_cc || 0,
        puissance_fiscale_cv: v.puissance_fiscale_cv || 0,
        ptac_kg: v.ptac_kg || 0,
        pv_kg: v.pv_kg || 0,
        cu_kg: v.cu_kg || 0,
      }) as Vehicle);

    importVehicles(validVehicles);
    setImportStatus('success');
    setImportMessage(`${validVehicles.length} véhicule(s) importé(s) avec succès!`);
    setPreview([]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'numero_immatriculation', 'numero_carte_grise', 'nom_proprietaire', 'rdc',
      'marque', 'type_commercial', 'couleur', 'carrosserie', 'genre',
      'usage_vehicule', 'energie', 'places_assises', 'nombre_essieux',
      'cylindree_cc', 'puissance_fiscale_cv', 'ptac_kg', 'vin_chassis',
      'numero_moteur', 'type_technique', 'date_mise_circulation', 'date_edition',
      'statut', 'kilometrage', 'date_achat', 'cout_achat',
      'date_assurance', 'date_vignette', 'cout_assurance_annuel',
      'affectation', 'conducteur', 'observations',
    ];
    const sample = [
      'AA-000-XX', 'CG00000001', 'ENTREPRISE EXEMPLE', 'CIABJ0000000000001',
      'TOYOTA', 'RAV4', 'NOIR', 'SUV', 'Voiture',
      'Commercial', 'Diesel', '5', '2',
      '2494', '14', '0', 'JTMDFREV50D012345',
      '2AR-0567890', 'GB001', '2023-01-15', '2023-01-20',
      'Actif', '50000', '2023-01-15', '18500000',
      '2025-01-15', '2025-01-31', '620000',
      'Logistique', 'Jean Dupont', 'Exemple',
    ];
    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_vehicules.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <Link to="/vehicules" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste des véhicules
        </Link>
        <h2 className="text-2xl font-bold text-slate-900">Importer des Données</h2>
        <p className="mt-1 text-sm text-slate-500">
          Importez vos véhicules depuis un fichier CSV, Excel (.xls/.xlsx). Les fichiers PDF doivent être convertis au préalable.
        </p>
      </div>

      {/* Upload Area */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">Téléverser un fichier</h3>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragActive
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <Upload className={`mx-auto h-12 w-12 ${dragActive ? 'text-emerald-500' : 'text-slate-400'}`} />
          <p className="mt-4 text-lg font-semibold text-slate-700">
            {dragActive ? 'Déposez le fichier ici' : 'Glissez-déposez un fichier ici'}
          </p>
          <p className="mt-2 text-sm text-slate-500">ou cliquez pour parcourir</p>
          <div className="mt-4 flex justify-center gap-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <FileSpreadsheet className="h-3 w-3" /> .csv
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <FileText className="h-3 w-3" /> .xls
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <FileText className="h-3 w-3" /> .xlsx
            </span>
          </div>
        </div>

        {/* Download Template */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-600">Pas sûr du format ? Téléchargez le modèle.</p>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Télécharger le modèle CSV
          </button>
        </div>
      </div>

      {/* Status */}
      {importStatus !== 'idle' && (
        <div
          className={`rounded-xl border p-4 ${
            importStatus === 'success' ? 'border-green-200 bg-green-50' :
            importStatus === 'error' ? 'border-red-200 bg-red-50' :
            'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-center gap-3">
            {importStatus === 'success' && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />}
            {importStatus === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />}
            {importStatus === 'processing' && <Upload className="h-5 w-5 flex-shrink-0 animate-spin text-blue-600" />}
            <p className={`text-sm font-medium ${
              importStatus === 'success' ? 'text-green-800' :
              importStatus === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {importMessage}
            </p>
          </div>

          {/* Import Action */}
          {importStatus === 'success' && importCount > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleImport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Importer {importCount} véhicule(s)
              </button>
              <button
                onClick={() => { setImportStatus('idle'); setPreview([]); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-800">Aperçu des données ({preview.length} premières lignes)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Immatriculation</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Marque</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Modèle</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Couleur</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Énergie</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Statut</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Conducteur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm font-medium text-emerald-600">{row.numero_immatriculation || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{row.marque || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{row.type_commercial || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{row.couleur || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{row.energie || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{row.statut || 'Actif'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{row.conducteur || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-800">Instructions d'import</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Formats supportés</h4>
            <ul className="space-y-1 text-sm text-slate-600">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> CSV (séparé par des virgules)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Excel (.xls, .xlsx)</li>
              <li className="flex items-center gap-2"><X className="h-4 w-4 text-red-400" /> PDF (convertir d'abord)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Champs recommandés</h4>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>• <strong>numero_immatriculation</strong> (obligatoire)</li>
              <li>• marque, type_commercial, couleur</li>
              <li>• energie, cylindree_cc, puissance_fiscale_cv</li>
              <li>• vin_chassis, numero_moteur</li>
              <li>• kilometrage, statut, affectation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
