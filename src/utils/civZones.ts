export type CivZoneName = 'Centre' | 'Nord' | 'Sud' | 'Est' | 'Ouest';

export type CivZoneDefinition = {
  name: CivZoneName;
  role: string;
  villes_cles: string[];
  frontieres?: string[];
  caracteristiques: string;
  color: string;
  // Polygone simplifié sur une carte SVG 600x700
  path: string;
  labelX: number;
  labelY: number;
  labelColor?: string;
};

export const CIV_ZONES: CivZoneDefinition[] = [
  {
    name: 'Nord',
    role: 'Zone frontalière septentrionale',
    villes_cles: ['Korhogo', 'Ferkessédougou', 'Odienné'],
    frontieres: ['Mali', 'Burkina Faso'],
    caracteristiques: "Climat de savane, culture du coton et de l'anacarde, élevage bovin.",
    color: '#10b981',
    path: 'M 105,160 Q 180,110 280,105 Q 390,102 470,135 L 455,220 Q 360,214 285,222 Q 180,230 115,245 Q 95,200 105,160 Z',
    labelX: 285,
    labelY: 165,
  },
  {
    name: 'Ouest',
    role: 'Zone forestière et montagneuse',
    villes_cles: ['Man', 'Daloa', 'Danané'],
    frontieres: ['Libéria', 'Guinée'],
    caracteristiques: 'Relief accidenté (Dix-Huit Montagnes), forte production de café, cacao et ressources minières.',
    color: '#ef4444',
    path: 'M 105,160 L 115,245 Q 160,235 200,285 L 180,375 L 155,470 L 120,565 Q 82,545 68,460 Q 58,365 68,275 Q 78,195 105,160 Z',
    labelX: 120,
    labelY: 360,
    labelColor: '#ffffff',
  },
  {
    name: 'Est',
    role: 'Zone frontalière orientale',
    villes_cles: ['Abengourou', 'Bondoukou'],
    frontieres: ['Ghana'],
    caracteristiques: 'Région de forêts et de vergers, commerce transfrontalier dynamique.',
    color: '#f59e0b',
    path: 'M 470,135 Q 520,255 512,400 Q 505,505 465,585 L 420,555 L 395,445 L 407,335 Q 424,248 455,220 L 470,135 Z',
    labelX: 448,
    labelY: 390,
    labelColor: '#ffffff',
  },
  {
    name: 'Centre',
    role: 'Carrefour central et politique',
    villes_cles: ['Yamoussoukro', 'Bouaké'],
    caracteristiques: 'Zone de transition forestière et savane, nœud routier national, capitale politique.',
    color: '#8b5cf6',
    path: 'M 115,245 Q 180,230 285,222 Q 360,214 455,220 L 407,335 Q 320,318 220,305 Q 150,300 115,245 Z',
    labelX: 286,
    labelY: 285,
    labelColor: '#ffffff',
  },
  {
    name: 'Sud',
    role: 'Poumon économique et littoral',
    villes_cles: ['Abidjan', 'San-Pédro', 'Grand-Bassam'],
    frontieres: ['Océan Atlantique / Golfe de Guinée'],
    caracteristiques: 'Zone côtière, ports maritimes majeurs, forte densité industrielle, culture intensive de cacao.',
    color: '#3b82f6',
    path: 'M 68,460 Q 82,545 120,565 L 155,470 L 180,375 L 200,285 Q 250,300 340,315 Q 390,320 407,335 L 395,445 L 420,555 L 380,610 Q 250,640 125,620 Q 80,595 68,460 Z',
    labelX: 255,
    labelY: 520,
  },
];

export const CIV_CITY_POINTS: Array<{ city: string; zone: CivZoneName; x: number; y: number; highlight?: boolean }> = [
  { city: 'Korhogo', zone: 'Nord', x: 292, y: 180 },
  { city: 'Ferkessédougou', zone: 'Nord', x: 340, y: 170 },
  { city: 'Odienné', zone: 'Nord', x: 150, y: 205 },
  { city: 'Bouaké', zone: 'Centre', x: 332, y: 245 },
  { city: 'Yamoussoukro', zone: 'Centre', x: 280, y: 308, highlight: true },
  { city: 'Abengourou', zone: 'Est', x: 420, y: 365 },
  { city: 'Bondoukou', zone: 'Est', x: 430, y: 250 },
  { city: 'Man', zone: 'Ouest', x: 118, y: 340 },
  { city: 'Daloa', zone: 'Ouest', x: 190, y: 355 },
  { city: 'Danané', zone: 'Ouest', x: 92, y: 270 },
  { city: 'Abidjan', zone: 'Sud', x: 305, y: 588, highlight: true },
  { city: 'San-Pédro', zone: 'Sud', x: 130, y: 585 },
  { city: 'Grand-Bassam', zone: 'Sud', x: 360, y: 600 },
];

const CITY_TO_ZONE = new Map<string, CivZoneName>();
for (const zone of CIV_ZONES) {
  for (const city of zone.villes_cles) {
    CITY_TO_ZONE.set(city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), zone.name);
  }
}
// synonymes / orthographes usuelles
CITY_TO_ZONE.set('abidjan', 'Sud');
CITY_TO_ZONE.set('grand bassam', 'Sud');
CITY_TO_ZONE.set('san pedro', 'Sud');
CITY_TO_ZONE.set('ferkessedougou', 'Nord');
CITY_TO_ZONE.set('ferkessedougou', 'Nord');
CITY_TO_ZONE.set('odienne', 'Nord');
CITY_TO_ZONE.set('yamoussoukro', 'Centre');
CITY_TO_ZONE.set('bouake', 'Centre');
CITY_TO_ZONE.set('abengourou', 'Est');
CITY_TO_ZONE.set('bondoukou', 'Est');
CITY_TO_ZONE.set('man', 'Ouest');
CITY_TO_ZONE.set('daloa', 'Ouest');
CITY_TO_ZONE.set('danane', 'Ouest');

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function detectIvoryCoastZoneFromText(text: string): CivZoneName | null {
  const normalized = normalize(text);
  for (const [city, zone] of CITY_TO_ZONE.entries()) {
    if (normalized.includes(city)) return zone;
  }
  return null;
}

export function getZoneMeta(zoneName: CivZoneName) {
  return CIV_ZONES.find((z) => z.name === zoneName) || null;
}
