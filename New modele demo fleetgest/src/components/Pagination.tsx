import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Construit la liste des cases à afficher. Jusqu'à 7 pages : toutes les cases.
 * Au-delà : 1ère et dernière page toujours visibles, + les voisines de la page courante,
 * séparées par « … » (ex. 1 … 4 5 6 … 12).
 */
function buildPageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('…');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const [goTo, setGoTo] = useState('');
  if (totalPages <= 1) return null;

  const go = (p: number) => {
    const page = Math.min(Math.max(1, p), totalPages);
    if (page !== currentPage) onPageChange(page);
  };

  const submitGoTo = () => {
    const n = parseInt(goTo, 10);
    if (!Number.isNaN(n)) go(n);
    setGoTo('');
  };

  const navBtn = 'flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-100';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden">
      <p className="text-sm text-slate-500">Page {currentPage} / {totalPages}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button disabled={currentPage === 1} onClick={() => go(currentPage - 1)} className={navBtn}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </button>

        {buildPageItems(currentPage, totalPages).map((item, i) =>
          item === '…' ? (
            <span key={`dots-${i}`} className="px-1 text-sm text-slate-400">…</span>
          ) : (
            <button
              key={item}
              onClick={() => go(item)}
              aria-current={item === currentPage ? 'page' : undefined}
              className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-medium ${
                item === currentPage
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button disabled={currentPage === totalPages} onClick={() => go(currentPage + 1)} className={navBtn}>
          Suivant <ChevronRight className="h-4 w-4" />
        </button>

        {totalPages > 7 && (
          <div className="ml-2 flex items-center gap-1">
            <span className="text-xs text-slate-500">Aller à</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={goTo}
              onChange={(e) => setGoTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitGoTo(); }}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button onClick={submitGoTo} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-100">OK</button>
          </div>
        )}
      </div>
    </div>
  );
}
