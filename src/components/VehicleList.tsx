import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import type { Vehicle } from '../types';
import {
  Search, Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Printer, FolderTree, CheckSquare, Square, Upload, Download,
} from 'lucide-react';
import VehicleForm from './VehicleForm';
import Pagination from './Pagination';
import VehicleDetailPanel from './VehicleDetailPanel';
import { getVehicleMaintenanceForecast, mergeExpensesWithMaintenance } from '../utils/maintenance';
import { exportRowsToExcel } from '../utils/importExport';
import SearchableSelect from './SearchableSelect';

function fmtMoney(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M FCFA';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + ' K FCFA';
  return v.toLocaleString('fr-FR') + ' FCFA';
}

export default function VehicleList() {
  const { vehicles, expenseRecords, maintenanceRecords, deleteVehicle, deleteMultipleVehicles } = useVehicles();
  const [search, setSearch]           = usePersistedState('fleetgest_filter_vehicles_search', '');
  const [filterStatus, setFilterStatus] = usePersistedState('fleetgest_filter_vehicles_status', '');
  const [filterCarrosserie, setFilterCarrosserie] = usePersistedState('fleetgest_filter_vehicles_carrosserie', '');
  const [filterGenre, setFilterGenre] = usePersistedState('fleetgest_filter_vehicles_genre', '');
  const [filterMarque, setFilterMarque] = usePersistedState('fleetgest_filter_vehicles_marque', '');
  const [filterUsage, setFilterUsage] = usePersistedState('fleetgest_filter_vehicles_usage', '');
  const [filterZone, setFilterZone] = usePersistedState('fleetgest_filter_vehicles_zone', '');
  const [showForm, setShowForm]       = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | undefined>();
  // Fiches dépliées mémorisées (sous forme de tableau dans localStorage) pour retrouver
  // la fiche ouverte au retour dans le menu.
  const [expandedArr, setExpandedArr] = usePersistedState<string[]>('fleetgest_vehicles_expanded', []);
  const expandedIds = useMemo(() => new Set(expandedArr), [expandedArr]);
  const setExpandedIds = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    setExpandedArr((prev) => Array.from(typeof updater === 'function' ? updater(new Set(prev)) : updater));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printOnlyId, setPrintOnlyId] = useState<string | null>(null);
  // Page courante mémorisée : on revient sur la même page après un changement de menu.
  const [currentPage, setCurrentPage] = usePersistedState<number>('fleetgest_vehicles_page', 1);
  const perPage = 8;

  // Impression d'une fiche véhicule individuelle :
  // 1. on déplie la ligne et on isole l'impression à ce véhicule
  // 2. on déclenche window.print() une fois le DOM mis à jour
  const handlePrintVehicle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setPrintOnlyId(id);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintOnlyId(null), 500);
    }, 200);
  };

  // ── Filtres par case de la fiche : carrosserie, genre, marque, usage, zone de travail ──
  // Les choix proposés sont les valeurs réellement présentes sur les véhicules (sans doublon,
  // sans tenir compte de la casse) ; « Non renseigné » apparaît si des fiches ont la case vide.
  const NONE = '__none__';
  const norm = (x?: string) => (x || '').trim().toLowerCase();
  const facets = [
    { id: 'carrosserie', label: 'Toutes les carrosseries', get: (v: Vehicle) => v.carrosserie, value: filterCarrosserie, set: setFilterCarrosserie },
    { id: 'genre',       label: 'Tous les genres',          get: (v: Vehicle) => v.genre,       value: filterGenre,       set: setFilterGenre },
    { id: 'marque',      label: 'Toutes les marques',       get: (v: Vehicle) => v.marque,      value: filterMarque,      set: setFilterMarque },
    { id: 'usage',       label: 'Tous les usages',          get: (v: Vehicle) => v.usage_vehicule, value: filterUsage,    set: setFilterUsage },
    { id: 'zone',        label: 'Toutes les zones de travail', get: (v: Vehicle) => v.zone_travail, value: filterZone,   set: setFilterZone },
  ];
  const facetOptions = useMemo(() => {
    const out: Record<string, { values: string[]; hasEmpty: boolean }> = {};
    facets.forEach((f) => {
      const seen = new Map<string, string>();
      let hasEmpty = false;
      vehicles.forEach((v) => {
        const t = (f.get(v) || '').trim();
        if (!t) { hasEmpty = true; return; }
        if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
      });
      out[f.id] = { values: Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'fr')), hasEmpty };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);
  // Valeur réellement sélectionnable : un filtre mémorisé dont la valeur n'existe plus est ignoré
  const facetState = facets.map((f) => {
    const o = facetOptions[f.id];
    const shown = f.value === NONE ? (o.hasEmpty ? NONE : '') : (o.values.find((x) => norm(x) === norm(f.value)) ?? '');
    return { ...f, o, shown };
  });
  const facetKey = facetState.map((f) => f.shown).join('|');
  const anyFilter = !!(search || filterStatus || facetState.some((f) => f.shown));
  const resetFilters = () => {
    setSearch(''); setFilterStatus('');
    facets.forEach((f) => f.set(''));
    setCurrentPage(1);
  };

  const filtered = useMemo(() => vehicles.filter((v) => {
    const q = search.toLowerCase();
    return (
      (!search ||
        v.numero_immatriculation.toLowerCase().includes(q) ||
        v.marque.toLowerCase().includes(q) ||
        v.type_commercial.toLowerCase().includes(q) ||
        v.conducteur.toLowerCase().includes(q) ||
        v.vin_chassis.toLowerCase().includes(q)) &&
      (!filterStatus || v.statut === filterStatus) &&
      facetState.every((f) => !f.shown || (f.shown === NONE ? !norm(f.get(v)) : norm(f.get(v)) === norm(f.shown)))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [vehicles, search, filterStatus, facetKey]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Dépenses affichées dans la liste = dépenses classiques + interventions de
  // Historique Maintenance, pour rester cohérent avec le total du panneau détaillé.
  const mergedRecords = useMemo(
    () => mergeExpensesWithMaintenance(expenseRecords, maintenanceRecords),
    [expenseRecords, maintenanceRecords]
  );

  // Si la page mémorisée n'existe plus (suppressions, filtre plus restrictif), on se recale
  // sur la dernière page valide. On attend que des véhicules soient chargés : au montage la
  // liste Firestore est encore vide et on ne doit pas écraser la page mémorisée.
  useEffect(() => {
    if (filtered.length > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [filtered.length, totalPages, currentPage, setCurrentPage]);

  const changePage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const expensesByVehicle = useMemo(() => {
    const map = new Map<string, number>();
    mergedRecords.forEach((e) => map.set(e.vehicleId, (map.get(e.vehicleId) ?? 0) + e.montant));
    return map;
  }, [mergedRecords]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(paginated.map((v) => v.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((v) => v.id)));
    }
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (confirm(`Supprimer ${ids.length} véhicule(s) sélectionné(s) ? Cette action est irréversible.`)) {
      deleteMultipleVehicles(ids);
      setSelectedIds(new Set());
      setExpandedIds(new Set());
    }
  };

  const handleEdit = (v: Vehicle) => { setEditVehicle(v); setShowForm(true); };
  const handleAdd  = () => { setEditVehicle(undefined); setShowForm(true); };

  const statusOptions = [
    { value: '', label: 'Tous' },
    { value: 'Actif', label: 'Actif' },
    { value: 'En maintenance', label: 'En maintenance' },
    { value: 'Hors service', label: 'Hors service' },
    { value: 'Réformé', label: 'Réformé' },
  ];

  const allSelected = paginated.length > 0 && selectedIds.size === paginated.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < paginated.length;

  const exportToExcel = () => {
    const rows = filtered.map(v => ({
      'Immatriculation': v.numero_immatriculation,
      'Marque': v.marque,
      'Modèle': v.type_commercial,
      'Couleur': v.couleur,
      'Énergie': v.energie,
      'Statut': v.statut,
      'Kilométrage': v.kilometrage,
      'Conducteur': v.conducteur,
      'Affectation': v.affectation,
      'VIN/Châssis': v.vin_chassis,
      'Date mise en circulation': v.date_mise_circulation,
      'Coût d\'achat (FCFA)': v.cout_achat,
      'Dépenses cumulées (FCFA)': expensesByVehicle.get(v.id) || 0,
    }));
    exportRowsToExcel(rows, 'parc_vehicules.xlsx', 'Véhicules');
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Parc Automobile</h2>
          <p className="mt-1 text-sm text-slate-500">
            {vehicles.length} véhicule(s) — {filtered.length} affiché(s)
            {selectedIds.size > 0 && <span className="ml-2 text-emerald-600 font-semibold">({selectedIds.size} sélectionné(s))</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
          <Link
            to="/vehicules/import"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            title="Importer"
          >
            <Upload className="h-4 w-4" />
          </Link>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            title="Exporter"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Immatriculation, marque, modèle, conducteur, VIN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {facetState.map((f) => (
          <SearchableSelect
            key={f.id}
            aria-label={f.label}
            value={f.shown}
            onChange={(v) => { f.set(v); setCurrentPage(1); }}
            emptyLabel={f.label}
            options={[...f.o.values.map((x) => ({ value: x, label: x })), ...(f.o.hasEmpty ? [{ value: NONE, label: 'Non renseigné' }] : [])]}
            className="min-w-[190px] rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        ))}
        {anyFilter && (
          <button onClick={resetFilters} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Arborescence controls ── */}
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-2">
        <FolderTree className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-600">Arborescence des fiches</span>
        <div className="ml-auto flex gap-2">
          <button onClick={expandAll} className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
            Tout déplier
          </button>
          <button onClick={collapseAll} className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
            Tout replier
          </button>
        </div>
      </div>

      {/* ── Arborescence ── */}
      <div className="space-y-3">
        {/* Header row with select all */}
        {paginated.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-600"
            >
              {allSelected ? (
                <CheckSquare className="h-5 w-5 text-emerald-600" />
              ) : someSelected ? (
                <div className="relative h-5 w-5">
                  <Square className="h-5 w-5 text-emerald-600" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                  </div>
                </div>
              ) : (
                <Square className="h-5 w-5 text-slate-400" />
              )}
              <span>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
            </button>
          </div>
        )}

        {paginated.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            Aucun véhicule trouvé
          </div>
        ) : paginated.map((v) => {
          const isExpanded = expandedIds.has(v.id);
          const isSelected = selectedIds.has(v.id);
          const maintenanceForecast = getVehicleMaintenanceForecast(v, mergedRecords);
          const nextMaintenanceDateLabel = maintenanceForecast.estimatedNextDate
            ? new Date(maintenanceForecast.estimatedNextDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
            : maintenanceForecast.hasHistory
              ? 'À estimer'
              : 'Non renseignée';
          const nextMaintenanceKmLabel = maintenanceForecast.hasHistory
            ? `${maintenanceForecast.nextMaintenanceKm.toLocaleString('fr-FR')} km`
            : 'Non renseigné';
          const isPrintHidden = printOnlyId !== null && printOnlyId !== v.id;
          return (
            <div
              key={v.id}
              className={`rounded-xl border bg-white shadow-sm overflow-hidden ${isSelected ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200'} ${isPrintHidden ? 'print:hidden' : ''}`}
            >
              {/* ── Node header ── */}
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isExpanded ? 'bg-emerald-50 border-b border-emerald-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => toggleExpand(v.id)}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(v.id); }}
                  className="flex-shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Square className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                <button className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:text-emerald-600">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {/* Photo miniature */}
                <div className="flex-shrink-0">
                  {v.photo_url ? (
                    <img src={v.photo_url} alt={v.numero_immatriculation} className="h-10 w-14 rounded-lg object-cover border border-slate-200" />
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                      <span className="text-[10px] text-slate-400">Photo</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-emerald-600">{v.numero_immatriculation}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      v.statut === 'Actif' ? 'bg-green-100 text-green-700' :
                      v.statut === 'En maintenance' ? 'bg-amber-100 text-amber-700' :
                      v.statut === 'Hors service' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{v.statut}</span>
                  </div>
                  <p className="text-xs text-slate-500">{v.marque} {v.type_commercial} — {v.couleur} — {v.energie}</p>
                </div>

                <div className="hidden sm:flex items-center gap-6 text-right">
                  <div>
                    <p className="text-[10px] text-slate-400">Km</p>
                    <p className="text-xs font-semibold text-slate-700">{v.kilometrage.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Dépenses</p>
                    <p className="text-xs font-semibold text-slate-700">{fmtMoney(expensesByVehicle.get(v.id) ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Proch. entretien</p>
                    <p className={`text-xs font-semibold ${
                      maintenanceForecast.alertLevel === 'critical'
                        ? 'text-red-600'
                        : maintenanceForecast.alertLevel === 'warning'
                          ? 'text-amber-600'
                          : 'text-slate-700'
                    }`}>{nextMaintenanceDateLabel}</p>
                    <p className="text-[10px] text-slate-400">{nextMaintenanceKmLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Conducteur</p>
                    <p className="text-xs font-semibold text-slate-700">{v.conducteur || '—'}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(v)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    title="Modifier"
                  ><Pencil className="h-4 w-4" /></button>
                  <button
                    onClick={() => { if (confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ? Tous les enregistrements associés (maintenances, dépenses) seront également supprimés.')) deleteVehicle(v.id); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                  ><Trash2 className="h-4 w-4" /></button>
                  <button
                    onClick={() => handlePrintVehicle(v.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                    title="Imprimer la fiche"
                  ><Printer className="h-4 w-4" /></button>
                </div>
              </div>

              {/* ── Expanded fiche ── */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  <VehicleDetailPanel vehicle={v} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={changePage} />

      {/* ── Formulaire ── */}
      {showForm && (
        <VehicleForm
          vehicle={editVehicle}
          onSave={() => {
            // Modification : on reste sur la page en cours. Ajout : le nouveau véhicule
            // est placé en fin de liste, on va donc sur la dernière page pour le voir.
            if (!editVehicle) setCurrentPage(Math.max(1, Math.ceil((filtered.length + 1) / perPage)));
            setShowForm(false); setEditVehicle(undefined);
          }}
          onClose={() => { setShowForm(false); setEditVehicle(undefined); }}
        />
      )}
    </div>
  );
}
