import { useEffect } from 'react';
import type { Driver, Mission } from '../types';
import {
  X, Phone, Mail, Car, CalendarDays, IdCard, CheckCircle2, AlertTriangle, FileText, FileImage, Pencil, StickyNote, ClipboardList,
} from 'lucide-react';

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Les URL Firebase Storage contiennent le chemin du fichier encodé : on détecte un PDF
// à son extension pour afficher un lien plutôt qu'une miniature d'image.
function isPdf(url: string) {
  try { return /\.pdf(\?|$)/i.test(decodeURIComponent(url)); } catch { return /\.pdf/i.test(url); }
}

const STATUT_COLORS: Record<string, string> = {
  Disponible: 'bg-green-100 text-green-700',
  'En mission': 'bg-blue-100 text-blue-700',
  'En congé': 'bg-amber-100 text-amber-700',
  Indisponible: 'bg-red-100 text-red-700',
};

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="w-40 flex-shrink-0 text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

function DocThumb({ url, label }: { url?: string; label: string }) {
  return (
    <div className="text-center">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block" title={`Ouvrir « ${label} »`}>
          {isPdf(url) ? (
            <div className="flex h-28 w-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
              <FileText className="mb-1 h-6 w-6" /><span className="text-[11px] font-medium">PDF — ouvrir</span>
            </div>
          ) : (
            <img src={url} alt={label} className="h-28 w-full rounded-lg border border-slate-200 object-cover hover:opacity-90" />
          )}
        </a>
      ) : (
        <div className="flex h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400">
          <FileImage className="mb-1 h-5 w-5" /><span className="text-[11px]">Non fourni</span>
        </div>
      )}
      <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default function DriverDetailModal({ driver, vehicleLabel, missions, onEdit, onClose }: {
  driver: Driver;
  vehicleLabel: string;
  missions: Mission[];
  onEdit: () => void;
  onClose: () => void;
}) {
  // Fermeture avec la touche Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const permisExpire = !!driver.date_expiration_permis && new Date(driver.date_expiration_permis) < new Date();
  const driverMissions = missions
    .filter((m) => m.driverId === driver.id)
    .sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''));
  const kmTotal = driverMissions.reduce((s, m) => s + Math.max(0, (m.km_retour || 0) - (m.km_depart || 0)), 0);
  const nbDocs = [driver.photo_url, driver.permis_recto_url, driver.permis_verso_url].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            {driver.photo_url && !isPdf(driver.photo_url) ? (
              <img src={driver.photo_url} alt={`${driver.prenom} ${driver.nom}`} className="h-12 w-12 rounded-full border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-white">
                {driver.prenom?.[0]}{driver.nom?.[0]}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-slate-900">{driver.prenom} {driver.nom}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUT_COLORS[driver.statut] || 'bg-slate-100 text-slate-600'}`}>{driver.statut}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <Pencil className="h-4 w-4" /> Modifier
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700" title="Fermer"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Informations */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Coordonnées & affectation</h4>
              <Row icon={<IdCard className="h-4 w-4" />} label="Fonction" value={driver.fonction} />
              <Row icon={<Phone className="h-4 w-4" />} label="Téléphone" value={driver.telephone} />
              <Row icon={<Mail className="h-4 w-4" />} label="E-mail" value={driver.email} />
              <Row icon={<Car className="h-4 w-4" />} label="Véhicule affecté" value={vehicleLabel} />
              <Row icon={<CalendarDays className="h-4 w-4" />} label="Date d'embauche" value={fmtDate(driver.date_embauche)} />
            </section>
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Permis de conduire</h4>
              <Row icon={<IdCard className="h-4 w-4" />} label="N° de permis" value={driver.numero_permis} />
              <Row icon={<IdCard className="h-4 w-4" />} label="Catégorie" value={driver.categorie_permis} />
              <Row
                icon={permisExpire ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                label="Date d'expiration"
                value={<span className={permisExpire ? 'text-red-600' : ''}>{fmtDate(driver.date_expiration_permis)}{permisExpire ? ' (expiré)' : ''}</span>}
              />
            </section>
          </div>

          {/* Documents joints */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">Documents joints ({nbDocs}/3)</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DocThumb url={driver.photo_url} label="Photo du chauffeur" />
              <DocThumb url={driver.permis_recto_url} label="Permis recto" />
              <DocThumb url={driver.permis_verso_url} label="Permis verso" />
            </div>
          </section>

          {/* Missions */}
          <section>
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <ClipboardList className="h-4 w-4" /> Missions ({driverMissions.length}) — {kmTotal.toLocaleString('fr-FR')} km parcourus
            </h4>
            {driverMissions.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune mission enregistrée.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Mission</th><th className="px-3 py-2">Trajet</th><th className="px-3 py-2">Du</th><th className="px-3 py-2">Au</th><th className="px-3 py-2">Statut</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driverMissions.slice(0, 5).map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-medium text-slate-800">{m.titre}</td>
                        <td className="px-3 py-2 text-slate-600">{[m.lieu_depart, m.lieu_arrivee].filter(Boolean).join(' → ') || '—'}</td>
                        <td className="px-3 py-2">{fmtDate(m.date_debut)}</td>
                        <td className="px-3 py-2">{fmtDate(m.date_fin)}</td>
                        <td className="px-3 py-2">{m.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {driverMissions.length > 5 && <p className="bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">5 plus récentes affichées sur {driverMissions.length} — voir l'onglet Missions.</p>}
              </div>
            )}
          </section>

          {/* Notes */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700"><StickyNote className="h-4 w-4" /> Notes</h4>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{driver.notes || '—'}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
