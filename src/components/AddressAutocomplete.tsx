/**
 * AddressAutocomplete — 100% LOCAL, aucun appel réseau.
 * Suggestions basées sur une base de villes ivoiriennes intégrée.
 */
import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';

// Base locale des principales villes et lieux de Côte d'Ivoire
const CI_PLACES = [
  // Abidjan & communes
  { name: 'Abidjan', lat: 5.3484, lon: -4.0305 },
  { name: 'Abidjan, Plateau', lat: 5.3200, lon: -4.0167 },
  { name: 'Abidjan, Cocody', lat: 5.3566, lon: -3.9779 },
  { name: 'Abidjan, Yopougon', lat: 5.3541, lon: -4.0822 },
  { name: 'Abidjan, Abobo', lat: 5.4178, lon: -4.0078 },
  { name: 'Abidjan, Adjamé', lat: 5.3664, lon: -4.0235 },
  { name: 'Abidjan, Marcory', lat: 5.3033, lon: -3.9995 },
  { name: 'Abidjan, Treichville', lat: 5.2985, lon: -4.0019 },
  { name: 'Abidjan, Koumassi', lat: 5.3006, lon: -3.9761 },
  { name: 'Abidjan, Port-Bouët', lat: 5.2616, lon: -3.9295 },
  { name: 'Abidjan, Angré', lat: 5.3797, lon: -3.9697 },
  { name: 'Abidjan, Bingerville', lat: 5.3571, lon: -3.8862 },
  { name: 'Abidjan, Songon', lat: 5.3974, lon: -4.2011 },
  { name: 'Abidjan, Grand-Bassam', lat: 5.2003, lon: -3.7369 },
  { name: 'Abidjan, Anyama', lat: 5.4897, lon: -4.0516 },
  { name: 'Abidjan, Braffedon', lat: 5.3200, lon: -4.0500 },
  { name: 'Abidjan, Zone Industrielle de Vridi', lat: 5.2634, lon: -3.9706 },
  // Grandes villes
  { name: 'Yamoussoukro', lat: 6.8276, lon: -5.2893 },
  { name: 'Bouaké', lat: 7.6906, lon: -5.0301 },
  { name: 'Daloa', lat: 6.8779, lon: -6.4502 },
  { name: 'San-Pédro', lat: 4.7490, lon: -6.6362 },
  { name: 'Korhogo', lat: 9.4580, lon: -5.6290 },
  { name: 'Man', lat: 7.4125, lon: -7.5540 },
  { name: 'Divo', lat: 5.8367, lon: -5.3569 },
  { name: 'Gagnoa', lat: 6.1321, lon: -5.9504 },
  { name: 'Abengourou', lat: 6.7298, lon: -3.4966 },
  { name: 'Soubré', lat: 5.7851, lon: -6.5995 },
  { name: 'Bondoukou', lat: 8.0399, lon: -2.8008 },
  { name: 'Séguéla', lat: 7.9621, lon: -6.6729 },
  { name: 'Odienné', lat: 9.5062, lon: -7.5645 },
  { name: 'Ferkessédougou', lat: 9.5924, lon: -5.1977 },
  { name: 'Touba', lat: 8.2833, lon: -7.6833 },
  { name: 'Katiola', lat: 8.1333, lon: -5.1000 },
  { name: 'Duekoué', lat: 6.7420, lon: -7.3494 },
  { name: 'Guiglo', lat: 6.5399, lon: -7.4923 },
  { name: 'Sassandra', lat: 4.9539, lon: -6.0874 },
  { name: 'Tabou', lat: 4.4231, lon: -7.3544 },
  { name: 'Grand-Lahou', lat: 5.1397, lon: -5.0221 },
  { name: 'Jacqueville', lat: 5.2065, lon: -4.4133 },
  { name: 'Tiassalé', lat: 5.8987, lon: -4.8250 },
  { name: 'Agboville', lat: 5.9210, lon: -4.2155 },
  { name: 'Adzopé', lat: 6.1003, lon: -3.8682 },
  { name: 'Dimbokro', lat: 6.6492, lon: -4.7053 },
  { name: 'Bongouanou', lat: 6.6497, lon: -4.2041 },
  { name: 'Toumodi', lat: 6.5500, lon: -5.0167 },
  { name: 'Issia', lat: 6.4839, lon: -6.5804 },
  { name: 'Lakota', lat: 5.8473, lon: -5.6957 },
  { name: 'Bangolo', lat: 7.0124, lon: -7.4875 },
  { name: 'Tengréla', lat: 10.4833, lon: -6.4000 },
  { name: 'Boundiali', lat: 9.5233, lon: -6.4880 },
  { name: 'Mankono', lat: 8.0572, lon: -6.1857 },
  { name: 'Zuénoula', lat: 7.4319, lon: -6.0480 },
  { name: 'Oumé', lat: 6.3826, lon: -5.4137 },
  { name: 'Sikensi', lat: 5.6551, lon: -4.5708 },
  { name: 'Hire', lat: 5.6667, lon: -5.6667 },
];

interface Props {
  value: string;
  onChange: (value: string, coords?: { lat: number; lon: number }) => void;
  placeholder?: string;
  label?: string;
}

export default function AddressAutocomplete({ value, onChange, placeholder, label }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = value.length >= 2
    ? CI_PLACES.filter(p => p.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (p: typeof CI_PLACES[0]) => {
    onChange(p.name, { lat: p.lat, lon: p.lon });
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightedIndex >= 0) { e.preventDefault(); selectSuggestion(suggestions[highlightedIndex]); }
    else if (e.key === 'Escape') setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setShowDropdown(true); setHighlightedIndex(-1); }}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={s.name}
              onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0 ${i === highlightedIndex ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
            >
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
              <span className="text-xs text-slate-700">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Export de la base pour usage dans GeolocTrajets
export { CI_PLACES };
