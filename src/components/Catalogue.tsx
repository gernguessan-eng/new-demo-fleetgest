import { useMemo, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  Package, Plus, Printer, Search, Trash2, Pencil, X, Info,
  TrendingUp, TrendingDown, Minus, History, AlertTriangle,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import SortToggleButton, { type SortDirection } from './SortToggleButton';
import {
  type CataloguePiece, type PriceHistoryEntry,
  CATALOGUE_STORAGE_KEY as STORAGE_KEY, SAMPLE_CATALOGUE as SAMPLE,
} from '../types/catalogue';
import SearchableSelect from './SearchableSelect';

function load(): CataloguePiece[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : SAMPLE; } catch { return SAMPLE; }
}

function fmtDate(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtMoney(n: number) { return n.toLocaleString('fr-FR') + ' FCFA'; }

function getLastTwo(historique: PriceHistoryEntry[]): { precedente?: PriceHistoryEntry; actuelle?: PriceHistoryEntry } {
  const sorted = [...historique].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { precedente: sorted[sorted.length - 2], actuelle: sorted[sorted.length - 1] };
}

function computeVariation(precedente?: PriceHistoryEntry, actuelle?: PriceHistoryEntry) {
  if (!precedente || !actuelle || precedente.valeur === 0) return { ecart: null as number | null, pct: null as number | null };
  const ecart = actuelle.valeur - precedente.valeur;
  const pct = (ecart / precedente.valeur) * 100;
  return { ecart, pct };
}

function classifyVariation(pct: number | null): { label: string; badgeClass: string; icon: 'up' | 'down' | 'flat' | 'new' } {
  if (pct === null) return { label: 'Nouvelle pièce', badgeClass: 'bg-slate-100 text-slate-500', icon: 'new' };
  if (pct === 0) return { label: 'Stable', badgeClass: 'bg-slate-100 text-slate-600', icon: 'flat' };
  const abs = Math.abs(pct);
  if (pct > 0) {
    if (abs < 5) return { label: 'Légère hausse', badgeClass: 'bg-amber-50 text-amber-600', icon: 'up' };
    if (abs < 15) return { label: 'Hausse modérée', badgeClass: 'bg-amber-100 text-amber-700', icon: 'up' };
    return { label: 'Forte hausse', badgeClass: 'bg-red-100 text-red-700', icon: 'up' };
  }
  if (abs < 5) return { label: 'Légère baisse', badgeClass: 'bg-emerald-50 text-emerald-600', icon: 'down' };
  if (abs < 15) return { label: 'Baisse modérée', badgeClass: 'bg-emerald-100 text-emerald-700', icon: 'down' };
  return { label: 'Forte baisse', badgeClass: 'bg-blue-100 text-blue-700', icon: 'down' };
}

const VariationIcon = ({ icon }: { icon: 'up' | 'down' | 'flat' | 'new' }) => {
  if (icon === 'up') return <TrendingUp className="h-3.5 w-3.5" />;
  if (icon === 'down') return <TrendingDown className="h-3.5 w-3.5" />;
  if (icon === 'flat') return <Minus className="h-3.5 w-3.5" />;
  return null;
};

export default function Catalogue() {
  const [pieces, setPieces] = useState<CataloguePiece[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [editPiece, setEditPiece] = useState<CataloguePiece | undefined>();
  const [prefillNom, setPrefillNom] = useState('');
  const [search, setSearch] = usePersistedState('fleetgest_filter_catalogue_search', '');
  const [fichePieceId, setFichePieceId] = useState<string | null>(null);
  const [selectedChartPieceId, setSelectedChartPieceId] = useState<string>('');

  const save = (next: CataloguePiece[]) => { setPieces(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };

  const knownPieceNames = useMemo(() => Array.from(new Set(pieces.map(p => p.nom_piece))).sort(), [pieces]);
  const knownSuppliers = useMemo(() => {
    const s = new Set<string>();
    pieces.forEach(p => p.historique.forEach(h => { if (h.fournisseur) s.add(h.fournisseur); }));
    return Array.from(s).sort();
  }, [pieces]);

  const rows = useMemo(() => pieces.map(p => {
    const { precedente, actuelle } = getLastTwo(p.historique);
    const { ecart, pct } = computeVariation(precedente, actuelle);
    const variation = classifyVariation(pct);
    return { piece: p, precedente, actuelle, ecart, pct, variation };
  }), [pieces]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => !q || r.piece.nom_piece.toLowerCase().includes(q) || r.piece.reference.toLowerCase().includes(q) || (r.actuelle?.fournisseur || '').toLowerCase().includes(q))
      .sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0));
  }, [rows, search]);

  // ── Analyses ──
  const stats = useMemo(() => {
    const withVariation = rows.filter(r => r.pct !== null);
    const hausses = withVariation.filter(r => (r.pct ?? 0) > 0).length;
    const baisses = withVariation.filter(r => (r.pct ?? 0) < 0).length;
    const variationMoyenne = withVariation.length > 0 ? withVariation.reduce((s, r) => s + (r.pct ?? 0), 0) / withVariation.length : 0;
    const fortesHausses = withVariation.filter(r => (r.pct ?? 0) >= 15).length;
    return { total: pieces.length, hausses, baisses, variationMoyenne, fortesHausses };
  }, [rows, pieces]);

  const topVariations = useMemo(() => rows
    .filter(r => r.pct !== null)
    .sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))
    .slice(0, 6)
    .map(r => ({ name: r.piece.nom_piece.length > 18 ? r.piece.nom_piece.slice(0, 16) + '…' : r.piece.nom_piece, pct: Math.round((r.pct ?? 0) * 10) / 10 }))
    .reverse(), [rows]);

  const chartPiece = pieces.find(p => p.id === selectedChartPieceId) || pieces[0];
  const chartData = useMemo(() => {
    if (!chartPiece) return [];
    return [...chartPiece.historique].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(h => ({ date: fmtDate(h.date), valeur: h.valeur }));
  }, [chartPiece]);

  // Fusionne intelligemment : si le nom de pièce correspond déjà à une pièce connue
  // (insensible à la casse/espaces), on ajoute un nouveau prix à son historique
  // plutôt que de créer un doublon — c'est ce qui rend la saisie suivante "intuitive".
  const handleSavePrice = (data: { nom_piece: string; reference: string; fournisseur: string; date: string; valeur: number; observations: string }, existingId?: string) => {
    const matched = existingId
      ? pieces.find(p => p.id === existingId)
      : pieces.find(p => p.nom_piece.trim().toLowerCase() === data.nom_piece.trim().toLowerCase());

    if (matched) {
      save(pieces.map(p => p.id === matched.id
        ? { ...p, reference: data.reference || p.reference, observations: data.observations || p.observations, historique: [...p.historique, { id: 'ph' + Date.now(), date: data.date, valeur: data.valeur, fournisseur: data.fournisseur }] }
        : p));
    } else {
      const newPiece: CataloguePiece = {
        id: 'cat' + Date.now(),
        nom_piece: data.nom_piece.trim(),
        reference: data.reference,
        observations: data.observations,
        historique: [{ id: 'ph' + Date.now(), date: data.date, valeur: data.valeur, fournisseur: data.fournisseur }],
      };
      save([...pieces, newPiece]);
    }
    setShowForm(false); setEditPiece(undefined); setPrefillNom('');
  };

  const handleEditInfo = (data: { nom_piece: string; reference: string; observations: string }, id: string) => {
    save(pieces.map(p => p.id === id ? { ...p, nom_piece: data.nom_piece.trim() || p.nom_piece, reference: data.reference, observations: data.observations } : p));
    setEditPiece(undefined); setShowForm(false);
  };

  const handleDelete = (id: string) => { if (confirm('Supprimer cette pièce et tout son historique de prix ?')) save(pieces.filter(p => p.id !== id)); };

  // Met à jour l'historique complet d'une pièce (édition/suppression d'une entrée de prix
  // précise, depuis la fiche détaillée ouverte au clic sur une ligne).
  const handleUpdateHistorique = (pieceId: string, historique: PriceHistoryEntry[]) => {
    save(pieces.map(p => p.id === pieceId ? { ...p, historique } : p));
  };

  const fichePiece = pieces.find(p => p.id === fichePieceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Catalogue des pièces de rechange</h2>
          <p className="mt-1 text-sm text-slate-500">Suivi des prix d'achat et de leur fluctuation dans le temps</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditPiece(undefined); setPrefillNom(''); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Plus className="h-4 w-4" /> Ajouter un prix</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 print:hidden">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>Saisie intuitive : tapez le nom d'une pièce déjà enregistrée (suggestion automatique) pour lui ajouter un nouveau prix — il viendra s'ajouter à son historique au lieu de créer un doublon. La colonne « Valeur d'achat » affiche l'avant-dernier prix connu, « Valeur d'achat actuelle » le dernier.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-slate-500">Pièces suivies</p><p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-red-500">Hausses de prix</p><p className="mt-1 text-2xl font-bold text-red-600">{stats.hausses}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-emerald-500">Baisses de prix</p><p className="mt-1 text-2xl font-bold text-emerald-600">{stats.baisses}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-slate-500">Variation moyenne</p><p className={`mt-1 text-2xl font-bold ${stats.variationMoyenne > 0 ? 'text-red-600' : stats.variationMoyenne < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{stats.variationMoyenne > 0 ? '+' : ''}{stats.variationMoyenne.toFixed(1)}%</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase text-amber-600">Fortes hausses (≥15%)</p><p className="mt-1 text-2xl font-bold text-amber-700">{stats.fortesHausses}</p></div>
      </div>

      {/* Recherche */}
      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une pièce, référence, fournisseur…" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>{['Pièce de rechange', 'Référence', 'Valeur d\'achat', 'Fournisseur', 'Valeur d\'achat actuelle', 'Fournisseur actuel', 'Écart', 'Niveau', ''].map(h => <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? <tr><td colSpan={9} className="py-10 text-center text-slate-400">Aucune pièce enregistrée</td></tr> :
                filtered.map(({ piece, precedente, actuelle, ecart, pct, variation }) => (
                  <tr key={piece.id} onClick={() => setFichePieceId(piece.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {piece.nom_piece}
                      {piece.historique.length > 1 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-normal text-blue-500"><History className="h-3 w-3" />{piece.historique.length} prix</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{piece.reference || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{precedente ? fmtMoney(precedente.valeur) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{precedente?.fournisseur || '—'}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-900">{actuelle ? fmtMoney(actuelle.valeur) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{actuelle?.fournisseur || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {ecart !== null ? (
                        <span className={`font-bold ${ecart > 0 ? 'text-red-600' : ecart < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {ecart > 0 ? '+' : ''}{fmtMoney(ecart)} <span className="font-normal">({pct !== null ? (pct > 0 ? '+' : '') + pct.toFixed(1) : 0}%)</span>
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${variation.badgeClass}`}><VariationIcon icon={variation.icon} />{variation.label}</span></td>
                    <td className="px-3 py-2 print:hidden">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setPrefillNom(piece.nom_piece); setEditPiece(undefined); setShowForm(true); }} className="p-1 text-slate-400 hover:text-emerald-600" title="Ajouter un nouveau prix"><Plus className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setFichePieceId(piece.id)} className="p-1 text-slate-400 hover:text-blue-600" title="Ouvrir la fiche"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(piece.id)} className="p-1 text-slate-400 hover:text-red-600" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analyses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Package className="h-4 w-4 text-emerald-500" />Évolution du prix d'une pièce</h3>
            {pieces.length > 0 && (
              <SearchableSelect value={chartPiece?.id || ''} onChange={setSelectedChartPieceId} aria-label="Pièce" options={pieces.map(p => ({ value: p.id, label: p.nom_piece }))} className="min-w-[180px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" />
            )}
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v: any) => [fmtMoney(Number(v)), 'Prix']} />
                <Line type="monotone" dataKey="valeur" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }}>
                  <LabelList dataKey="valeur" position="top" formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`} style={{ fontSize: 10, fill: '#475569' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="py-16 text-center text-sm text-slate-400">Pas assez d'historique pour cette pièce (au moins 2 prix requis).</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"><AlertTriangle className="h-4 w-4 text-amber-500" />Plus fortes variations de prix</h3>
          {topVariations.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topVariations} layout="vertical" margin={{ top: 5, left: 5, right: 35, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} interval={0} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => [`${v > 0 ? '+' : ''}${v}%`, 'Variation']} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={18}>
                  {topVariations.map((d, i) => <Cell key={i} fill={d.pct > 0 ? '#ef4444' : '#10b981'} />)}
                  <LabelList dataKey="pct" position="right" formatter={(v: any) => `${v > 0 ? '+' : ''}${v}%`} style={{ fontSize: 10, fontWeight: 'bold', fill: '#475569' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-16 text-center text-sm text-slate-400">Pas assez de données pour une comparaison.</p>}
        </div>
      </div>

      {showForm && (
        <PriceFormModal
          editPiece={editPiece}
          prefillNom={prefillNom}
          knownPieceNames={knownPieceNames}
          knownSuppliers={knownSuppliers}
          pieces={pieces}
          onSavePrice={handleSavePrice}
          onEditInfo={handleEditInfo}
          onClose={() => { setShowForm(false); setEditPiece(undefined); setPrefillNom(''); }}
        />
      )}

      {fichePiece && (
        <FicheModal
          piece={fichePiece}
          knownSuppliers={knownSuppliers}
          onUpdateHistorique={handleUpdateHistorique}
          onEditInfo={handleEditInfo}
          onClose={() => setFichePieceId(null)}
        />
      )}
    </div>
  );
}

function PriceFormModal({ editPiece, prefillNom, knownPieceNames, knownSuppliers, pieces, onSavePrice, onEditInfo, onClose }: {
  editPiece?: CataloguePiece;
  prefillNom: string;
  knownPieceNames: string[];
  knownSuppliers: string[];
  pieces: CataloguePiece[];
  onSavePrice: (data: { nom_piece: string; reference: string; fournisseur: string; date: string; valeur: number; observations: string }, existingId?: string) => void;
  onEditInfo: (data: { nom_piece: string; reference: string; observations: string }, id: string) => void;
  onClose: () => void;
}) {
  const isEditMode = !!editPiece;
  const [nomPiece, setNomPiece] = useState(editPiece?.nom_piece || prefillNom || '');
  const [reference, setReference] = useState(editPiece?.reference || '');
  const [observations, setObservations] = useState(editPiece?.observations || '');
  const [fournisseur, setFournisseur] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [valeur, setValeur] = useState('');

  const matched = useMemo(() => pieces.find(p => p.nom_piece.trim().toLowerCase() === nomPiece.trim().toLowerCase()), [pieces, nomPiece]);

  // Auto-complète la référence dès qu'une pièce connue est reconnue — c'est le
  // comportement "intuitif" demandé pour les saisies suivantes.
  const handleNomChange = (v: string) => {
    setNomPiece(v);
    const m = pieces.find(p => p.nom_piece.trim().toLowerCase() === v.trim().toLowerCase());
    if (m && !reference) setReference(m.reference);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && editPiece) {
      onEditInfo({ nom_piece: nomPiece, reference, observations }, editPiece.id);
      return;
    }
    if (!nomPiece.trim() || !fournisseur.trim() || !valeur) return;
    onSavePrice({ nom_piece: nomPiece, reference, fournisseur, date, valeur: Number(valeur), observations }, matched?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold">{isEditMode ? 'Modifier la pièce' : 'Ajouter un prix'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <label className="block text-xs font-medium text-slate-600">
            Nom de la pièce de rechange
            <input required list="catalogue-piece-names" value={nomPiece} onChange={e => handleNomChange(e.target.value)} placeholder="Ex: Plaquettes de frein avant" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <datalist id="catalogue-piece-names">{knownPieceNames.map(n => <option key={n} value={n} />)}</datalist>
          </label>

          {!isEditMode && matched && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 border border-emerald-100">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>Pièce déjà connue ({matched.historique.length} prix enregistré{matched.historique.length > 1 ? 's' : ''}) — ce nouveau prix viendra s'ajouter à son historique.</p>
            </div>
          )}

          <label className="block text-xs font-medium text-slate-600">Référence (optionnel)
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ex: PF-2201" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>

          {!isEditMode && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-600">Date d'achat
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </label>
                <label className="block text-xs font-medium text-slate-600">Valeur d'achat actuelle (FCFA)
                  <input type="number" required min="0" value={valeur} onChange={e => setValeur(e.target.value)} placeholder="Ex: 42000" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-600">Fournisseur
                <input required list="catalogue-suppliers" value={fournisseur} onChange={e => setFournisseur(e.target.value)} placeholder="Ex: Auto Service Abidjan" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <datalist id="catalogue-suppliers">{knownSuppliers.map(s => <option key={s} value={s} />)}</datalist>
              </label>
            </>
          )}

          <label className="block text-xs font-medium text-slate-600">Observations
            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>

          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{isEditMode ? 'Mettre à jour' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FicheModal({ piece, knownSuppliers, onUpdateHistorique, onEditInfo, onClose }: {
  piece: CataloguePiece;
  knownSuppliers: string[];
  onUpdateHistorique: (pieceId: string, historique: PriceHistoryEntry[]) => void;
  onEditInfo: (data: { nom_piece: string; reference: string; observations: string }, id: string) => void;
  onClose: () => void;
}) {
  const [nomPiece, setNomPiece] = useState(piece.nom_piece);
  const [reference, setReference] = useState(piece.reference);
  const [observations, setObservations] = useState(piece.observations);
  const [rows, setRows] = useState<PriceHistoryEntry[]>(
    [...piece.historique].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newEntry, setNewEntry] = useState({ date: new Date().toISOString().slice(0, 10), valeur: '', fournisseur: '' });

  // L'écart de prix se calcule toujours par rapport à l'entrée chronologiquement
  // précédente, indépendamment du sens d'affichage choisi par l'utilisateur.
  const chronoDesc = useMemo(
    () => [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [rows]
  );
  const diffById = useMemo(() => {
    const map = new Map<string, number | null>();
    chronoDesc.forEach((h, i) => {
      const prev = chronoDesc[i + 1];
      map.set(h.id, prev ? h.valeur - prev.valeur : null);
    });
    return map;
  }, [chronoDesc]);
  const displayRows = useMemo(
    () => (sortDir === 'desc' ? chronoDesc : [...chronoDesc].reverse()),
    [chronoDesc, sortDir]
  );

  const updateRow = (id: string, patch: Partial<PriceHistoryEntry>) => {
    const next = rows.map(r => r.id === id ? { ...r, ...patch } : r);
    setRows(next);
    onUpdateHistorique(piece.id, next);
  };

  const deleteRow = (id: string) => {
    if (rows.length <= 1) { alert("Impossible de supprimer le dernier prix d'une pièce. Supprimez la pièce entière si besoin."); return; }
    if (!confirm('Supprimer cette entrée de prix ?')) return;
    const next = rows.filter(r => r.id !== id);
    setRows(next);
    onUpdateHistorique(piece.id, next);
  };

  const addRow = () => {
    if (!newEntry.valeur || !newEntry.fournisseur.trim()) return;
    const entry: PriceHistoryEntry = { id: 'ph' + Date.now(), date: newEntry.date, valeur: Number(newEntry.valeur), fournisseur: newEntry.fournisseur.trim() };
    const next = [entry, ...rows];
    setRows(next);
    onUpdateHistorique(piece.id, next);
    setNewEntry({ date: new Date().toISOString().slice(0, 10), valeur: '', fournisseur: '' });
    setShowAddRow(false);
  };

  const saveInfo = () => onEditInfo({ nom_piece: nomPiece, reference, observations }, piece.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold">Fiche pièce</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 border-b p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-600">Nom de la pièce
              <input value={nomPiece} onChange={e => setNomPiece(e.target.value)} onBlur={saveInfo} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <label className="block text-xs font-medium text-slate-600">Référence
              <input value={reference} onChange={e => setReference(e.target.value)} onBlur={saveInfo} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">Observations
            <textarea value={observations} onChange={e => setObservations(e.target.value)} onBlur={saveInfo} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
        </div>

        <div className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">Historique des prix ({rows.length})<SortToggleButton direction={sortDir} onToggle={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} /></h4>
            <button onClick={() => setShowAddRow(v => !v)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" /> Ajouter un prix</button>
          </div>

          {showAddRow && (
            <div className="mb-3 grid grid-cols-[1fr_1fr_1.4fr_auto] items-end gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <label className="block text-[10px] font-medium text-slate-600">Date
                <input type="date" value={newEntry.date} onChange={e => setNewEntry(v => ({ ...v, date: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </label>
              <label className="block text-[10px] font-medium text-slate-600">Valeur (FCFA)
                <input type="number" min="0" value={newEntry.valeur} onChange={e => setNewEntry(v => ({ ...v, valeur: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </label>
              <label className="block text-[10px] font-medium text-slate-600">Fournisseur
                <input list="fiche-suppliers" value={newEntry.fournisseur} onChange={e => setNewEntry(v => ({ ...v, fournisseur: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                <datalist id="fiche-suppliers">{knownSuppliers.map(s => <option key={s} value={s} />)}</datalist>
              </label>
              <button onClick={addRow} className="h-[30px] rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">OK</button>
            </div>
          )}

          <div className="space-y-2">
            {displayRows.map((h) => {
              const diff = diffById.get(h.id) ?? null;
              return (
                <div key={h.id} className="grid grid-cols-[1fr_1fr_1.4fr_auto_auto] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <input type="date" value={h.date} onChange={e => updateRow(h.id, { date: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" />
                  <input type="number" min="0" value={h.valeur} onChange={e => updateRow(h.id, { valeur: Number(e.target.value) })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold" />
                  <input list="fiche-suppliers" value={h.fournisseur} onChange={e => updateRow(h.id, { fournisseur: e.target.value })} placeholder="Fournisseur" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" />
                  {diff !== null ? (
                    <span className={`text-[11px] font-bold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{diff > 0 ? '+' : ''}{fmtMoney(diff)}</span>
                  ) : <span />}
                  <button onClick={() => deleteRow(h.id)} className="p-1 text-slate-400 hover:text-red-600" title="Supprimer cette entrée"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Fermer</button>
        </div>
      </div>
    </div>
  );
}
