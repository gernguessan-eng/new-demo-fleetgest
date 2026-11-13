// Paramètres généraux de l'application, partagés entre tous les utilisateurs (synchronisés
// via Firestore, comme le reste des données de l'appli — pas un simple réglage local).

export interface AppSettings {
  /** Toujours 'general' — un seul document de paramètres pour toute l'application. */
  id: string;
  /** Prix de référence carburant (FCFA / litre), utilisés dans tous les calculs théoriques
   *  de consommation et de coût (Gestion des carburants, Géolocalisation et trajectoires...). */
  fuelPriceEssence: number;
  fuelPriceDiesel: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'general',
  fuelPriceEssence: 875,
  fuelPriceDiesel: 700,
};
