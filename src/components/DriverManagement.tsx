import { useState, useMemo, useEffect } from 'react';
import { useDrivers } from '../store/DriverStore';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import type { Driver, Mission, PlanningEvent } from '../types';
import { parseSpreadsheetFile, getCell, exportRowsToExcel } from '../utils/importExport';
import SelectWithOther from './SelectWithOther';
import SortToggleButton, { type SortDirection } from './SortToggleButton';
import { uploadDriverImage, validateImageFile } from '../utils/uploadImage';
import {
  Users, ClipboardList, CalendarDays, Plus, Pencil, Trash2, Search,
  Phone, Mail, Car, MapPin, Printer, ChevronRight, Download,
  CheckCircle2, AlertTriangle, X, Upload, FileImage,
} from 'lucide-react';
import DriverDetailModal from './DriverDetailModal';
import SuggestInput from './SuggestInput';
import { uniqueValues } from '../utils/suggestions';
import SearchableSelect from './SearchableSelect';

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number) { return n.toLocaleString('fr-FR') + ' FCFA'; }

const STATUT_DRIVER_COLORS: Record<string, string> = {
  Disponible: 'bg-green-100 text-green-700',
  'En mission': 'bg-blue-100 text-blue-700',
  'En congé': 'bg-amber-100 text-amber-700',
  Indisponible: 'bg-red-100 text-red-700',
};
const STATUT_MISSION_COLORS: Record<string, string> = {
  Planifiée: 'bg-blue-100 text-blue-700',
  'En cours': 'bg-amber-100 text-amber-700',
  Terminée: 'bg-green-100 text-green-700',
  Annulée: 'bg-red-100 text-red-700',
};
const EVENT_COLORS: Record<string, string> = {
  Mission: '#10b981', Congé: '#f59e0b', Formation: '#06b6d4', Repos: '#94a3b8', Autre: '#8b5cf6',
};

// ─────────────────────────────────────────────────────────
// Formulaire générique pour chauffeurs
// ─────────────────────────────────────────────────────────
const emptyDriver: Omit<Driver, 'id'> = { nom: '', prenom: '', fonction: '', telephone: '', email: '', numero_permis: '', categorie_permis: 'B', date_expiration_permis: '', date_embauche: '', vehicule_affecte_id: '', statut: 'Disponible', photo_url: '', permis_recto_url: '', permis_verso_url: '', notes: '' };

function DriverFormModal({ driver, vehicles, knownFonctions, onSave, onClose }: {
  knownFonctions: string[];
  driver?: Driver; vehicles: { id: string; label: string }[]; onSave: (data: Omit<Driver, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Omit<Driver, 'id'>>(driver ? { ...driver } : { ...emptyDriver });
  const up = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  // Identifiant connu dès l'ouverture : dossier de rangement des copies du permis, même avant enregistrement
  const [pendingId] = useState(() => driver?.id || 'dr' + Date.now());
  const [docUploading, setDocUploading] = useState<string | null>(null);
  const handleDocumentUpload = async (fieldKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { alert(error); return; }
    setDocUploading(fieldKey);
    try {
      const url = await uploadDriverImage(pendingId, fieldKey, file);
      up(fieldKey, url);
    } catch {
      alert("Échec de l'import du document. Vérifiez votre connexion et réessayez.");
    } finally {
      setDocUploading(null);
    }
  };
  const renderDocumentUpload = (label: string, fieldKey: 'permis_recto_url' | 'permis_verso_url') => {
    const value = (f as any)[fieldKey] as string | undefined;
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
            {uploading ? 'Import en cours…' : value ? 'Remplacer' : 'Importer'}
            <input type="file" accept="image/*,.pdf,application/pdf" className="hidden" disabled={uploading} onChange={(e) => handleDocumentUpload(fieldKey, e)} />
          </label>
          {value && (
            <button type="button" onClick={() => up(fieldKey, '')} className="flex-shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Retirer le document">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };
  const inp = (label: string, key: string, type = 'text', placeholder?: string) => (
    <label className="block text-xs font-medium text-slate-600">{label}
      <input
        type={type}
        value={(f as any)[key] || ''}
        onChange={e => up(key, e.target.value)}
        placeholder={placeholder || `Saisir ${label.toLowerCase()}...`}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{driver ? 'Modifier le chauffeur' : 'Ajouter un chauffeur'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(f); }} className="grid grid-cols-2 gap-4 p-6">
          {inp('Nom', 'nom')}{inp('Prénom', 'prenom')}
          <label className="col-span-2 block text-xs font-medium text-slate-600">Fonction
            <input list="driver-fonctions" autoComplete="off" value={f.fonction || ''} onChange={e => up('fonction', e.target.value)} placeholder="Ex : Chauffeur de direction, Chauffeur-livreur…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <datalist id="driver-fonctions">{knownFonctions.map(fn => <option key={fn} value={fn} />)}</datalist>
          </label>
          {inp('Téléphone', 'telephone', 'tel')}{inp('Email', 'email', 'email')}
          {inp('N° Permis', 'numero_permis')}
          <label className="block text-xs font-medium text-slate-600">Catégorie permis
            <SelectWithOther
              value={f.categorie_permis}
              onChange={(v) => up('categorie_permis', v)}
              options={['A', 'B', 'AB', 'B-C', 'B-C-D', 'BCDE', 'ABCDE', 'C', 'D', 'E']}
              placeholder="Sélectionner la catégorie du permis..."
              otherPlaceholder="Préciser la catégorie du permis…"
            />
          </label>
          {inp('Expiration permis', 'date_expiration_permis', 'date')}{inp("Date d'embauche", 'date_embauche', 'date')}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            {renderDocumentUpload('Permis de conduire (recto)', 'permis_recto_url')}
            {renderDocumentUpload('Permis de conduire (verso)', 'permis_verso_url')}
          </div>
          <label className="block text-xs font-medium text-slate-600">Véhicule affecté
            <SearchableSelect value={f.vehicule_affecte_id} onChange={v => up('vehicule_affecte_id', v)} emptyLabel="Aucun véhicule (laisser vide)" placeholder="Sélectionner un véhicule ou laisser vide..." options={vehicles.map(v => ({ value: v.id, label: v.label }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Statut
            <select value={f.statut} onChange={e => up('statut', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="" disabled>Sélectionner un statut...</option>
              {['Disponible', 'En mission', 'En congé', 'Indisponible'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="col-span-2">{inp('Notes', 'notes', 'text', 'Ajouter une remarque sur le chauffeur, ses disponibilités ou contraintes...')}</div>
          <div className="col-span-2 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{driver ? 'Mettre à jour' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Formulaire Mission
// ─────────────────────────────────────────────────────────
const emptyMission: Omit<Mission, 'id'> = { driverId: '', vehicleId: '', titre: '', description: '', lieu_depart: '', lieu_arrivee: '', date_debut: '', date_fin: '', heure_depart: '', heure_retour: '', km_depart: 0, km_retour: 0, statut: 'Planifiée', cout_mission: 0, observations: '' };

function MissionFormModal({ mission, drivers, vehicles, existingMissions, onSave, onClose }: {
  mission?: Mission; drivers: Driver[]; vehicles: { id: string; label: string }[]; existingMissions: Mission[]; onSave: (data: Omit<Mission, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Omit<Mission, 'id'>>(mission ? { ...mission } : { ...emptyMission });
  const [error, setError] = useState('');
  // Titres et lieux déjà saisis sur les autres missions, reproposés
  const sg = {
    titres: uniqueValues(existingMissions.map(m => m.titre)),
    lieux: uniqueValues(existingMissions.flatMap(m => [m.lieu_depart, m.lieu_arrivee])),
  };
  const up = (k: string, v: string | number) => { setF(p => ({ ...p, [k]: v })); setError(''); };
  const inp = (label: string, key: string, type = 'text', placeholder?: string, suggest?: string[]) => (
    <label className="block text-xs font-medium text-slate-600">{label}
      <SuggestInput
        suggestions={suggest || []}
        type={type}
        value={(f as any)[key] || ''}
        onChange={e => up(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder || `Saisir ${label.toLowerCase()}...`}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </label>
  );

  // Chauffeurs disponibles uniquement (sauf le chauffeur déjà assigné en mode édition)
  const availableDrivers = drivers.filter(d => d.statut === 'Disponible' || (mission && d.id === mission.driverId));

  // Vérification chevauchement de dates
  const checkOverlap = (): string | null => {
    if (!f.driverId || !f.date_debut || !f.date_fin) return null;
    const start = f.date_debut;
    const end = f.date_fin;
    const conflict = existingMissions.find(m => {
      if (m.driverId !== f.driverId) return false;
      if (mission && m.id === mission.id) return false; // ignorer la mission en cours d'édition
      if (m.statut === 'Annulée' || m.statut === 'Terminée') return false;
      // Chevauchement : !(fin1 < début2 || début1 > fin2)
      return !(end < m.date_debut || start > m.date_fin);
    });
    if (conflict) {
      const dr = drivers.find(d => d.id === f.driverId);
      return `${dr?.prenom} ${dr?.nom} est déjà affecté(e) à la mission "${conflict.titre}" du ${conflict.date_debut} au ${conflict.date_fin}. Choisissez un autre chauffeur ou modifiez les dates.`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const overlap = checkOverlap();
    if (overlap) { setError(overlap); return; }
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{mission ? 'Modifier la mission' : 'Nouvelle mission'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 p-6">
          {error && <div className="col-span-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700"><AlertTriangle className="inline h-4 w-4 mr-1" />{error}</div>}
          <label className="block text-xs font-medium text-slate-600">Chauffeur
            <SearchableSelect required value={f.driverId} onChange={v => up('driverId', v)} placeholder="Sélectionner le chauffeur concerné..." noOptionsText="Aucun chauffeur disponible" options={availableDrivers.map(d => ({ value: d.id, label: `${d.prenom} ${d.nom} (${d.statut})` }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            {drivers.filter(d => d.statut !== 'Disponible' && !(mission && d.id === mission.driverId)).length > 0 && (
              <p className="mt-1 text-[10px] text-amber-600">{drivers.filter(d => d.statut !== 'Disponible').length} chauffeur(s) non disponible(s) masqué(s)</p>
            )}
          </label>
          <label className="block text-xs font-medium text-slate-600">Véhicule
            <SearchableSelect required value={f.vehicleId} onChange={v => up('vehicleId', v)} placeholder="Sélectionner le véhicule utilisé..." options={vehicles.map(v => ({ value: v.id, label: v.label }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <div className="col-span-2">{inp('Titre de la mission', 'titre', 'text', 'Ex: Livraison Yamoussoukro, Visite client Bouaké...', sg.titres)}</div>
          {inp('Lieu de départ', 'lieu_depart', 'text', 'Ex: Abidjan, Plateau', sg.lieux)}{inp("Lieu d'arrivée", 'lieu_arrivee', 'text', 'Ex: Yamoussoukro', sg.lieux)}
          {inp('Date début', 'date_debut', 'date')}{inp('Date fin', 'date_fin', 'date')}
          {inp('Heure départ', 'heure_depart', 'time')}{inp('Heure retour', 'heure_retour', 'time')}
          {inp('Km départ', 'km_depart', 'number', 'Ex: 45200')}{inp('Km retour', 'km_retour', 'number', 'Ex: 45680')}
          {inp('Coût mission (FCFA)', 'cout_mission', 'number', 'Ex: 35000')}
          <label className="block text-xs font-medium text-slate-600">Statut
            <select value={f.statut} onChange={e => up('statut', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="" disabled>Sélectionner le statut de la mission...</option>
              {['Planifiée', 'En cours', 'Terminée', 'Annulée'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="col-span-2">{inp('Observations', 'observations', 'text', 'Ajouter des consignes, contraintes ou remarques sur la mission...')}</div>
          <div className="col-span-2 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{mission ? 'Mettre à jour' : 'Créer la mission'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Formulaire Planning
// ─────────────────────────────────────────────────────────
const emptyEvent: Omit<PlanningEvent, 'id'> = { driverId: '', vehicleId: '', titre: '', type: 'Mission', date_debut: '', date_fin: '', couleur: '#10b981', notes: '' };

function PlanningFormModal({ event, drivers, vehicles, existingPlanning, onSave, onClose }: {
  event?: PlanningEvent; drivers: Driver[]; vehicles: { id: string; label: string }[]; existingPlanning: PlanningEvent[]; onSave: (data: Omit<PlanningEvent, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Omit<PlanningEvent, 'id'>>(event ? { ...event } : { ...emptyEvent });
  const [error, setError] = useState('');
  const sg = { titres: uniqueValues(existingPlanning.map(e => e.titre)) };
  const up = (k: string, v: string) => { setF(p => ({ ...p, [k]: v })); setError(''); };

  // Pour les missions : seuls les chauffeurs disponibles
  const isMissionType = f.type === 'Mission';
  const availableDrivers = isMissionType
    ? drivers.filter(d => d.statut === 'Disponible' || (event && d.id === event.driverId))
    : drivers;

  const checkOverlap = (): string | null => {
    if (!f.driverId || !f.date_debut || !f.date_fin) return null;
    const conflict = existingPlanning.find(ev => {
      if (ev.driverId !== f.driverId) return false;
      if (event && ev.id === event.id) return false;
      return !(f.date_fin < ev.date_debut || f.date_debut > ev.date_fin);
    });
    if (conflict) {
      const dr = drivers.find(d => d.id === f.driverId);
      return `${dr?.prenom} ${dr?.nom} est déjà planifié(e) sur "${conflict.titre}" du ${conflict.date_debut} au ${conflict.date_fin}.`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const overlap = checkOverlap();
    if (overlap) { setError(overlap); return; }
    onSave(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{event ? 'Modifier' : 'Nouvel événement'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-6">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700"><AlertTriangle className="inline h-4 w-4 mr-1" />{error}</div>}
          <label className="block text-xs font-medium text-slate-600">Chauffeur
            <SearchableSelect required value={f.driverId} onChange={v => up('driverId', v)} placeholder="Sélectionner le chauffeur à planifier..." options={availableDrivers.map(d => ({ value: d.id, label: `${d.prenom} ${d.nom}${isMissionType ? ` (${d.statut})` : ''}` }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            {isMissionType && drivers.filter(d => d.statut !== 'Disponible' && !(event && d.id === event.driverId)).length > 0 && (
              <p className="mt-1 text-[10px] text-amber-600">{drivers.filter(d => d.statut !== 'Disponible').length} chauffeur(s) non disponible(s) masqué(s)</p>
            )}
          </label>
          <label className="block text-xs font-medium text-slate-600">Titre
            <SuggestInput suggestions={sg.titres} required value={f.titre} onChange={e => up('titre', e.target.value)} placeholder="Ex: Mission Bouaké, Congé annuel, Formation sécurité..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-600">Type
              <SelectWithOther
                value={f.type}
                onChange={(v) => { up('type', v); up('couleur', EVENT_COLORS[v] || '#8b5cf6'); }}
                options={['Mission', 'Congé', 'Formation', 'Repos']}
                placeholder="Sélectionner le type d'événement..."
                otherPlaceholder="Préciser le type d'événement…"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">Véhicule
              <SearchableSelect value={f.vehicleId} onChange={v => up('vehicleId', v)} emptyLabel="Aucun véhicule (laisser vide)" placeholder="Sélectionner un véhicule ou laisser vide..." options={vehicles.map(v => ({ value: v.id, label: v.label }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-600">Début <input type="date" required value={f.date_debut} onChange={e => up('date_debut', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-slate-600">Fin <input type="date" required value={f.date_fin} onChange={e => up('date_fin', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
          <label className="block text-xs font-medium text-slate-600">Notes <input value={f.notes} onChange={e => up('notes', e.target.value)} placeholder="Ajouter un commentaire ou une précision sur la planification..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{event ? 'Mettre à jour' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function DriverManagement() {
  const { drivers, missions, planning, addDriver, updateDriver, deleteDriver, importDrivers, addMission, updateMission, deleteMission, addPlanningEvent, updatePlanningEvent, deletePlanningEvent } = useDrivers();
  const { vehicles } = useVehicles();
  const [tab, setTab] = usePersistedState<'chauffeurs' | 'missions' | 'planning'>('fleetgest_filter_drivers_tab', 'chauffeurs');
  const [search, setSearch] = usePersistedState('fleetgest_filter_drivers_search', '');
  const [importMessage, setImportMessage] = useState('');
  const [preview, setPreview] = useState<Driver[]>([]);

  // Modals
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | undefined>();
  // Fiche chauffeur ouverte en boîte de dialogue (clic sur une carte)
  const [viewDriverId, setViewDriverId] = useState<string | null>(null);
  // Case KPI ouverte en boîte de dialogue (Disponibles, En mission, En congé, Permis < 90j)
  // Fonctions proposées dans le formulaire : suggestions de base + fonctions déjà saisies
  const knownFonctions = useMemo(() => {
    const m = new Map<string, string>();
    ['Chauffeur', 'Chauffeur de direction', 'Chauffeur-livreur', 'Chauffeur poids lourd', 'Coursier', 'Convoyeur']
      .concat(drivers.map(d => d.fonction?.trim() || ''))
      .forEach(fn => { if (fn && !m.has(fn.toLowerCase())) m.set(fn.toLowerCase(), fn); });
    return Array.from(m.values()).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [drivers]);
  const [openStat, setOpenStat] = useState<null | 'Disponible' | 'En mission' | 'En congé' | 'permis'>(null);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [missionSortDir, setMissionSortDir] = useState<SortDirection>('desc');
  const [editMission, setEditMission] = useState<Mission | undefined>();
  const [showPlanningForm, setShowPlanningForm] = useState(false);
  const [editEvent, setEditEvent] = useState<PlanningEvent | undefined>();

  const vehicleOptions = useMemo(() => vehicles.map(v => ({ id: v.id, label: `${v.numero_immatriculation} — ${v.marque} ${v.type_commercial}` })), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map(d => [d.id, d])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
  // Recherche : porte sur toutes les rubriques de la fiche (identité, fonction, contacts, permis,
  // dates, véhicule affecté, statut, notes). Insensible aux accents et à la casse ; plusieurs mots =
  // tous doivent être trouvés (dans n'importe quelle rubrique). Dates cherchables en 25/03/2027 ou 2027-03-25.
  const filteredDrivers = useMemo(() => {
    const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const words = fold(search).split(/\s+/).filter(Boolean);
    if (words.length === 0) return drivers;
    const frDate = (iso?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
    return drivers.filter(d => {
      const v = vehicleById.get(d.vehicule_affecte_id);
      const hay = fold([
        d.nom, d.prenom, d.prenom + ' ' + d.nom, d.fonction, d.telephone, (d.telephone || '').replace(/[\s.\-()]/g, ''), d.email,
        d.numero_permis, d.categorie_permis, d.date_expiration_permis, frDate(d.date_expiration_permis), d.date_embauche, frDate(d.date_embauche),
        d.statut, d.notes,
        v ? `${v.numero_immatriculation} ${v.marque} ${v.type_commercial}` : 'aucun vehicule',
      ].filter(Boolean).join(' | '));
      return words.every(w => hay.includes(w));
    });
  }, [drivers, search, vehicleById]);

  const tabs = [
    { id: 'chauffeurs' as const, label: 'Chauffeurs', icon: Users, count: drivers.length },
    { id: 'missions' as const, label: 'Missions', icon: ClipboardList, count: missions.length },
    { id: 'planning' as const, label: 'Planification', icon: CalendarDays, count: planning.length },
  ];

  // ── Stats ──
  const driverStats = useMemo(() => ({
    total: drivers.length,
    disponibles: drivers.filter(d => d.statut === 'Disponible').length,
    enMission: drivers.filter(d => d.statut === 'En mission').length,
    enConge: drivers.filter(d => d.statut === 'En congé').length,
    permisExpirant: drivers.filter(d => { if (!d.date_expiration_permis) return false; const diff = (new Date(d.date_expiration_permis).getTime() - Date.now()) / 86400000; return diff >= 0 && diff <= 90; }).length,
  }), [drivers]);

  // ── Weeks for planning calendar view ──
  const calendarWeeks = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    const days: Date[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const getEventsForDay = (day: Date) => {
    const dayStr = day.toISOString().slice(0, 10);
    return planning.filter(ev => ev.date_debut <= dayStr && ev.date_fin >= dayStr);
  };

  const exportToExcel = () => {
    const rows = filteredDrivers.map(d => {
      const v = vehicleById.get(d.vehicule_affecte_id);
      return {
        'Nom': d.nom,
        'Prénom': d.prenom,
        'Téléphone': d.telephone,
        'Email': d.email,
        'N° Permis': d.numero_permis,
        'Catégorie permis': d.categorie_permis,
        'Expiration permis': d.date_expiration_permis,
        'Date embauche': d.date_embauche,
        'Véhicule affecté': v?.numero_immatriculation || '',
        'Statut': d.statut,
        'Notes': d.notes,
      };
    });
    exportRowsToExcel(rows, 'gestion_chauffeurs.xlsx', 'Chauffeurs');
  };

  const buildDriverFromRow = (row: Record<string, unknown>, index: number): Driver | null => {
    const nom = getCell(row, ['nom']);
    const prenom = getCell(row, ['prenom', 'prénom']);
    if (!nom && !prenom) return null;
    const plate = getCell(row, ['vehicule_affecte', 'véhicule affecté', 'immatriculation']);
    const vehicle = plate ? vehicles.find(v => v.numero_immatriculation.toLowerCase() === plate.toLowerCase()) : undefined;
    return {
      id: 'dr-import-' + Date.now() + '-' + index,
      nom,
      prenom,
      fonction: getCell(row, ['fonction', 'poste']),
      telephone: getCell(row, ['telephone', 'téléphone', 'tel']),
      email: getCell(row, ['email', 'e-mail']),
      numero_permis: getCell(row, ['numero_permis', 'n° permis', 'permis']),
      categorie_permis: getCell(row, ['categorie_permis', 'catégorie permis', 'categorie']) || 'B',
      date_expiration_permis: getCell(row, ['date_expiration_permis', 'expiration permis', 'expiration']),
      date_embauche: getCell(row, ['date_embauche', 'date embauche']),
      vehicule_affecte_id: vehicle?.id || '',
      statut: (getCell(row, ['statut']) || 'Disponible') as Driver['statut'],
      notes: getCell(row, ['notes', 'observations']),
    };
  };

  const processImportFile = async (file: File) => {
    setImportMessage('Traitement du fichier en cours...');
    setPreview([]);
    try {
      const rows = await parseSpreadsheetFile(file);
      const imported = rows
        .map((row, index) => buildDriverFromRow(row, index))
        .filter((d): d is Driver => Boolean(d));
      setPreview(imported);
      setImportMessage(imported.length > 0
        ? `${imported.length} chauffeur(s) valide(s) détecté(s).`
        : 'Aucune ligne valide détectée. Vérifiez que les colonnes "nom" et/ou "prenom" sont renseignées.');
    } catch (error) {
      setImportMessage('Erreur: ' + (error as Error).message);
    }
  };

  const confirmImport = () => {
    importDrivers(preview);
    setImportMessage(`${preview.length} chauffeur(s) importé(s) avec succès.`);
    setPreview([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion des Chauffeurs</h2>
          <p className="mt-1 text-sm text-slate-500">{driverStats.total} chauffeur(s) — {driverStats.disponibles} disponible(s) — {missions.filter(m => m.statut === 'Planifiée' || m.statut === 'En cours').length} mission(s) active(s)</p>
        </div>
        <div className="flex gap-2">
          {tab === 'chauffeurs' && (
            <>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer" title="Importer">
                <Upload className="h-4 w-4" /> Importer
                <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && processImportFile(e.target.files[0])} />
              </label>
              <button onClick={exportToExcel} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" title="Exporter"><Download className="h-4 w-4" /> Exporter</button>
            </>
          )}
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>

      {tab === 'chauffeurs' && importMessage && <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 print:hidden">{importMessage}</p>}
      {tab === 'chauffeurs' && preview.length > 0 && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 flex items-center justify-between print:hidden">
          <span className="text-sm text-emerald-800">{preview.length} chauffeur(s) prêt(s) à importer</span>
          <button onClick={confirmImport} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Confirmer l'import</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: 'Total', value: driverStats.total, color: 'emerald' },
          { label: 'Disponibles', value: driverStats.disponibles, color: 'green', key: 'Disponible' as const },
          { label: 'En mission', value: driverStats.enMission, color: 'blue', key: 'En mission' as const },
          { label: 'En congé', value: driverStats.enConge, color: 'amber', key: 'En congé' as const },
          { label: 'Permis < 90j', value: driverStats.permisExpirant, color: 'red', key: 'permis' as const },
        ].map((k: { label: string; value: number; color: string; key?: 'Disponible' | 'En mission' | 'En congé' | 'permis' }) => (
          <div
            key={k.label}
            onClick={k.key ? () => setOpenStat(k.key!) : undefined}
            title={k.key ? 'Cliquer pour voir le détail' : undefined}
            className={`rounded-xl border p-4 bg-${k.color}-50 border-${k.color}-200 ${k.key ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
          >
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 print:hidden">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="h-4 w-4" /> {t.label} <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════ CHAUFFEURS ═══════ */}
      {tab === 'chauffeurs' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row print:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher : nom, fonction, téléphone, e-mail, n° permis, véhicule, statut, notes…" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <button onClick={() => { setEditDriver(undefined); setShowDriverForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Ajouter</button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {search.trim() && (
              <p className="col-span-full text-xs text-slate-500 print:hidden">
                {filteredDrivers.length === 0 ? 'Aucun chauffeur ne correspond à cette recherche.' : `${filteredDrivers.length} chauffeur(s) trouvé(s) sur ${drivers.length}`}
              </p>
            )}
            {filteredDrivers.map(d => {
              const v = vehicleById.get(d.vehicule_affecte_id);
              const permisExpire = d.date_expiration_permis && new Date(d.date_expiration_permis) < new Date();
              return (
                <div key={d.id} onClick={() => setViewDriverId(d.id)} title="Voir la fiche complète" className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-sm">
                        {d.prenom[0]}{d.nom[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{d.prenom} {d.nom}</p>
                        {d.fonction && <p className="text-[11px] text-slate-500">{d.fonction}</p>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_DRIVER_COLORS[d.statut]}`}>{d.statut}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 print:hidden" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditDriver(d); setShowDriverForm(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteDriver(d.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" />{d.telephone}</p>
                    <p className="flex items-center gap-2"><Mail className="h-3 w-3 text-slate-400" />{d.email}</p>
                    <p className="flex items-center gap-2"><Car className="h-3 w-3 text-slate-400" />{v ? v.numero_immatriculation + ' — ' + v.marque : 'Aucun véhicule'}</p>
                    <p className="flex items-center gap-2">
                      {permisExpire ? <AlertTriangle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      Permis {d.categorie_permis} — expire {fmtDate(d.date_expiration_permis)}
                    </p>
                    {(d.permis_recto_url || d.permis_verso_url) && (
                      <p className="flex items-center gap-2 print:hidden" onClick={e => e.stopPropagation()}>
                        <FileImage className="h-3 w-3 text-slate-400" />
                        <span>Copie du permis :</span>
                        {d.permis_recto_url && <a href={d.permis_recto_url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 hover:underline">recto</a>}
                        {d.permis_recto_url && d.permis_verso_url && <span className="text-slate-300">|</span>}
                        {d.permis_verso_url && <a href={d.permis_verso_url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 hover:underline">verso</a>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {openStat && (
            <DriverStatModal
              kind={openStat}
              drivers={drivers}
              missions={missions}
              planning={planning}
              vehicleLabel={(id) => { const v = vehicleById.get(id); return v ? `${v.numero_immatriculation} — ${v.marque}` : '—'; }}
              onOpenDriver={(id) => { setOpenStat(null); setViewDriverId(id); }}
              onClose={() => setOpenStat(null)}
            />
          )}
          {viewDriverId && (() => {
            const vd = drivers.find(d => d.id === viewDriverId);
            if (!vd) return null;
            const vv = vehicleById.get(vd.vehicule_affecte_id);
            return (
              <DriverDetailModal
                driver={vd}
                vehicleLabel={vv ? `${vv.numero_immatriculation} — ${vv.marque}` : 'Aucun véhicule'}
                missions={missions}
                onEdit={() => { setViewDriverId(null); setEditDriver(vd); setShowDriverForm(true); }}
                onClose={() => setViewDriverId(null)}
              />
            );
          })()}
          {showDriverForm && (
            <DriverFormModal
              driver={editDriver}
              vehicles={vehicleOptions}
              knownFonctions={knownFonctions}
              onClose={() => { setShowDriverForm(false); setEditDriver(undefined); }}
              onSave={data => {
                if (editDriver) updateDriver(editDriver.id, data);
                else addDriver({ ...data, id: 'dr' + Date.now() });
                setShowDriverForm(false); setEditDriver(undefined);
              }}
            />
          )}
        </div>
      )}

      {/* ═══════ MISSIONS ═══════ */}
      {tab === 'missions' && (
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <button onClick={() => { setEditMission(undefined); setShowMissionForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Nouvelle mission</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Mission', 'Chauffeur', 'Véhicule', 'Trajet', 'Dates', 'Km', 'Coût', 'Statut', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        {h === 'Dates' ? <span className="inline-flex items-center gap-2">{h}<SortToggleButton direction={missionSortDir} onToggle={() => setMissionSortDir(d => d === 'desc' ? 'asc' : 'desc')} /></span> : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {missions.length === 0 ? (
                    <tr><td colSpan={9} className="py-10 text-center text-slate-400">Aucune mission</td></tr>
                  ) : missions.sort((a, b) => (missionSortDir === 'desc' ? 1 : -1) * (new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime())).map(m => {
                    const dr = driverById.get(m.driverId);
                    const ve = vehicleById.get(m.vehicleId);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-semibold text-slate-800">{m.titre}</p><p className="text-xs text-slate-500">{m.description}</p></td>
                        <td className="px-4 py-3">{dr ? `${dr.prenom} ${dr.nom}` : '—'}</td>
                        <td className="px-4 py-3 text-xs">{ve ? ve.numero_immatriculation : '—'}</td>
                        <td className="px-4 py-3 text-xs"><div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-500" />{m.lieu_depart}</div><div className="flex items-center gap-1"><ChevronRight className="h-3 w-3 text-slate-300" />{m.lieu_arrivee}</div></td>
                        <td className="px-4 py-3 text-xs">{fmtDate(m.date_debut)}{m.date_fin !== m.date_debut ? ` → ${fmtDate(m.date_fin)}` : ''}</td>
                        <td className="px-4 py-3 text-xs">{m.km_retour > 0 ? `${(m.km_retour - m.km_depart).toLocaleString()} km` : '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold">{m.cout_mission ? fmtMoney(m.cout_mission) : '—'}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUT_MISSION_COLORS[m.statut]}`}>{m.statut}</span></td>
                        <td className="px-4 py-3 print:hidden">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditMission(m); setShowMissionForm(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => {
                              if (confirm('Supprimer cette mission ? L\'événement de planification associé sera également supprimé.')) {
                                deleteMission(m.id);
                                const linkedEvent = planning.find(ev => ev.id === `pl-mi-${m.id}`);
                                if (linkedEvent) deletePlanningEvent(linkedEvent.id);
                              }
                            }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {showMissionForm && (
            <MissionFormModal
              mission={editMission}
              drivers={drivers}
              vehicles={vehicleOptions}
              existingMissions={missions}
              onClose={() => { setShowMissionForm(false); setEditMission(undefined); }}
              onSave={data => {
                if (editMission) {
                  updateMission(editMission.id, data);
                } else {
                  const newId = 'mi' + Date.now();
                  const newMission = { ...data, id: newId } as Mission;
                  addMission(newMission);
                }
                setShowMissionForm(false);
                setEditMission(undefined);
                setTab('planning');
              }}
            />
          )}
        </div>
      )}

      {/* ═══════ PLANNING ═══════ */}
      {tab === 'planning' && (
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <button onClick={() => { setEditEvent(undefined); setShowPlanningForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Nouvelle planification</button>
          </div>

          {/* Calendar Grid — 4 weeks */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarWeeks.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const events = getEventsForDay(day);
                return (
                  <div key={i} className={`min-h-[90px] p-1.5 ${isToday ? 'bg-emerald-50' : 'bg-white'}`}>
                    <p className={`text-xs font-medium mb-1 ${isToday ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                      {day.getDate()}{day.getDate() === 1 ? '/' + (day.getMonth() + 1) : ''}
                    </p>
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map(ev => {
                        const dr = driverById.get(ev.driverId);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => { setEditEvent(ev); setShowPlanningForm(true); }}
                            className="w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white"
                            style={{ backgroundColor: ev.couleur || '#10b981' }}
                            title={`${ev.titre} — ${dr ? dr.prenom + ' ' + dr.nom : ''}`}
                          >
                            {ev.titre}
                          </button>
                        );
                      })}
                      {events.length > 3 && <p className="text-[10px] text-slate-400">+{events.length - 3} autre(s)</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event list below calendar */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-700">Tous les événements</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {planning.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Aucun événement planifié</p> : planning.sort((a, b) => a.date_debut.localeCompare(b.date_debut)).map(ev => {
                const dr = driverById.get(ev.driverId);
                const ve = vehicleById.get(ev.vehicleId);
                return (
                  <div key={ev.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="h-8 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ev.couleur }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{ev.titre}</p>
                      <p className="text-xs text-slate-500">{dr ? `${dr.prenom} ${dr.nom}` : '—'} {ve ? `• ${ve.numero_immatriculation}` : ''} • {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)}</p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">{ev.type}</span>
                    <div className="flex gap-1 print:hidden">
                      <button onClick={() => { setEditEvent(ev); setShowPlanningForm(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deletePlanningEvent(ev.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showPlanningForm && (
            <PlanningFormModal
              event={editEvent}
              drivers={drivers}
              vehicles={vehicleOptions}
              existingPlanning={planning}
              onClose={() => { setShowPlanningForm(false); setEditEvent(undefined); }}
              onSave={(data) => {
                const eventId = editEvent?.id || 'pl' + Date.now();
                if (editEvent) updatePlanningEvent(eventId, data);
                else addPlanningEvent({ ...data, id: eventId });

                if (data.type === 'Mission') {
                  const linkedMission = {
                    id: `mi-pl-${eventId}`,
                    driverId: data.driverId,
                    vehicleId: data.vehicleId,
                    titre: data.titre,
                    description: data.notes || '',
                    lieu_depart: '',
                    lieu_arrivee: '',
                    date_debut: data.date_debut,
                    date_fin: data.date_fin,
                    heure_depart: '',
                    heure_retour: '',
                    km_depart: 0,
                    km_retour: 0,
                    statut: 'Planifiée',
                    cout_mission: 0,
                    observations: 'Créée depuis la Planification',
                  } as Mission;

                  const missionExists = missions.some(m => m.id === linkedMission.id);
                  if (missionExists) updateMission(linkedMission.id, linkedMission);
                  else addMission(linkedMission);
                  setTab('missions');
                }
                setShowPlanningForm(false);
                setEditEvent(undefined);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Boîte de dialogue des cases KPI chauffeurs ────────────────────────────────

function fmtD(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

function DriverStatModal({ kind, drivers, missions, planning, vehicleLabel, onOpenDriver, onClose }: {
  kind: 'Disponible' | 'En mission' | 'En congé' | 'permis';
  drivers: Driver[];
  missions: Mission[];
  planning: PlanningEvent[];
  vehicleLabel: (vehicleId: string) => string;
  onOpenDriver: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = new Date().toISOString().slice(0, 10);
  const isPermis = kind === 'permis';
  const list = isPermis
    ? drivers.filter(d => d.date_expiration_permis && daysUntil(d.date_expiration_permis) >= 0 && daysUntil(d.date_expiration_permis) <= 90)
        .sort((a, b) => a.date_expiration_permis.localeCompare(b.date_expiration_permis))
    : drivers.filter(d => d.statut === kind);
  // Pour information : permis déjà expirés (non comptés dans la case « Permis < 90j »)
  const expired = isPermis ? drivers.filter(d => d.date_expiration_permis && daysUntil(d.date_expiration_permis) < 0) : [];

  const title = isPermis ? 'Permis expirant sous 90 jours' : kind === 'Disponible' ? 'Chauffeurs disponibles' : kind === 'En mission' ? 'Chauffeurs en mission' : 'Chauffeurs en congé';

  // Colonne « détail » propre à chaque case
  const detail = (d: Driver) => {
    if (isPermis) {
      const n = daysUntil(d.date_expiration_permis);
      return <span className={n <= 30 ? 'font-semibold text-red-600' : 'text-amber-700'}>Expire le {fmtD(d.date_expiration_permis)} · dans {n} j</span>;
    }
    if (kind === 'En mission') {
      const m = missions.filter(x => x.driverId === d.id && x.statut === 'En cours').sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''))[0]
        || missions.filter(x => x.driverId === d.id && x.statut === 'Planifiée').sort((a, b) => (a.date_debut || '').localeCompare(b.date_debut || ''))[0];
      if (!m) return <span className="text-slate-400">Aucune mission « En cours » enregistrée</span>;
      return <span><b>{m.titre}</b> ({m.statut})<br />{[m.lieu_depart, m.lieu_arrivee].filter(Boolean).join(' → ') || '—'} · du {fmtD(m.date_debut)} au {fmtD(m.date_fin)}{m.vehicleId ? <><br />Véhicule : {vehicleLabel(m.vehicleId)}</> : null}</span>;
    }
    if (kind === 'En congé') {
      const c = planning.filter(p => p.driverId === d.id && p.type === 'Congé' && p.date_fin >= today).sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0];
      if (!c) return <span className="text-slate-400">Aucune période de congé saisie dans la Planification</span>;
      return <span>Du {fmtD(c.date_debut)} au {fmtD(c.date_fin)} · retour dans {Math.max(0, daysUntil(c.date_fin) + 1)} j{c.notes ? <><br />{c.notes}</> : null}</span>;
    }
    // Disponible : prochaine mission planifiée éventuelle
    const next = missions.filter(x => x.driverId === d.id && x.statut === 'Planifiée' && x.date_debut >= today).sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0];
    return next ? <span>Prochaine mission : <b>{next.titre}</b> le {fmtD(next.date_debut)}</span> : <span className="text-slate-400">Aucune mission planifiée</span>;
  };

  const table = (rows: Driver[], showDetail = true) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-500">
          <tr><th className="px-3 py-2">Chauffeur</th><th className="px-3 py-2">Téléphone</th><th className="px-3 py-2">Permis</th><th className="px-3 py-2">Véhicule affecté</th>{showDetail && <th className="px-3 py-2">Détail</th>}<th className="px-3 py-2"></th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(d => (
            <tr key={d.id} className="align-top hover:bg-slate-50">
              <td className="px-3 py-2"><p className="font-semibold text-slate-800">{d.prenom} {d.nom}</p><p className="text-slate-500">{d.statut}</p></td>
              <td className="px-3 py-2 whitespace-nowrap">{d.telephone || '—'}</td>
              <td className="px-3 py-2">{d.numero_permis || '—'}{d.categorie_permis ? ` (${d.categorie_permis})` : ''}</td>
              <td className="px-3 py-2">{d.vehicule_affecte_id ? vehicleLabel(d.vehicule_affecte_id) : '—'}</td>
              {showDetail && <td className="px-3 py-2">{detail(d)}</td>}
              <td className="px-3 py-2"><button onClick={() => onOpenDriver(d.id)} className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-white">Fiche ›</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title} — {list.length}</h3>
            <p className="text-xs text-slate-500">{drivers.length > 0 ? ((list.length / drivers.length) * 100).toFixed(0) : 0} % des {drivers.length} chauffeur(s)</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700" title="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6">
          {list.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-400">Aucun chauffeur dans cette situation.</p> : table(list)}
          {isPermis && expired.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Permis déjà expirés ({expired.length}) — non comptés dans la case</h4>
              {table(expired.map(d => d), false)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
