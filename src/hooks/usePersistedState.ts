import { useEffect, useState } from 'react';

/**
 * Comme `useState`, mais la valeur est mémorisée dans localStorage sous `key` et relue au
 * montage. Utilisé pour les filtres/recherches/critères de chaque menu : sans cela, ces
 * réglages sont perdus dès qu'on quitte un menu puis qu'on y revient (le composant de page
 * est démonté par React Router, donc son état local repart de zéro à chaque retour).
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);

  return [value, setValue];
}
