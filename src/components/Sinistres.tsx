import { useMemo, useState } from 'react';
import SortToggleButton, { type SortDirection } from './SortToggleButton';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import type { SinistreRecord } from '../types/sinistres';
import { SINISTRE_TYPES, NATURE_DOMMAGE_OPTIONS, RESPONSABILITE_OPTIONS, COMMUNES_SUGGESTIONS } from '../types/sinistres';
import { parseSpreadsheetFile, getCell, parseAmount, exportRowsToExcel } from '../utils/importExport';
import SelectWithOther from './SelectWithOther';
import SuggestInput from './SuggestInput';
import { uniqueValues } from '../utils/suggestions';
import {
  AlertTriangle, Plus, Printer, Search,
  Trash2, Car, Shield, DollarSign, X, Eye, Upload, Download, Info, HeartPulse, Percent, MapPinned,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import SearchableSelect from './SearchableSelect';

const STATUT_COLORS: Record<string, string> = {
  Déclaré: 'bg-blue-100 text-blue-700',
  Expertise: 'bg-amber-100 text-amber-700',
  'En réparation': 'bg-purple-100 text-purple-700',
  Indemnisé: 'bg-green-100 text-green-700',
  Clôturé: 'bg-slate-100 text-slate-600',
};

const RESPONSABILITE_COLORS: Record<string, string> = {
  'Engagée': 'bg-red-100 text-red-700',
  'Non engagée': 'bg-green-100 text-green-700',
};

const NATURE_DOMMAGE_COLORS: Record<string, string> = {
  'Dommage corporel': 'bg-red-100 text-red-700',
  'Dommage matériel': 'bg-slate-100 text-slate-600',
  Autre: 'bg-slate-100 text-slate-600',
};

export default function Sinistres() {
  const { vehicles, sinistres, addSinistre, updateSinistre, deleteSinistre, importSinistres } = useVehicles();
  const [showForm, setShowForm] = useState(false);
  const [editSinistre, setEditSinistre] = useState<SinistreRecord | undefined>();
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [search, setSearch] = usePersistedState('fleetgest_filter_sinistres_search', '');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [periodFrom, setPeriodFrom] = usePersistedState('fleetgest_filter_sinistres_from', '');
  const [periodTo, setPeriodTo] = usePersistedState('fleetgest_filter_sinistres_to', '');
  const [importMessage, setImportMessage] = useState('');
  const [preview, setPreview] = useState<SinistreRecord[]>([]);

  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sinistres.filter(s => {
      const v = vehicleById.get(s.vehicleId);
      const matchSearch = !q || s.type.toLowerCase().includes(q) || s.lieu.toLowerCase().includes(q) ||
        (s.commune || '').toLowerCase().includes(q) || s.assureur.toLowerCase().includes(q) || v?.numero_immatriculation.toLowerCase().includes(q);
      const matchFrom = !periodFrom || s.date_sinistre >= periodFrom;
      const matchTo = !periodTo || s.date_sinistre <= periodTo;
      return matchSearch && matchFrom && matchTo;
    });
  }, [sinistres, search, vehicleById, periodFrom, periodTo]);

  const stats = useMemo(() => {
    const total = sinistres.length;
    const coutTotal = sinistres.reduce((s, si) => s + (si.cout_final || si.cout_estime), 0);
    const coutMoyen = total > 0 ? Math.round(coutTotal / total) : 0;
    // Taux par véhicule
    const vehiculeCount = vehicles.length || 1;
    const taux = total / vehiculeCount;
    // Par type
    const typeCounts: Record<string, number> = {};
    sinistres.forEach(s => { typeCounts[s.type] = (typeCounts[s.type] || 0) + 1; });
    const typeDistribution = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
    // Par statut
    const statutCounts: Record<string, number> = {};
    sinistres.forEach(s => { statutCounts[s.statut] = (statutCounts[s.statut] || 0) + 1; });
    const statutDistribution = Object.entries(statutCounts).map(([name, value]) => ({ name, value }));
    // Dommages corporels — indicateur sécurité
    const dommagesCorporels = sinistres.filter(s => s.nature_dommage === 'Dommage corporel').length;
    // Taux de responsabilité engagée — utile pour la négociation des primes d'assurance
    const avecResponsabiliteDeterminee = sinistres.filter(s => s.responsabilite === 'Engagée' || s.responsabilite === 'Non engagée');
    const responsabiliteEngagee = avecResponsabiliteDeterminee.filter(s => s.responsabilite === 'Engagée').length;
    const tauxResponsabiliteEngagee = avecResponsabiliteDeterminee.length > 0
      ? Math.round((responsabiliteEngagee / avecResponsabiliteDeterminee.length) * 100)
      : 0;
    // Répartition par commune — identifie les zones à risque
    const communeCounts: Record<string, number> = {};
    sinistres.forEach(s => { const c = s.commune?.trim(); if (c) communeCounts[c] = (communeCounts[c] || 0) + 1; });
    const communeDistribution = Object.entries(communeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return {
      total, coutTotal, coutMoyen, taux, typeDistribution, statutDistribution,
      dommagesCorporels, tauxResponsabiliteEngagee, avecResponsabiliteDeterminee: avecResponsabiliteDeterminee.length,
      communeDistribution,
    };
  }, [sinistres, vehicles]);

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#06b6d4', '#ec4899', '#94a3b8'];

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer ce sinistre ?')) return;
    deleteSinistre(id);
  };

  const handleSave = (data: Omit<SinistreRecord, 'id'>, id?: string) => {
    if (id) updateSinistre(id, data);
    else addSinistre({ ...data, id: 'si' + Date.now() });
    setShowForm(false);
    setEditSinistre(undefined);
    // Un sinistre "En réparation" immobilise le véhicule (statut "En maintenance"
    // dans le menu Véhicules) ; il redevient "Actif" dès qu'aucun sinistre du
    // véhicule n'est plus "En réparation" et qu'aucune immobilisation n'est active.
    // Mise à jour automatique et instantanée via le store central.
  };

  const exportToExcel = () => {
    const rows = filtered.map(s => {
      const v = vehicleById.get(s.vehicleId);
      return {
        'Véhicule': v?.numero_immatriculation || 'Inconnu',
        'Date': s.date_sinistre,
        'Lieu': s.lieu,
        'Commune': s.commune || '',
        'Type': s.type,
        'Nature dommage': s.nature_dommage || '',
        'Responsabilité': s.responsabilite || '',
        'Description': s.description,
        'Coût estimé (FCFA)': s.cout_estime,
        'Coût final (FCFA)': s.cout_final || '',
        'Assureur': s.assureur,
        'N° dossier': s.numero_dossier,
        'Statut': s.statut,
        'Responsable': s.responsable,
        'Témoins': s.temoins,
        'Observations': s.observations,
      };
    });
    exportRowsToExcel(rows, 'gestion_sinistres.xlsx', 'Sinistres');
  };

  const buildSinistreFromRow = (row: Record<string, unknown>, index: number): SinistreRecord | null => {
    const plate = getCell(row, ['immatriculation', 'numero_immatriculation', 'plaque', 'vehicule', 'véhicule']);
    const vehicle = vehicles.find((v) => v.numero_immatriculation.toLowerCase() === plate.toLowerCase());
    if (!vehicle) return null;
    const dateSinistre = getCell(row, ['date_sinistre', 'date sinistre', 'date']) || new Date().toISOString().slice(0, 10);
    return {
      id: 'si-import-' + Date.now() + '-' + index,
      vehicleId: vehicle.id,
      date_sinistre: dateSinistre,
      lieu: getCell(row, ['lieu']),
      commune: getCell(row, ['commune']),
      type: getCell(row, ['type']) || 'Autre',
      nature_dommage: getCell(row, ['nature_dommage', 'nature dommage']) || undefined,
      responsabilite: (getCell(row, ['responsabilite', 'responsabilité']) || '') as SinistreRecord['responsabilite'],
      description: getCell(row, ['description']),
      cout_estime: parseAmount(getCell(row, ['cout_estime', 'coût estimé', 'cout'])),
      cout_final: parseAmount(getCell(row, ['cout_final', 'coût final'])) || undefined,
      assureur: getCell(row, ['assureur']),
      numero_dossier: getCell(row, ['numero_dossier', 'n° dossier', 'dossier']),
      statut: (getCell(row, ['statut']) || 'Déclaré') as SinistreRecord['statut'],
      responsable: getCell(row, ['responsable']),
      temoins: getCell(row, ['temoins', 'témoins']),
      observations: getCell(row, ['observations', 'notes']),
    };
  };

  const processImportFile = async (file: File) => {
    setImportMessage('Traitement du fichier en cours...');
    setPreview([]);
    try {
      const rows = await parseSpreadsheetFile(file);
      const imported = rows
        .map((row, index) => buildSinistreFromRow(row, index))
        .filter((s): s is SinistreRecord => Boolean(s));
      setPreview(imported);
      setImportMessage(imported.length > 0
        ? `${imported.length} sinistre(s) valide(s) détecté(s).`
        : 'Aucune ligne valide détectée. Vérifiez que la colonne "immatriculation" correspond à un véhicule existant.');
    } catch (error) {
      setImportMessage('Erreur: ' + (error as Error).message);
    }
  };

  const confirmImport = () => {
    importSinistres(preview);
    setImportMessage(`${preview.length} sinistre(s) importé(s) avec succès.`);
    setPreview([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Sinistres</h2>
          <p className="mt-1 text-sm text-slate-500">Suivi des accidents, déclarations et indemnisations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditSinistre(undefined); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus className="h-4 w-4" /> Déclarer</button>
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
          <span className="text-sm text-emerald-800">{preview.length} sinistre(s) prêt(s) à importer</span>
          <button onClick={confirmImport} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Confirmer l'import</button>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 print:hidden">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Un véhicule avec un sinistre au statut <strong>En réparation</strong> passe automatiquement en <strong>En maintenance</strong> dans le menu Véhicules ; il repasse « Actif » dès qu'aucun sinistre actif ne le concerne (et qu'il n'a pas non plus d'immobilisation en cours).</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Sinistres déclarés', value: stats.total, icon: AlertTriangle, color: 'red' },
          { label: 'Coût total', value: formatMoney(stats.coutTotal), icon: DollarSign, color: 'blue' },
          { label: 'Coût moyen', value: formatMoney(stats.coutMoyen), icon: DollarSign, color: 'amber' },
          { label: 'Taux sinistralité', value: stats.taux.toFixed(2) + ' / véh.', icon: Shield, color: 'teal' },
          { label: 'Dommages corporels', value: stats.dommagesCorporels, icon: HeartPulse, color: 'red' },
          { label: 'Taux resp. engagée', value: stats.avecResponsabiliteDeterminee > 0 ? stats.tauxResponsabiliteEngagee + ' %' : '—', icon: Percent, color: 'violet' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] uppercase text-slate-500">{k.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Répartition par type de sinistre</h3>
          {stats.typeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.typeDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}>
                  {stats.typeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aucun sinistre</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Répartition par statut</h3>
          {stats.statutDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.statutDistribution}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aucun sinistre</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-700"><MapPinned className="h-4 w-4 text-slate-400" /> Zones à risque (par commune)</h3>
          {stats.communeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.communeDistribution} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400">Aucune commune renseignée</p>}
        </div>
      </div>

      {/* Recherche + Période */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher sinistre, véhicule…" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <label className="block text-xs font-medium text-slate-600">Du<input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium text-slate-600">Au<input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Date', 'Véhicule', 'Type', 'Lieu', 'Commune', 'Assureur', 'Coût', 'Statut', 'Responsabilité', 'Action'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {h === 'Date' ? <span className="inline-flex items-center gap-2">{h}<SortToggleButton direction={sortDir} onToggle={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} /></span> : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? <tr><td colSpan={10} className="py-10 text-center text-slate-400">Aucun sinistre trouvé</td></tr> :
                filtered.sort((a, b) => (sortDir === 'desc' ? 1 : -1) * (new Date(b.date_sinistre).getTime() - new Date(a.date_sinistre).getTime())).map(s => {
                  const v = vehicleById.get(s.vehicleId);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs">{formatDate(s.date_sinistre)}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-600">{v?.numero_immatriculation || '—'}</td>
                      <td className="px-3 py-2 text-xs font-medium">{s.type}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 max-w-[150px] truncate">{s.lieu}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{s.commune || '—'}</td>
                      <td className="px-3 py-2 text-xs">{s.assureur}</td>
                      <td className="px-3 py-2 text-xs font-semibold">{formatMoney(s.cout_final || s.cout_estime)}</td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_COLORS[s.statut]}`}>{s.statut}</span></td>
                      <td className="px-3 py-2">
                        {s.responsabilite ? <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${RESPONSABILITE_COLORS[s.responsabilite] || 'bg-slate-100 text-slate-600'}`}>{s.responsabilite}</span> : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 print:hidden">
                        <div className="flex gap-1">
                          <button onClick={() => setDetailId(s.id)} className="p-1 text-slate-400 hover:text-blue-600" title="Détails"><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setEditSinistre(s); setShowForm(true); }} className="p-1 text-slate-400 hover:text-amber-600" title="Modifier"><Car className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(s.id)} className="p-1 text-slate-400 hover:text-red-600" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <SinistreFormModal sinistre={editSinistre} vehicles={vehicles} onSave={handleSave} onClose={() => { setShowForm(false); setEditSinistre(undefined); }} />}

      {detailId && <SinistreDetail sinistre={sinistres.find(s => s.id === detailId)!} vehicle={vehicleById.get(sinistres.find(s => s.id === detailId)?.vehicleId || '')} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function formatMoney(n: number) { return n.toLocaleString('fr-FR') + ' FCFA'; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ── Détail sinistre ──
function SinistreDetail({ sinistre, vehicle, onClose }: { sinistre: SinistreRecord; vehicle?: { numero_immatriculation: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold">Détail du sinistre</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(sinistre.date_sinistre)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Véhicule</span><span className="font-medium text-emerald-600">{vehicle?.numero_immatriculation}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium">{sinistre.type}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Lieu</span><span className="font-medium">{sinistre.lieu}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Commune</span><span className="font-medium">{sinistre.commune || '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Nature des dommages</span>{sinistre.nature_dommage ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${NATURE_DOMMAGE_COLORS[sinistre.nature_dommage] || 'bg-slate-100 text-slate-600'}`}>{sinistre.nature_dommage}</span> : <span className="font-medium">—</span>}</div>
          <div className="flex justify-between"><span className="text-slate-500">Responsabilité</span>{sinistre.responsabilite ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RESPONSABILITE_COLORS[sinistre.responsabilite] || 'bg-slate-100 text-slate-600'}`}>{sinistre.responsabilite}</span> : <span className="font-medium">—</span>}</div>
          <div className="flex justify-between"><span className="text-slate-500">Assureur</span><span className="font-medium">{sinistre.assureur}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">N° dossier</span><span className="font-medium">{sinistre.numero_dossier}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Coût estimé</span><span className="font-medium">{formatMoney(sinistre.cout_estime)}</span></div>
          {sinistre.cout_final != null && <div className="flex justify-between"><span className="text-slate-500">Coût final</span><span className="font-bold text-emerald-600">{formatMoney(sinistre.cout_final)}</span></div>}
          <div className="flex justify-between"><span className="text-slate-500">Statut</span><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_COLORS[sinistre.statut]}`}>{sinistre.statut}</span></div>
          <div className="border-t pt-3"><span className="text-slate-500">Description</span><p className="mt-1 text-slate-700">{sinistre.description}</p></div>
          {sinistre.observations && <div><span className="text-slate-500">Observations</span><p className="mt-1 text-slate-600">{sinistre.observations}</p></div>}
        </div>
      </div>
    </div>
  );
}

// ── Formulaire ──
interface SinistreFormProps {
  sinistre?: SinistreRecord;
  vehicles: { id: string; numero_immatriculation: string }[];
  onSave: (data: Omit<SinistreRecord, 'id'>, id?: string) => void;
  onClose: () => void;
}

function SinistreFormModal({ sinistre, vehicles, onSave, onClose }: SinistreFormProps) {
  // Valeurs déjà saisies sur les autres sinistres, reproposées dans le formulaire
  const { sinistres: allSinistres } = useVehicles();
  const sg = useMemo(() => ({
    lieux: uniqueValues(allSinistres.map(x => x.lieu)),
    communes: uniqueValues([...COMMUNES_SUGGESTIONS, ...allSinistres.map(x => x.commune)]),
    assureurs: uniqueValues(allSinistres.map(x => x.assureur)),
    responsables: uniqueValues(allSinistres.map(x => x.responsable)),
    types: uniqueValues([...SINISTRE_TYPES, ...allSinistres.map(x => String(x.type))], { sort: false, exclude: ['Autre'] }),
    natures: uniqueValues([...NATURE_DOMMAGE_OPTIONS, ...allSinistres.map(x => x.nature_dommage)], { sort: false, exclude: ['Autre'] }),
  }), [allSinistres]);
  const [f, setF] = useState({
    vehicleId: sinistre?.vehicleId || vehicles[0]?.id || '',
    date_sinistre: sinistre?.date_sinistre || new Date().toISOString().slice(0, 10),
    lieu: sinistre?.lieu || '',
    commune: sinistre?.commune || '',
    type: (sinistre?.type || SINISTRE_TYPES[0]) as SinistreRecord['type'],
    nature_dommage: (sinistre?.nature_dommage || '') as SinistreRecord['nature_dommage'],
    responsabilite: (sinistre?.responsabilite || '') as SinistreRecord['responsabilite'],
    description: sinistre?.description || '',
    cout_estime: sinistre?.cout_estime || 0,
    cout_final: sinistre?.cout_final || 0,
    assureur: sinistre?.assureur || '',
    numero_dossier: sinistre?.numero_dossier || '',
    statut: (sinistre?.statut || 'Déclaré') as SinistreRecord['statut'],
    responsable: sinistre?.responsable || '',
    temoins: sinistre?.temoins || '',
    observations: sinistre?.observations || '',
  });
  const up = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold">{sinistre ? 'Modifier le sinistre' : 'Déclarer un sinistre'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(f, sinistre?.id); }} className="grid grid-cols-2 gap-4 p-6">
          <label className="block text-xs font-medium text-slate-600">Véhicule
            <SearchableSelect value={f.vehicleId} onChange={v => up('vehicleId', v)} placeholder="Sélectionner un véhicule" options={vehicles.map(v => ({ value: v.id, label: v.numero_immatriculation }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Date du sinistre
            <input type="date" value={f.date_sinistre} onChange={e => up('date_sinistre', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Lieu
            <SuggestInput suggestions={sg.lieux} value={f.lieu} onChange={e => up('lieu', e.target.value)} placeholder="Ex: Boulevard Latrille, Abidjan" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Commune
            <input list="sinistre-communes" value={f.commune} onChange={e => up('commune', e.target.value)} placeholder="Ex: Cocody" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <datalist id="sinistre-communes">{sg.communes.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="block text-xs font-medium text-slate-600">Commune
            <input list="sinistre-communes" value={f.commune} onChange={e => up('commune', e.target.value)} placeholder="Ex: Cocody" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <datalist id="sinistre-communes">{COMMUNES_SUGGESTIONS.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="block text-xs font-medium text-slate-600">Type de sinistre
            <SelectWithOther
              value={f.type}
              onChange={(v) => up('type', v)}
              options={sg.types}
              otherPlaceholder="Préciser le type de sinistre…"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">Nature des dommages
            <SelectWithOther
              value={f.nature_dommage || ''}
              onChange={(v) => up('nature_dommage', v)}
              options={sg.natures}
              placeholder="Non déterminée"
              otherPlaceholder="Préciser la nature des dommages…"
            />
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">Description
            <textarea value={f.description} onChange={e => up('description', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Coût estimé (FCFA)
            <input type="number" value={f.cout_estime} onChange={e => up('cout_estime', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Coût final (FCFA)
            <input type="number" value={f.cout_final} onChange={e => up('cout_final', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Assureur
            <SuggestInput suggestions={sg.assureurs} value={f.assureur} onChange={e => up('assureur', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">N° dossier
            <input value={f.numero_dossier} onChange={e => up('numero_dossier', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Statut du dossier
            <select value={f.statut} onChange={e => up('statut', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="Déclaré">Déclaré</option>
              <option value="Expertise">Expertise</option>
              <option value="En réparation">En réparation</option>
              <option value="Indemnisé">Indemnisé</option>
              <option value="Clôturé">Clôturé</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">Responsabilité
            <select value={f.responsabilite || ''} onChange={e => up('responsabilite', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Non déterminée</option>
              {RESPONSABILITE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">Responsable
            <SuggestInput suggestions={sg.responsables} value={f.responsable} onChange={e => up('responsable', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Témoins
            <input value={f.temoins} onChange={e => up('temoins', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">Observations
            <textarea value={f.observations} onChange={e => up('observations', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <div className="col-span-2 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{sinistre ? 'Mettre à jour' : 'Déclarer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
