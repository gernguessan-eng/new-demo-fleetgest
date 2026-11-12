/**
 * Impression d'une case (carte) du tableau de bord : on en place une copie dans un conteneur
 * temporaire, puis tout le reste de la page est masqué le temps de l'impression (classe posée
 * sur <body>). Un Ctrl+P ordinaire reste inchangé, la page se réimprime normalement.
 */
const PRINT_CSS = `
.cardprint-portal { display: none; }
@media print {
  body.printing-card > *:not(.cardprint-portal) { display: none !important; }
  body.printing-card .cardprint-portal { display: block !important; }
  .cardprint-portal * { max-height: none !important; }
  .cardprint-portal .overflow-auto, .cardprint-portal .overflow-x-auto, .cardprint-portal .overflow-y-auto { overflow: visible !important; }
  .cardprint-portal .sticky { position: static !important; }
  .cardprint-portal > div { box-shadow: none !important; border: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cardprint-portal tr { break-inside: avoid; }
  .cardprint-portal thead { display: table-header-group; }
}
`;

let cleanupCurrent: (() => void) | null = null;

export function printCard(card: HTMLElement, origin = 'Tableau de bord'): void {
  cleanupCurrent?.();

  const copy = card.cloneNode(true) as HTMLElement;
  copy.classList.remove('print:hidden');          // la case peut être masquée à l'impression de la page entière
  copy.querySelectorAll('.kpi-no-print').forEach((n) => n.remove());

  const stamp = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  const header = document.createElement('p');
  header.style.cssText = 'margin:0 0 6px;font-size:11px;color:#64748b';
  header.textContent = `Parc Auto — Gestion de Flotte · ${origin} · Édité le ${stamp}`;

  const portal = document.createElement('div');
  portal.className = 'cardprint-portal';
  portal.append(header, copy);

  const style = document.createElement('style');
  style.textContent = `${PRINT_CSS}\n@media print { @page { size: A4 portrait; margin: 10mm; } }`;

  document.head.appendChild(style);
  document.body.appendChild(portal);
  document.body.classList.add('printing-card');

  let timer = 0;
  const cleanup = () => {
    document.body.classList.remove('printing-card');
    portal.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
    window.clearTimeout(timer);
    cleanupCurrent = null;
  };
  cleanupCurrent = cleanup;
  window.addEventListener('afterprint', cleanup);
  timer = window.setTimeout(cleanup, 60000); // sécurité si « afterprint » n'est pas émis
  window.print();
}
