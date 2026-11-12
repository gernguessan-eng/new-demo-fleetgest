import * as XLSX from 'xlsx';

/**
 * Export Excel du contenu d'une boîte de dialogue, lu directement dans son affichage :
 *  - onglet « Synthèse » : titre, sous-titre, date d'édition, chiffres clés ([data-xl-stats]) et
 *    remarques (paragraphes directs du contenu) ;
 *  - un onglet par tableau <table>, par bloc [data-xl-table] (lignes [data-xl-row], cellules
 *    [data-xl-cell]) et par liste [data-xl-list] (une ligne par élément) ;
 *  - un montant marqué data-xl="<valeur>" est exporté avec sa valeur exacte (et non son
 *    affichage abrégé « 1.2 M FCFA »).
 * Les colonnes sans titre (boutons « Fiche ») sont ignorées.
 */

type Cell = string | number | { v: number; z: string };
const MONEY_FMT = '#,##0 "FCFA"';

const BLOCK = new Set(['P', 'DIV', 'BR', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'TABLE']);
const norm = (s: string) => s.replace(/[\s  ]+/g, ' ').trim();
const fmtNum = (n: number) => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');

/** Texte « 125 000 » ou « 42 » → nombre ; tout le reste (téléphones, n° de dossier, dates…) reste du texte. */
function toValue(text: string): Cell {
  if (/^-?\d{1,9}$/.test(text) && (text === '0' || !/^-?0/.test(text))) return Number(text);
  if (/^\d{1,3}( \d{3})+$/.test(text)) return Number(text.replace(/ /g, ''));
  return text;
}

/** Lit une cellule : montant exact si elle ne contient que lui, sinon texte (blocs séparés par « | »). */
export function readCell(el: Element): Cell {
  const amtEl = el.hasAttribute('data-xl') ? el : el.querySelector('[data-xl]');
  if (amtEl) {
    const n = Number(amtEl.getAttribute('data-xl'));
    if (Number.isFinite(n) && norm(amtEl.textContent ?? '') === norm(el.textContent ?? '')) return { v: n, z: MONEY_FMT };
  }
  const parts: string[] = [];
  let buf = '';
  const flush = () => { const t = norm(buf); if (t) parts.push(t); buf = ''; };
  const walk = (n: Node) => {
    if (n.nodeType === 3) { buf += n.textContent ?? ''; return; }
    if (n.nodeType !== 1) return;
    const e = n as Element;
    if (e.hasAttribute('data-xl')) {
      const num = Number(e.getAttribute('data-xl'));
      if (Number.isFinite(num)) { buf += `${fmtNum(num)} FCFA`; return; }
    }
    const block = BLOCK.has(e.tagName);
    if (block) flush();
    e.childNodes.forEach(walk);
    if (block) flush();
  };
  el.childNodes.forEach(walk);
  flush();
  return toValue(parts.join(' | '));
}

const text = (el: Element) => { const c = readCell(el); return typeof c === 'object' ? fmtNum(c.v) + ' FCFA' : String(c); };

function toSheet(rows: Cell[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => (typeof c === 'object' ? c.v : c))));
  rows.forEach((r, ri) => r.forEach((c, ci) => {
    if (typeof c === 'object') { const ref = XLSX.utils.encode_cell({ r: ri, c: ci }); if (ws[ref]) ws[ref].z = c.z; }
  }));
  const width: number[] = [];
  rows.forEach((r) => r.forEach((c, i) => {
    const len = typeof c === 'object' ? fmtNum(c.v).length + 6 : String(c).length;
    width[i] = Math.max(width[i] || 8, Math.min(60, len + 2));
  }));
  ws['!cols'] = width.map((wch) => ({ wch }));
  return ws;
}

/** Intitulé de la section qui précède l'élément (h4…), pour nommer l'onglet. */
function nearestHeading(el: Element, root: Element): string {
  let node: Element | null = el;
  while (node && node !== root) {
    let sib = node.previousElementSibling;
    while (sib) {
      const named = sib.matches('[data-xl-name]') ? sib : sib.querySelector('[data-xl-name]');
      if (named) return norm(named.getAttribute('data-xl-name') || '');
      if (/^H[1-6]$/.test(sib.tagName)) return norm(sib.textContent ?? '');
      const h = sib.querySelector('h1,h2,h3,h4,h5,h6');
      if (h && !sib.querySelector('table')) return norm(h.textContent ?? '');
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return '';
}

function cleanName(raw: string): string {
  return raw.replace(/\s*\(\d+\)\s*/g, ' ').replace(/\s+[—–-]\s+.*$/, '').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildModalWorkbook(root: Element, title: string, subtitle?: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const addSheet = (wanted: string, ws: XLSX.WorkSheet) => {
    let base = cleanName(wanted).slice(0, 31) || 'Détail';
    let name = base; let i = 2;
    while (used.has(name.toLowerCase())) { const suf = ` (${i++})`; name = base.slice(0, 31 - suf.length) + suf; }
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // ── Synthèse
  const summary: Cell[][] = [[title]];
  if (subtitle) summary.push([subtitle]);
  summary.push(['Édité le', new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })], []);
  const stats = Array.from(root.querySelectorAll('[data-xl-stats]'));
  if (stats.length) {
    summary.push(['Indicateur', 'Valeur']);
    stats.forEach((blk) => blk.querySelectorAll('[data-xl-item]').forEach((it) => {
      const l = it.querySelector('[data-xl-l]'); const v = it.querySelector('[data-xl-v]');
      if (l && v) summary.push([text(l), readCell(v)]);
    }));
    summary.push([]);
  }
  const notes = Array.from(root.children).filter((c) => c.tagName === 'P').map((p) => norm(p.textContent ?? '')).filter(Boolean);
  if (notes.length) { summary.push(['Remarques']); notes.forEach((n) => summary.push([n])); }
  addSheet('Synthèse', toSheet(summary));

  // ── Tableaux et listes, dans l'ordre d'affichage
  const blocks = Array.from(root.querySelectorAll('table, [data-xl-table], [data-xl-list]'));
  const unnamed = blocks.filter((b) => !nearestHeading(b, root) && !b.getAttribute('data-xl-table') && !b.getAttribute('data-xl-list')).length;
  let unnamedIdx = 0;
  blocks.forEach((b) => {
    const rows: Cell[][] = [];
    let name = b.getAttribute('data-xl-table') || b.getAttribute('data-xl-list') || nearestHeading(b, root);
    if (!name) name = unnamed > 1 ? `Détail ${++unnamedIdx}` : 'Détail';

    if (b.tagName === 'TABLE') {
      const t = b as HTMLTableElement;
      const head = t.tHead?.rows[0] ? Array.from(t.tHead.rows[0].cells).map((c) => norm(c.textContent ?? '')) : [];
      const keep = head.length ? head.map((h) => h !== '') : null;
      const pushRow = (tr: HTMLTableRowElement) => {
        const row: Cell[] = [];
        Array.from(tr.cells).forEach((c) => { row.push(readCell(c)); for (let k = 1; k < c.colSpan; k++) row.push(''); });
        rows.push(keep ? row.filter((_, i) => keep[i] !== false) : row);
      };
      if (head.length) rows.push(head.filter((h) => h !== ''));
      Array.from(t.tBodies).forEach((tb) => Array.from(tb.rows).forEach(pushRow));
      if (t.tFoot) Array.from(t.tFoot.rows).forEach(pushRow);
    } else if (b.hasAttribute('data-xl-table')) {
      const cols = (b.getAttribute('data-xl-cols') || '').split('|').filter(Boolean);
      if (cols.length) rows.push(cols);
      b.querySelectorAll('[data-xl-row]').forEach((r) => rows.push(Array.from(r.querySelectorAll('[data-xl-cell]')).map(readCell)));
    } else {
      const cols = (b.getAttribute('data-xl-cols') || '').split('|').filter(Boolean);
      if (cols.length) rows.push(cols);
      Array.from(b.children).forEach((item) => rows.push(text(item).split(' · ')));
    }
    if (rows.length) addSheet(name, toSheet(rows));
  });
  return wb;
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'detail';
}

export function exportModalToExcel(root: Element | null, title: string, subtitle?: string): void {
  if (!root) return;
  const wb = buildModalWorkbook(root, title, subtitle);
  XLSX.writeFile(wb, `${slug(title)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
