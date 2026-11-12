import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X } from 'lucide-react';
import { exportModalToExcel } from '../utils/exportModal';

/**
 * Impression d'une boîte de dialogue : pendant l'impression seulement (classe posée sur <body>),
 * tout le reste de la page est masqué et la boîte s'affiche à plat, sans défilement ni boutons.
 * Sans cette classe, rien ne change : un Ctrl+P ordinaire imprime la page comme avant.
 * Les boutons du contenu sont masqués, sauf ceux marqués data-print-keep (lignes cliquables
 * dont le texte doit rester sur le papier).
 */
const PRINT_CSS = `
@media print {
  .kpi-print-portal { display: none !important; }
  body.printing-kpi-modal > *:not(.kpi-print-portal) { display: none !important; }
  body.printing-kpi-modal .kpi-print-portal { display: block !important; position: static !important; inset: auto !important; background: none !important; padding: 0 !important; }
  body.printing-kpi-modal .kpi-print-card { max-width: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body.printing-kpi-modal .kpi-print-card * { max-height: none !important; }
  body.printing-kpi-modal .kpi-print-card .overflow-auto,
  body.printing-kpi-modal .kpi-print-card .overflow-x-auto,
  body.printing-kpi-modal .kpi-print-card .overflow-y-auto { overflow: visible !important; }
  body.printing-kpi-modal .kpi-print-card .sticky { position: static !important; }
  body.printing-kpi-modal .kpi-print-card button:not([data-print-keep]),
  body.printing-kpi-modal .kpi-no-print { display: none !important; }
  body.printing-kpi-modal .kpi-print-only { display: block !important; }
  body.printing-kpi-modal .kpi-print-card tr { break-inside: avoid; }
  body.printing-kpi-modal .kpi-print-card thead { display: table-header-group; }
}
`;

interface Props {
  title: string;
  subtitle?: string;
  /** Menu d'origine, rappelé sur l'en-tête de l'impression (défaut : Tableau de bord) */
  origin?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Boîte de dialogue de détail d'un KPI, avec boutons Imprimer et Exporter (Excel). */
export default function KpiModal({ title, subtitle, origin = 'Tableau de bord', onClose, children }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Si la boîte se ferme pendant une impression, on remet la page dans son état normal
  useEffect(() => () => cleanupRef.current?.(), []);

  const handlePrint = () => {
    cleanupRef.current?.();
    if (stampRef.current) stampRef.current.textContent = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    // Les tableaux de ces boîtes sont larges : A4 en paysage
    const pageStyle = document.createElement('style');
    pageStyle.textContent = '@page { size: A4 landscape; margin: 10mm; }';
    document.head.appendChild(pageStyle);
    document.body.classList.add('printing-kpi-modal');
    let timer = 0;
    const cleanup = () => {
      document.body.classList.remove('printing-kpi-modal');
      pageStyle.remove();
      window.removeEventListener('afterprint', cleanup);
      window.clearTimeout(timer);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
    window.addEventListener('afterprint', cleanup);
    timer = window.setTimeout(cleanup, 60000); // sécurité si « afterprint » n'est pas émis
    window.print();
  };

  const handleExport = () => {
    try { exportModalToExcel(contentRef.current, title, subtitle); }
    catch (err) { console.error('Export Excel impossible', err); alert("L'export Excel a échoué. Réessayez, ou utilisez Imprimer puis « Enregistrer au format PDF »."); }
  };

  return createPortal(
    <div className="kpi-print-portal fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <style>{PRINT_CSS}</style>
      <div className="kpi-print-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="kpi-print-only mb-1 hidden text-[11px] text-slate-500">Parc Auto — Gestion de Flotte · {origin} · Édité le <span ref={stampRef} /></p>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="kpi-no-print flex flex-shrink-0 items-center gap-2">
            <button onClick={handlePrint} title="Imprimer cette fenêtre (ou l'enregistrer en PDF)" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
              <Printer className="h-4 w-4" /><span className="hidden sm:inline">Imprimer</span>
            </button>
            <button onClick={handleExport} title="Exporter le détail vers Excel" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">Exporter</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700" title="Fermer"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div ref={contentRef} className="space-y-5 p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
