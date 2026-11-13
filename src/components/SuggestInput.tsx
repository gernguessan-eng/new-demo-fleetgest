import { useId, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** Valeurs déjà saisies ailleurs dans l'appli, proposées pendant la frappe (saisie libre conservée) */
  suggestions: string[];
};

/**
 * Case de saisie libre avec propositions automatiques : dès qu'une valeur a déjà été
 * enregistrée une fois, elle est reproposée à la prochaine saisie.
 */
export default function SuggestInput({ suggestions, ...props }: Props) {
  const id = 'sg-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const has = suggestions.length > 0;
  return (
    <>
      <input {...props} list={has ? id : undefined} autoComplete="off" />
      {has && <datalist id={id}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </>
  );
}
