import { useState, useEffect, useRef } from 'react';
import { Lock, Mail, Send, CheckCircle2, AlertCircle, Clock, ShieldCheck, KeyRound } from 'lucide-react';
import {
  ADMIN_EMAIL,
  DEMO_DURATION_DAYS,
  getDemoEnd,
  isDemoExpired,
  unlockDemo,
  getRemainingDays,
} from '../utils/demoAccess';

interface Props {
  children: React.ReactNode;
}

export default function AccessGate({ children }: Props) {
  const [expired, setExpired] = useState<boolean>(() => isDemoExpired());
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Re-vérifie l'expiration toutes les 60 s
  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setExpired(isDemoExpired());
    }, 60_000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError("Veuillez saisir votre adresse email.");
      return;
    }
    if (unlockDemo(email)) {
      setExpired(false);
      setEmail('');
    } else {
      setError(`Adresse non autorisée. Seul l'administrateur (${ADMIN_EMAIL}) peut prolonger la démo.`);
    }
  };

  const handleRequestAccess = () => {
    const subject = encodeURIComponent("Demande d'accès – Démo Parc Auto");
    const body = encodeURIComponent(
      `Bonjour,\n\nJe souhaite accéder à la démo de l'application de gestion du parc automobile.\n\nMerci de bien vouloir prolonger mon accès.\n\nCordialement.`
    );
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
    setRequestSent(true);
  };

  if (!expired) {
    return <>{children}</>;
  }

  // ── Écran de verrouillage ──
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Démo expirée</h1>
              <p className="text-sm text-white/90">L'accès à la démonstration n'est plus disponible</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Période d'évaluation terminée</p>
                <p className="mt-1 text-xs">
                  Cette démo est limitée à <strong>{DEMO_DURATION_DAYS} jours</strong>. Pour continuer à utiliser
                  l'application ou prolonger votre période d'évaluation, veuillez confirmer votre adresse email
                  d'administration.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="space-y-3">
            <label className="block">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                Adresse email administrateur
              </span>
              <div className="mt-1.5 relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@domaine.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" />
              Confirmer et prolonger l'accès
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-400">ou</span>
            </div>
          </div>

          {/* Request access */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Vous n'êtes pas administrateur ? Faites une demande d'accès :
            </p>
            <button
              onClick={handleRequestAccess}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {requestSent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Send className="h-4 w-4" />}
              {requestSent ? 'Demande envoyée' : `Contacter ${ADMIN_EMAIL}`}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-center">
          <p className="text-[11px] text-slate-400">
            Démo Parc Auto — Période expirée le {new Date(getDemoEnd()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Bandeau de compte à rebours visible sur toutes les pages ──
export function DemoBanner() {
  const [days, setDays] = useState(getRemainingDays());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setDays(getRemainingDays()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (dismissed || days <= 0) return null;

  const isUrgent = days <= 1;
  const isWarning = days <= 2 && days > 1;

  return (
    <div
      className={`print:hidden flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium ${
        isUrgent
          ? 'bg-red-100 text-red-800 border-b border-red-200'
          : isWarning
            ? 'bg-amber-100 text-amber-800 border-b border-amber-200'
            : 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        <span>
          <strong>Démo</strong> – il vous reste <strong>{days} jour{days > 1 ? 's' : ''}</strong>{' '}
          d'accès. Expire le {new Date(getDemoEnd()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-1 opacity-60 hover:opacity-100"
        title="Masquer"
      >
        ✕
      </button>
    </div>
  );
}
