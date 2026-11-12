import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Lit une valeur de ligne importée en essayant plusieurs noms de colonnes possibles
 * (l'utilisateur peut renommer les en-têtes de son fichier), insensible à la casse/aux
 * espaces.
 */
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

/** Parse un nombre depuis une cellule (accepte virgule décimale, espaces, symboles monétaires). */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.').replace(/[A-Za-z]/g, '');
  return Number(cleaned) || 0;
}

/** Lit un fichier CSV, XLS ou XLSX et retourne ses lignes sous forme d'objets {colonne: valeur}. */
export async function readTabularFile(file: File): Promise<Record<string, unknown>[]> {
  if (file.name.endsWith('.csv')) {
    return Papa.parse(await file.text(), { header: true, skipEmptyLines: true }).data as Record<string, unknown>[];
  }
  if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, unknown>[];
  }
  throw new Error('Format non supporté. Utilisez un fichier CSV, XLS ou XLSX.');
}

/** Génère et télécharge un fichier Excel (.xlsx) à partir d'un tableau d'objets. */
export function exportRowsToExcel(rows: Record<string, unknown>[], filename: string, sheetName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
