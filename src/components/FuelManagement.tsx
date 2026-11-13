import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import { getFuelPrice, fuelPricesFromSettings } from '../utils/fuelPrices';
import { parseSpreadsheetFile, getCell, parseAmount, exportRowsToExcel } from '../utils/importExport';
import type { ExpenseRecord } from '../types';
import { 
  Fuel, DollarSign, TrendingUp, Download, Printer, PieChart as PieChartIcon, 
  BarChart as BarChartIcon, CheckCircle2, MapPin, Calendar, Tag, Layers, Upload,
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList, LineChart, Line
} from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function formatFCFA(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA';
}

export default function FuelManagement() {
  const { vehicles, expenseRecords, importExpenseRecords, appSettings } = useVehicles();
  const fuelPrices = fuelPricesFromSettings(appSettings);
  const [periodFrom, setPeriodFrom] = usePersistedState('fleetgest_filter_fuel_from', '');
  const [periodTo, setPeriodTo] = usePersistedState('fleetgest_filter_fuel_to', '');
  const [importMessage, setImportMessage] = useState('');
  const [preview, setPreview] = useState<ExpenseRecord[]>([]);

  const fuelExpenses = useMemo(() => {
    let list = expenseRecords.filter(e => e.categorie === 'Carburant');
    if (periodFrom) list = list.filter(e => e.date >= periodFrom);
    if (periodTo) list = list.filter(e => e.date <= periodTo);
    return list;
  }, [expenseRecords, periodFrom, periodTo]);

  const stats = useMemo(() => {
    const total = fuelExpenses.reduce((sum, e) => sum + e.montant, 0);
    const count = fuelExpenses.length;
    const avg = count > 0 ? total / count : 0;
    
    // Payment methods
    const paymentMethods: Record<string, number> = {};
    fuelExpenses.forEach(e => {
      const m = e.mode_paiement || 'Inconnu';
      paymentMethods[m] = (paymentMethods[m] || 0) + e.montant;
    });
    const paymentData = Object.entries(paymentMethods).map(([name, value]) => ({ name, value }));

    // By vehicle
    const vehicleById = new Map(vehicles.map(v => [v.id, v]));
    const vehicleUsage: Record<string, number> = {};
    fuelExpenses.forEach(e => {
      const v = vehicleById.get(e.vehicleId);
      const label = v ? v.numero_immatriculation : 'Inconnu';
      vehicleUsage[label] = (vehicleUsage[label] || 0) + e.montant;
    });
    const vehicleData = Object.entries(vehicleUsage)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Real vs Theoretical
    // Théorique = coût de référence pour 100 km, basé uniquement sur la consommation constructeur
    // (L/100km) et le prix carburant — indépendant du kilométrage total du véhicule.
    const comparisonData = vehicles.map(v => {
      const actualCost = fuelExpenses
        .filter(e => e.vehicleId === v.id)
        .reduce((sum, e) => sum + e.montant, 0);

      const theoreticalCostPer100 = (v.consommation_100km || 0) * getFuelPrice(v.energie, fuelPrices);

      return {
        name: v.numero_immatriculation,
        Reel: actualCost,
        Theorique: Math.round(theoreticalCostPer100)
      };
    }).filter(d => d.Reel > 0);
    // ── Répartition des consommations / zone de travail ──
    // La zone d'une dépense est celle du véhicule auquel elle est affectée (case « Zone de travail » de sa fiche).
    // Les zones qui ont des véhicules affectés mais aucune dépense carburant sur la période restent affichées (0 FCFA).
    const zoneOf = (v?: (typeof vehicles)[number]) => (v ? (v.zone_travail?.trim() || 'Non renseigné') : 'Véhicule inconnu');
    const zoneMap = new Map<string, { value: number; count: number; actifs: Set<string>; affectes: number }>();
    const zoneEntry = (z: string) => {
      let e = zoneMap.get(z);
      if (!e) { e = { value: 0, count: 0, actifs: new Set(), affectes: 0 }; zoneMap.set(z, e); }
      return e;
    };
    vehicles.forEach(v => { zoneEntry(zoneOf(v)).affectes += 1; });
    fuelExpenses.forEach(e => {
      const entry = zoneEntry(zoneOf(vehicleById.get(e.vehicleId)));
      entry.value += e.montant;
      entry.count += 1;
      entry.actifs.add(e.vehicleId);
    });
    const zoneData = Array.from(zoneMap.entries())
      .map(([name, x]) => ({
        name, value: x.value, count: x.count,
        affectes: x.affectes, actifs: x.actifs.size,
        moyenne: x.actifs.size > 0 ? Math.round(x.value / x.actifs.size) : 0,
      }))
      .sort((p, q) => q.value - p.value || p.name.localeCompare(q.name, 'fr'));

    // ── Évolution mensuelle des dépenses carburant ──
    const monthlyMap = new Map<string, number>();
    fuelExpenses.forEach((e) => {
      if (!e.date) return;
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + e.montant);
    });
    const monthlyData = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, value]) => {
        const [year, month] = key.split('-');
        const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        return {
          mois: `${monthLabels[parseInt(month, 10) - 1]} ${year.slice(-2)}`,
          montant: value,
        };
      });

    // ── Consommation par marque ──
    const brandMap = new Map<string, { total: number; count: number; vehicles: Set<string> }>();
    fuelExpenses.forEach((e) => {
      const v = vehicleById.get(e.vehicleId);
      if (!v) return;
      const brand = v.marque || 'Inconnue';
      const entry = brandMap.get(brand) || { total: 0, count: 0, vehicles: new Set() };
      entry.total += e.montant;
      entry.count += 1;
      entry.vehicles.add(v.id);
      brandMap.set(brand, entry);
    });
    const brandData = Array.from(brandMap.entries())
      .map(([name, entry]) => ({
        name,
        Total: entry.total,
        Moyenne: Math.round(entry.total / entry.vehicles.size),
        nbVehicules: entry.vehicles.size,
      }))
      .sort((a, b) => b.Total - a.Total);

    // ── Consommation par type de véhicule (carrosserie/genre) ──
    const typeMap = new Map<string, { total: number; vehicles: Set<string> }>();
    fuelExpenses.forEach((e) => {
      const v = vehicleById.get(e.vehicleId);
      if (!v) return;
      const type = v.carrosserie || v.genre || 'Non renseigné';
      const entry = typeMap.get(type) || { total: 0, vehicles: new Set() };
      entry.total += e.montant;
      entry.vehicles.add(v.id);
      typeMap.set(type, entry);
    });
    const typeData = Array.from(typeMap.entries())
      .map(([name, entry]) => ({
        name,
        Total: entry.total,
        Moyenne: Math.round(entry.total / entry.vehicles.size),
        nbVehicules: entry.vehicles.size,
      }))
      .sort((a, b) => b.Total - a.Total);

    return { 
      total, count, avg, 
      paymentData, vehicleData, comparisonData, zoneData,
      monthlyData, brandData, typeData
    };
  }, [fuelExpenses, vehicles]);

  const exportToExcel = () => {
    const data = fuelExpenses.map(e => {
      const v = vehicles.find(veh => veh.id === e.vehicleId);
      return {
        'Date': e.date,
        'Véhicule': v ? v.numero_immatriculation : 'Inconnu',
        'Libellé': e.libelle,
        'Montant': e.montant,
        'Fournisseur': e.fournisseur,
        'Mode Paiement': e.mode_paiement,
        'Notes': e.notes
      };
    });
    exportRowsToExcel(data, 'gestion_carburant.xlsx', 'Dépenses Carburant');
  };

  const handlePrint = () => {
    window.print();
  };

  const buildFuelExpenseFromRow = (row: Record<string, unknown>, index: number): ExpenseRecord | null => {
    const plate = getCell(row, ['immatriculation', 'numero_immatriculation', 'plaque', 'vehicule', 'véhicule']);
    const vehicle = vehicles.find((v) => v.numero_immatriculation.toLowerCase() === plate.toLowerCase());
    if (!vehicle) return null;
    const montant = parseAmount(getCell(row, ['montant', 'cout', 'coût', 'prix', 'amount']));
    if (!montant) return null;
    const date = getCell(row, ['date']) || new Date().toISOString().slice(0, 10);
    return {
      id: 'e-import-' + Date.now() + '-' + index,
      vehicleId: vehicle.id,
      date,
      categorie: 'Carburant',
      libelle: getCell(row, ['libelle', 'libellé', 'description']) || 'Carburant',
      montant,
      fournisseur: getCell(row, ['fournisseur', 'station', 'prestataire']),
      mode_paiement: getCell(row, ['mode_paiement', 'paiement', 'mode']) || 'Non précisé',
      numero_piece: getCell(row, ['numero_piece', 'n_piece', 'facture', 'recu', 'reçu']),
      justificatif_nom: '',
      notes: getCell(row, ['notes', 'observation', 'observations']),
    };
  };

  const processImportFile = async (file: File) => {
    setImportMessage('Traitement du fichier en cours...');
    setPreview([]);
    try {
      const rows = await parseSpreadsheetFile(file);
      const imported = rows
        .map((row, index) => buildFuelExpenseFromRow(row, index))
        .filter((e): e is ExpenseRecord => Boolean(e));
      setPreview(imported);
      setImportMessage(imported.length > 0
        ? `${imported.length} plein(s) de carburant valide(s) détecté(s).`
        : 'Aucune ligne valide détectée. Vérifiez que la colonne "immatriculation" correspond à un véhicule existant et que le montant est renseigné.');
    } catch (error) {
      setImportMessage('Erreur: ' + (error as Error).message);
    }
  };

  const confirmImport = () => {
    importExpenseRecords(preview);
    setImportMessage(`${preview.length} plein(s) importé(s) avec succès.`);
    setPreview([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion Carburant</h2>
          <p className="mt-1 text-sm text-slate-500">Analyses approfondies des consommations et coûts de carburant</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer" title="Importer">
            <Upload className="h-4 w-4" /> Importer
            <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && processImportFile(e.target.files[0])} />
          </label>
          <button onClick={exportToExcel} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> Exporter</button>
          <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>

      {importMessage && <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 print:hidden">{importMessage}</p>}
      {preview.length > 0 && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 flex items-center justify-between print:hidden">
          <span className="text-sm text-emerald-800">{preview.length} plein(s) prêt(s) à importer</span>
          <button onClick={confirmImport} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Confirmer l'import</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <Fuel className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Dépenses Carburant Totales</p>
              <p className="text-xl font-bold text-slate-900">{formatFCFA(stats.total)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Nombre de Pleins</p>
              <p className="text-xl font-bold text-slate-900">{stats.count}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Coût Moyen / Plein</p>
              <p className="text-xl font-bold text-slate-900">{formatFCFA(Math.round(stats.avg))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200 print:hidden">
        <label className="block text-xs font-medium text-slate-600">Période du<input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></label>
        <label className="block text-xs font-medium text-slate-600">au<input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" /></label>
        {(periodFrom || periodTo) && <button onClick={() => { setPeriodFrom(''); setPeriodTo(''); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Réinitialiser</button>}
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payment Methods */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <PieChartIcon className="h-5 w-5 text-indigo-500" />
            Répartition par Mode de Paiement
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`}
                >
                  {stats.paymentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatFCFA(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Vehicle */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <BarChartIcon className="h-5 w-5 text-emerald-500" />
            Dépenses Carburant par Véhicule
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.vehicleData} layout="vertical" margin={{ left: 30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(v: any) => formatFCFA(v)} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" formatter={(v: any) => `${Math.round(v/1000)}k`} style={{ fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consommation cumulée : réel vs théorique */}
        <div className="col-span-1 lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
            Consommation Cumulée : Réel vs Théorique (coût de référence pour 100 km)
          </h3>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.comparisonData} margin={{ top: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip formatter={(v: any) => formatFCFA(v)} />
                <Legend />
                <Bar dataKey="Reel" fill="#10b981" name="Coût Réel (Saisi, cumulé)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Theorique" fill="#94a3b8" name="Coût Théorique (pour 100 km, L/100 x prix)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-xs text-slate-500 italic text-center">
            Note: Le coût théorique correspond au coût de référence pour 100 km, calculé uniquement à partir de la consommation constructeur (L/100km) et des prix de référence carburant — sans tenir compte du kilométrage total du véhicule. Essence {fuelPrices.Essence.toLocaleString('fr-FR')} FCFA/L, Diesel {fuelPrices.Diesel.toLocaleString('fr-FR')} FCFA/L. <Link to="/parametres" className="font-medium text-emerald-600 hover:underline print:hidden">Modifier ces prix</Link>
          </p>
        </div>

        {/* Histogramme des consommations par centre (zone de travail) */}
        <div className="col-span-1 lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <MapPin className="h-5 w-5 text-emerald-500" />
            Consommations par centre (zone de travail)
          </h3>
          <p className="mb-4 text-[11px] text-slate-400">
            Dépenses carburant{(periodFrom || periodTo) ? ' de la période' : ''} de chaque centre, selon la case « Zone de travail » des véhicules qui lui sont affectés
          </p>
          {stats.total > 0 && stats.zoneData.length > 0 ? (
            <div className="h-96 w-full" data-testid="fuel-by-zone">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.zoneData} margin={{ top: 25, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#ecfdf5' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const z = payload[0].payload as (typeof stats.zoneData)[number];
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md">
                          <p className="mb-1 font-bold text-slate-800">{z.name}</p>
                          <p>Consommation : <strong>{formatFCFA(z.value)}</strong> ({stats.total > 0 ? Math.round((z.value / stats.total) * 100) : 0}%)</p>
                          <p>{z.count} dépense(s) carburant</p>
                          <p>{z.affectes} véhicule(s) affecté(s) · {z.actifs} avec dépense</p>
                          {z.actifs > 0 && <p>Moyenne : {formatFCFA(z.moyenne)} / véhicule</p>}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" name="Consommation carburant" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {stats.zoneData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`} style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune dépense carburant enregistrée{(periodFrom || periodTo) ? ' sur cette période' : ''} pour tracer l'histogramme par centre.</p>
          )}
          {stats.total > 0 && stats.zoneData.length > 0 && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <strong>Centre le plus consommateur :</strong> {stats.zoneData[0].name} — {formatFCFA(stats.zoneData[0].value)} ({Math.round((stats.zoneData[0].value / stats.total) * 100)}% du total), {stats.zoneData[0].affectes} véhicule(s) affecté(s).
              {stats.zoneData.some(z => z.name === 'Non renseigné' && z.value > 0) && <> « Non renseigné » regroupe les véhicules dont la fiche n'indique pas de zone de travail.</>}
            </div>
          )}
        </div>
      </div>

      {/* ── Répartition par énergie ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Fuel className="h-5 w-5 text-emerald-500" />
          Répartition par énergie
        </h3>
        {(() => {
          const energyMap = new Map<string, number>();
          vehicles.forEach(v => energyMap.set(v.energie, (energyMap.get(v.energie) || 0) + 1));
          const energyData = Array.from(energyMap.entries()).map(([name, value]) => ({ name, value }));
          return energyData.length > 0 ? (
            <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={energyData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`}>{energyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => formatFCFA(v)} /><Legend /></PieChart></ResponsiveContainer></div>
          ) : <p className="text-sm text-slate-400">Aucune donnée</p>;
        })()}
      </div>

      {/* ── Évolution mensuelle ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Calendar className="h-5 w-5 text-cyan-500" />
          Évolution mensuelle des consommations carburant
        </h3>
        {stats.monthlyData.length > 0 ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyData} margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => formatFCFA(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="montant"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  name="Dépenses carburant"
                  dot={{ r: 5, fill: '#06b6d4' }}
                  activeDot={{ r: 7 }}
                >
                  <LabelList
                    dataKey="montant"
                    position="top"
                    formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`}
                    style={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Aucune dépense carburant enregistrée pour générer l'historique mensuel.</p>
        )}
      </div>

      {/* ── Comparaison par marque & par type ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Par marque */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Tag className="h-5 w-5 text-violet-500" />
            Consommation par marque de véhicule
          </h3>
          {stats.brandData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.brandData} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any, name: any) => [formatFCFA(v), String(name)]} />
                  <Legend />
                  <Bar dataKey="Total" fill="#8b5cf6" name="Total dépensé" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Total"
                      position="top"
                      formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`}
                      style={{ fontSize: 10, fill: '#475569' }}
                    />
                  </Bar>
                  <Bar dataKey="Moyenne" fill="#c4b5fd" name="Moyenne / véhicule" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Moyenne"
                      position="top"
                      formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`}
                      style={{ fontSize: 10, fill: '#475569' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée disponible pour analyser par marque.</p>
          )}
          {stats.brandData.length > 0 && (
            <div className="mt-3 rounded-lg bg-violet-50 p-3 text-xs text-violet-700">
              <strong>Marque la plus consommatrice :</strong> {stats.brandData[0].name} —
              {' '}{formatFCFA(stats.brandData[0].Total)} sur {stats.brandData[0].nbVehicules} véhicule(s)
            </div>
          )}
        </div>

        {/* Par type */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Layers className="h-5 w-5 text-rose-500" />
            Consommation par type de véhicule
          </h3>
          {stats.typeData.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.typeData} layout="vertical" margin={{ top: 20, right: 60, bottom: 10, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any, name: any) => [formatFCFA(v), String(name)]} />
                  <Legend />
                  <Bar dataKey="Total" fill="#f43f5e" name="Total dépensé" radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="Total"
                      position="right"
                      formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`}
                      style={{ fontSize: 10, fill: '#475569' }}
                    />
                  </Bar>
                  <Bar dataKey="Moyenne" fill="#fda4af" name="Moyenne / véhicule" radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="Moyenne"
                      position="right"
                      formatter={(v: any) => `${Math.round(Number(v) / 1000)}k`}
                      style={{ fontSize: 10, fill: '#475569' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée disponible pour analyser par type.</p>
          )}
          {stats.typeData.length > 0 && (
            <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <strong>Type le plus consommateur :</strong> {stats.typeData[0].name} —
              {' '}{formatFCFA(stats.typeData[0].Total)} sur {stats.typeData[0].nbVehicules} véhicule(s)
            </div>
          )}
        </div>
      </div>

      {/* Detailed Data Table for Printing */}
      <div className="hidden print:block space-y-4 pt-10">
        <h3 className="text-xl font-bold border-b pb-2">Journal des Dépenses Carburant</h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Véhicule</th>
              <th className="p-2 border">Libellé</th>
              <th className="p-2 border">Fournisseur</th>
              <th className="p-2 border">Paiement</th>
              <th className="p-2 border text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {fuelExpenses.map(e => {
               const v = vehicles.find(veh => veh.id === e.vehicleId);
               return (
                <tr key={e.id} className="border-b">
                  <td className="p-2 border">{e.date}</td>
                  <td className="p-2 border font-medium">{v?.numero_immatriculation}</td>
                  <td className="p-2 border">{e.libelle}</td>
                  <td className="p-2 border">{e.fournisseur}</td>
                  <td className="p-2 border">{e.mode_paiement}</td>
                  <td className="p-2 border text-right font-bold">{formatFCFA(e.montant)}</td>
                </tr>
               );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold">
              <td colSpan={5} className="p-2 border text-right uppercase">Total Général</td>
              <td className="p-2 border text-right">{formatFCFA(stats.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
