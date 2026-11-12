import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Texte secondaire (ex. marque et modèle) : affiché en gris dans la liste et pris en compte par la recherche */
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Texte affiché tant qu'aucune valeur n'est choisie */
  placeholder?: string;
  /** Ajoute en tête une entrée « vide » (valeur '') avec ce libellé, ex. « Tous les véhicules », « Aucun » */
  emptyLabel?: string;
  /** Message affiché quand la liste est vide (ex. « Aucun chauffeur disponible ») */
  noOptionsText?: string;
  required?: boolean;
  disabled?: boolean;
  /** Classes du bouton : les mêmes que celles du <select> remplacé */
  className?: string;
  /** La barre de recherche apparaît à partir de ce nombre d'options (défaut : 8) */
  searchThreshold?: number;
  searchPlaceholder?: string;
  'aria-label'?: string;
}

// Recherche sans tenir compte de la casse ni des accents (« eleve » trouve « Élève »)
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/**
 * Remplace un <select> : même apparence, mais la liste comporte une barre de recherche
 * dès qu'elle est longue. Clavier : ↑ ↓ pour naviguer, Entrée pour choisir, Échap pour fermer.
 * La liste s'affiche en surimpression (portail) : elle n'est jamais coupée par une boîte de dialogue.
 */
export default function SearchableSelect({
  value, onChange, options, placeholder, emptyLabel, noOptionsText, required, disabled,
  className = '', searchThreshold = 8, searchPlaceholder = 'Rechercher…', 'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const showSearch = options.length >= searchThreshold;
  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? emptyLabel ?? '';
  // Grisé = invite « Sélectionner… » ; normal = vraie valeur ou entrée « Tous… » d'un filtre
  const muted = !selected && !(value === '' && emptyLabel && !placeholder);

  // Entrées affichées : filtrées par la recherche ; l'entrée « vide » n'apparaît que sans recherche
  const visible = useMemo<SelectOption[]>(() => {
    const q = fold(query.trim());
    if (!q) return emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options;
    return options.filter((o) => fold(`${o.label} ${o.hint ?? ''}`).includes(q));
  }, [options, query, emptyLabel]);

  const computePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const above = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(340, above ? spaceAbove : spaceBelow));
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 220) - 8)),
      width: Math.max(r.width, 220),
      maxHeight,
      ...(above ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  };

  const openPanel = () => {
    if (disabled) return;
    setQuery('');
    const idx = (emptyLabel ? [{ value: '' }, ...options] : options).findIndex((o) => o.value === value);
    setActive(Math.max(0, idx));
    setOpen(true);
  };
  const close = (refocus = false) => { setOpen(false); if (refocus) triggerRef.current?.focus(); };
  const choose = (opt: SelectOption | undefined) => { if (!opt) return; onChange(opt.value); close(true); };

  // Position à l'ouverture, puis à chaque défilement / redimensionnement
  useLayoutEffect(() => { if (open) computePos(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const update = () => computePos();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open]);

  // Fermeture au clic en dehors
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Focus : sur la recherche si elle existe, sinon sur la liste (pour le clavier)
  useEffect(() => {
    if (!open || !pos) return;
    (showSearch ? searchRef.current : panelRef.current)?.focus();
  }, [open, !!pos, showSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garde l'entrée active visible quand on navigue au clavier
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open, visible]);

  const onPanelKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(visible.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); choose(visible[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') { close(); }
  };

  return (
    <span className="relative block">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openPanel(); } }}
        className={`${className} flex items-center justify-between gap-2 bg-white text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`truncate ${muted ? 'text-slate-400' : ''}`}>{display || '\u00A0'}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Champ masqué : conserve le message « Veuillez renseigner ce champ » des formulaires */}
      <input
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value}
        onChange={() => {}}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
      />

      {open && pos && createPortal(
        <div
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={onPanelKey}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          className="z-[100] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl outline-none print:hidden"
        >
          {showSearch && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
              <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className="min-w-0 flex-1 text-sm outline-none placeholder:text-slate-400"
              />
              {query && <span className="flex-shrink-0 text-[10px] text-slate-400">{visible.length} / {options.length}</span>}
            </div>
          )}
          <div ref={listRef} role="listbox" className="overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400">
                {query ? `Aucun résultat pour « ${query} »` : noOptionsText || 'Aucune option disponible'}
              </p>
            ) : visible.map((o, i) => (
              <div
                key={`${o.value}-${i}`}
                role="option"
                aria-selected={o.value === value}
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${i === active ? 'bg-emerald-50' : ''} ${o.value === value ? 'font-semibold text-emerald-700' : 'text-slate-700'}`}
              >
                <span className="min-w-0 truncate">{o.label}{o.hint && <span className="ml-2 text-xs font-normal text-slate-400">{o.hint}</span>}</span>
                {o.value === value && <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
