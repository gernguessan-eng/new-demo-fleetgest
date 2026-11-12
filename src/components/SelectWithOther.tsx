import { useState, useEffect } from 'react';
import SuggestInput from './SuggestInput';

interface SelectWithOtherProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** Libellé du choix qui déclenche la saisie manuelle (par défaut "Autre"). */
  otherLabel?: string;
  /** Texte indicatif affiché dans le champ de saisie manuelle. */
  otherPlaceholder?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Valeurs déjà saisies ailleurs, reproposées pendant la frappe dans la case de saisie manuelle. */
  suggestions?: string[];
  required?: boolean;
  id?: string;
  name?: string;
}

/**
 * Liste déroulante générique dont l'option "Autre" (ou équivalent) fait apparaître un champ
 * de saisie libre juste en dessous, permettant une saisie manuelle. Utilisé dans toute
 * l'application pour que le choix "Autre" ne soit jamais une impasse.
 *
 * - Si la valeur courante ne correspond à aucune option connue (ex : une valeur personnalisée
 *   déjà enregistrée), le composant bascule automatiquement en mode saisie manuelle.
 * - La valeur transmise à `onChange` est toujours la valeur réelle (jamais le mot "Autre").
 */
export default function SelectWithOther({
  value,
  onChange,
  options,
  otherLabel = 'Autre',
  otherPlaceholder = 'Préciser…',
  placeholder = 'Sélectionner…',
  className = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
  inputClassName,
  suggestions = [],
  required,
  id,
  name,
}: SelectWithOtherProps) {
  const isKnownValue = value === '' || options.includes(value);
  const [manualMode, setManualMode] = useState(!isKnownValue);

  // Si la valeur passe à une option connue (reset du formulaire, sélection d'un autre
  // enregistrement…) on repasse automatiquement en mode liste.
  useEffect(() => {
    if (options.includes(value)) setManualMode(false);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === otherLabel) {
      setManualMode(true);
      onChange('');
    } else {
      setManualMode(false);
      onChange(next);
    }
  };

  return (
    <div className="space-y-1.5">
      <select
        id={id}
        name={name}
        required={required && !manualMode}
        value={manualMode ? otherLabel : value}
        onChange={handleSelectChange}
        className={className}
      >
        {!manualMode && value === '' && (
          <option value="" disabled={required}>{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        {!options.includes(otherLabel) && <option value={otherLabel}>{otherLabel}</option>}
      </select>
      {manualMode && (
        <SuggestInput
          suggestions={suggestions}
          type="text"
          required={required}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          className={inputClassName || className}
        />
      )}
    </div>
  );
}
