import { useMemo, useState } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import type { PneumatiqueRecord, SeuilAlertePneu } from '../types/pneumatique';
import { PNEU_DIMENSIONS, PNEU_MARQUES } from '../types/pneumatique';
import { parseSpreadsheetFile, getCell, parseAmount, exportRowsToExcel } from '../utils/importExport';
import SelectWithOther from './SelectWithOther';
import {
  AlertTriangle, Plus, Printer, Search,
  Trash2, X, Gauge, DollarSign, AlertCircle, Upload, Download, CheckSquare, Square, Ruler, RefreshCw, Pencil,
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import SearchableSelect from './SearchableSelect';
import SortDateButton, { type SortOrder } from './SortDateButton';

const SEUIL_DEFAUT: SeuilAlertePneu = { usureMinimale_mm: 1.6, kmMaxParJeu: 60000, coutBudgetMensuel: 2000000 };

const ETAT_COLORS: Record<string, string> = {
  Bon: 'bg-green-100 text-green-700',
  'Usure modérée': 'bg-amber-100 text-amber-700',
  'À remplacer': 'bg-red-100 text-red-700',
  Remplacé: 'bg-slate-100 text-slate-600',
};

const POSITION_LABEL: Record<string, string> = {
  AVG: 'Avant Gauche', AVD: 'Avant Droit', ARG: 'Arrière Gauche', ARD: 'Arrière Droit', Secours: 'Secours',
  'Paire de 2': 'Paire de 2 (essieu)', 'Paire de 4': 'Paire de 4 (train complet)',
};
const ETATS: PneumatiqueRecord['etat'][] = ['Bon', 'Usure modérée', 'À remplacer', 'Remplacé'];
const filterSelCls = 'mt-1 block w-full min-w-[110px] rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] font-normal normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none';

// L'état d'un pneu est automatique, calculé à partir des 2 seuils d'alerte (usure minimale
// et km max par jeu) comparés aux informations réelles du pneu — sauf s'il a été marqué
// manuellement "Remplacé" (état terminal qui n'est plus recalculé).
// Bon : aucun des 2 seuils dépassé · Usure modérée : un seul seuil dépassé · À remplacer : les 2.
function calcEtat(p: PneumatiqueRecord, seuil: SeuilAlertePneu): PneumatiqueRecord['etat'] {
  if (p.etat === 'Remplacé') return 'Remplacé';
  const kmParcourus = p.km_actuel ? p.km_actuel - p.km_montage : 0;
  const usureDepassee = (p.usure_mm ?? 99) <= seuil.usureMinimale_mm;
  const kmDepasse = kmParcourus >= seuil.kmMaxParJeu;
  if (usureDepassee && kmDepasse) return 'À remplacer';
  if (usureDepassee || kmDepasse) return 'Usure modérée';
  return 'Bon';
}

// Retourne le kilométrage le plus récemment saisi pour un véhicule, tous menus confondus
// (fiche véhicule, entretiens, dépenses) : le kilométrage augmentant toujours, la valeur la
// plus élevée correspond à la saisie la plus récente. Utilisé pour préremplir "Km actuel"
// automatiquement dans la fiche pneu.
function useLatestKmByVehicle() {
  const { vehicles, maintenanceRecords, expenseRecords } = useVehicles();
  return useMemo(() => {
    const map = new Map<string, number>();
    vehicles.forEach(v => map.set(v.id, v.kilometrage || 0));
    maintenanceRecords.forEach(m => {
      if (m.kilometrage && m.kilometrage > (map.get(m.vehicleId) || 0)) map.set(m.vehicleId, m.kilometrage);
    });
    expenseRecords.forEach(e => {
      if (e.kilometrage_entretien && e.kilometrage_entretien > (map.get(e.vehicleId) || 0)) map.set(e.vehicleId, e.kilometrage_entretien);
    });
    return map;
  }, [vehicles, maintenanceRecords, expenseRecords]);
}

export default function Pneumatique() {
  const { vehicles, pneus, setPneus } = useVehicles();
  const [showForm, setShowForm] = useState(false);
  const [editPneu, setEditPneu] = useState<PneumatiqueRecord | undefined>();
  const [search, setSearch] = usePersistedState('fleetgest_filter_pneus_search', '');
  const [seuil, setSeuil] = usePersistedState<SeuilAlertePneu>('fleetgest_filter_pneus_seuil', SEUIL_DEFAUT);
  const [periodFrom, setPeriodFrom] = usePersistedState('fleetgest_filter_pneus_from', '');
  const [periodTo, setPeriodTo] = usePersistedState('fleetgest_filter_pneus_to', '');
  // Critères activables, sur le même principe que le "Plan de réforme" : chaque critère
  // coché restreint la liste (intersection ET). Aucun critère coché = tous les pneus affichés.
  const [usureEnabled, setUsureEnabled] = usePersistedState('fleetgest_filter_pneus_usure_on', false);
  const [kmEnabled, setKmEnabled] = usePersistedState('fleetgest_filter_pneus_km_on', false);
  const [sortOrder, setSortOrder] = usePersistedState<SortOrder>('fleetgest_sort_pneus_date', 'desc');
  const [importMessage, setImportMessage] = useState('');
  const [preview, setPreview] = useState<PneumatiqueRecord[]>([]);
  // Filtres des colonnes « Position » et « État » du tableau ('' = toutes les valeurs)
  const [positionFilter, setPositionFilter] = usePersistedState('fleetgest_filter_pneus_position', '');
  const [etatFilter, setEtatFilter] = usePersistedState('fleetgest_filter_pneus_etat', '');

  const latestKmByVehicle = useLatestKmByVehicle();
  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

  // Pneus avec leur état recalculé automatiquement à partir des seuils actuels.
  const pneusWithEtat = useMemo(
    () => pneus.map(p => ({ ...p, etat: calcEtat(p, seuil) })),
    [pneus, seuil]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pneusWithEtat.filter(p => {
      const v = vehicleById.get(p.vehicleId);
      const matchSearch = !q || p.marque.toLowerCase().includes(q) || p.modele.toLowerCase().includes(q) ||
        p.dimension.includes(q) || v?.numero_immatriculation.toLowerCase().includes(q);
      const matchFrom = !periodFrom || p.date_montage >= periodFrom;
      const matchTo = !periodTo || p.date_montage <= periodTo;
      // Critères "seuil d'alerte" : un pneu est concerné par un critère coché s'il en
      // dépasse le seuil (même logique que calcEtat, exposée ici par critère individuel).
      const kmParcourus = p.km_actuel ? p.km_actuel - p.km_montage : 0;
      const usureDepassee = (p.usure_mm ?? 99) <= seuil.usureMinimale_mm;
      const kmDepasse = kmParcourus >= seuil.kmMaxParJeu;
      const matchUsure = !usureEnabled || usureDepassee;
      const matchKm = !kmEnabled || kmDepasse;
      const matchPosition = !positionFilter || p.position === positionFilter;
      const matchEtat = !etatFilter || p.etat === etatFilter;
      return matchSearch && matchFrom && matchTo && matchUsure && matchKm && matchPosition && matchEtat;
    }).sort((a, b) => sortOrder === 'asc' ? a.date_montage.localeCompare(b.date_montage) : b.date_montage.localeCompare(a.date_montage));
  }, [pneusWithEtat, search, vehicleById, periodFrom, periodTo, usureEnabled, kmEnabled, seuil, sortOrder, positionFilter, etatFilter]);

  // Valeurs déjà saisies (marque, dimension, modèle, fournisseur) : reproposées dans le formulaire
  const knownMarques = useMemo(() => mergeSuggestions(PNEU_MARQUES, pneus.map(p => p.marque)), [pneus]);
  const knownDimensions = useMemo(() => mergeSuggestions(PNEU_DIMENSIONS, pneus.map(p => p.dimension)), [pneus]);
  const knownFournisseurs = useMemo(() => mergeSuggestions([], pneus.map(p => p.fournisseur)), [pneus]);
  const knownModeles = useMemo(() => {
    const seen = new Set<string>(); const out: { marque: string; modele: string }[] = [];
    pneus.forEach(p => { const mo = (p.modele || '').trim(); if (!mo) return; const k = `${(p.marque || '').trim().toLowerCase()}|${mo.toLowerCase()}`; if (!seen.has(k)) { seen.add(k); out.push({ marque: p.marque || '', modele: mo }); } });
    return out;
  }, [pneus]);


  const noCriteria = !usureEnabled && !kmEnabled;
  const colFilterActive = !!positionFilter || !!etatFilter;
  const listeFiltree = !noCriteria || colFilterActive; // la liste affichée est restreinte (graphiques compris)
  // Effectifs par valeur (sur l'ensemble des pneus), affichés dans les listes de filtre
  const countByPosition = (pos: string) => pneusWithEtat.filter(x => x.position === pos).length;
  const countByEtat = (et: string) => pneusWithEtat.filter(x => x.etat === et).length;

  // Les cases KPI (en haut) reflètent toujours la FLOTTE ENTIÈRE, quels que soient les
  // critères cochés — seuls les graphiques et le tableau du bas suivent le filtre.
  const stats = useMemo(() => {
    const totalFlotte = vehicles.length * 5;
    const aRemplacer = pneusWithEtat.filter(p => p.etat === 'À remplacer').length;
    const usureModeree = pneusWithEtat.filter(p => p.etat === 'Usure modérée').length;
    const coutTotal = pneusWithEtat.reduce((s, p) => s + p.cout_unitaire + (p.main_oeuvre || 0), 0);
    const withKm = pneusWithEtat.filter(p => p.km_actuel && p.km_montage);
    const kmMoyen = withKm.length > 0
      ? Math.round(withKm.reduce((s, p) => s + ((p.km_actuel || 0) - p.km_montage), 0) / withKm.length)
      : 0;
    const coutPar1000km = kmMoyen > 0 ? Math.round((coutTotal / kmMoyen) * 1000) : 0;
    return { totalFlotte, aRemplacer, usureModeree, coutTotal, kmMoyen, coutPar1000km };
  }, [pneusWithEtat, vehicles]);

  // Graphiques : les 2 déjà existants suivent la liste filtrée (comme demandé) ; la
  // répartition par marque (nombre de pneus, pas coût) porte elle sur la flotte entière.
  const etatDistribution = useMemo(() => {
    const counts: Record<string, number> = { Bon: 0, 'Usure modérée': 0, 'À remplacer': 0, Remplacé: 0 };
    filtered.forEach(p => { counts[p.etat] = (counts[p.etat] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const marqueDistributionFlotte = useMemo(() => {
    const counts = new Map<string, number>();
    pneusWithEtat.forEach(p => counts.set(p.marque, (counts.get(p.marque) || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [pneusWithEtat]);

  // Détail par véhicule : justifie le total théorique de la flotte (véhicules × 5) en
  // montrant combien de pneus sont réellement enregistrés pour chacun.
  const fleetTireDetail = useMemo(() => {
    return vehicles.map(v => {
      const tires = pneusWithEtat.filter(p => p.vehicleId === v.id);
      const positions = new Set(tires.map(t => t.position));
      const missing = (['AVG', 'AVD', 'ARG', 'ARD', 'Secours'] as const).filter(p => !positions.has(p));
      return { vehicle: v, tires, missing };
    }).sort((a, b) => a.tires.length - b.tires.length);
  }, [vehicles, pneusWithEtat]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];
  const MARQUE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16', '#a855f7'];

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cet enregistrement pneu ?')) return;
    setPneus(pneus.filter(p => p.id !== id));
  };

  const handleSave = (data: Omit<PneumatiqueRecord, 'id'>, id?: string) => {
    if (id) {
      setPneus(pneus.map(p => p.id === id ? { ...p, ...data } : p));
    } else {
      setPneus([...pneus, { ...data, id: 'pn' + Date.now() }]);
    }
    setShowForm(false);
    setEditPneu(undefined);
  };

  const exportToExcel = () => {
    const rows = filtered.map(p => {
      const v = vehicleById.get(p.vehicleId);
      return {
        'Véhicule': v?.numero_immatriculation || 'Inconnu',
        'Position': POSITION_LABEL[p.position] || p.position,
        'Marque': p.marque,
        'Modèle': p.modele,
        'Dimension': p.dimension,
        'Date montage': p.date_montage,
        'Km montage': p.km_montage,
        'Km actuel': p.km_actuel || '',
        'Usure (mm)': p.usure_mm ?? '',
        'État': p.etat,
        'Coût unitaire (FCFA)': p.cout_unitaire,
        'Main d\'œuvre (FCFA)': p.main_oeuvre,
        'Fournisseur': p.fournisseur,
        'Observations': p.observations,
      };
    });
    exportRowsToExcel(rows, 'gestion_pneumatiques.xlsx', 'Pneumatiques');
  };

  const buildPneuFromRow = (row: Record<string, unknown>, index: number): PneumatiqueRecord | null => {
    const plate = getCell(row, ['immatriculation', 'numero_immatriculation', 'plaque', 'vehicule', 'véhicule']);
    const vehicle = vehicles.find((v) => v.numero_immatriculation.toLowerCase() === plate.toLowerCase());
    if (!vehicle) return null;
    const dimension = getCell(row, ['dimension']) || PNEU_DIMENSIONS[0];
    const kmMontage = parseAmount(getCell(row, ['km_montage', 'km montage', 'kilometrage_montage']));
    return {
      id: 'pn-import-' + Date.now() + '-' + index,
      vehicleId: vehicle.id,
      position: (getCell(row, ['position']) || 'AVG') as PneumatiqueRecord['position'],
      marque: getCell(row, ['marque']) || PNEU_MARQUES[0],
      modele: getCell(row, ['modele', 'modèle']),
      dimension,
      date_montage: getCell(row, ['date_montage', 'date montage']) || new Date().toISOString().slice(0, 10),
      km_montage: kmMontage,
      km_actuel: parseAmount(getCell(row, ['km_actuel', 'km actuel'])) || undefined,
      usure_mm: parseAmount(getCell(row, ['usure_mm', 'usure'])) || undefined,
      cout_unitaire: parseAmount(getCell(row, ['cout_unitaire', 'coût unitaire', 'prix'])),
      main_oeuvre: parseAmount(getCell(row, ['main_oeuvre', "main d'œuvre", 'main doeuvre'])),
      etat: 'Bon',
      fournisseur: getCell(row, ['fournisseur']),
      observations: getCell(row, ['observations', 'notes']),
    };
  };

  const processImportFile = async (file: File) => {
    setImportMessage('Traitement du fichier en cours...');
    setPreview([]);
    try {
      const rows = await parseSpreadsheetFile(file);
      const imported = rows
        .map((row, index) => buildPneuFromRow(row, index))
        .filter((p): p is PneumatiqueRecord => Boolean(p));
      setPreview(imported);
      setImportMessage(imported.length > 0
        ? `${imported.length} pneu(s) valide(s) détecté(s).`
        : 'Aucune ligne valide détectée. Vérifiez que la colonne "immatriculation" correspond à un véhicule existant.');
    } catch (error) {
      setImportMessage('Erreur: ' + (error as Error).message);
    }
  };

  const confirmImport = () => {
    setPneus([...pneus, ...preview]);
    setImportMessage(`${preview.length} pneu(s) importé(s) avec succès.`);
    setPreview([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Pneumatiques</h2>
          <p className="mt-1 text-sm text-slate-500">Suivi de l'usure, des coûts et des remplacements de pneus</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditPneu(undefined); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus className="h-4 w-4" /> Ajouter</button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer" title="Importer">
            <Upload className="h-4 w-4" /> Importer
            <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && processImportFile(e.target.files[0])} />
          </label>
          <button onClick={exportToExcel} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" title="Exporter"><Download className="h-4 w-4" /> Exporter</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>

      {importMessage && <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 print:hidden">{importMessage}</p>}
      {preview.length > 0 && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 flex items-center justify-between print:hidden">
          <span className="text-sm text-emerald-800">{preview.length} pneu(s) prêt(s) à importer</span>
          <button onClick={confirmImport} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Confirmer l'import</button>
        </div>
      )}

      {/* Seuil d'alerte — critères activables, comme dans le Plan de réforme : cocher un
          critère filtre la liste de pneus tout en dessous (et les graphiques la suivent). */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-3"><AlertTriangle className="h-4 w-4" />Seuil d'alerte pneumatique</h3>
        <p className="mb-3 text-xs text-amber-700">Cochez un ou plusieurs critères pour filtrer la liste de pneus ci-dessous aux seuls pneus qui les dépassent. Les graphiques suivent automatiquement la liste filtrée.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={`rounded-lg border-2 p-3 transition-all ${usureEnabled ? 'border-amber-400 bg-white' : 'border-transparent bg-white/60'}`}>
            <button type="button" onClick={() => setUsureEnabled(v => !v)} className="mb-1.5 flex items-center gap-2">
              {usureEnabled ? <CheckSquare className="h-4.5 w-4.5 text-amber-600" /> : <Square className="h-4.5 w-4.5 text-slate-400" />}
              <span className="flex items-center gap-1 text-xs font-bold text-slate-700"><Ruler className="h-3.5 w-3.5" /> Usure minimale (mm)</span>
            </button>
            <input type="number" step="0.1" value={seuil.usureMinimale_mm} onChange={e => setSeuil(s => ({ ...s, usureMinimale_mm: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
          </div>
          <div className={`rounded-lg border-2 p-3 transition-all ${kmEnabled ? 'border-amber-400 bg-white' : 'border-transparent bg-white/60'}`}>
            <button type="button" onClick={() => setKmEnabled(v => !v)} className="mb-1.5 flex items-center gap-2">
              {kmEnabled ? <CheckSquare className="h-4.5 w-4.5 text-amber-600" /> : <Square className="h-4.5 w-4.5 text-slate-400" />}
              <span className="flex items-center gap-1 text-xs font-bold text-slate-700"><Gauge className="h-3.5 w-3.5" /> Km max par jeu</span>
            </button>
            <input type="number" step="5000" value={seuil.kmMaxParJeu} onChange={e => setSeuil(s => ({ ...s, kmMaxParJeu: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
          </div>
          <div className="rounded-lg border-2 border-transparent bg-white/60 p-3">
            <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-700"><DollarSign className="h-3.5 w-3.5" /> Budget mensuel (FCFA)</label>
            <input type="number" step="50000" value={seuil.coutBudgetMensuel} onChange={e => setSeuil(s => ({ ...s, coutBudgetMensuel: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {noCriteria && <span className="text-xs italic text-amber-700">Aucun critère coché — tous les pneus sont affichés ci-dessous.</span>}
          {usureEnabled && <span className="rounded-full bg-amber-200 px-3 py-0.5 text-xs font-medium text-amber-800">Usure ≤ {seuil.usureMinimale_mm} mm</span>}
          {kmEnabled && <span className="rounded-full bg-amber-200 px-3 py-0.5 text-xs font-medium text-amber-800">Km parcourus ≥ {seuil.kmMaxParJeu.toLocaleString()}</span>}
          {!noCriteria && <span className="ml-auto text-xs font-bold text-amber-800">{filtered.length} pneu(s) concerné(s)</span>}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total pneus de la flotte', value: stats.totalFlotte, icon: Gauge, color: 'emerald' },
          { label: 'À remplacer', value: stats.aRemplacer, icon: AlertTriangle, color: 'red' },
          { label: 'Usure modérée', value: stats.usureModeree, icon: AlertCircle, color: 'amber' },
          { label: 'Coût total', value: formatMoney(stats.coutTotal), icon: DollarSign, color: 'blue' },
          { label: 'Km moyen/jeu', value: stats.kmMoyen.toLocaleString() + ' km', icon: Gauge, color: 'violet' },
          { label: 'Coût / 1000km', value: formatMoney(stats.coutPar1000km), icon: DollarSign, color: 'teal' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-slate-200 bg-white p-4`}>
            <p className="text-[10px] uppercase text-slate-500">{k.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Détail par véhicule — justifie le total théorique de la flotte (véhicules × 5) en
          listant, pour chaque véhicule, le nombre de pneus réellement enregistrés. */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-700">Détail par véhicule</h3>
          <p className="text-xs text-slate-400">{vehicles.length} véhicule(s) × 5 pneus théoriques = <strong className="text-slate-600">{stats.totalFlotte}</strong></p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {['Véhicule', 'Marque / Modèle', 'Pneus enregistrés', 'Positions manquantes'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fleetTireDetail.map(({ vehicle, tires, missing }) => (
                <tr key={vehicle.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-semibold text-emerald-600">{vehicle.numero_immatriculation}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{vehicle.marque} {vehicle.type_commercial}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${tires.length >= 5 ? 'bg-green-100 text-green-700' : tires.length === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {tires.length} / 5
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {missing.length === 0 ? <span className="text-slate-400">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {missing.map(p => <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{POSITION_LABEL[p]}</span>)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Répartition par état {listeFiltree && <span className="font-normal text-slate-400">(liste filtrée)</span>}</h3>
          {etatDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={etatDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}>
                  {etatDistribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aucune donnée</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Répartition par marque <span className="font-normal text-slate-400">(flotte entière)</span></h3>
          {marqueDistributionFlotte.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={marqueDistributionFlotte} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}>
                  {marqueDistributionFlotte.map((_, i) => <Cell key={i} fill={MARQUE_COLORS[i % MARQUE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} pneu(s)`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aucune donnée</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Coût par marque {listeFiltree && <span className="font-normal text-slate-400">(liste filtrée)</span>}</h3>
          {coutParMarque(filtered).length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={coutParMarque(filtered)}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
                <Tooltip formatter={(v: any) => [formatMoney(v), 'Coût total']} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" style={{ fontSize: 10 }} formatter={(v: any) => `${(v / 1000).toFixed(0)}k`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aucune donnée</p>}
        </div>
      </div>

      {/* Recherche + Période */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher pneu, véhicule…" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <label className="block text-xs font-medium text-slate-600">Du<input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium text-slate-600">Au<input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>

      {/* Tableau — cliquer sur une ligne ouvre la fiche modifiable du pneu */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-700">Liste des pneus</h3>
          <SortDateButton order={sortOrder} onToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} label="Date de montage" />
          {colFilterActive && (
            <>
              <span className="text-xs text-slate-500">{filtered.length} pneu(s) affiché(s)</span>
              <button onClick={() => { setPositionFilter(''); setEtatFilter(''); }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 print:hidden"><X className="h-3 w-3" /> Effacer les filtres Position / État</button>
            </>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Véhicule', 'Position', 'Marque/Modèle', 'Dimension', 'Usure', 'Km parcourus', 'Coût', 'État', 'Action'].map(h => (
                  <th key={h} className="px-3 py-3 text-left align-top text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {h}
                    {h === 'Position' && (
                      <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)} onClick={e => e.stopPropagation()} title="Filtrer par position du pneu" aria-label="Filtrer par position" className={`${filterSelCls} print:hidden ${positionFilter ? 'border-emerald-500 bg-emerald-50' : ''}`}>
                        <option value="">Toutes</option>
                        {Object.entries(POSITION_LABEL).map(([k, label]) => <option key={k} value={k}>{label} ({countByPosition(k)})</option>)}
                      </select>
                    )}
                    {h === 'État' && (
                      <select value={etatFilter} onChange={e => setEtatFilter(e.target.value)} onClick={e => e.stopPropagation()} title="Filtrer par état du pneu" aria-label="Filtrer par état" className={`${filterSelCls} print:hidden ${etatFilter ? 'border-emerald-500 bg-emerald-50' : ''}`}>
                        <option value="">Tous</option>
                        {ETATS.map(et => <option key={et} value={et}>{et} ({countByEtat(et)})</option>)}
                      </select>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? <tr><td colSpan={9} className="py-10 text-center text-slate-400">{!listeFiltree ? 'Aucun pneu trouvé' : 'Aucun pneu ne correspond aux critères sélectionnés.'}</td></tr> :
                filtered.map(p => {
                  const v = vehicleById.get(p.vehicleId);
                  const kmParcourus = p.km_actuel ? p.km_actuel - p.km_montage : 0;
                  const usureCritique = (p.usure_mm || 99) <= seuil.usureMinimale_mm;
                  const kmCritique = kmParcourus >= seuil.kmMaxParJeu;
                  return (
                    <tr key={p.id} onClick={() => { setEditPneu(p); setShowForm(true); }} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-emerald-600">{v?.numero_immatriculation || '—'}</td>
                      <td className="px-3 py-2 text-xs">{POSITION_LABEL[p.position] || p.position}</td>
                      <td className="px-3 py-2"><span className="font-medium">{p.marque}</span> <span className="text-slate-500">{p.modele}</span></td>
                      <td className="px-3 py-2 text-xs">{p.dimension}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${usureCritique ? 'bg-red-100 text-red-700' : kmCritique ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {p.usure_mm != null ? p.usure_mm + ' mm' : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{kmParcourus.toLocaleString()} km</td>
                      <td className="px-3 py-2 text-xs font-semibold">{formatMoney(p.cout_unitaire + (p.main_oeuvre || 0))}</td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ETAT_COLORS[p.etat]}`}>{p.etat}</span></td>
                      <td className="px-3 py-2 print:hidden">
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditPneu(p); setShowForm(true); }} className="p-1 text-slate-400 hover:text-blue-600" title="Ouvrir la fiche"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <PneuFormModal pneu={editPneu} vehicles={vehicles} latestKmByVehicle={latestKmByVehicle} knownMarques={knownMarques} knownDimensions={knownDimensions} knownFournisseurs={knownFournisseurs} knownModeles={knownModeles} onSave={handleSave} onClose={() => { setShowForm(false); setEditPneu(undefined); }} />}
    </div>
  );
}

// ── Helpers ──
/** Liste de base + valeurs déjà saisies (sans doublon, insensible à la casse, sans « Autre »). */
function mergeSuggestions(base: string[], used: string[]): string[] {
  const baseMap = new Map<string, string>();
  base.forEach(b => { const t = b.trim(); const k = t.toLowerCase(); if (t && k !== 'autre' && !baseMap.has(k)) baseMap.set(k, t); });
  const extra = new Map<string, string>();
  used.forEach(u => { const t = (u || '').trim(); const k = t.toLowerCase(); if (t && k !== 'autre' && !baseMap.has(k) && !extra.has(k)) extra.set(k, t); });
  return [...Array.from(baseMap.values()), ...Array.from(extra.values()).sort((a, b) => a.localeCompare(b, 'fr'))];
}
function formatMoney(n: number) { return n.toLocaleString('fr-FR') + ' FCFA'; }
function coutParMarque(pneus: PneumatiqueRecord[]) {
  const map = new Map<string, number>();
  pneus.forEach(p => map.set(p.marque, (map.get(p.marque) || 0) + p.cout_unitaire + (p.main_oeuvre || 0)));
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// ── Formulaire ──
interface PneuFormProps {
  pneu?: PneumatiqueRecord;
  vehicles: { id: string; numero_immatriculation: string }[];
  latestKmByVehicle: Map<string, number>;
  /** Valeurs déjà saisies dans le module, reproposées dans le formulaire */
  knownMarques: string[];
  knownDimensions: string[];
  knownFournisseurs: string[];
  knownModeles: { marque: string; modele: string }[];
  onSave: (data: Omit<PneumatiqueRecord, 'id'>, id?: string) => void;
  onClose: () => void;
}

function PneuFormModal({ pneu, vehicles, latestKmByVehicle, knownMarques, knownDimensions, knownFournisseurs, knownModeles, onSave, onClose }: PneuFormProps) {
  const draftKey = pneu ? `fleetgest_draft_pneu_edit_${pneu.id}` : 'fleetgest_draft_pneu_new';
  const [f, setF] = usePersistedState(draftKey, {
    vehicleId: pneu?.vehicleId || vehicles[0]?.id || '',
    position: (pneu?.position || 'AVG') as PneumatiqueRecord['position'],
    marque: pneu?.marque || PNEU_MARQUES[0],
    modele: pneu?.modele || '',
    dimension: pneu?.dimension || PNEU_DIMENSIONS[0],
    date_montage: pneu?.date_montage || new Date().toISOString().slice(0, 10),
    km_montage: pneu?.km_montage || 0,
    km_actuel: pneu?.km_actuel || latestKmByVehicle.get(pneu?.vehicleId || vehicles[0]?.id || '') || 0,
    usure_mm: pneu?.usure_mm ?? 7.0,
    cout_unitaire: pneu?.cout_unitaire || 0,
    main_oeuvre: pneu?.main_oeuvre || 0,
    etat: (pneu?.etat || 'Bon') as PneumatiqueRecord['etat'],
    fournisseur: pneu?.fournisseur || '',
    observations: pneu?.observations || '',
  });
  const up = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  // "Km actuel" se remplit automatiquement avec le dernier kilométrage connu du véhicule
  // sélectionné (toutes saisies confondues : fiche véhicule, entretiens, dépenses) — que ce
  // soit à l'ouverture du formulaire ou lors d'un changement de véhicule. L'utilisateur peut
  // toujours corriger la valeur manuellement ensuite.
  const handleVehicleChange = (vehicleId: string) => {
    setF(p => ({ ...p, vehicleId, km_actuel: latestKmByVehicle.get(vehicleId) || p.km_actuel }));
  };
  const autoKm = latestKmByVehicle.get(f.vehicleId);
  // Modèles déjà saisis : ceux de la marque choisie en premier, puis les autres
  const modeleOptions = useMemo(() => {
    const m = (f.marque || '').trim().toLowerCase();
    const same = knownModeles.filter(x => x.marque.trim().toLowerCase() === m).map(x => x.modele);
    return mergeSuggestions(same, knownModeles.map(x => x.modele));
  }, [knownModeles, f.marque]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold">{pneu ? 'Modifier pneu' : 'Ajouter un pneu'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(f, pneu?.id); }} className="grid grid-cols-2 gap-4 p-6">
          <label className="block text-xs font-medium text-slate-600">Véhicule
            <SearchableSelect value={f.vehicleId} onChange={v => handleVehicleChange(v)} placeholder="Sélectionner un véhicule" options={vehicles.map(v => ({ value: v.id, label: v.numero_immatriculation }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Position
            <select value={f.position} onChange={e => up('position', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              {Object.entries(POSITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">Marque
            <SelectWithOther
              value={f.marque}
              onChange={(v) => up('marque', v)}
              options={knownMarques}
              otherPlaceholder="Préciser la marque…"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">Modèle
            <input list="pneu-modeles" autoComplete="off" value={f.modele} onChange={e => up('modele', e.target.value)} placeholder="Ex: Primacy 4" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <datalist id="pneu-modeles">{modeleOptions.map(m => <option key={m} value={m} />)}</datalist>
          </label>
          <label className="block text-xs font-medium text-slate-600">Dimension
            <SelectWithOther
              value={f.dimension}
              onChange={(v) => up('dimension', v)}
              options={knownDimensions}
              otherPlaceholder="Ex: 275/45 R20…"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">Date montage
            <input type="date" value={f.date_montage} onChange={e => up('date_montage', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Km au montage
            <input type="number" value={f.km_montage} onChange={e => up('km_montage', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Km actuel
            <div className="mt-1 flex gap-1.5">
              <input type="number" value={f.km_actuel} onChange={e => up('km_actuel', Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              {autoKm != null && (
                <button type="button" onClick={() => up('km_actuel', autoKm)} title={`Reprendre le dernier kilométrage connu (${autoKm.toLocaleString()} km)`} className="flex-shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"><RefreshCw className="h-3.5 w-3.5" /></button>
              )}
            </div>
            {autoKm != null && <p className="mt-1 text-[10px] text-slate-400">Pré-rempli automatiquement d'après la dernière saisie connue pour ce véhicule ({autoKm.toLocaleString()} km).</p>}
          </label>
          <label className="block text-xs font-medium text-slate-600">Usure (mm)
            <input type="number" step="0.1" value={f.usure_mm} onChange={e => up('usure_mm', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Coût unitaire (FCFA)
            <input type="number" value={f.cout_unitaire} onChange={e => up('cout_unitaire', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Main d'œuvre (FCFA)
            <input type="number" value={f.main_oeuvre} onChange={e => up('main_oeuvre', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">État
            <div className="mt-1 flex h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <input
                type="checkbox"
                id="etat-remplace"
                checked={f.etat === 'Remplacé'}
                onChange={e => up('etat', e.target.checked ? 'Remplacé' : 'Bon')}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="etat-remplace" className="text-xs text-slate-600">Marquer comme remplacé</label>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Sinon, l'état (Bon / Usure modérée / À remplacer) est calculé automatiquement selon les seuils d'alerte.</p>
          </label>
          <label className="block text-xs font-medium text-slate-600">Fournisseur
            <input list="pneu-fournisseurs" autoComplete="off" value={f.fournisseur} onChange={e => up('fournisseur', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <datalist id="pneu-fournisseurs">{knownFournisseurs.map(x => <option key={x} value={x} />)}</datalist>
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">Observations
            <textarea value={f.observations} onChange={e => up('observations', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <div className="col-span-2 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{pneu ? 'Mettre à jour' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
