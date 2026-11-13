// ─── Système de contrôle d'accès démo ───
// La démo est valide 5 jours à partir de la première visite sur ce domaine/URL.
// La clé inclut le hostname pour que chaque URL de déploiement ait son propre compteur.

export const DEMO_DURATION_DAYS = 5;
export const ADMIN_EMAIL = 'gernguessan@outlook.com';

function getDomainKey(): string {
  // Utilise le hostname pour isoler chaque déploiement
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return host.replace(/[^a-z0-9]/gi, '_');
}

function getStorageKeyStart(): string {
  return `parc_auto_demo_start_${getDomainKey()}`;
}
function getStorageKeyUnlocked(): string {
  return `parc_auto_demo_unlocked_until_${getDomainKey()}`;
}

/**
 * Date de début de la période de démo (timestamp ms).
 * Enregistrée au 1er accès sur ce domaine, jamais réinitialisée automatiquement.
 */
export function getDemoStart(): number {
  const key = getStorageKeyStart();
  let raw = localStorage.getItem(key);
  if (!raw) {
    raw = String(Date.now());
    localStorage.setItem(key, raw);
  }
  return parseInt(raw, 10);
}

/**
 * Date de fin de la période de démo (timestamp ms).
 */
export function getDemoEnd(): number {
  const unlocked = localStorage.getItem(getStorageKeyUnlocked());
  if (unlocked) {
    return parseInt(unlocked, 10);
  }
  return getDemoStart() + DEMO_DURATION_DAYS * 24 * 60 * 60 * 1000;
}

export function getRemainingMs(): number {
  return Math.max(0, getDemoEnd() - Date.now());
}

export function getRemainingDays(): number {
  return Math.ceil(getRemainingMs() / (24 * 60 * 60 * 1000));
}

export function isDemoExpired(): boolean {
  return getRemainingMs() <= 0;
}

/**
 * Débloque la démo pour 5 jours supplémentaires si l'email correspond à l'admin.
 */
export function unlockDemo(email: string): boolean {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;
  const newEnd = Date.now() + DEMO_DURATION_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(getStorageKeyUnlocked(), String(newEnd));
  return true;
}

export function resetDemo(): void {
  localStorage.removeItem(getStorageKeyStart());
  localStorage.removeItem(getStorageKeyUnlocked());
}
