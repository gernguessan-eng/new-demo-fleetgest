import { useMemo, useState } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { usePersistedState } from '../hooks/usePersistedState';
import type { Contact } from '../types';
import SelectWithOther from './SelectWithOther';
import {
  Plus, Printer, Search, Trash2, Pencil, X, BookUser, Phone, Mail,
  MapPin, Building2, Globe, User, Briefcase,
} from 'lucide-react';
import SuggestInput from './SuggestInput';
import { uniqueValues } from '../utils/suggestions';

const TYPE_OPTIONS: Contact['type_contact'][] = [
  'Fournisseur', 'Garage', 'Assureur', 'Client', 'Partenaire', 'Administration', 'Chauffeur', 'Autre',
];

const TYPE_COLORS: Record<Contact['type_contact'], string> = {
  Fournisseur: 'bg-indigo-100 text-indigo-700',
  Garage: 'bg-amber-100 text-amber-700',
  Assureur: 'bg-emerald-100 text-emerald-700',
  Client: 'bg-sky-100 text-sky-700',
  Partenaire: 'bg-violet-100 text-violet-700',
  Administration: 'bg-slate-200 text-slate-700',
  Chauffeur: 'bg-orange-100 text-orange-700',
  Autre: 'bg-gray-100 text-gray-600',
};

const emptyContact: Omit<Contact, 'id'> = {
  type_contact: 'Fournisseur',
  civilite: '',
  nom: '',
  prenom: '',
  societe: '',
  fonction: '',
  telephone: '',
  telephone_secondaire: '',
  email: '',
  adresse: '',
  ville: '',
  pays: 'Côte d\'Ivoire',
  site_web: '',
  notes: '',
  date_creation: new Date().toISOString().slice(0, 10),
};

export default function AddressBook() {
  const { contacts, addContact, updateContact, deleteContact } = useVehicles();
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | undefined>();
  const [search, setSearch] = usePersistedState('fleetgest_filter_contacts_search', '');
  const [typeFilter, setTypeFilter] = usePersistedState<string>('fleetgest_filter_contacts_type', 'Tous');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      const matchSearch =
        !q ||
        c.nom.toLowerCase().includes(q) ||
        (c.prenom || '').toLowerCase().includes(q) ||
        (c.societe || '').toLowerCase().includes(q) ||
        (c.telephone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q);
      const matchType = typeFilter === 'Tous' || c.type_contact === typeFilter;
      return matchSearch && matchType;
    }).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [contacts, search, typeFilter]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    contacts.forEach((c) => m.set(c.type_contact, (m.get(c.type_contact) || 0) + 1));
    return m;
  }, [contacts]);

  const handleSave = (data: Omit<Contact, 'id'>, id?: string) => {
    if (id) {
      updateContact(id, data);
    } else {
      addContact({ ...data, id: 'ct' + Date.now() });
    }
    setShowForm(false);
    setEditContact(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BookUser className="h-6 w-6 text-emerald-600" /> Carnet d'adresses
          </h2>
          <p className="mt-1 text-sm text-slate-500">Fournisseurs, garages, assureurs, clients et tous vos contacts professionnels</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditContact(undefined); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Nouveau contact
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom, une société, un téléphone, un email..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTypeFilter('Tous')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === 'Tous' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Tous ({contacts.length})
          </button>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === t ? 'bg-slate-800 text-white' : `${TYPE_COLORS[t]} hover:opacity-80`}`}
            >
              {t} ({counts.get(t) || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Liste des contacts */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <BookUser className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Aucun contact trouvé. Ajoutez votre premier contact au carnet d'adresses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} onClick={() => { setEditContact(c); setShowForm(true); }} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-emerald-300 print:break-inside-avoid">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${TYPE_COLORS[c.type_contact] || 'bg-gray-100 text-gray-600'}`}>
                    {c.type_contact}
                  </span>
                  <h3 className="mt-2 text-base font-bold text-slate-900">
                    {c.civilite ? `${c.civilite} ` : ''}{c.prenom ? `${c.prenom} ` : ''}{c.nom}
                  </h3>
                  {c.fonction && (
                    <p className="flex items-center gap-1 text-xs text-slate-500"><Briefcase className="h-3 w-3" /> {c.fonction}</p>
                  )}
                  {c.societe && (
                    <p className="flex items-center gap-1 text-xs font-medium text-slate-600"><Building2 className="h-3 w-3" /> {c.societe}</p>
                  )}
                </div>
                <div className="flex gap-1 print:hidden" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditContact(c); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteContact(c.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {c.telephone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {c.telephone}</p>}
                {c.telephone_secondaire && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {c.telephone_secondaire} <span className="text-xs text-slate-400">(secondaire)</span></p>}
                {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /> {c.email}</p>}
                {(c.adresse || c.ville) && (
                  <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {[c.adresse, c.ville, c.pays].filter(Boolean).join(', ')}</p>
                )}
                {c.site_web && <p className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-slate-400" /> {c.site_web}</p>}
              </div>

              {c.notes && (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">{c.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ContactFormModal
          contact={editContact}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditContact(undefined); }}
        />
      )}
    </div>
  );
}

// ── Formulaire ──
interface ContactFormProps {
  contact?: Contact;
  onSave: (data: Omit<Contact, 'id'>, id?: string) => void;
  onClose: () => void;
}

function ContactFormModal({ contact, onSave, onClose }: ContactFormProps) {
  // Valeurs déjà saisies sur les autres contacts, reproposées dans le formulaire
  const { contacts: allContacts } = useVehicles();
  const sg = useMemo(() => ({
    societes: uniqueValues(allContacts.map(c => c.societe)),
    fonctions: uniqueValues(allContacts.map(c => c.fonction)),
    adresses: uniqueValues(allContacts.map(c => c.adresse)),
    villes: uniqueValues(allContacts.map(c => c.ville)),
    pays: uniqueValues(allContacts.map(c => c.pays)),
  }), [allContacts]);
  const [f, setF] = useState<Omit<Contact, 'id'>>({
    type_contact: contact?.type_contact || emptyContact.type_contact,
    civilite: contact?.civilite || '',
    nom: contact?.nom || '',
    prenom: contact?.prenom || '',
    societe: contact?.societe || '',
    fonction: contact?.fonction || '',
    telephone: contact?.telephone || '',
    telephone_secondaire: contact?.telephone_secondaire || '',
    email: contact?.email || '',
    adresse: contact?.adresse || '',
    ville: contact?.ville || '',
    pays: contact?.pays || 'Côte d\'Ivoire',
    site_web: contact?.site_web || '',
    notes: contact?.notes || '',
    date_creation: contact?.date_creation || new Date().toISOString().slice(0, 10),
  });

  const up = (k: keyof Omit<Contact, 'id'>, v: string) => setF((p) => ({ ...p, [k]: v }));

  const inputCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelCls = "block text-xs font-medium text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <User className="h-5 w-5 text-emerald-600" /> {contact ? 'Modifier le contact' : 'Ajouter un contact'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(f, contact?.id); }} className="grid grid-cols-2 gap-4 p-6">
          <div className="col-span-2 rounded-lg bg-emerald-50 p-3 -mb-1">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Identité</p>
          </div>

          <label className={labelCls}>Type de contact
            <SelectWithOther
              value={f.type_contact}
              onChange={(v) => up('type_contact', v)}
              options={TYPE_OPTIONS.filter((t) => t !== 'Autre')}
              className={inputCls}
              otherPlaceholder="Préciser le type de contact…"
            />
          </label>
          <label className={labelCls}>Civilité
            <select value={f.civilite} onChange={(e) => up('civilite', e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
              <option value="Mlle">Mlle</option>
            </select>
          </label>
          <label className={labelCls}>Nom *
            <input required value={f.nom} onChange={(e) => up('nom', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Prénom
            <input value={f.prenom} onChange={(e) => up('prenom', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Société / Organisation
            <SuggestInput suggestions={sg.societes} value={f.societe} onChange={(e) => up('societe', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Fonction
            <SuggestInput suggestions={sg.fonctions} value={f.fonction} onChange={(e) => up('fonction', e.target.value)} placeholder="Ex: Gestionnaire de flotte" className={inputCls} />
          </label>

          <div className="col-span-2 rounded-lg bg-sky-50 p-3 -mb-1 mt-2">
            <p className="text-xs font-semibold text-sky-700 uppercase">Coordonnées</p>
          </div>

          <label className={labelCls}>Téléphone
            <input value={f.telephone} onChange={(e) => up('telephone', e.target.value)} placeholder="+225 07 00 00 00 00" className={inputCls} />
          </label>
          <label className={labelCls}>Téléphone secondaire
            <input value={f.telephone_secondaire} onChange={(e) => up('telephone_secondaire', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Email
            <input type="email" value={f.email} onChange={(e) => up('email', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Site web
            <input value={f.site_web} onChange={(e) => up('site_web', e.target.value)} placeholder="www.exemple.ci" className={inputCls} />
          </label>
          <label className={labelCls}>Adresse
            <SuggestInput suggestions={sg.adresses} value={f.adresse} onChange={(e) => up('adresse', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Ville
            <SuggestInput suggestions={sg.villes} value={f.ville} onChange={(e) => up('ville', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Pays
            <SuggestInput suggestions={sg.pays} value={f.pays} onChange={(e) => up('pays', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>Date de création
            <input type="date" value={f.date_creation} onChange={(e) => up('date_creation', e.target.value)} className={inputCls} />
          </label>

          <label className={`col-span-2 ${labelCls}`}>Notes
            <textarea value={f.notes} onChange={(e) => up('notes', e.target.value)} rows={3} placeholder="Informations complémentaires, références contrat, remarques..." className={inputCls} />
          </label>

          <div className="col-span-2 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{contact ? 'Mettre à jour' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
