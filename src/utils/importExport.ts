// ── Utilitaires partagés d'import/export Excel/CSV ──────────────────────────
// Centralise la logique utilisée par tous les modules (Véhicules, Dépenses,
// Carburant, Pneus, Sinistres, Immobilisations, Chauffeurs) pour garantir un
// comportement cohérent et éviter de dupliquer le parsing dans chaque fichier.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/** Lit un fichier .csv, .xls ou .xlsx et retourne ses lignes sous forme d'objets (une entrée par colonne d'en-tête). */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data as Record<string, unknown>[];
  }
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
  }
  throw new Error('Format non supporté. Utilisez un fichier .csv, .xls ou .xlsx.');
}

/** Cherche la valeur d'une ligne importée en essayant plusieurs noms de colonnes possibles (insensible à la casse). */
export function getCell(row: Record<string, unknown>, keys: string[]): string {
  const normalized = Object.entries(row).reduce<Record<string, unknown>>((acc, [k, v]) => {
    acc[k.trim().toLowerCase()] = v;
    return acc;
  }, {});
  for (const key of keys) {
    const v = normalized[key.trim().toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/** Parse un montant saisi sous des formats variés ("1 250 000", "1250000 FCFA", "1250,50"...) en nombre. */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.').replace(/[A-Za-z]/g, '');
  return Number(cleaned) || 0;
}

/** Génère et télécharge un fichier .xlsx à partir de lignes déjà formatées pour l'affichage (clé = en-tête de colonne). */
export function exportRowsToExcel(rows: Record<string, unknown>[], filename: string, sheetName: string): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
