// ── Catalogue des pièces de rechange (suivi des prix) ──

export type PriceHistoryEntry = {
  id: string;
  date: string;
  valeur: number;
  fournisseur: string;
};

export type CataloguePiece = {
  id: string;
  nom_piece: string;
  reference: string;
  observations: string;
  // Historique trié chronologiquement croissant (le plus ancien en premier).
  // "Valeur d'achat" = avant-dernière entrée, "Valeur d'achat actuelle" = dernière entrée.
  historique: PriceHistoryEntry[];
};

export const CATALOGUE_STORAGE_KEY = 'parc_auto_catalogue_pieces';

export const SAMPLE_CATALOGUE: CataloguePiece[] = [
  {
    id: 'cat1',
    nom_piece: 'Plaquettes de frein avant',
    reference: 'PF-2201',
    observations: 'Kit complet essieu avant, toutes marques SUV',
    historique: [
      { id: 'ph1', date: '2024-11-05', valeur: 35000, fournisseur: 'Auto Service Abidjan' },
      { id: 'ph2', date: '2025-02-04', valeur: 42000, fournisseur: 'Auto Service Abidjan' },
    ],
  },
  {
    id: 'cat2',
    nom_piece: 'Filtre à huile',
    reference: 'FH-1187',
    observations: '',
    historique: [
      { id: 'ph3', date: '2024-09-10', valeur: 8000, fournisseur: 'Garage KIA' },
      { id: 'ph4', date: '2025-01-18', valeur: 8500, fournisseur: 'Garage Central' },
      { id: 'ph5', date: '2025-05-10', valeur: 9200, fournisseur: 'Garage KIA' },
    ],
  },
  {
    id: 'cat3',
    nom_piece: 'Batterie 12V 60Ah',
    reference: 'BAT-60',
    observations: 'Marque Bosch',
    historique: [
      { id: 'ph6', date: '2024-06-01', valeur: 65000, fournisseur: 'SIP' },
      { id: 'ph7', date: '2025-03-10', valeur: 78000, fournisseur: 'SIP' },
    ],
  },
  {
    id: 'cat4',
    nom_piece: 'Pneu 215/65 R16',
    reference: 'PN-21665',
    observations: 'Continental',
    historique: [
      { id: 'ph8', date: '2024-08-01', valeur: 95000, fournisseur: 'SIP' },
      { id: 'ph9', date: '2024-12-15', valeur: 98000, fournisseur: 'SIP' },
      { id: 'ph10', date: '2025-04-20', valeur: 96500, fournisseur: 'Société Ivoirienne de Pneumatiques' },
    ],
  },
];
