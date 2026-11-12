import { MapPin } from 'lucide-react';
import { getZoneMeta } from '../utils/civZones';

// ── Coordonnées GeoJSON officielles de la Côte d'Ivoire ──
const CIV_BORDER: [number, number][] = [
  [-2.856125, 4.994476], [-3.311084, 4.984296], [-4.00882, 5.179813],
  [-4.649917, 5.168264], [-5.834496, 4.993701], [-6.528769, 4.705088],
  [-7.518941, 4.338288], [-7.712159, 4.364566], [-7.635368, 5.188159],
  [-7.539715, 5.313345], [-7.570153, 5.707352], [-7.993693, 6.12619],
  [-8.311348, 6.193033], [-8.60288, 6.467564], [-8.385452, 6.911801],
  [-8.485446, 7.395208], [-8.439298, 7.686043], [-8.280703, 7.68718],
  [-8.221792, 8.123329], [-8.299049, 8.316444], [-8.203499, 8.455453],
  [-7.8321, 8.575704],   [-8.079114, 9.376224], [-8.309616, 9.789532],
  [-8.229337, 10.12902], [-8.029944, 10.206535],[-7.89959, 10.297382],
  [-7.622759, 10.147236],[-6.850507, 10.138994],[-6.666461, 10.430811],
  [-6.493965, 10.411303],[-6.205223, 10.524061],[-6.050452, 10.096361],
  [-5.816926, 10.222555],[-5.404342, 10.370737],[-4.954653, 10.152714],
  [-4.779884, 9.821985], [-4.330247, 9.610835], [-3.980449, 9.862344],
  [-3.511899, 9.900326], [-2.827496, 9.642461], [-2.56219, 8.219628],
  [-2.983585, 7.379705], [-3.24437, 6.250472],  [-2.810701, 5.389051],
  [-2.856125, 4.994476],
];

const LON_MIN = -8.62, LON_MAX = -2.48, LAT_MIN = 4.33, LAT_MAX = 10.74;
const SVG_W = 500, SVG_H = 560, PAD = 28;

function geoToSvg(lon: number, lat: number): [number, number] {
  const x = PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (SVG_W - 2 * PAD);
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - 2 * PAD);
  return [x, y];
}

function buildPath(coords: [number, number][]): string {
  return coords.map((c, i) => {
    const [x, y] = geoToSvg(c[0], c[1]);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

const BORDER_PATH = buildPath(CIV_BORDER);

const CUT_LAT_NORD = 8.35, CUT_LAT_SUD = 6.40, CUT_LON_OUEST = -6.50, CUT_LON_EST = -3.75;
function svgX(lon: number) { return PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (SVG_W - 2 * PAD); }
function svgY(lat: number) { return PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - 2 * PAD); }
const SX_OUEST = svgX(CUT_LON_OUEST), SX_EST = svgX(CUT_LON_EST);
const SY_NORD = svgY(CUT_LAT_NORD), SY_SUD = svgY(CUT_LAT_SUD);

const ZONE_COLOR: Record<string, string> = { Nord: '#10b981', Ouest: '#ef4444', Est: '#f59e0b', Centre: '#8b5cf6', Sud: '#3b82f6' };

// Villes avec offsets personnalisés pour éviter le chevauchement
const CITIES = [
  { name: 'Korhogo',    lon: -5.630, lat: 9.458, bold: false, dx: 5, dy: 3  },
  { name: 'Odienné',    lon: -7.568, lat: 9.508, bold: false, dx: 5, dy: 3  },
  { name: 'Man',        lon: -7.554, lat: 7.413, bold: false, dx: 5, dy: 3  },
  { name: 'Daloa',      lon: -6.450, lat: 6.877, bold: false, dx: -55, dy: 14 },
  { name: 'Yamoussoukro',lon:-5.277, lat: 6.821, bold: true,  dx: -70, dy: -10 },
  { name: 'Bouaké',     lon: -5.030, lat: 7.694, bold: false, dx: -55, dy: 14 },
  { name: 'Abengourou', lon: -3.496, lat: 6.730, bold: false, dx: 5, dy: 3  },
  { name: 'Bondoukou',  lon: -2.800, lat: 8.040, bold: false, dx: 5, dy: -10 },
  { name: 'Abidjan',    lon: -4.002, lat: 5.354, bold: true,  dx: 5, dy: 14 },
  { name: 'San-Pédro',  lon: -6.636, lat: 4.749, bold: false, dx: -60, dy: -10 },
  { name: 'Grand-Bassam',lon:-3.730, lat: 5.203, bold: false, dx: 5, dy: 14 },
];

type ZoneName = 'Nord' | 'Sud' | 'Est' | 'Centre' | 'Ouest';
interface ZoneItem { name: ZoneName; value: number }
interface Props { zoneDistribution: ZoneItem[]; totalVehicles: number; onZoneClick?: (zone: ZoneName) => void }

export default function IvoryCoastZoneMap({ zoneDistribution, totalVehicles, onZoneClick }: Props) {
  // Rend une zone cliquable (carte et légende) quand onZoneClick est fourni
  const clickable = (name: ZoneName) => onZoneClick ? { onClick: () => onZoneClick(name), style: { cursor: 'pointer' } } : {};
  const maxVal = Math.max(...zoneDistribution.map(z => z.value), 1);
  const fillOpacity = (name: ZoneName) => {
    const v = zoneDistribution.find(z => z.name === name)?.value ?? 0;
    return v > 0 ? 0.42 + (v / maxVal) * 0.58 : 0.16;
  };
  const count = (name: ZoneName) => zoneDistribution.find(z => z.name === name)?.value ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <MapPin className="h-5 w-5 text-emerald-500" />
        Cartographie — Côte d'Ivoire · Répartition par zone d'affectation
      </h3>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-shrink-0 w-full lg:w-[420px]">
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full drop-shadow-md" style={{ background: '#dbeafe', borderRadius: 12 }}>
            <defs>
              <clipPath id="civ-border"><path d={BORDER_PATH} /></clipPath>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="#dbeafe" rx="12" />

            <rect x="0" y="0" width={SVG_W} height={SY_NORD} fill={ZONE_COLOR.Nord} fillOpacity={fillOpacity('Nord')} clipPath="url(#civ-border)" {...clickable('Nord')}><title>Nord — cliquer pour le détail</title></rect>
            <rect x="0" y={SY_SUD} width={SVG_W} height={SVG_H} fill={ZONE_COLOR.Sud} fillOpacity={fillOpacity('Sud')} clipPath="url(#civ-border)" {...clickable('Sud')}><title>Sud — cliquer pour le détail</title></rect>
            <rect x="0" y={SY_NORD} width={SX_OUEST} height={SY_SUD - SY_NORD} fill={ZONE_COLOR.Ouest} fillOpacity={fillOpacity('Ouest')} clipPath="url(#civ-border)" {...clickable('Ouest')}><title>Ouest — cliquer pour le détail</title></rect>
            <rect x={SX_EST} y={SY_NORD} width={SVG_W} height={SY_SUD - SY_NORD} fill={ZONE_COLOR.Est} fillOpacity={fillOpacity('Est')} clipPath="url(#civ-border)" {...clickable('Est')}><title>Est — cliquer pour le détail</title></rect>
            <rect x={SX_OUEST} y={SY_NORD} width={SX_EST - SX_OUEST} height={SY_SUD - SY_NORD} fill={ZONE_COLOR.Centre} fillOpacity={fillOpacity('Centre')} clipPath="url(#civ-border)" {...clickable('Centre')}><title>Centre — cliquer pour le détail</title></rect>

            <path d={BORDER_PATH} fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinejoin="round" />

            <g stroke="#0f172a" strokeWidth="1" strokeDasharray="6,4" opacity="0.45" clipPath="url(#civ-border)">
              <line x1="0" y1={SY_NORD} x2={SVG_W} y2={SY_NORD} />
              <line x1="0" y1={SY_SUD}  x2={SVG_W} y2={SY_SUD} />
              <line x1={SX_OUEST} y1={SY_NORD} x2={SX_OUEST} y2={SY_SUD} />
              <line x1={SX_EST}   y1={SY_NORD} x2={SX_EST}   y2={SY_SUD} />
            </g>

            {/* Labels zones — placés stratégiquement pour éviter le chevauchement */}
            <g fontFamily="sans-serif" fontWeight="700" pointerEvents="none">
              <text x={svgX(-5.5)} y={svgY(10.1)} textAnchor="middle" fill="#064e3b" fontSize="13">NORD ({count('Nord')})</text>
              <text x={svgX(-7.8)} y={svgY(7.1)}  textAnchor="middle" fill="#7f1d1d" fontSize="11">OUEST ({count('Ouest')})</text>
              <text x={svgX(-2.9)} y={svgY(8.0)}  textAnchor="middle" fill="#78350f" fontSize="11">EST ({count('Est')})</text>
              <text x={svgX(-5.3)} y={svgY(7.4)}  textAnchor="middle" fill="#3b0764" fontSize="12">CENTRE ({count('Centre')})</text>
              <text x={svgX(-5.0)} y={svgY(5.7)}  textAnchor="middle" fill="#1e3a5f" fontSize="13">SUD ({count('Sud')})</text>
            </g>

            {/* Villes */}
            <g fontFamily="sans-serif" fontSize="9">
              {CITIES.map(({ name, lon, lat, bold, dx, dy }) => {
                const [cx, cy] = geoToSvg(lon, lat);
                return (
                  <g key={name}>
                    <circle cx={cx} cy={cy} r={bold ? 3.5 : 2.5} fill={bold ? '#dc2626' : '#0f172a'} stroke="#fff" strokeWidth="1" />
                    <text x={cx + dx} y={cy + dy} fill="#0f172a" fontWeight={bold ? '700' : '400'}>{name}</text>
                  </g>
                );
              })}
            </g>

            <text x={svgX(-5.5)} y={SVG_H - 8} textAnchor="middle" fontSize="9" fill="#1d4ed8" fontStyle="italic" fontFamily="sans-serif">OCÉAN ATLANTIQUE</text>
          </svg>
        </div>

        {/* Légende */}
        <div className="flex-1 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Répartition par zone</h4>
          <div className="space-y-3">
            {zoneDistribution.map((zone) => {
              const meta = getZoneMeta(zone.name);
              const pct  = totalVehicles > 0 ? ((zone.value / totalVehicles) * 100).toFixed(1) : '0';
              if (!meta) return null;
              return (
                <div key={zone.name} {...clickable(zone.name)} className="rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full shadow" style={{ background: ZONE_COLOR[zone.name] }} />
                      <span className="text-sm font-semibold text-slate-700">{zone.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-slate-900">{zone.value}</span>
                      <span className="ml-2 text-xs text-slate-500">véhicule(s) — {pct}%</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500"><strong>Villes :</strong> {meta.villes_cles.join(', ')}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
