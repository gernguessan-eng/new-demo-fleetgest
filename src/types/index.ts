export interface Vehicle {
  id: string;
  // Carte grise - Front
  numero_immatriculation: string;
  numero_carte_grise: string;
  code_parc_entreprise?: string;
  nom_proprietaire: string;
  rdc: string;
  marque: string;
  genre: string;
  type_commercial: string;
  couleur: string;
  carrosserie: string;
  date_mise_circulation: string;
  date_edition: string;
  usage_vehicule: string;
  energie: string;
  places_assises: number;
  ptac_kg: number;
  nombre_essieux: number;
  cylindree_cc: number;
  puissance_fiscale_cv: number;
  pv_kg: number;
  cu_kg: number;
  // Carte grise - Back
  vin_chassis: string;
  numero_moteur: string;
  type_technique: string;
  numero_immatriculation_precedent: string;
  societe_credit: string;
  // Gestion de parc
  statut: 'Actif' | 'En maintenance' | 'Hors service' | 'Réformé';
  kilometrage: number;
  date_achat: string;
  cout_achat: number;
  // Échéances avec période complète (date d'effet -> date d'échéance)
  date_effet_assurance?: string;
  date_assurance: string;
  date_effet_vignette?: string;
  date_vignette: string;
  date_effet_carte_transport?: string;
  validite_carte_transport?: string;
  date_effet_patente?: string;
  validite_patente?: string;
  date_effet_carte_stationnement?: string;
  validite_carte_stationnement?: string;
  cout_assurance_annuel: number;
  affectation: string;
  zone_affectation?: 'Nord' | 'Sud' | 'Est' | 'Centre' | 'Ouest';
  /** Zone de travail (texte libre, ex : un site ou un centre d'activité) — base des répartitions par zone */
  zone_travail?: string;
  categorie_parc?: 'Véhicule de fonction' | 'Véhicule de service' | 'Véhicule de pool' | 'Autre' | (string & {});
  conducteur: string;
  observations: string;
  valeur_residuelle?: number;
  frais_livraison?: number;
  frais_douane?: number;
  frais_installation?: number;
  couts_indirects?: number;
  photo_url?: string;
  // Photos des documents administratifs (fichiers importés depuis l'appareil : seule l'URL
  // du fichier est conservée — voir renderDocumentUpload dans VehicleForm.tsx).
  photo_carte_grise?: string;        // carte grise recto (nom de champ conservé pour les fiches existantes)
  photo_carte_grise_verso?: string;  // carte grise verso
  photo_patente?: string;
  photo_vignette?: string;
  photo_carte_transport?: string;
  photo_carte_stationnement?: string;
  consommation_100km?: number;
  telephone_gps?: string;
}

export type MaintenanceType = 'Préventive' | 'Curative' | 'Accidentelle' | 'Autre' | (string & {});

export const MAINTENANCE_TYPES: MaintenanceType[] = ['Préventive', 'Curative', 'Accidentelle', 'Autre'];

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  type: MaintenanceType;
  description: string;
  cout: number;
  kilometrage: number;
}

export type ExpenseCategory =
  | 'Carburant'
  | 'Entretien'
  | 'Réparation'
  | 'Assurance'
  | 'Vignette'
  | 'Péage'
  | 'Parking'
  | 'Lavage'
  | 'Amende'
  | 'Pièces'
  | 'Autre'
  | (string & {});

export interface ExpenseRecord {
  id: string;
  vehicleId: string;
  date: string;
  categorie: ExpenseCategory;
  libelle: string;
  montant: number;
  fournisseur: string;
  mode_paiement: string;
  numero_piece: string;
  justificatif_nom: string;
  notes: string;
  date_entretien?: string;
  kilometrage_entretien?: number;
  /** Photo du reçu/pompe carburant (prise depuis l'appareil photo ou importée), en base64. */
  photo_carburant_url?: string;
}

// ── Gestion des chauffeurs ──

export interface Driver {
  id: string;
  nom: string;
  prenom: string;
  fonction?: string;
  telephone: string;
  email: string;
  numero_permis: string;
  categorie_permis: string;
  date_expiration_permis: string;
  date_embauche: string;
  vehicule_affecte_id: string;
  statut: 'Disponible' | 'En mission' | 'En congé' | 'Indisponible';
  photo_url?: string;
  /** Copies du permis de conduire (recto / verso) : URL des fichiers importés */
  permis_recto_url?: string;
  permis_verso_url?: string;
  notes: string;
}

export interface Mission {
  id: string;
  driverId: string;
  vehicleId: string;
  titre: string;
  description: string;
  lieu_depart: string;
  lieu_arrivee: string;
  date_debut: string;
  date_fin: string;
  heure_depart: string;
  heure_retour: string;
  km_depart: number;
  km_retour: number;
  statut: 'Planifiée' | 'En cours' | 'Terminée' | 'Annulée';
  cout_mission: number;
  observations: string;
}

export interface PlanningEvent {
  id: string;
  driverId: string;
  vehicleId: string;
  titre: string;
  type: 'Mission' | 'Congé' | 'Formation' | 'Repos' | 'Autre' | (string & {});
  date_debut: string;
  date_fin: string;
  couleur: string;
  notes: string;
}

export type DashboardStats = {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  outOfServiceVehicles: number;
  reformedVehicles: number;
  totalKilometers: number;
  avgKilometers: number;
  totalAcquisitionCost: number;
  totalInsuranceCost: number;
  totalExpenseCost: number;
  totalOperatingCost: number;
  avgExpensePerVehicle: number;
  tcoGlobal: number;
  tcoPerVehicle: number;
  upcomingInsurance: number;
  upcomingVignette: number;
  upcomingCarteTransport: number;
  upcomingPatente: number;
  upcomingCarteStationnement: number;
  energyDistribution: { name: string; value: number }[];
  brandDistribution: { name: string; value: number }[];
  monthlyCosts: { month: string; cost: number }[];
  monthlyExpenses: { month: string; cost: number }[];
  expenseCategoryDistribution: { name: string; value: number }[];
  vehicleAgeDistribution: { name: string; value: number }[];
  fleetCategoryDistribution: { name: string; value: number }[];
};

export interface Contact {
  id: string;
  type_contact: 'Fournisseur' | 'Garage' | 'Assureur' | 'Client' | 'Partenaire' | 'Administration' | 'Chauffeur' | 'Autre' | (string & {});
  civilite?: 'M.' | 'Mme' | 'Mlle' | '';
  nom: string;
  prenom?: string;
  societe?: string;
  fonction?: string;
  telephone?: string;
  telephone_secondaire?: string;
  email?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  site_web?: string;
  notes?: string;
  date_creation?: string;
}

