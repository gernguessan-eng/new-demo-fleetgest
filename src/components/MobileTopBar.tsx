import { useLocation } from 'react-router-dom';
import { Car, Menu } from 'lucide-react';
import { pageTitleFor } from './Sidebar';

/** Barre fixe en haut de l'écran, visible uniquement sur téléphone/tablette : bouton menu + page en cours. */
export default function MobileTopBar({ open, onMenu }: { open: boolean; onMenu: () => void }) {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white shadow-md lg:hidden print:hidden">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-controls="main-nav"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10 transition active:scale-95 active:bg-white/20"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500 shadow">
        <Car className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{pageTitleFor(pathname)}</p>
        <p className="truncate text-[10px] leading-tight text-slate-400">Gestion de flotte</p>
      </div>
    </header>
  );
}
