import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useVehicles } from '../store/VehicleStore';
import { getFuelPrice, fuelPricesFromSettings } from '../utils/fuelPrices';
import {
  MapPin, Navigation, Fuel, Phone, Clock, Route, Car,
  Gauge, AlertTriangle, CheckCircle2, Search, Printer,
  TrendingUp, Activity,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { detectIvoryCoastZoneFromText, getZoneMeta } from '../utils/civZones';
import SearchableSelect from './SearchableSelect';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ── Base de données locale des villes CI ──────────────────────────────────────
const CITIES: Record<string, { lat: number; lon: number; region: string }> = {
  'abidjan':        { lat: 5.3484,  lon: -4.0305, region: 'Lagunes' },
  'plateau':        { lat: 5.3190,  lon: -4.0234, region: 'Lagunes' },
  'cocody':         { lat: 5.3572,  lon: -3.9828, region: 'Lagunes' },
  'yopougon':       { lat: 5.3458,  lon: -4.0852, region: 'Lagunes' },
  'marcory':        { lat: 5.3000,  lon: -3.9833, region: 'Lagunes' },
  'treichville':    { lat: 5.2956,  lon: -4.0117, region: 'Lagunes' },
  'adjamé':         { lat: 5.3644,  lon: -4.0281, region: 'Lagunes' },
  'port-bouet':     { lat: 5.2554,  lon: -3.9295, region: 'Lagunes' },
  'bingerville':    { lat: 5.3555,  lon: -3.8876, region: 'Lagunes' },
  'angré':          { lat: 5.3939,  lon: -3.9760, region: 'Lagunes' },
  'yamoussoukro':   { lat: 6.8276,  lon: -5.2893, region: 'Lacs' },
  'bouaké':         { lat: 7.6939,  lon: -5.0307, region: 'Vallée du Bandama' },
  'korhogo':        { lat: 9.4580,  lon: -5.6295, region: 'Savanes' },
  'san-pédro':      { lat: 4.7485,  lon: -6.6363, region: 'Bas-Sassandra' },
  'daloa':          { lat: 6.8774,  lon: -6.4502, region: 'Haut-Sassandra' },
  'man':            { lat: 7.4125,  lon: -7.5537, region: 'Montagnes' },
  'gagnoa':         { lat: 6.1319,  lon: -5.9500, region: 'Fromager' },
  'abengourou':     { lat: 6.7297,  lon: -3.4956, region: 'Zanzan' },
  'divo':           { lat: 5.8372,  lon: -5.3572, region: 'Lacs' },
  'bondoukou':      { lat: 8.0403,  lon: -2.7997, region: 'Zanzan' },
  'odienné':        { lat: 9.5054,  lon: -7.5645, region: 'Denguélé' },
  'ferkessédougou': { lat: 9.5928,  lon: -5.1962, region: 'Savanes' },
  'katiola':        { lat: 8.1328,  lon: -5.0941, region: 'Vallée du Bandama' },
  'touba':          { lat: 8.2784,  lon: -7.6852, region: 'Denguélé' },
  'séguéla':        { lat: 7.9558,  lon: -6.6713, region: 'Worodougou' },
  'bouaflé':        { lat: 6.9908,  lon: -5.7394, region: 'Marahoué' },
  'issia':          { lat: 6.4819,  lon: -6.5832, region: 'Haut-Sassandra' },
  'soubré':         { lat: 5.7836,  lon: -6.5921, region: 'Bas-Sassandra' },
  'duekoué':        { lat: 6.7397,  lon: -7.3491, region: 'Montagnes' },
  'grand-bassam':   { lat: 5.2007,  lon: -3.7397, region: 'Lagunes' },
  'assinie':        { lat: 5.1463,  lon: -3.4622, region: 'Lagunes' },
  'agboville':      { lat: 5.9282,  lon: -4.2148, region: 'Agnéby' },
  'adzopé':         { lat: 6.1119,  lon: -3.8628, region: 'Lagunes' },
  'tiassalé':       { lat: 5.8980,  lon: -4.8232, region: 'Lacs' },
  'dimbokro':       { lat: 6.6486,  lon: -4.7024, region: 'Lacs' },
};

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findCity(text: string): { name: string; lat: number; lon: number; region: string } | null {
  const t = normalize(text);
  for (const [key, val] of Object.entries(CITIES)) {
    const k = normalize(key);
    if (t.includes(k)) return { name: key.charAt(0).toUpperCase() + key.slice(1), ...val };
  }
  return null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Génère un tracé intermédiaire réaliste (courbe légère entre deux points)
function buildPolyline(lat1: number, lon1: number, lat2: number, lon2: number): [number, number][] {
  const pts: [number, number][] = [];
  const steps = 20;
  // Légère déviation pour simuler une route
  const midLat = (lat1 + lat2) / 2 + (Math.random() - 0.5) * 0.3;
  const midLon = (lon1 + lon2) / 2 + (Math.random() - 0.5) * 0.3;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Courbe de Bézier quadratique
    const lat = (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * midLat + t ** 2 * lat2;
    const lon = (1 - t) ** 2 * lon1 + 2 * (1 - t) * t * midLon + t ** 2 * lon2;
    pts.push([lat, lon]);
  }
  return pts;
}

function generateSteps(from: string, to: string, dist: number) {
  const steps = [];
  const ratio = dist / 4;
  steps.push({ instruction: `Quitter ${from} direction Nord`, distance: ratio * 0.3 });
  steps.push({ instruction: 'Prendre la voie principale', distance: ratio * 0.5 });
  if (dist > 100) steps.push({ instruction: 'Continuer sur la route nationale', distance: ratio * 1.2 });
  steps.push({ instruction: `Entrer dans ${to}`, distance: ratio * 0.6 });
  steps.push({ instruction: `Arriver à destination — ${to}`, distance: ratio * 0.4 });
  return steps;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
function formatDistance(km: number) {
  return `${km.toFixed(0)} km`;
}
function formatMoney(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA';
}

interface RouteResult {
  distKm: number;
  durationMin: number;
  geometry: [number, number][];
  steps: { instruction: string; distance: number }[];
  originCoord: [number, number];
  destCoord: [number, number];
  originName: string;
  destName: string;
}

// Historique GPS simulé autour d'Abidjan
const MOCK_HISTORY = [
  { address: 'Abidjan, Cocody — Cité des Arts',       lat: 5.3630, lon: -3.9870 },
  { address: 'Abidjan, Angré — Carrefour Palmeraie',  lat: 5.3940, lon: -3.9760 },
  { address: 'Abidjan, Bingerville — Route Nationale',lat: 5.3970, lon: -3.8980 },
  { address: 'Grand-Bassam — Centre-ville',            lat: 5.2010, lon: -3.7400 },
];

// ── Champ de saisie avec suggestions de villes/quartiers (autocomplétion locale) ──────────
function CityAutocompleteInput({
  value, onChange, placeholder, accentColor = 'emerald',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  accentColor?: 'emerald' | 'blue';
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = normalize(value.trim());
    if (!q) return [];
    return Object.keys(CITIES)
      .filter(key => normalize(key).includes(q))
      .sort((a, b) => {
        const aStarts = normalize(a).startsWith(q) ? 0 : 1;
        const bStarts = normalize(b).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 8);
  }, [value]);

  useEffect(() => {
    if (highlighted >= suggestions.length) setHighlighted(0);
  }, [suggestions, highlighted]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectCity(key: string) {
    onChange(key.charAt(0).toUpperCase() + key.slice(1));
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); selectCity(suggestions[highlighted]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const ring = accentColor === 'blue'
    ? 'focus:border-blue-500 focus:ring-blue-500'
    : 'focus:border-emerald-500 focus:ring-emerald-500';
  const activeBg = accentColor === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700';

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 ${ring}`}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.map((key, i) => (
            <li
              key={key}
              onMouseDown={e => { e.preventDefault(); selectCity(key); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === highlighted ? activeBg : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
              <span className="capitalize">{key}</span>
              <span className="ml-auto text-[11px] text-slate-400">{CITIES[key].region}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GeolocTrajets() {
  const { vehicles, appSettings } = useVehicles();
  const fuelPrices = fuelPricesFromSettings(appSettings);
  const [activeTab, setActiveTab] = useState<'itineraire' | 'suivi'>('itineraire');

  // Itinéraire
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');

  // Suivi GPS
  const [trackVehicleId, setTrackVehicleId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackHistory, setTrackHistory] = useState<Array<{ address: string; lat: number; lon: number; date: string }>>([]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const trackVehicle    = vehicles.find(v => v.id === trackVehicleId);

  const originZone      = useMemo(() => detectIvoryCoastZoneFromText(origin), [origin]);
  const destinationZone = useMemo(() => detectIvoryCoastZoneFromText(destination), [destination]);

  // ── Calcul 100% local, instantané ──────────────────────────────────────────
  const handleCalculateRoute = useCallback(() => {
    setError('');
    setRouteResult(null);

    if (!origin || !destination || !selectedVehicleId) {
      setError('Veuillez sélectionner un véhicule, un départ et une destination.');
      return;
    }

    const o = findCity(origin);
    const d = findCity(destination);

    if (!o) { setError(`Ville de départ introuvable. Essayez : Abidjan, Yamoussoukro, Bouaké, Korhogo, San-Pédro…`); return; }
    if (!d) { setError(`Ville de destination introuvable. Essayez : Abidjan, Yamoussoukro, Bouaké, Korhogo, San-Pédro…`); return; }
    if (o.name === d.name) { setError('Le départ et la destination sont identiques.'); return; }

    const distKm    = Math.round(haversine(o.lat, o.lon, d.lat, d.lon) * 1.28); // facteur route +28%
    const durationMin = distKm / 70 * 60; // vitesse moyenne 70 km/h
    const geometry  = buildPolyline(o.lat, o.lon, d.lat, d.lon);
    const steps     = generateSteps(o.name, d.name, distKm);

    setRouteResult({
      distKm,
      durationMin,
      geometry,
      steps,
      originCoord: [o.lat, o.lon],
      destCoord:   [d.lat, d.lon],
      originName:  o.name,
      destName:    d.name,
    });
  }, [origin, destination, selectedVehicleId]);

  const fuelConsumption = useMemo(() => {
    if (!routeResult || !selectedVehicle?.consommation_100km) return null;
    const liters = routeResult.distKm * (selectedVehicle.consommation_100km / 100);
    return { liters: Math.round(liters * 10) / 10, cost: Math.round(liters * getFuelPrice(selectedVehicle.energie, fuelPrices)) };
  }, [routeResult, selectedVehicle, fuelPrices]);

  const routeMapCenter: [number, number] = useMemo(() =>
    routeResult ? [
      (routeResult.originCoord[0] + routeResult.destCoord[0]) / 2,
      (routeResult.originCoord[1] + routeResult.destCoord[1]) / 2,
    ] : [6.5, -5.5],
  [routeResult]);

  const routeZoom = useMemo(() => {
    if (!routeResult) return 7;
    if (routeResult.distKm < 50)  return 11;
    if (routeResult.distKm < 150) return 9;
    if (routeResult.distKm < 350) return 8;
    return 7;
  }, [routeResult]);

  // Suivi GPS : chargement instantané depuis données simulées
  const handleTrack = useCallback(() => {
    if (!trackVehicleId) return;
    const now = Date.now();
    setTrackHistory(MOCK_HISTORY.map((h, i) => ({
      ...h,
      date: new Date(now - (MOCK_HISTORY.length - i) * 3600 * 1000).toISOString(),
    })));
    setTracking(true);
  }, [trackVehicleId]);

  const trackMapCenter: [number, number] = useMemo(() =>
    trackHistory.length > 0
      ? [trackHistory[trackHistory.length - 1].lat, trackHistory[trackHistory.length - 1].lon]
      : [5.3484, -4.0305],
  [trackHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Géolocalisation & Trajets</h2>
          <p className="mt-1 text-sm text-slate-500">Calcul d'itinéraires CI, estimation carburant et suivi de position.</p>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
          <Printer className="h-4 w-4" /> Imprimer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {[
          { id: 'itineraire' as const, label: 'Itinéraire & Consommation', icon: Route },
          { id: 'suivi'      as const, label: 'Suivi GPS',                 icon: MapPin },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ── ITINÉRAIRE ── */}
      {activeTab === 'itineraire' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Formulaire */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Navigation className="h-5 w-5 text-emerald-600" />Calcul d'itinéraire
            </h3>

            {/* Villes suggérées */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              <p className="font-semibold text-slate-700 mb-1">Villes et quartiers disponibles (CI)</p>
              <p className="leading-relaxed">Commencez à taper dans les champs ci-dessous : des suggestions apparaissent automatiquement (Abidjan et ses quartiers, Yamoussoukro, Bouaké, Korhogo, San-Pédro, Daloa, Man, Gagnoa…).</p>
            </div>

            <label className="block text-xs font-medium text-slate-600">
              Véhicule
              <SearchableSelect value={selectedVehicleId} onChange={setSelectedVehicleId} emptyLabel="Aucun véhicule" placeholder="Sélectionner…" options={vehicles.map(v => ({ value: v.id, label: `${v.numero_immatriculation} — ${v.marque}` }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>

            {selectedVehicle && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <p className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5 text-amber-500" />Consommation : <strong>{selectedVehicle.consommation_100km ?? '—'} L/100km</strong></p>
                <p className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-blue-500" />Kilométrage : <strong>{selectedVehicle.kilometrage.toLocaleString()} km</strong></p>
              </div>
            )}

            <label className="block text-xs font-medium text-slate-600">
              Point de départ
              <CityAutocompleteInput value={origin} onChange={setOrigin} placeholder="Ex: Abidjan, Cocody" accentColor="emerald" />
            </label>
            {originZone && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 border border-emerald-100">
                <strong>Zone :</strong> {originZone}{getZoneMeta(originZone) ? ` — ${getZoneMeta(originZone)?.villes_cles.join(', ')}` : ''}
              </div>
            )}

            <label className="block text-xs font-medium text-slate-600">
              Destination
              <CityAutocompleteInput value={destination} onChange={setDestination} placeholder="Ex: Yamoussoukro" accentColor="blue" />
            </label>
            {destinationZone && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 border border-blue-100">
                <strong>Zone :</strong> {destinationZone}{getZoneMeta(destinationZone) ? ` — ${getZoneMeta(destinationZone)?.villes_cles.join(', ')}` : ''}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-100">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            <button onClick={handleCalculateRoute}
              disabled={!origin || !destination || !selectedVehicleId}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Navigation className="h-4 w-4" />Calculer l'itinéraire
            </button>
          </div>

          {/* Résultats */}
          <div className="space-y-4 lg:col-span-2">
            {routeResult ? (
              <>
                {/* KPI */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'Distance',       value: formatDistance(routeResult.distKm),        icon: TrendingUp,  color: 'text-slate-900' },
                    { label: 'Durée estimée',  value: formatDuration(routeResult.durationMin),   icon: Clock,       color: 'text-slate-900' },
                    { label: 'Carburant',      value: fuelConsumption ? `${fuelConsumption.liters} L` : '—', icon: Fuel, color: 'text-amber-600' },
                    { label: 'Coût estimé',    value: fuelConsumption ? formatMoney(fuelConsumption.cost) : '—', icon: Activity, color: 'text-emerald-600' },
                  ].map(k => {
                    const Icon = k.icon;
                    return (
                      <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1"><Icon className="h-3.5 w-3.5 text-slate-400" /><p className="text-xs text-slate-500">{k.label}</p></div>
                        <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Carte */}
                <div className="h-80 w-full rounded-xl border border-slate-200 overflow-hidden shadow-sm" style={{ zIndex: 0 }}>
                  <MapContainer key={`${routeResult.originName}-${routeResult.destName}`}
                    center={routeMapCenter} zoom={routeZoom}
                    style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={routeResult.originCoord}><Popup>🟢 Départ : {routeResult.originName}</Popup></Marker>
                    <Marker position={routeResult.destCoord}><Popup>🔴 Arrivée : {routeResult.destName}</Popup></Marker>
                    <Polyline positions={routeResult.geometry} color="#10b981" weight={5} opacity={0.85} />
                  </MapContainer>
                </div>

                {/* Étapes */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold text-slate-800">Étapes du trajet</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {routeResult.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{i + 1}</div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{step.instruction}</p>
                          <p className="text-xs text-slate-500">{Math.round(step.distance)} km</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(routeResult.originName + ', Côte d\'Ivoire')}&destination=${encodeURIComponent(routeResult.destName + ', Côte d\'Ivoire')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <MapPin className="h-4 w-4" />Ouvrir dans Google Maps
                  </a>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-16 text-slate-400">
                <Route className="h-14 w-14 mb-3" />
                <p className="text-sm">Sélectionnez un véhicule, saisissez un départ et une destination</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUIVI GPS ── */}
      {activeTab === 'suivi' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <MapPin className="h-5 w-5 text-emerald-600" />Suivi GPS
            </h3>

            <label className="block text-xs font-medium text-slate-600">
              Véhicule à suivre
              <select value={trackVehicleId} onChange={e => { setTrackVehicleId(e.target.value); setTracking(false); setTrackHistory([]); }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option value="">Sélectionner…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.numero_immatriculation} — {v.marque}</option>)}
              </select>
            </label>

            {trackVehicle && (
              <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100"><Car className="h-5 w-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{trackVehicle.numero_immatriculation}</p>
                    <p className="text-xs text-slate-500">{trackVehicle.marque} {trackVehicle.type_commercial}</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-blue-500" /><strong>Tél. GPS :</strong> {trackVehicle.telephone_gps || 'Non renseigné'}</p>
                  <p className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-amber-500" /><strong>Km :</strong> {trackVehicle.kilometrage.toLocaleString()} km</p>
                  <p className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      trackVehicle.statut === 'Actif' ? 'bg-green-100 text-green-700' :
                      trackVehicle.statut === 'En maintenance' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'}`}>
                      {trackVehicle.statut}
                    </span>
                  </p>
                </div>
                <button onClick={handleTrack} disabled={tracking}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {tracking ? <CheckCircle2 className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  {tracking ? 'Suivi actif' : 'Lancer le suivi'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:col-span-2">
            {tracking && trackVehicle ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">Position actuelle</h3>
                  <div className="h-72 w-full rounded-xl border border-slate-200 overflow-hidden mb-4" style={{ zIndex: 0 }}>
                    <MapContainer key="track-map" center={trackMapCenter} zoom={12}
                      style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {trackHistory.map((h, i) => (
                        <Marker key={i} position={[h.lat, h.lon]}>
                          <Popup>{h.address}<br /><span className="text-xs text-slate-500">{new Date(h.date).toLocaleTimeString('fr-FR')}</span></Popup>
                        </Marker>
                      ))}
                      {trackHistory.length > 1 && (
                        <Polyline positions={trackHistory.map(h => [h.lat, h.lon] as [number, number])} color="#f59e0b" weight={4} dashArray="8,4" />
                      )}
                    </MapContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-600">Latitude</p><p className="font-bold text-emerald-800">{trackMapCenter[0].toFixed(4)}° N</p></div>
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-600">Longitude</p><p className="font-bold text-emerald-800">{Math.abs(trackMapCenter[1]).toFixed(4)}° W</p></div>
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-600">Mise à jour</p><p className="font-bold text-emerald-800">À l'instant</p></div>
                  </div>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    <MapPin className="mr-1 inline h-4 w-4 text-red-500" />
                    <strong>Dernière adresse :</strong> {trackHistory[trackHistory.length - 1]?.address}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 text-base font-semibold text-slate-800">Historique des positions</h3>
                  <div className="space-y-2">
                    {trackHistory.slice().reverse().map((pos, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{pos.address}</p>
                          <p className="text-xs text-slate-500">{new Date(pos.date).toLocaleString('fr-FR')} — {pos.lat.toFixed(4)}°, {pos.lon.toFixed(4)}°</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-16 text-slate-400">
                <MapPin className="h-14 w-14 mb-3" />
                <p className="text-sm">Sélectionnez un véhicule et lancez le suivi</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
