import { useState } from "react";
import { loginWithEmail, registerWithEmail, type UserProfile } from "../authService";

const inputCls =
  "mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function Login({ onLogin }: { onLogin: (profile: UserProfile) => void }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"login" | "create">("login");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email.trim()) return setErr("Veuillez saisir votre adresse e-mail.");
    if (pwd.length < 6) return setErr("Le mot de passe doit contenir au moins 6 caractères.");

    try {
      setLoading(true);
      const profile =
        mode === "create"
          ? await registerWithEmail(email.trim(), pwd, displayName.trim() || email.trim())
          : await loginWithEmail(email.trim(), pwd);
      onLogin(profile);
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code.includes("auth/invalid-credential")) setErr("E-mail ou mot de passe incorrect.");
      else if (code.includes("auth/email-already-in-use")) setErr("Cette adresse e-mail est déjà utilisée.");
      else if (code.includes("auth/weak-password")) setErr("Le mot de passe est trop faible.");
      else setErr("Connexion Firebase impossible. Vérifiez la configuration Firebase et votre connexion Internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-wide text-slate-900">FleetGest</h1>
          <p className="mt-1 text-sm text-slate-500">Gestion de parc automobile</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-bold text-slate-500">
          <button type="button" onClick={() => { setMode("login"); setErr(""); }} className={`rounded-md py-2.5 transition-all ${mode === "login" ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-700"}`}>Connexion</button>
          <button type="button" onClick={() => { setMode("create"); setErr(""); }} className={`rounded-md py-2.5 transition-all ${mode === "create" ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-700"}`}>Inscription</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold text-slate-800">
            Adresse e-mail
            <input className={inputCls} type="email" placeholder="nom@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Mot de passe
            <input className={inputCls} type="password" placeholder="Minimum 6 caractères" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </label>
          {mode === "create" && (
            <label className="block text-sm font-bold text-slate-800">
              Nom / Fonction
              <input className={inputCls} placeholder="Ex : Gestionnaire de flotte" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          )}

          {err && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{err}</p>}

          <button disabled={loading} type="submit" className="h-11 w-full rounded-lg bg-emerald-600 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60">
            {loading ? "Connexion..." : mode === "create" ? "Créer le compte" : "Se connecter"}
          </button>
          <p className="text-center text-xs leading-5 text-slate-400">
            Le premier compte créé devient administrateur.
          </p>
        </form>
      </div>
    </div>
  );
}
