// ── Gestion des Pneumatiques ──

export type PneumatiqueRecord = {
  id: string;
  vehicleId: string;
  position: 'AVG' | 'AVD' | 'ARG' | 'ARD' | 'Secours' | 'Paire de 2' | 'Paire de 4';
  marque: string;
  modele: string;
  dimension: string;
  date_montage: string;
  km_montage: number;
  km_actuel?: number;
  usure_mm?: number; // profondeur de sculpture restante
  cout_unitaire: number;
  main_oeuvre: number;
  etat: 'Bon' | 'Usure modérée' | 'À remplacer' | 'Remplacé';
  fournisseur: string;
  observations: string;
};

export type SeuilAlertePneu = {
  usureMinimale_mm: number;
  kmMaxParJeu: number;
  coutBudgetMensuel: number;
};

export const PNEU_DIMENSIONS: string[] = [
  '175/65 R15', '185/65 R15', '195/65 R15', '205/55 R16',
  '215/55 R17', '225/45 R17', '235/55 R18', '245/45 R18',
  '255/55 R19', '265/60 R18', '165/70 R13', '175/70 R13',
  'Autre',
];

export const PNEU_MARQUES: string[] = [
  'Michelin', 'Bridgestone', 'Goodyear', 'Continental',
  'Pirelli', 'Dunlop', 'Hankook', 'Yokohama',
  'BF Goodrich', 'Nokian', 'Firestone', 'Autre',
];

// Échantillon de données
export const SAMPLE_PNEUS: PneumatiqueRecord[] = [
  {
    id: 'pn1', vehicleId: 'v1', position: 'AVG', marque: 'Michelin', modele: 'Primacy 4',
    dimension: '205/55 R16', date_montage: '2024-03-15', km_montage: 38000, km_actuel: 45200,
    usure_mm: 5.2, cout_unitaire: 65000, main_oeuvre: 10000, etat: 'Bon',
    fournisseur: 'Pneu Express Abidjan', observations: '',
  },
  {
    id: 'pn2', vehicleId: 'v1', position: 'AVD', marque: 'Michelin', modele: 'Primacy 4',
    dimension: '205/55 R16', date_montage: '2024-03-15', km_montage: 38000, km_actuel: 45200,
    usure_mm: 5.0, cout_unitaire: 65000, main_oeuvre: 10000, etat: 'Bon',
    fournisseur: 'Pneu Express Abidjan', observations: '',
  },
  {
    id: 'pn3', vehicleId: 'v2', position: 'AVG', marque: 'Bridgestone', modele: 'Turanza T005',
    dimension: '215/55 R17', date_montage: '2023-06-10', km_montage: 72000, km_actuel: 89300,
    usure_mm: 2.8, cout_unitaire: 78000, main_oeuvre: 12000, etat: 'Usure modérée',
    fournisseur: 'Auto Pneus Plateau', observations: 'À surveiller, proche du seuil',
  },
  {
    id: 'pn4', vehicleId: 'v3', position: 'ARG', marque: 'Continental', modele: 'ContiPremiumContact 6',
    dimension: '235/55 R18', date_montage: '2024-01-20', km_montage: 55000, km_actuel: 67800,
    usure_mm: 4.5, cout_unitaire: 92000, main_oeuvre: 15000, etat: 'Bon',
    fournisseur: 'Michelin Store CI', observations: '',
  },
  {
    id: 'pn5', vehicleId: 'v6', position: 'AVG', marque: 'Goodyear', modele: 'EfficientGrip Performance 2',
    dimension: '225/45 R17', date_montage: '2024-09-05', km_montage: 60000, km_actuel: 72400,
    usure_mm: 6.1, cout_unitaire: 72000, main_oeuvre: 10000, etat: 'Bon',
    fournisseur: 'Goodyear Center', observations: '',
  },
  {
    id: 'pn6', vehicleId: 'v4', position: 'AVD', marque: 'Hankook', modele: 'Kinergy GT',
    dimension: '195/65 R15', date_montage: '2023-01-15', km_montage: 140000, km_actuel: 156000,
    usure_mm: 1.4, cout_unitaire: 45000, main_oeuvre: 8000, etat: 'À remplacer',
    fournisseur: 'Discount Pneu', observations: 'Usure critique, remplacement urgent',
  },
];
