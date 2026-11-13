import { useState, useEffect } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { Fuel, Save, RotateCcw, CheckCircle2, Info } from 'lucide-react';
import type { AppSettings } from '../types/settings';

export default function Settings() {
  const { appSettings, updateAppSettings } = useVehicles();
  const [f, setF] = useState<AppSettings>(appSettings);
  const [saved, setSaved] = useState(false);

  // Si les paramètres arrivent (ou changent) depuis Firestore après le montage — par
  // exemple au premier chargement, une fois la synchronisation initiale terminée — on
  // aligne le formulaire dessus, sauf si l'utilisateur a déjà commencé à modifier.
  useEffect(() => { setF(appSettings); }, [appSettings]);

  const dirty = f.fuelPriceEssence !== appSettings.fuelPriceEssence || f.fuelPriceDiesel !== appSettings.fuelPriceDiesel;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAppSettings({ fuelPriceEssence: f.fuelPriceEssence, fuelPriceDiesel: f.fuelPriceDiesel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => setF(appSettings);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Configuration</p>
        <h2 className="text-lg font-bold text-slate-800">Paramètres</h2>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2"><Fuel className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Prix du carburant</h3>
            <p className="text-xs text-slate-500">Prix de référence (FCFA / litre), utilisés pour tous les calculs théoriques de consommation et de coût.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">Essence (FCFA / litre)
            <input
              type="number" min="0" step="1" required
              value={f.fuelPriceEssence}
              onChange={(e) => setF((p) => ({ ...p, fuelPriceEssence: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">Diesel (FCFA / litre)
            <input
              type="number" min="0" step="1" required
              value={f.fuelPriceDiesel}
              onChange={(e) => setF((p) => ({ ...p, fuelPriceDiesel: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p>Ce prix est utilisé dans <strong>Gestion des carburants</strong> (coût théorique par véhicule) et <strong>Géolocalisation et trajectoires</strong> (estimation du coût d'un trajet). Le changement s'applique immédiatement, pour tous les utilisateurs, dès l'enregistrement.</p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {saved && <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Paramètres enregistrés</span>}
          <button type="button" onClick={handleReset} disabled={!dirty} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <RotateCcw className="h-3.5 w-3.5" /> Annuler
          </button>
          <button type="submit" disabled={!dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
