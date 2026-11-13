import { useMemo } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  AlertTriangle, Car, Gauge, DollarSign, Calendar, Printer, Download,
  CheckSquare, Square, Wrench,
} from 'lucide-react';
import * as XLSX from 'xlsx';

function fmtMoney(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M FCFA';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + ' K FCFA';
  return v.toLocaleString('fr-FR') + ' FCFA';
}

function getAge(dateMiseCirculation: string): number {
  if (!dateMiseCirculation) return 0;
  const diff = Date.now() - new Date(dateMiseCirculation).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export default function VehicleReform() {
  const { vehicles, expenseRecords, maintenanceRecords } = useVehicles();

  // ── Critères ──
  const [ageEnabled,  setAgeEnabled]  = usePersistedState('fleetgest_filter_reform_age_on', false);
  const [kmEnabled,   setKmEnabled]   = usePersistedState('fleetgest_filter_reform_km_on', false);
  const [costEnabled, setCostEnabled] = usePersistedState('fleetgest_filter_reform_cost_on', false);

  const [ageThreshold,  setAgeThreshold]  = usePersistedState('fleetgest_filter_reform_age_val', 5);
  const [kmThreshold,   setKmThreshold]   = usePersistedState('fleetgest_filter_reform_km_val', 150000);
  const [costThreshold, setCostThreshold] = usePersistedState('fleetgest_filter_reform_cost_val', 5000000);

  // ── Calcul coût d'exploitation par véhicule ──
  const exploitationCosts = useMemo(() => {
    const map = new Map<string, number>();
    vehicles.forEach((v) => {
      const maint = maintenanceRecords
        .filter((m) => m.vehicleId === v.id)
        .reduce((s, m) => s + m.cout, 0);
      const expenses = expenseRecords
        .filter((e) => e.vehicleId === v.id)
        .reduce((s, e) => s + e.montant, 0);
      map.set(v.id, maint + expenses + v.cout_assurance_annuel);
    });
    return map;
  }, [vehicles, maintenanceRecords, expenseRecords]);

  // ── Filtrage : intersection (ET) des critères cochés ──
  // Chaque critère activé réduit la liste. Seuls les véhicules respectant TOUS les critères actifs sont affichés.
  const filteredVehicles = useMemo(() => {
    if (!ageEnabled && !kmEnabled && !costEnabled) return [];

    return vehicles.filter((v) => {
      if (ageEnabled && getAge(v.date_mise_circulation) < ageThreshold) return false;
      if (kmEnabled && v.kilometrage < kmThreshold) return false;
      if (costEnabled && (exploitationCosts.get(v.id) ?? 0) < costThreshold) return false;
      return true;
    });
  }, [vehicles, ageEnabled, kmEnabled, costEnabled, ageThreshold, kmThreshold, costThreshold, exploitationCosts]);

  // ── Motifs pour chaque véhicule ──
  const getMotifs = (v: typeof vehicles[0]) => {
    const motifs: string[] = [];
    if (ageEnabled && getAge(v.date_mise_circulation) >= ageThreshold)
      motifs.push(`Âge ≥ ${ageThreshold} ans (${getAge(v.date_mise_circulation)} ans)`);
    if (kmEnabled && v.kilometrage >= kmThreshold)
      motifs.push(`Km ≥ ${kmThreshold.toLocaleString()} (${v.kilometrage.toLocaleString()} km)`);
    if (costEnabled && (exploitationCosts.get(v.id) ?? 0) >= costThreshold)
      motifs.push(`Coût ≥ ${fmtMoney(costThreshold)} (${fmtMoney(exploitationCosts.get(v.id) ?? 0)})`);
    return motifs;
  };

  const noCriteria = !ageEnabled && !kmEnabled && !costEnabled;

  // ── Export Excel ──
  const exportExcel = () => {
    const rows = filteredVehicles.map((v) => ({
      'Immatriculation': v.numero_immatriculation,
      'Marque': v.marque,
      'Modèle': v.type_commercial,
      'Âge (ans)': getAge(v.date_mise_circulation),
      'Kilométrage': v.kilometrage,
      'Coût exploitation (FCFA)': exploitationCosts.get(v.id) ?? 0,
      'Statut actuel': v.statut,
      'Motifs': getMotifs(v).join(' ; '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Réforme véhicules');
    XLSX.writeFile(wb, 'reforme_vehicules.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Plan de réforme</h2>
          <p className="mt-1 text-sm text-slate-500">
            Identifiez les véhicules éligibles à la réforme. Chaque critère activé réduit la liste : seuls les véhicules respectant TOUS les critères cochés sont affichés.
          </p>
        </div>
        <div className="flex gap-2">
          {filteredVehicles.length > 0 && (
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Exporter Excel
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        </div>
      </div>

      {/* Filtres période (pour les coûts) */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200 print:hidden">
        <label className="block text-xs font-medium text-slate-600">Période du<input type="date" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium text-slate-600">au<input type="date" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>

      {/* ── Critères de sélection ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Âge */}
        <div className={`rounded-xl border-2 p-5 shadow-sm transition-all ${ageEnabled ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setAgeEnabled(!ageEnabled)}>
                {ageEnabled
                  ? <CheckSquare className="h-6 w-6 text-amber-600" />
                  : <Square className="h-6 w-6 text-slate-400" />
                }
              </button>
              <div className="flex items-center gap-2">
                <Calendar className={`h-5 w-5 ${ageEnabled ? 'text-amber-600' : 'text-slate-400'}`} />
                <h3 className={`text-sm font-bold ${ageEnabled ? 'text-amber-800' : 'text-slate-700'}`}>Âge du véhicule</h3>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Sélectionner les véhicules dont l'âge est supérieur ou égal au seuil défini.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Seuil (en années)
            <input
              type="number"
              min={1}
              value={ageThreshold}
              onChange={(e) => setAgeThreshold(Math.max(1, Number(e.target.value)))}
              placeholder="Ex: 5"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          <p className="mt-2 text-xs text-slate-400">
            Véhicules concernés : <strong className="text-slate-700">{vehicles.filter((v) => getAge(v.date_mise_circulation) >= ageThreshold).length}</strong>
          </p>
        </div>

        {/* Kilométrage */}
        <div className={`rounded-xl border-2 p-5 shadow-sm transition-all ${kmEnabled ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setKmEnabled(!kmEnabled)}>
                {kmEnabled
                  ? <CheckSquare className="h-6 w-6 text-blue-600" />
                  : <Square className="h-6 w-6 text-slate-400" />
                }
              </button>
              <div className="flex items-center gap-2">
                <Gauge className={`h-5 w-5 ${kmEnabled ? 'text-blue-600' : 'text-slate-400'}`} />
                <h3 className={`text-sm font-bold ${kmEnabled ? 'text-blue-800' : 'text-slate-700'}`}>Kilométrage du véhicule</h3>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Sélectionner les véhicules dont le kilométrage dépasse le seuil défini.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Seuil (en km)
            <input
              type="number"
              min={1000}
              step={5000}
              value={kmThreshold}
              onChange={(e) => setKmThreshold(Math.max(1000, Number(e.target.value)))}
              placeholder="Ex: 150000"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <p className="mt-2 text-xs text-slate-400">
            Véhicules concernés : <strong className="text-slate-700">{vehicles.filter((v) => v.kilometrage >= kmThreshold).length}</strong>
          </p>
        </div>

        {/* Coût d'exploitation */}
        <div className={`rounded-xl border-2 p-5 shadow-sm transition-all ${costEnabled ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setCostEnabled(!costEnabled)}>
                {costEnabled
                  ? <CheckSquare className="h-6 w-6 text-red-600" />
                  : <Square className="h-6 w-6 text-slate-400" />
                }
              </button>
              <div className="flex items-center gap-2">
                <DollarSign className={`h-5 w-5 ${costEnabled ? 'text-red-600' : 'text-slate-400'}`} />
                <h3 className={`text-sm font-bold ${costEnabled ? 'text-red-800' : 'text-slate-700'}`}>Coût d'exploitation</h3>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Sélectionner les véhicules dont le coût d'exploitation total dépasse le seuil.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Seuil (en FCFA)
            <input
              type="number"
              min={100000}
              step={500000}
              value={costThreshold}
              onChange={(e) => setCostThreshold(Math.max(100000, Number(e.target.value)))}
              placeholder="Ex: 5000000"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>
          <p className="mt-2 text-xs text-slate-400">
            Véhicules concernés : <strong className="text-slate-700">{vehicles.filter((v) => (exploitationCosts.get(v.id) ?? 0) >= costThreshold).length}</strong>
          </p>
        </div>
      </div>

      {/* ── Résumé des critères actifs ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="text-sm font-medium text-slate-700">Critères actifs :</span>
        {noCriteria && <span className="text-sm text-slate-400 italic">Aucun critère coché — cochez au moins un critère ci-dessus</span>}
        {ageEnabled && <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-700">Âge ≥ {ageThreshold} ans</span>}
        {kmEnabled && <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-700">Km ≥ {kmThreshold.toLocaleString()}</span>}
        {costEnabled && <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-medium text-red-700">Coût ≥ {fmtMoney(costThreshold)}</span>}
        {!noCriteria && (
          <span className="ml-auto text-sm font-bold text-slate-800">
            {filteredVehicles.length} véhicule(s) éligible(s)
          </span>
        )}
      </div>

      {/* ── Tableau récapitulatif ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Véhicule</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Marque / Modèle</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Âge</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Kilométrage</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Coût exploitation</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Motif(s) de réforme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    {noCriteria
                      ? 'Cochez au moins un critère ci-dessus pour afficher les véhicules éligibles à la réforme.'
                      : 'Aucun véhicule ne correspond aux critères sélectionnés.'}
                  </td>
                </tr>
              ) : (
                filteredVehicles
                  .sort((a, b) => (exploitationCosts.get(b.id) ?? 0) - (exploitationCosts.get(a.id) ?? 0))
                  .map((v) => {
                    const age = getAge(v.date_mise_circulation);
                    const cost = exploitationCosts.get(v.id) ?? 0;
                    const motifs = getMotifs(v);
                    return (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="font-bold text-emerald-600">{v.numero_immatriculation}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{v.marque}</p>
                          <p className="text-xs text-slate-500">{v.type_commercial} — {v.couleur}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            age >= ageThreshold && ageEnabled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>{age} ans</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${
                            v.kilometrage >= kmThreshold && kmEnabled ? 'text-blue-700' : 'text-slate-700'
                          }`}>{v.kilometrage.toLocaleString()} km</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${
                            cost >= costThreshold && costEnabled ? 'text-red-700' : 'text-slate-700'
                          }`}>{fmtMoney(cost)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            v.statut === 'Actif' ? 'bg-green-100 text-green-700' :
                            v.statut === 'En maintenance' ? 'bg-amber-100 text-amber-700' :
                            v.statut === 'Hors service' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{v.statut}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {motifs.map((m, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 border border-red-200">
                                <Wrench className="h-2.5 w-2.5" />
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Comment fonctionne la réforme ?
        </h3>
        <div className="space-y-1 text-sm text-slate-600">
          <p>• <strong>Cochez un ou plusieurs critères</strong> ci-dessus : âge, kilométrage et/ou coût d'exploitation.</p>
          <p>• Les critères agissent en <strong>intersection (ET)</strong> : chaque critère coché réduit la liste aux véhicules qui respectent TOUS les critères actifs.</p>
          <p>• <strong>Ajustez les seuils</strong> pour affiner la liste.</p>
          <p>• Le <strong>coût d'exploitation</strong> inclut : dépenses + maintenance + assurance annuelle.</p>
          <p>• Vous pouvez <strong>exporter</strong> la liste en Excel ou <strong>imprimer</strong> le rapport.</p>
        </div>
      </div>
    </div>
  );
}
