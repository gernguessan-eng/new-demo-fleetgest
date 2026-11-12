import { Download, Printer } from 'lucide-react';
import { printCard } from '../utils/printCard';
import { exportModalToExcel } from '../utils/exportModal';

interface Props {
  /** Titre du fichier Excel et de l'impression */
  title: string;
  subtitle?: string;
  origin?: string;
  className?: string;
}

/**
 * Boutons Imprimer / Exporter (Excel) d'une case du tableau de bord.
 * Ils s'appliquent à l'élément parent portant l'attribut data-print-card.
 */
export default function CardActions({ title, subtitle, origin, className = '' }: Props) {
  const card = (el: HTMLElement) => el.closest<HTMLElement>('[data-print-card]');
  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium';
  return (
    <span className={`kpi-no-print flex items-center gap-2 print:hidden ${className}`}>
      <button type="button" onClick={(e) => { const c = card(e.currentTarget); if (c) printCard(c, origin); }}
        title="Imprimer cette case (ou l'enregistrer en PDF)" className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}>
        <Printer className="h-3.5 w-3.5" /> Imprimer
      </button>
      <button type="button" onClick={(e) => {
        const c = card(e.currentTarget); if (!c) return;
        try { exportModalToExcel(c, title, subtitle); }
        catch (err) { console.error('Export Excel impossible', err); alert("L'export Excel a échoué. Réessayez, ou utilisez Imprimer puis « Enregistrer au format PDF »."); }
      }} title="Exporter cette case vers Excel" className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
        <Download className="h-3.5 w-3.5" /> Exporter
      </button>
    </span>
  );
}
