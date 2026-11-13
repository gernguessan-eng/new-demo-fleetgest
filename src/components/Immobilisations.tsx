import { useMemo, useState } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import { Plus, Printer, Search, Trash2, Pencil, X, AlertTriangle, Upload, Download, Info } from 'lucide-react';
import type { ImmobilisationRecord } from '../types/immobilisations';
import { parseSpreadsheetFile, getCell, parseAmount, exportRowsToExcel } from '../utils/importExport';
import SortToggleButton, { type SortDirection } from './SortToggleButton';
import SearchableSelect from './SearchableSelect';

export type { ImmobilisationRecord };

function fmtDate(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtMoney(n: number) { return n.toLocaleString('fr-FR') + ' FCFA'; }

function daysBetween(start: string, end: string) {
  if (!start) return 0;
  const e = end ? new Date(end) : new Date();
  return Math.max(0, Math.ceil((e.getTime() - new Date(start).getTime()) / 86400000));
}

const STATUT_COLORS: Record<string, string> = {
  'En cours': 'bg-amber-100 text-amber-700',
  'Terminé': 'bg-green-100 text-green-700',
  'En attente pièces': 'bg-red-100 text-red-700',
};

export default function Immobilisations() {
  // Source unique de vérité : le store central (plus de localStorage local à
  // ce composant), pour que Véhicules et Tableau de bord soient toujours à jour.
  const { vehicles, immobilisations: records, addImmobilisation, updateImmobilisation, deleteImmobilisation, importImmobilisations } = useVehicles();
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<ImmobilisationRecord | undefined>();
  const [search, setSearch] = usePersistedState('fleetgest_filter_immob_search', '');
  const [periodFrom, setPeriodFrom] = usePersistedState('fleetgest_filter_immob_from', '');
  const [periodTo, setPeriodTo] = usePersistedState('fleetgest_filter_immob_to', '');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [importMessage, setImportMessage] = useState('');
  const [preview, setPreview] = useState<ImmobilisationRecord[]>([]);

  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

  // Garages déjà saisis, proposés automatiquement dans le formulaire (sans doublons,
  // insensible à la casse, triés par ordre alphabétique).
  const knownGarages = useMemo(() => {
    const m = new Map<string, string>();
    records.forEach(r => { const g = r.garage?.trim(); if (g && !m.has(g.toLowerCase())) m.set(g.toLowerCase(), g); });
    return Array.from(m.values()).sort((x, y) => x.localeCompare(y, 'fr'));
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      const v = vehicleById.get(r.vehicleId);
      const matchSearch = !q || r.garage.toLowerCase().includes(q) || r.travaux.toLowerCase().includes(q) || v?.numero_immatriculation.toLowerCase().includes(q);
      const matchFrom = !periodFrom || r.date_entree >= periodFrom;
      const matchTo = !periodTo || r.date_entree <= periodTo;
      return matchSearch && matchFrom && matchTo;
    }).sort((a, b) => (sortDir === 'desc' ? 1 : -1) * (new Date(b.date_entree).getTime() - new Date(a.date_entree).getTime()));
  }, [records, search, vehicleById, periodFrom, periodTo, sortDir]);

  const stats = useMemo(() => {
    const enCours = records.filter(r => r.statut !== 'Terminé').length;
    const termines = records.filter(r => r.statut === 'Terminé').length;
    const dureeMoyenne = records.filter(r => r.statut === 'Terminé' && r.date_sortie_reelle).length > 0
      ? Math.round(records.filter(r => r.statut === 'Terminé' && r.date_sortie_reelle).reduce((s, r) => s + daysBetween(r.date_entree, r.date_sortie_reelle), 0) / records.filter(r => r.statut === 'Terminé' && r.date_sortie_reelle).length)
      : 0;
    const coutTotal = records.reduce((s, r) => s + (r.cout_final || r.cout_estime), 0);
    return { enCours, termines, dureeMoyenne, coutTotal };
  }, [records]);

  const handleSave = (data: Omit<ImmobilisationRecord, 'id'>, id?: string) => {
    if (id) updateImmobilisation(id, data);
    else addImmobilisation({ ...data, id: 'imm' + Date.now() });
    setShowForm(false); setEditRecord(undefined);
    // Le véhicule concerné passe automatiquement en "En maintenance" si le
    // dossier n'est pas "Terminé", ou repasse "Actif" s'il n'a plus aucun
    // dossier actif — cf. menu Véhicules et Tableau de bord (mise à jour
    // automatique et instantanée via le store central, aucune action requise).
  };

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette immobilisation ?')) return;
    deleteImmobilisation(id);
  };

  const exportToExcel = () => {
    const rows = filtered.map(r => {
      const v = vehicleById.get(r.vehicleId);
      return {
        'Véhicule': v?.numero_immatriculation || 'Inconnu',
        'Garage': r.garage,
        'Date entrée': r.date_entree,
        'Date sortie prévue': r.date_sortie_prevue,
        'Date sortie réelle': r.date_sortie_reelle,
        'Travaux': r.travaux,
        'Statut': r.statut,
        'Coût estimé (FCFA)': r.cout_estime,
        'Coût final (FCFA)': r.cout_final,
        'Observations': r.observations,
      };
    });
    exportRowsToExcel(rows, 'suivi_immobilisations.xlsx', 'Immobilisations');
  };

  const buildRecordFromRow = (row: Record<string, unknown>, index: number): ImmobilisationRecord | null => {
    const plate = getCell(row, ['immatriculation', 'numero_immatriculation', 'plaque', 'vehicule', 'véhicule']);
    const vehicle = vehicles.find((v) => v.numero_immatriculation.toLowerCase() === plate.toLowerCase());
    if (!vehicle) return null;
    const garage = getCell(row, ['garage']);
    const dateEntree = getCell(row, ['date_entree', 'date entrée', 'date_entrée']) || new Date().toISOString().slice(0, 10);
    return {
      id: 'imm-import-' + Date.now() + '-' + index,
      vehicleId: vehicle.id,
      garage,
      date_entree: dateEntree,
      date_sortie_prevue: getCell(row, ['date_sortie_prevue', 'date sortie prévue']),
      date_sortie_reelle: getCell(row, ['date_sortie_reelle', 'date sortie réelle']),
      travaux: getCell(row, ['travaux', 'description']),
      statut: (getCell(row, ['statut']) || 'En cours') as ImmobilisationRecord['statut'],
      cout_estime: parseAmount(getCell(row, ['cout_estime', 'coût estimé', 'cout'])),
      cout_final: parseAmount(getCell(row, ['cout_final', 'coût final'])),
      observations: getCell(row, ['observations', 'notes']),
    };
  };

  const processImportFile = async (file: File) => {
    setImportMessage('Traitement du fichier en cours...');
    setPreview([]);
    try {
      const rows = await parseSpreadsheetFile(file);
      const imported = rows
        .map((row, index) => buildRecordFromRow(row, index))
        .filter((r): r is ImmobilisationRecord => Boolean(r));
      setPreview(imported);
      setImportMessage(imported.length > 0
        ? `${imported.length} entrée(s) valide(s) détectée(s).`
        : 'Aucune ligne valide détectée. Vérifiez que la colonne "immatriculation" correspond à un véhicule existant.');
    } catch (error) {
      setImportMessage('Erreur: ' + (error as Error).message);
    }
  };

  const confirmImport = () => {
    importImmobilisations(preview);
    setImportMessage(`${preview.length} entrée(s) importée(s) avec succès.`);
    setPreview([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div><h2 className="text-2xl font-bold text-slate-900">Suivi des Immobilisations</h2><p className="mt-1 text-sm text-slate-500">Suivi des véhicules en garage : durée, travaux, coûts</p></div>
        <div className="flex gap-2">
          <button onClick={() => { setEditRecord(undefined); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus className="h-4 w-4" /> Nouvelle entrée</button>
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
          <span className="text-sm text-emerald-800">{preview.length} entrée(s) prête(s) à importer</span>
          <button onClick={confirmImport} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Confirmer l'import</button>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 print:hidden">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Un véhicule ayant un dossier « En cours » ou « En attente pièces » passe automatiquement au statut <strong>En maintenance</strong> dans le menu Véhicules ; il repasse « Actif » dès que le dossier est marqué <strong>Terminé</strong> (et qu'aucun autre dossier actif ne le concerne).</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-slate-500">En cours</p><p className="mt-1 text-2xl font-bold text-amber-600">{stats.enCours}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-slate-500">Terminés</p><p className="mt-1 text-2xl font-bold text-green-600">{stats.termines}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-slate-500">Durée moy. (jours)</p><p className="mt-1 text-2xl font-bold text-blue-600">{stats.dureeMoyenne}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-slate-500">Coût total</p><p className="mt-1 text-2xl font-bold text-slate-900">{fmtMoney(stats.coutTotal)}</p></div>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher garage, véhicule, travaux…" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <label className="block text-xs font-medium text-slate-600">Du<input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium text-slate-600">Au<input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{['Véhicule', 'Garage', 'Travaux', 'Entrée', 'Sortie prévue', 'Sortie réelle', 'Durée', 'Coût', 'Statut', ''].map(h => (
              <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {h === 'Entrée' ? <span className="inline-flex items-center gap-2">{h}<SortToggleButton direction={sortDir} onToggle={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} /></span> : h}
              </th>
            ))}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? <tr><td colSpan={10} className="py-10 text-center text-slate-400">Aucune immobilisation</td></tr> :
                filtered.map(r => {
                  const v = vehicleById.get(r.vehicleId);
                  const jours = daysBetween(r.date_entree, r.date_sortie_reelle || '');
                  const depassement = r.date_sortie_prevue && !r.date_sortie_reelle && new Date() > new Date(r.date_sortie_prevue);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-emerald-600">{v?.numero_immatriculation || '—'}<p className="text-[10px] text-slate-500">{v?.marque} {v?.type_commercial}</p></td>
                      <td className="px-3 py-2 text-xs font-medium">{r.garage}</td>
                      <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={r.travaux}>{r.travaux}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(r.date_entree)}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(r.date_sortie_prevue)}</td>
                      <td className="px-3 py-2 text-xs">{r.date_sortie_reelle ? fmtDate(r.date_sortie_reelle) : <span className="text-amber-600 font-semibold">En garage</span>}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`font-bold ${depassement ? 'text-red-600' : 'text-slate-700'}`}>{jours} j</span>
                        {depassement && <AlertTriangle className="ml-1 inline h-3 w-3 text-red-500" />}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold">{fmtMoney(r.cout_final || r.cout_estime)}</td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_COLORS[r.statut]}`}>{r.statut}</span></td>
                      <td className="px-3 py-2 print:hidden">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditRecord(r); setShowForm(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ImmobilisationFormModal record={editRecord} vehicles={vehicles} knownGarages={knownGarages} onSave={handleSave} onClose={() => { setShowForm(false); setEditRecord(undefined); }} />}
    </div>
  );
}

function ImmobilisationFormModal({ record, vehicles, knownGarages, onSave, onClose }: { record?: ImmobilisationRecord; vehicles: { id: string; numero_immatriculation: string }[]; knownGarages: string[]; onSave: (data: Omit<ImmobilisationRecord, 'id'>, id?: string) => void; onClose: () => void }) {
  const [f, setF] = useState({
    vehicleId: record?.vehicleId || vehicles[0]?.id || '', garage: record?.garage || '', date_entree: record?.date_entree || new Date().toISOString().slice(0, 10),
    date_sortie_prevue: record?.date_sortie_prevue || '', date_sortie_reelle: record?.date_sortie_reelle || '', travaux: record?.travaux || '',
    statut: (record?.statut || 'En cours') as ImmobilisationRecord['statut'], cout_estime: record?.cout_estime || 0, cout_final: record?.cout_final || 0, observations: record?.observations || '',
  });
  const [obsError, setObsError] = useState(false);
  const up = (k: string, v: string | number) => setF(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.observations.trim()) { setObsError(true); return; }
    onSave(f, record?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"><h3 className="text-lg font-bold">{record ? 'Modifier' : 'Nouvelle immobilisation'}</h3><button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 p-6">
          <label className="block text-xs font-medium text-slate-600">Véhicule<SearchableSelect value={f.vehicleId} onChange={v => up('vehicleId', v)} placeholder="Sélectionner un véhicule" options={vehicles.map(v => ({ value: v.id, label: v.numero_immatriculation }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="block text-xs font-medium text-slate-600">Garage<input list="immob-garages" autoComplete="off" value={f.garage} onChange={e => up('garage', e.target.value)} placeholder="Nom du garage…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /><datalist id="immob-garages">{knownGarages.map(g => <option key={g} value={g} />)}</datalist></label>
          <label className="block text-xs font-medium text-slate-600">Date d'entrée<input type="date" value={f.date_entree} onChange={e => up('date_entree', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="block text-xs font-medium text-slate-600">Date sortie prévue<input type="date" value={f.date_sortie_prevue} onChange={e => up('date_sortie_prevue', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="block text-xs font-medium text-slate-600">Date sortie réelle<input type="date" value={f.date_sortie_reelle} onChange={e => up('date_sortie_reelle', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="block text-xs font-medium text-slate-600">Statut<select value={f.statut} onChange={e => up('statut', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"><option value="En cours">En cours</option><option value="Terminé">Terminé</option><option value="En attente pièces">En attente pièces</option></select></label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">Travaux en cours / effectués<textarea value={f.travaux} onChange={e => up('travaux', e.target.value)} rows={2} placeholder="Décrivez les travaux…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="block text-xs font-medium text-slate-600">Coût estimé (FCFA)<input type="number" value={f.cout_estime} onChange={e => up('cout_estime', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="block text-xs font-medium text-slate-600">Coût final (FCFA)<input type="number" value={f.cout_final} onChange={e => up('cout_final', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></label>
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            Observations <span className="text-red-500">*</span>
            <textarea
              required
              value={f.observations}
              onChange={e => { up('observations', e.target.value); if (obsError && e.target.value.trim()) setObsError(false); }}
              rows={2}
              placeholder="Champ obligatoire — précisez le contexte, la cause, ou toute information utile…"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${obsError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500'}`}
            />
            {obsError && <span className="mt-1 block text-[11px] font-normal text-red-600">Ce champ est obligatoire.</span>}
          </label>
          <div className="col-span-2 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{record ? 'Mettre à jour' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
