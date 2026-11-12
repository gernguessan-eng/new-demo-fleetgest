import { useParams, useNavigate } from 'react-router-dom';
import { useVehicles } from '../store/VehicleStore';
import { ArrowLeft, Car, MapPin, User, Gauge, Calendar, Shield, FileText, Wrench, AlertCircle, DollarSign, Info, Hash, Fuel, Receipt, Phone } from 'lucide-react';
import type { MaintenanceRecord } from '../types';
import { useState } from 'react';
import SuggestInput from './SuggestInput';
import { uniqueValues } from '../utils/suggestions';

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatMoney(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA';
}

function daysUntil(d: string) {
  if (!d) return null;
  const target = new Date(d);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vehicles, deleteVehicle, maintenanceRecords, addMaintenanceRecord, deleteMaintenanceRecord, expenseRecords, deleteExpenseRecord } = useVehicles();
  const maintTypes = uniqueValues(maintenanceRecords.map(m => m.type));
  const maintDescriptions = uniqueValues(maintenanceRecords.map(m => m.description));
  const vehicle = vehicles.find((v) => v.id === id);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [maintForm, setMaintForm] = useState({ date: '', type: '', description: '', cout: '', kilometrage: '' });

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Car className="h-16 w-16 text-slate-300" />
        <h2 className="mt-4 text-xl font-semibold text-slate-500">Véhicule non trouvé</h2>
        <button onClick={() => navigate('/vehicules')} className="mt-4 text-sm text-emerald-600 hover:underline">
          Retour à la liste
        </button>
      </div>
    );
  }

  const vehicleMaintenance = maintenanceRecords.filter((m) => m.vehicleId === vehicle.id);
  const vehicleExpenses = expenseRecords
    .filter((expense) => expense.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalExpenses = vehicleExpenses.reduce((sum, expense) => sum + expense.montant, 0);
  const daysToAssurance = daysUntil(vehicle.date_assurance);
  const daysToVignette = daysUntil(vehicle.date_vignette);

  const statutColors = {
    Actif: 'bg-green-100 text-green-700 border-green-200',
    'En maintenance': 'bg-amber-100 text-amber-700 border-amber-200',
    'Hors service': 'bg-red-100 text-red-700 border-red-200',
    Réformé: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const handleAddMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const record: MaintenanceRecord = {
      id: 'm' + Date.now(),
      vehicleId: vehicle.id,
      date: maintForm.date,
      type: maintForm.type,
      description: maintForm.description,
      cout: Number(maintForm.cout),
      kilometrage: Number(maintForm.kilometrage),
    };
    addMaintenanceRecord(record);
    setShowMaintForm(false);
    setMaintForm({ date: '', type: '', description: '', cout: '', kilometrage: '' });
  };

  const infoCard = (title: React.ReactNode, children: React.ReactNode) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );

  const infoRow = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className="mt-0.5 flex-shrink-0 text-slate-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Back Button & Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/vehicules')} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => { if (confirm('Supprimer ce véhicule ?')) { deleteVehicle(vehicle.id); navigate('/vehicules'); } }}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* Vehicle Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-200">
              <Car className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{vehicle.numero_immatriculation}</h1>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statutColors[vehicle.statut]}`}>
                  {vehicle.statut}
                </span>
              </div>
              <p className="text-slate-500">{vehicle.marque} {vehicle.type_commercial} — {vehicle.couleur}</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-500">Kilométrage</p>
              <p className="text-lg font-bold text-slate-800">{vehicle.kilometrage.toLocaleString()} km</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Mise en circulation</p>
              <p className="text-lg font-bold text-slate-800">{formatDate(vehicle.date_mise_circulation)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Carte Grise - Recto */}
        <div>
          {infoCard(<><FileText className="h-4 w-4" /> Carte Grise (Recto)</>,
            <>
              {infoRow(<Hash className="h-4 w-4" />, "N° Carte Grise", vehicle.numero_carte_grise)}
              {infoRow(<Hash className="h-4 w-4" />, "Code parc entreprise", vehicle.code_parc_entreprise || '—')}
              {infoRow(<Info className="h-4 w-4" />, "Propriétaire", vehicle.nom_proprietaire)}
              {infoRow(<Info className="h-4 w-4" />, "RDC", vehicle.rdc)}
              {infoRow(<Car className="h-4 w-4" />, "Marque", vehicle.marque)}
              {infoRow(<Car className="h-4 w-4" />, "Type commercial", vehicle.type_commercial)}
              {infoRow(<Info className="h-4 w-4" />, "Couleur", vehicle.couleur)}
              {infoRow(<Info className="h-4 w-4" />, "Carrosserie", vehicle.carrosserie)}
              {infoRow(<Info className="h-4 w-4" />, "Genre", vehicle.genre)}
              {infoRow(<Info className="h-4 w-4" />, "Usage", vehicle.usage_vehicule)}
              {infoRow(<Fuel className="h-4 w-4" />, "Énergie", vehicle.energie)}
              {infoRow(<Calendar className="h-4 w-4" />, "Date édition", formatDate(vehicle.date_edition))}
              {infoRow(<Info className="h-4 w-4" />, "Places assises", vehicle.places_assises?.toString() || '—')}
              {infoRow(<Info className="h-4 w-4" />, "Nbr essieux", vehicle.nombre_essieux?.toString() || '—')}
              {infoRow(<Gauge className="h-4 w-4" />, "Cylindrée", vehicle.cylindree_cc ? vehicle.cylindree_cc + ' CC' : '—')}
              {infoRow(<Gauge className="h-4 w-4" />, "Puissance fiscale", vehicle.puissance_fiscale_cv ? vehicle.puissance_fiscale_cv + ' CV' : '—')}
              {infoRow(<Info className="h-4 w-4" />, "PTAC", vehicle.ptac_kg ? vehicle.ptac_kg + ' Kg' : '—')}
            </>
          )}
        </div>

        {/* Carte Grise - Verso */}
        <div>
          {infoCard(<><FileText className="h-4 w-4" /> Carte Grise (Verso)</>,
            <>
              {infoRow(<Hash className="h-4 w-4" />, "N° VIN/Chassis", vehicle.vin_chassis || '—')}
              {infoRow(<Hash className="h-4 w-4" />, "N° Moteur", vehicle.numero_moteur || '—')}
              {infoRow(<Info className="h-4 w-4" />, "Type technique", vehicle.type_technique || '—')}
              {infoRow(<Info className="h-4 w-4" />, "N° immat. précédent", vehicle.numero_immatriculation_precedent || '—')}
              {infoRow(<Info className="h-4 w-4" />, "Société de crédit", vehicle.societe_credit || '—')}
            </>
          )}

          {/* Gestion */}
          <div className="mt-4">
            {infoCard(<><DollarSign className="h-4 w-4" /> Gestion du Parc</>,
              <>
                {infoRow(<Calendar className="h-4 w-4" />, "Date d'achat", formatDate(vehicle.date_achat))}
                {infoRow(<DollarSign className="h-4 w-4" />, "Coût d'achat", vehicle.cout_achat ? formatMoney(vehicle.cout_achat) : '—')}
                <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">Assurance (échéance)</p>
                    <p className="text-sm font-medium text-slate-800">{formatDate(vehicle.date_assurance)}</p>
                    {daysToAssurance !== null && (
                      <p className={`text-xs mt-0.5 ${daysToAssurance < 30 ? 'text-red-500 font-bold' : daysToAssurance < 60 ? 'text-amber-500' : 'text-green-500'}`}>
                        {daysToAssurance < 0 ? 'Expirée depuis ' + Math.abs(daysToAssurance) + ' jours' : daysToAssurance === 0 ? 'Expire aujourd\'hui' : 'Dans ' + daysToAssurance + ' jours'}
                      </p>
                    )}
                  </div>
                </div>
                {infoRow(<Shield className="h-4 w-4" />, "Coût assurance annuel", vehicle.cout_assurance_annuel ? formatMoney(vehicle.cout_assurance_annuel) : '—')}
                {infoRow(<Receipt className="h-4 w-4" />, "Dépenses enregistrées", formatMoney(totalExpenses))}
                <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">Vignette (échéance)</p>
                    <p className="text-sm font-medium text-slate-800">{formatDate(vehicle.date_vignette)}</p>
                    {daysToVignette !== null && (
                      <p className={`text-xs mt-0.5 ${daysToVignette < 30 ? 'text-red-500 font-bold' : daysToVignette < 60 ? 'text-amber-500' : 'text-green-500'}`}>
                        {daysToVignette < 0 ? 'Expirée depuis ' + Math.abs(daysToVignette) + ' jours' : daysToVignette === 0 ? 'Expire aujourd\'hui' : 'Dans ' + daysToVignette + ' jours'}
                      </p>
                    )}
                  </div>
                </div>
                {infoRow(<User className="h-4 w-4" />, "Conducteur", vehicle.conducteur || '—')}
                {infoRow(<MapPin className="h-4 w-4" />, "Affectation", vehicle.affectation || '—')}
                {infoRow(<Car className="h-4 w-4" />, "Catégorie de parc", vehicle.categorie_parc || '—')}
                {infoRow(<Fuel className="h-4 w-4" />, "Consommation aux 100 km", vehicle.consommation_100km ? `${vehicle.consommation_100km.toLocaleString('fr-FR')} L / 100 km` : '—')}
                {infoRow(<Phone className="h-4 w-4" />, "Téléphone balise GPS", vehicle.telephone_gps || '—')}
                {vehicle.observations && infoRow(<AlertCircle className="h-4 w-4" />, "Observations", vehicle.observations)}
              </>
            )}
          </div>
        </div>

        {/* Maintenance */}
        <div>
          {infoCard(<><Wrench className="h-4 w-4" /> Historique de Maintenance</>,
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-500">
                  {vehicleMaintenance.length} intervention(s) — {formatMoney(vehicleMaintenance.reduce((s, m) => s + m.cout, 0))}
                </span>
                <button
                  onClick={() => setShowMaintForm(!showMaintForm)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  + Ajouter
                </button>
              </div>

              {showMaintForm && (
                <form onSubmit={handleAddMaintenance} className="mb-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <input type="date" required value={maintForm.date} onChange={(e) => setMaintForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  <SuggestInput suggestions={maintTypes} type="text" required placeholder="Type d'intervention" value={maintForm.type} onChange={(e) => setMaintForm(p => ({ ...p, type: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  <SuggestInput suggestions={maintDescriptions} type="text" placeholder="Description" value={maintForm.description} onChange={(e) => setMaintForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" required placeholder="Coût (FCFA)" value={maintForm.cout} onChange={(e) => setMaintForm(p => ({ ...p, cout: e.target.value }))} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
                    <input type="number" placeholder="Kilométrage" value={maintForm.kilometrage} onChange={(e) => setMaintForm(p => ({ ...p, kilometrage: e.target.value }))} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 rounded bg-emerald-600 py-1.5 text-xs font-semibold text-white">Enregistrer</button>
                    <button type="button" onClick={() => setShowMaintForm(false)} className="flex-1 rounded border border-slate-300 py-1.5 text-xs text-slate-500">Annuler</button>
                  </div>
                </form>
              )}

              {vehicleMaintenance.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vehicleMaintenance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{m.type}</p>
                          <p className="text-xs text-slate-500">{formatDate(m.date)} — {m.kilometrage?.toLocaleString()} km</p>
                          {m.description && <p className="text-xs text-slate-400 mt-1">{m.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-700">{formatMoney(m.cout)}</p>
                          <button
                            onClick={() => deleteMaintenanceRecord(m.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">Aucun enregistrement</p>
              )}
            </>
          )}

          <div className="mt-4">
            {infoCard(<><Receipt className="h-4 w-4" /> Dépenses du Véhicule</>,
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {vehicleExpenses.length} dépense(s) — {formatMoney(totalExpenses)}
                  </span>
                  <button
                    onClick={() => navigate('/depenses')}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    Gérer
                  </button>
                </div>
                {vehicleExpenses.length > 0 ? (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {vehicleExpenses.slice(0, 8).map((expense) => (
                      <div key={expense.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{expense.libelle}</p>
                            <p className="text-xs text-slate-500">{formatDate(expense.date)} — {expense.categorie}</p>
                            {expense.fournisseur && <p className="mt-1 text-xs text-slate-400">{expense.fournisseur}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="whitespace-nowrap text-sm font-bold text-slate-700">{formatMoney(expense.montant)}</p>
                            <button onClick={() => deleteExpenseRecord(expense.id)} className="text-slate-400 hover:text-red-500">
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-slate-400">Aucune dépense enregistrée</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
