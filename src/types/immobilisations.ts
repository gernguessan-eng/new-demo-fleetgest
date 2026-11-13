// ── Suivi des Immobilisations ──

export type ImmobilisationStatut = 'En cours' | 'Terminé' | 'En attente pièces';

export type ImmobilisationRecord = {
  id: string;
  vehicleId: string;
  garage: string;
  date_entree: string;
  date_sortie_prevue: string;
  date_sortie_reelle: string;
  travaux: string;
  statut: ImmobilisationStatut;
  cout_estime: number;
  cout_final: number;
  observations: string;
};

export const IMMOBILISATIONS_STORAGE_KEY = 'parc_auto_immobilisations';

export const SAMPLE_IMMOBILISATIONS: ImmobilisationRecord[] = [
  { id: 'imm1', vehicleId: 'v3', garage: 'Garage Central Abidjan', date_entree: '2025-05-10', date_sortie_prevue: '2025-05-17', date_sortie_reelle: '', travaux: 'Remplacement plaquettes freins + disques', statut: 'En cours', cout_estime: 450000, cout_final: 0, observations: 'Pièces en commande' },
  { id: 'imm2', vehicleId: 'v4', garage: 'Garage Expert', date_entree: '2025-04-20', date_sortie_prevue: '2025-05-05', date_sortie_reelle: '2025-05-08', travaux: 'Diagnostic moteur complet + réparation', statut: 'Terminé', cout_estime: 1200000, cout_final: 1350000, observations: 'Dépassement dû à des pièces supplémentaires' },
  { id: 'imm3', vehicleId: 'v1', garage: 'KIA Service Cocody', date_entree: '2025-05-18', date_sortie_prevue: '2025-05-20', date_sortie_reelle: '', travaux: 'Révision périodique 45000 km', statut: 'En attente pièces', cout_estime: 180000, cout_final: 0, observations: 'Filtre à air en rupture' },
  { id: 'imm4', vehicleId: 'v8', garage: 'Garage KIA', date_entree: '2026-06-02', date_sortie_prevue: '2026-06-10', date_sortie_reelle: '', travaux: 'Remplacement embrayage', statut: 'En cours', cout_estime: 620000, cout_final: 0, observations: '' },
  { id: 'imm5', vehicleId: 'v12', garage: 'Garage Central Abidjan', date_entree: '2026-05-15', date_sortie_prevue: '2026-05-22', date_sortie_reelle: '2026-05-21', travaux: 'Réparation climatisation', statut: 'Terminé', cout_estime: 220000, cout_final: 195000, observations: '' },
  { id: 'imm6', vehicleId: 'v16', garage: 'Société Ivoirienne de Pneumatiques', date_entree: '2026-06-20', date_sortie_prevue: '2026-06-24', date_sortie_reelle: '', travaux: 'Remplacement 4 pneus', statut: 'En attente pièces', cout_estime: 380000, cout_final: 0, observations: 'Rupture de stock fournisseur' },
  { id: 'imm7', vehicleId: 'v19', garage: 'Garage Expert', date_entree: '2026-04-28', date_sortie_prevue: '2026-05-10', date_sortie_reelle: '2026-05-09', travaux: 'Réfection moteur partielle', statut: 'Terminé', cout_estime: 1800000, cout_final: 1750000, observations: '' },
];
