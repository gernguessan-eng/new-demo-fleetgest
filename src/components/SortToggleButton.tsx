import { ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

interface SortToggleButtonProps {
  direction: SortDirection;
  onToggle: () => void;
  className?: string;
}

/**
 * Petit bouton "2 flèches en sens inverse" à placer à côté d'un titre ou d'un en-tête
 * de colonne "Date", pour basculer le tri entre plus ancien → plus récent et inversement.
 */
export default function SortToggleButton({ direction, onToggle, className = '' }: SortToggleButtonProps) {
  const isAsc = direction === 'asc';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isAsc ? 'Trié du plus ancien au plus récent — cliquer pour inverser' : 'Trié du plus récent au plus ancien — cliquer pour inverser'}
      aria-label="Inverser l'ordre de tri par date"
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
        isAsc
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
      } ${className}`}
    >
      <ArrowUpDown className="h-3 w-3" />
      <span className="hidden sm:inline">{isAsc ? 'Plus ancien' : 'Plus récent'}</span>
    </button>
  );
}
