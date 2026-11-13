import { useVehicles } from '../store/VehicleStore';
import { isMaintenanceDerivedExpense } from '../utils/maintenance';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import { TrendingUp, DollarSign, Gauge, AlertTriangle, Award, Clock, Printer } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' M';
  if (n >= 1000) return (n / 1000).toFixed(0) + ' K';
  return n.toString();
}

function formatFCFA(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA';
}

function getVehicleAge(d: string) {
  if (!d) return 0;
  return new Date().getFullYear() - new Date(d).getFullYear();
}

// Icon components defined at top level
function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export default function Analytics() {
  const { vehicles, maintenanceRecords, expenseRecords, immobilisations, getDashboardStats } = useVehicles();
  const stats = getDashboardStats();

  const avgInsuranceCost = vehicles.length > 0 ? Math.round(stats.totalInsuranceCost / vehicles.length) : 0;
  const avgAcquisitionCost = vehicles.length > 0 ? Math.round(stats.totalAcquisitionCost / vehicles.length) : 0;

  // Kilometers by vehicle
  const kmByVehicle = vehicles.map((v) => ({
    name: v.numero_immatriculation,
    km: v.kilometrage,
  })).sort((a, b) => b.km - a.km).slice(0, 10);

  // Operational expenses by vehicle, including the dedicated expenses tab.
  const maintCostByVehicle = vehicles.map((v) => {
    const maintenanceCost = maintenanceRecords.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + m.cout, 0);
    const expenseCost = expenseRecords.filter((expense) => expense.vehicleId === v.id).reduce((s, expense) => s + expense.montant, 0);
    const cost = maintenanceCost + expenseCost;
    return { name: v.numero_immatriculation, cout: cost };
  }).filter((v) => v.cout > 0).sort((a, b) => b.cout - a.cout).slice(0, 10);

  // Cost per km
  const costPerKm = vehicles.map((v) => {
    const maintCost = maintenanceRecords.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + m.cout, 0);
    const expenseCost = expenseRecords.filter((expense) => expense.vehicleId === v.id).reduce((s, expense) => s + expense.montant, 0);
    const totalVariableCost = maintCost + expenseCost;
    const avgCostPerKm = v.kilometrage > 0 ? Math.round(totalVariableCost / v.kilometrage) : 0;
    return { name: v.numero_immatriculation, coutParKm: avgCostPerKm, totalMaint: totalVariableCost };
  }).filter((v) => v.totalMaint > 0).sort((a, b) => b.coutParKm - a.coutParKm).slice(0, 10);

  // Status distribution
  const statusData = [
    { name: 'Actif', value: stats.activeVehicles },
    { name: 'En maintenance', value: stats.maintenanceVehicles },
    { name: 'Hors service', value: stats.outOfServiceVehicles },
    { name: 'Réformé', value: stats.reformedVehicles },
  ].filter((d) => d.value > 0);

  // Vehicle age
  const ageData = stats.vehicleAgeDistribution;

  // Maintenance frequency
  // Un passage en maintenance peut être saisi à 3 endroits de l'application ; on les
  // compte tous :
  //  - l'historique maintenance de la fiche véhicule ;
  //  - les dépenses « Entretien » / « Réparation » saisies directement dans Dépenses
  //    (on exclut les dépenses miroirs créées depuis l'historique, déjà comptées) ;
  //  - les séjours en garage du menu Suivi des Immo-Garages.
  const maintFreqByVehicle = vehicles.map((v) => {
    const historique = maintenanceRecords.filter((m) => m.vehicleId === v.id).length;
    const depenses = expenseRecords.filter((e) =>
      e.vehicleId === v.id &&
      (e.categorie === 'Entretien' || e.categorie === 'Réparation') &&
      !isMaintenanceDerivedExpense(e)
    ).length;
    const garage = immobilisations.filter((r) => r.vehicleId === v.id).length;
    return { name: v.numero_immatriculation, historique, depenses, garage, frequence: historique + depenses + garage };
  }).filter((v) => v.frequence > 0).sort((a, b) => b.frequence - a.frequence).slice(0, 10);

  // Total cost analysis
  const totalCostAnalysis = vehicles.map((v) => {
    const maintCost = maintenanceRecords.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + m.cout, 0);
    const expenseCost = expenseRecords.filter((expense) => expense.vehicleId === v.id).reduce((s, expense) => s + expense.montant, 0);
    const acquisition = v.cout_achat;
    const assurance = v.cout_assurance_annuel;
    return {
      name: v.numero_immatriculation,
      acquisition,
      maintenance: maintCost,
      depenses: expenseCost,
      assurance,
      totalAffiche: acquisition + maintCost + expenseCost + assurance,
    };
  }).sort((a, b) => b.totalAffiche - a.totalAffiche).slice(0, 8);

  // Recommendations
  const recommendations: { icon: React.ReactNode; title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];

  if (stats.maintenanceVehicles > 0) {
    recommendations.push({
      icon: <WrenchIcon className="h-5 w-5 text-amber-500" />,
      title: 'Véhicules en maintenance',
      description: `${stats.maintenanceVehicles} véhicule(s) actuellement en maintenance. Suivez les interventions pour minimiser les temps d'immobilisation.`,
      priority: 'high',
    });
  }

  if (stats.upcomingInsurance > 0) {
    recommendations.push({
      icon: <ShieldIcon className="h-5 w-5 text-red-500" />,
      title: 'Assurances à renouveler',
      description: `${stats.upcomingInsurance} assurance(s) expirent dans les 30 prochains jours. Prévoyez le renouvellement rapidement.`,
      priority: 'high',
    });
  }

  if (stats.upcomingVignette > 0) {
    recommendations.push({
      icon: <FileTextIcon className="h-5 w-5 text-red-500" />,
      title: 'Vignettes à renouveler',
      description: `${stats.upcomingVignette} vignette(s) expirent dans les 30 prochains jours.`,
      priority: 'high',
    });
  }

  if (avgAcquisitionCost > 15000000) {
    recommendations.push({
      icon: <DollarSign className="h-5 w-5 text-blue-500" />,
      title: 'Coût d\'acquisition élevé',
      description: `Le coût moyen d'acquisition est de ${formatFCFA(avgAcquisitionCost)}. Évaluez les alternatives pour les prochains achats.`,
      priority: 'medium',
    });
  }

  if (vehicles.length > 0) {
    const oldVehicles = vehicles.filter((v) => getVehicleAge(v.date_mise_circulation) > 4);
    if (oldVehicles.length > 0) {
      recommendations.push({
        icon: <Clock className="h-5 w-5 text-purple-500" />,
        title: 'Véhicules anciens',
        description: `${oldVehicles.length} véhicule(s) ont plus de 4 ans. Prévoyez un plan de renouvellement pour optimiser les coûts de maintenance.`,
        priority: 'medium',
      });
    }
  }

  if (costPerKm.length > 0) {
    const highCostVehicles = costPerKm.filter((v) => v.coutParKm > 200);
    if (highCostVehicles.length > 0) {
      recommendations.push({
        icon: <Gauge className="h-5 w-5 text-orange-500" />,
        title: 'Coût de maintenance élevé par km',
        description: `${highCostVehicles.length} véhicule(s) ont un coût de maintenance supérieur à 200 FCFA/km. Envisagez leur remplacement.`,
        priority: 'medium',
      });
    }
  }

  recommendations.push({
    icon: <Award className="h-5 w-5 text-emerald-500" />,
    title: 'Optimisation du parc',
    description: `Total d'investissement: ${formatFCFA(stats.totalAcquisitionCost)}. Dépenses enregistrées: ${formatFCFA(stats.totalExpenseCost)}. Coût opérationnel total: ${formatFCFA(stats.totalOperatingCost)}.`,
    priority: 'low',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Graphiques & Analyses</h2>
          <p className="mt-1 text-sm text-slate-500">Analyses détaillées pour la prise de décision</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <Printer className="h-4 w-4" /> Imprimer Analyses
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Coût moyen acquisition</p>
              <p className="text-lg font-bold text-slate-900">{formatFCFA(avgAcquisitionCost)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100"><DollarSign className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Coût moyen assurance</p>
              <p className="text-lg font-bold text-slate-900">{formatFCFA(avgInsuranceCost)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100"><Gauge className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Kilométrage moyen</p>
              <p className="text-lg font-bold text-slate-900">{stats.avgKilometers.toLocaleString()} km</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Alertes actives</p>
              <p className="text-lg font-bold text-slate-900">{stats.upcomingInsurance + stats.upcomingVignette}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100"><DollarSign className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Dépenses enregistrées</p>
              <p className="text-lg font-bold text-slate-900">{formatFCFA(stats.totalExpenseCost)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><TrendingUp className="h-5 w-5 text-slate-700" /></div>
            <div>
              <p className="text-xs text-slate-500">Coût opérationnel</p>
              <p className="text-lg font-bold text-slate-900">{formatFCFA(stats.totalOperatingCost)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kilometers by Vehicle */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Kilométrage par Véhicule</h3>
          {kmByVehicle.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kmByVehicle} layout="vertical" margin={{ left: 20, right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} km`, 'Kilométrage']} />
                <Bar dataKey="km" fill="#10b981" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="km" position="right" style={{ fontSize: 11, fill: '#475569' }} formatter={(v: unknown) => Number(v).toLocaleString() + ' km'} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>

        {/* Status Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Répartition par Statut</h3>
          {statusData.length > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                    labelLine={true}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} véhicule(s)`, '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Operating Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Dépenses Opérationnelles par Véhicule</h3>
          {maintCostByVehicle.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={maintCostByVehicle} layout="vertical" margin={{ left: 20, right: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatFCFA(value as number), 'Dépenses']} />
                <Bar dataKey="cout" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="cout" position="right" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">Aucune dépense enregistrée</p>
          )}
        </div>

        {/* Cost per km */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Dépenses par Kilomètre</h3>
          {costPerKm.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costPerKm} layout="vertical" margin={{ left: 20, right: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => v + ' F/km'} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} FCFA/km`, 'Coût par km']} />
                <Bar dataKey="coutParKm" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="coutParKm" position="right" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: unknown) => String(v) + ' F/km'} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Expense Category Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Dépenses par Catégorie</h3>
          {stats.expenseCategoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stats.expenseCategoryDistribution} layout="vertical" margin={{ left: 20, right: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatFCFA(value as number), 'Montant']} />
                <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">Aucune dépense enregistrée</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Évolution Mensuelle des Dépenses</h3>
          {stats.monthlyExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stats.monthlyExpenses} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(value) => [formatFCFA(value as number), 'Dépenses']} />
                <Bar dataKey="cost" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="cost" position="top" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">Aucune dépense enregistrée</p>
          )}
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Total Cost Analysis */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Analyse des Coûts Totaux par Véhicule</h3>
          {totalCostAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={totalCostAnalysis} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(value) => [formatFCFA(value as number), '']} />
                <Legend />
                <Bar dataKey="acquisition" stackId="a" fill="#6366f1" name="Acquisition" />
                <Bar dataKey="assurance" stackId="a" fill="#06b6d4" name="Assurance" />
                <Bar dataKey="maintenance" stackId="a" fill="#f59e0b" name="Maintenance" />
                <Bar dataKey="depenses" stackId="a" fill="#f97316" name="Dépenses" />
                {/* Total label affiché au-dessus de chaque pile */}
                <Bar dataKey="totalAffiche" fill="transparent" stackId="b" isAnimationActive={false}>
                  <LabelList
                    dataKey="totalAffiche"
                    position="top"
                    formatter={(value: any) => formatNumber(Number(value))}
                    style={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>

        {/* Vehicle Age */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Âge du Parc Automobile</h3>
          {ageData.length > 0 ? (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={ageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                    labelLine={true}
                  >
                    {ageData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} véhicule(s)`, '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Maintenance Frequency */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">Fréquence de Maintenance par Véhicule</h3>
        {maintFreqByVehicle.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={maintFreqByVehicle}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(value, name) => [`${value} intervention(s)`, name]} />
              <Legend />
              <Bar dataKey="historique" stackId="f" fill="#8b5cf6" name="Historique maintenance" />
              <Bar dataKey="depenses" stackId="f" fill="#f59e0b" name="Dépenses entretien/réparation" />
              <Bar dataKey="garage" stackId="f" fill="#06b6d4" name="Immo-garages" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400">Aucun enregistrement de maintenance</p>
        )}
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Award className="h-5 w-5 text-emerald-500" />
          Recommandations pour la Prise de Décision
        </h3>
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                rec.priority === 'high' ? 'border-red-200 bg-red-50' :
                rec.priority === 'medium' ? 'border-amber-200 bg-amber-50' :
                'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex-shrink-0">{rec.icon}</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    rec.priority === 'high' ? 'bg-red-200 text-red-700' :
                    rec.priority === 'medium' ? 'bg-amber-200 text-amber-700' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {rec.priority === 'high' ? 'Urgent' : rec.priority === 'medium' ? 'Important' : 'Info'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{rec.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
