import { useState, useEffect, useMemo } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { useDrivers } from '../store/DriverStore';
import type { Vehicle } from '../types';
import { X, FileImage } from 'lucide-react';
import SelectWithOther from './SelectWithOther';
import SuggestInput from './SuggestInput';
import { uniqueValues } from '../utils/suggestions';
import { uploadVehicleImage, validateImageFile } from '../utils/uploadImage';

interface VehicleFormProps {
  vehicle: Vehicle | undefined;
  onSave: () => void;
  onClose: () => void;
}

const emptyVehicle: Omit<Vehicle, 'id'> = {
  numero_immatriculation: '',
  numero_carte_grise: '',
  code_parc_entreprise: '',
  nom_proprietaire: '',
  rdc: '',
  marque: '',
  genre: 'Voiture',
  type_commercial: '',
  couleur: '',
  carrosserie: '',
  date_mise_circulation: '',
  date_edition: '',
  usage_vehicule: 'Privé',
  energie: 'Essence',
  places_assises: 5,
  ptac_kg: 0,
  nombre_essieux: 2,
  cylindree_cc: 0,
  puissance_fiscale_cv: 0,
  pv_kg: 0,
  cu_kg: 0,
  vin_chassis: '',
  numero_moteur: '',
  type_technique: '',
  numero_immatriculation_precedent: '',
  societe_credit: '',
  statut: 'Actif',
  kilometrage: 0,
  date_achat: '',
  cout_achat: 0,
  date_effet_assurance: '',
  date_assurance: '',
  date_effet_vignette: '',
  date_vignette: '',
  date_effet_carte_transport: '',
  validite_carte_transport: '',
  date_effet_patente: '',
  validite_patente: '',
  date_effet_carte_stationnement: '',
  validite_carte_stationnement: '',
  cout_assurance_annuel: 0,
  affectation: '',
  categorie_parc: 'Véhicule de service',
  conducteur: '',
  observations: '',
  valeur_residuelle: 0,
  frais_livraison: 0,
  frais_douane: 0,
  frais_installation: 0,
  couts_indirects: 0,
  zone_travail: '',
  photo_carte_grise: '',
  photo_carte_grise_verso: '',
  photo_patente: '',
  photo_vignette: '',
  photo_carte_transport: '',
  photo_carte_stationnement: '',
  consommation_100km: 0,
  telephone_gps: '',
};

export default function VehicleForm({ vehicle, onSave, onClose }: VehicleFormProps) {
  const { vehicles, addVehicle, updateVehicle } = useVehicles();
  const { drivers } = useDrivers();
  const [formData, setFormData] = useState<Omit<Vehicle, 'id'>>(vehicle ? { ...vehicle } : { ...emptyVehicle });
  // Identifiant connu dès l'ouverture : sert de dossier de rangement des documents importés,
  // même pour un véhicule qui n'est pas encore enregistré.
  const [pendingId] = useState(() => vehicle?.id || 'v' + Date.now());
  const [activeTab, setActiveTab] = useState<'carte' | 'technique' | 'gestion'>('carte');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vehicle) {
      updateVehicle(vehicle.id, formData);
    } else {
      addVehicle({ ...formData, id: pendingId });
    }
    onSave();
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'carte' as const, label: 'Carte Grise' },
    { id: 'technique' as const, label: 'Infos Techniques' },
    { id: 'gestion' as const, label: 'Gestion Parc' },
  ];

  // Valeurs déjà saisies sur les autres véhicules, reproposées dans les cases de saisie libre.
  // (Les identifiants uniques — immatriculation, carte grise, VIN, n° moteur… — n'en ont pas.)
  const suggestionsByField = useMemo(() => {
    const pick = (k: keyof Vehicle) => uniqueValues(vehicles.map(v => v[k] as string));
    const marque = ((formData as any).marque || '').trim().toLowerCase();
    const modelesDeLaMarque = vehicles.filter(v => (v.marque || '').trim().toLowerCase() === marque).map(v => v.type_commercial);
    return {
      nom_proprietaire: pick('nom_proprietaire'),
      marque: pick('marque'),
      // les modèles de la marque choisie d'abord, puis les autres
      type_commercial: uniqueValues([...modelesDeLaMarque, ...vehicles.map(v => v.type_commercial)], { sort: false }),
      couleur: pick('couleur'),
      carrosserie: pick('carrosserie'),
      type_technique: pick('type_technique'),
      societe_credit: pick('societe_credit'),
      affectation: pick('affectation'),
      zone_travail: pick('zone_travail'),
      // noms des chauffeurs enregistrés, puis les conducteurs déjà saisis sur d'autres fiches
      conducteur: uniqueValues([...drivers.map(d => `${d.nom} ${d.prenom}`.trim()), ...vehicles.map(v => v.conducteur)]),
    } as Record<string, string[]>;
  }, [vehicles, drivers, (formData as any).marque]);

  const [docUploading, setDocUploading] = useState<string | null>(null);

  const handleDocumentUpload = async (fieldKey: keyof Vehicle, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { alert(error); return; }
    setDocUploading(fieldKey as string);
    try {
      const url = await uploadVehicleImage(pendingId, fieldKey as string, file);
      handleChange(fieldKey as string, url);
    } catch {
      alert("Échec de l'import du document. Vérifiez votre connexion et réessayez.");
    } finally {
      setDocUploading(null);
    }
  };

  const renderDocumentUpload = (label: string, fieldKey: keyof Vehicle) => {
    const value = (formData as any)[fieldKey] as string | undefined;
    const uploading = docUploading === fieldKey;
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
        <div className="flex items-center gap-2">
          {value ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200">
              <img src={value} alt={label} className="h-full w-full object-cover" />
            </a>
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
              <FileImage className="h-4 w-4" />
            </div>
          )}
          <label className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-600 hover:bg-slate-50">
            {uploading ? 'Import en cours…' : value ? 'Remplacer le document' : 'Importer un document'}
            <input type="file" accept="image/*,.pdf,application/pdf" className="hidden" disabled={uploading} onChange={(e) => handleDocumentUpload(fieldKey, e)} />
          </label>
          {value && (
            <button type="button" onClick={() => handleChange(fieldKey as string, '')} className="flex-shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Retirer le document">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderInput = (label: string, field: string, type = 'text', options?: { value: string; label: string }[], placeholder?: string) => {
    const hasAutre = options?.some((o) => o.value === 'Autre');
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
        {options ? (
          hasAutre ? (
            <SelectWithOther
              value={(formData as any)[field] || ''}
              onChange={(v) => handleChange(field, v)}
              options={options.filter((o) => o.value !== 'Autre').map((o) => o.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              otherPlaceholder={`Préciser ${label.toLowerCase()}…`}
            />
          ) : (
            <select
              value={(formData as any)[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="" disabled>Sélectionner...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )
        ) : (
          <SuggestInput
            suggestions={type === 'text' ? (suggestionsByField[field] || []) : []}
            type={type}
            value={(formData as any)[field] || ''}
            onChange={(e) => handleChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder={placeholder || `Saisir ${label.toLowerCase()}...`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        )}
      </div>
    );
  };

  // Une échéance = une période complète (date d'effet -> date d'échéance), regroupée
  // visuellement pour que les deux dates d'un même document restent bien identifiées.
  const renderPeriod = (label: string, effetField: string, echeanceField: string) => (
    <div className="col-span-2 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="col-span-2 -mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Date d'effet</label>
        <input
          type="date"
          value={(formData as any)[effetField] || ''}
          onChange={(e) => handleChange(effetField, e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Date d'échéance</label>
        <input
          type="date"
          value={(formData as any)[echeanceField] || ''}
          onChange={(e) => handleChange(echeanceField, e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">
            {vehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'carte' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-lg bg-emerald-50 p-3 mb-2">
                <p className="text-xs font-semibold text-emerald-700 uppercase">Informations Carte Grise (Recto)</p>
              </div>
              {renderInput("N° Immatriculation", "numero_immatriculation")}
              {renderInput("N° Carte Grise", "numero_carte_grise")}
              <div>{renderDocumentUpload('Carte grise recto', 'photo_carte_grise')}</div>
              <div>{renderDocumentUpload('Carte grise verso', 'photo_carte_grise_verso')}</div>
              {renderInput("Code parc entreprise", "code_parc_entreprise")}
              {renderInput("Propriétaire", "nom_proprietaire")}
              {renderInput("RDC", "rdc")}
              {renderInput("Marque", "marque")}
              {renderInput("Type Commercial", "type_commercial")}
              {renderInput("Couleur", "couleur")}
              {renderInput("Carrosserie", "carrosserie")}
              {renderInput("Genre", "genre", "text", [
                { value: 'Voiture', label: 'Voiture' },
                { value: 'Utilitaire', label: 'Utilitaire' },
                { value: 'Camion', label: 'Camion' },
                { value: 'Moto', label: 'Moto' },
                { value: 'Tricycle', label: 'Tricycle' },
                { value: 'Autre', label: 'Autre' },
              ])}
              {renderInput("Usage", "usage_vehicule", "text", [
                { value: 'Privé', label: 'Privé' },
                { value: 'Commercial', label: 'Commercial' },
                { value: 'Location', label: 'Location' },
                { value: 'Ambulance', label: 'Ambulance' },
                { value: 'Autre', label: 'Autre' },
              ])}
              {renderInput("Énergie", "energie", "text", [
                { value: 'Essence', label: 'Essence' },
                { value: 'Diesel', label: 'Diesel' },
                { value: 'Hybride', label: 'Hybride' },
                { value: 'Électrique', label: 'Électrique' },
                { value: 'GPL', label: 'GPL' },
                { value: 'Autre', label: 'Autre' },
              ])}
              {renderInput("Date 1ère mise en circulation", "date_mise_circulation", "date")}
              {renderInput("Date d'édition", "date_edition", "date")}
              {renderInput("Places assises", "places_assises", "number")}
              {renderInput("Nombre d'essieux", "nombre_essieux", "number")}
              {renderInput("Cylindrée (CC)", "cylindree_cc", "number")}
              {renderInput("Puissance fiscale (CV)", "puissance_fiscale_cv", "number")}
              {renderInput("PTAC (Kg)", "ptac_kg", "number")}
              {renderInput("PV (Kg)", "pv_kg", "number")}
              {renderInput("CU (Kg)", "cu_kg", "number")}
            </div>
          )}

          {activeTab === 'technique' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-lg bg-blue-50 p-3 mb-2">
                <p className="text-xs font-semibold text-blue-700 uppercase">Informations Techniques (Verso)</p>
              </div>
              {renderInput("N° VIN/Chassis", "vin_chassis")}
              {renderInput("N° Moteur", "numero_moteur")}
              {renderInput("Type technique", "type_technique")}
              {renderInput("N° immatriculation précédent", "numero_immatriculation_precedent")}
              {renderInput("Société de crédit", "societe_credit")}
            </div>
          )}

          {activeTab === 'gestion' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-lg bg-violet-50 p-3 mb-2">
                <p className="text-xs font-semibold text-violet-700 uppercase">Gestion du Parc</p>
              </div>
              {renderInput("Statut", "statut", "text", [
                { value: 'Actif', label: 'Actif' },
                { value: 'En maintenance', label: 'En maintenance' },
                { value: 'Hors service', label: 'Hors service' },
                { value: 'Réformé', label: 'Réformé' },
              ])}
              {renderInput("Kilométrage", "kilometrage", "number")}
              {renderInput("Date d'achat", "date_achat", "date")}
              {renderInput("Coût d'achat (FCFA)", "cout_achat", "number")}
              {renderPeriod("Assurance", "date_effet_assurance", "date_assurance")}
              {renderPeriod("Vignette", "date_effet_vignette", "date_vignette")}
              <div className="col-span-2">{renderDocumentUpload('Photo de la vignette', 'photo_vignette')}</div>
              {renderPeriod("Carte de transport", "date_effet_carte_transport", "validite_carte_transport")}
              <div className="col-span-2">{renderDocumentUpload('Photo de la carte de transport', 'photo_carte_transport')}</div>
              {renderPeriod("Patente", "date_effet_patente", "validite_patente")}
              <div className="col-span-2">{renderDocumentUpload('Photo de la patente', 'photo_patente')}</div>
              {renderPeriod("Carte de stationnement", "date_effet_carte_stationnement", "validite_carte_stationnement")}
              <div className="col-span-2">{renderDocumentUpload('Photo de la carte de stationnement', 'photo_carte_stationnement')}</div>
              {renderInput("Coût assurance annuel (FCFA)", "cout_assurance_annuel", "number")}
              {renderInput("Valeur résiduelle estimée (FCFA)", "valeur_residuelle", "number")}
              {renderInput("Frais de livraison (FCFA)", "frais_livraison", "number")}
              {renderInput("Frais de douane (FCFA)", "frais_douane", "number")}
              {renderInput("Frais d'installation (FCFA)", "frais_installation", "number")}
              {renderInput("Coûts indirects (FCFA)", "couts_indirects", "number")}
              {renderInput("Affectation", "affectation")}
              {renderInput("Catégorie de parc", "categorie_parc", "text", [
                { value: 'Véhicule de fonction', label: 'Véhicule de fonction' },
                { value: 'Véhicule de service', label: 'Véhicule de service' },
                { value: 'Véhicule de pool', label: 'Véhicule de pool' },
                { value: 'Autre', label: 'Autre' },
              ])}
              {renderInput("Zone d'affectation", "zone_affectation", "text", [
                { value: 'Nord', label: 'Nord' },
                { value: 'Sud', label: 'Sud' },
                { value: 'Est', label: 'Est' },
                { value: 'Centre', label: 'Centre' },
                { value: 'Ouest', label: 'Ouest' },
              ])}
              {renderInput("Zone de travail", "zone_travail", "text", undefined, "Ex: Chantier Cocody, Dépôt Yopougon…")}
              {renderInput("Conducteur", "conducteur")}
              {renderInput("Consommation aux 100km (L)", "consommation_100km", "number")}
              {renderInput("Téléphone balise GPS", "telephone_gps")}
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Observations</label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                  rows={3}
                  placeholder="Notes, remarques particulières, historique..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              {vehicle ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
