// ── Gestion des Sinistres ──

export type SinistreType =
  | 'Collision'
  | 'Renversement'
  | 'Vol'
  | 'Bris de glace'
  | 'Incendie'
  | 'Inondation'
  | 'Vandalisme'
  | 'Autre'
  | (string & {});

export type SinistreStatut = 'Déclaré' | 'Expertise' | 'En réparation' | 'Indemnisé' | 'Clôturé';

export type NatureDommage = 'Dommage corporel' | 'Dommage matériel' | 'Autre' | (string & {});

export type Responsabilite = 'Engagée' | 'Non engagée' | '';

export const SINISTRES_STORAGE_KEY = 'parc_auto_sinistres';

export type SinistreRecord = {
  id: string;
  vehicleId: string;
  date_sinistre: string;
  lieu: string;
  // « Autre » permet de saisir un type libre : on accepte donc aussi du texte.
  type: SinistreType | (string & {});
  commune?: string;
  nature_dommage?: NatureDommage | (string & {});
  responsabilite?: Responsabilite;
  description: string;
  cout_estime: number;
  cout_final?: number;
  assureur: string;
  numero_dossier: string;
  statut: SinistreStatut;
  responsable: string;
  temoins: string;
  photos_jointes?: string;
  observations: string;
};

export const SINISTRE_TYPES: SinistreType[] = [
  'Collision', 'Renversement', 'Vol', 'Bris de glace',
  'Incendie', 'Inondation', 'Vandalisme', 'Autre',
];

export const SINISTRE_STATUTS: SinistreStatut[] = [
  'Déclaré', 'Expertise', 'En réparation', 'Indemnisé', 'Clôturé',
];

export const NATURE_DOMMAGE_OPTIONS: NatureDommage[] = ['Dommage corporel', 'Dommage matériel', 'Autre'];

export const RESPONSABILITE_OPTIONS: Exclude<Responsabilite, ''>[] = ['Engagée', 'Non engagée'];

// Suggestions pour la case « Commune » (saisie libre possible)
export const COMMUNES_SUGGESTIONS: string[] = [
  'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi',
  'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon',
  'Bouaké', 'Yamoussoukro', 'San-Pédro', 'Daloa', 'Korhogo', 'Man', 'Gagnoa',
  'Abengourou', 'Divo', 'Soubré', 'Grand-Bassam', 'Dabou', 'Agboville',
];

// Échantillon
export const SAMPLE_SINISTRES: SinistreRecord[] = [
  {
    id: 'si1', vehicleId: 'v2', date_sinistre: '2024-05-12', lieu: 'Boulevard Latrille, Abidjan', commune: 'Cocody',
    type: 'Collision', nature_dommage: 'Dommage corporel', responsabilite: 'Non engagée',
    description: 'Choc arrière avec un véhicule qui a freiné brusquement',
    cout_estime: 1250000, cout_final: 1180000, assureur: 'NSIA Assurances',
    numero_dossier: 'NSIA-2024-00512', statut: 'Indemnisé', responsable: 'Conducteur tiers',
    temoins: 'Oui, 2 témoins', photos_jointes: 'oui', observations: 'Véhicule réparé chez Garage Central',
  },
  {
    id: 'si2', vehicleId: 'v3', date_sinistre: '2024-11-20', lieu: 'Yamoussoukro, RN1', commune: 'Yamoussoukro',
    type: 'Bris de glace', nature_dommage: 'Dommage matériel', responsabilite: 'Non engagée',
    description: 'Impact de pierre sur pare-brise côté conducteur',
    cout_estime: 350000, cout_final: 320000, assureur: 'Allianz CI',
    numero_dossier: 'ALZ-2024-01120', statut: 'En réparation', responsable: 'Non déterminé',
    temoins: 'Non', photos_jointes: 'oui', observations: '',
  },
  {
    id: 'si3', vehicleId: 'v4', date_sinistre: '2024-08-03', lieu: 'Parking direction, Cocody', commune: 'Cocody',
    type: 'Vandalisme', nature_dommage: 'Dommage matériel', responsabilite: 'Non engagée',
    description: 'Rayures multiples sur la carrosserie côté gauche',
    cout_estime: 580000, assureur: 'Sanlam Assurances',
    numero_dossier: 'SLM-2024-00803', statut: 'Expertise', responsable: 'Inconnu',
    temoins: 'Non', observations: 'En attente du rapport d\'expertise',
  },
  {
    id: 'si4', vehicleId: 'v1', date_sinistre: '2025-02-14', lieu: 'Autoroute du Nord, Km 45', commune: 'Anyama',
    type: 'Collision', nature_dommage: 'Dommage matériel', responsabilite: '',
    description: 'Accrochage latéral lors d\'un dépassement',
    cout_estime: 890000, assureur: 'NSIA Assurances',
    numero_dossier: 'NSIA-2025-00214', statut: 'Déclaré', responsable: 'En cours de détermination',
    temoins: 'Oui, passager présent', photos_jointes: 'oui', observations: 'Photo du constat jointe',
  },
  {
    id: 'si5', vehicleId: 'v9', date_sinistre: '2026-07-03', lieu: 'Marcory, Zone 4, Abidjan', commune: 'Marcory',
    type: 'Collision', nature_dommage: 'Dommage matériel', responsabilite: 'Non engagée',
    description: 'Choc à un carrefour, priorité non respectée par le tiers',
    cout_estime: 720000, assureur: 'Allianz CI',
    numero_dossier: 'ALZ-2026-00703', statut: 'Déclaré', responsable: 'Conducteur tiers',
    temoins: 'Oui, 1 témoin', photos_jointes: 'oui', observations: '',
  },
  {
    id: 'si6', vehicleId: 'v14', date_sinistre: '2026-06-18', lieu: 'Yopougon, Abidjan', commune: 'Yopougon',
    type: 'Vol', nature_dommage: 'Dommage matériel', responsabilite: 'Non engagée',
    description: 'Tentative de vol, rétroviseur arraché',
    cout_estime: 95000, cout_final: 90000, assureur: 'Sanlam Assurances',
    numero_dossier: 'SLM-2026-00618', statut: 'Indemnisé', responsable: 'Inconnu',
    temoins: 'Non', observations: '',
  },
  {
    id: 'si7', vehicleId: 'v17', date_sinistre: '2026-05-27', lieu: 'Bouaké, RN2', commune: 'Bouaké',
    type: 'Renversement', nature_dommage: 'Dommage corporel', responsabilite: 'Engagée',
    description: 'Sortie de route sur chaussée glissante',
    cout_estime: 2100000, cout_final: 1980000, assureur: 'NSIA Assurances',
    numero_dossier: 'NSIA-2026-00527', statut: 'Clôturé', responsable: 'Conducteur du véhicule',
    temoins: 'Oui, 2 témoins', photos_jointes: 'oui', observations: 'Véhicule immobilisé 3 semaines',
  },
];
