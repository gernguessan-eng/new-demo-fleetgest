import { ArrowUpDown } from 'lucide-react';

export type SortOrder = 'asc' | 'desc';

interface Props {
  order: SortOrder;
  onToggle: () => void;
  /** Libellé optionnel affiché à côté de l'icône (ex: "Date") */
  label?: string;
  className?: string;
}

/**
 * Bouton de tri par date — icône à deux flèches en sens inverses, à placer à côté du
 * titre d'une liste/tableau dont le classement le plus pertinent est chronologique.
 * Au clic, on bascule entre "plus ancien → plus récent" et l'inverse.
 */
export default function SortDateButton({ order, onToggle, label, className }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={order === 'asc' ? 'Trié du plus ancien au plus récent — cliquer pour inverser' : 'Trié du plus récent au plus ancien — cliquer pour inverser'}
      className={
        className ||
        'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700'
      }
    >
      <ArrowUpDown className="h-3.5 w-3.5" />
      {label && <span>{label}</span>}
      <span className="text-slate-400">{order === 'asc' ? '(plus ancien → récent)' : '(plus récent → ancien)'}</span>
    </button>
  );
}
