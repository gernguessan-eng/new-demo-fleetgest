/**
 * Valeurs distinctes d'une liste de saisies, pour les reproposer dans les formulaires.
 * - espaces retirés, doublons ignorés sans tenir compte de la casse (1ère graphie conservée) ;
 * - triées par ordre alphabétique (sort: false pour garder l'ordre fourni) ;
 * - exclude : valeurs à écarter (ex. « Autre »).
 */
export function uniqueValues(
  values: (string | null | undefined)[],
  opts: { sort?: boolean; exclude?: string[] } = {},
): string[] {
  const exclude = new Set((opts.exclude || []).map((x) => x.trim().toLowerCase()));
  const seen = new Map<string, string>();
  for (const v of values) {
    const t = (v ?? '').toString().trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (exclude.has(k) || seen.has(k)) continue;
    seen.set(k, t);
  }
  const out = Array.from(seen.values());
  return opts.sort === false ? out : out.sort((a, b) => a.localeCompare(b, 'fr'));
}
