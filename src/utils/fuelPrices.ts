// Prix de référence carburant (FCFA / litre), utilisés dans toute l'application pour les
// calculs théoriques de consommation et de coût (FuelManagement, GeolocTrajets...).
// Les valeurs réelles sont désormais modifiables depuis le menu Paramètres (AppSettings,
// synchronisé Firestore) — les constantes ci-dessous ne servent plus que de valeurs de
// repli tant que les paramètres n'ont pas encore été chargés.
export const FUEL_PRICES: Record<string, number> = {
  Essence: 875,
  Diesel: 700,
};

const DEFAULT_FUEL_PRICE = FUEL_PRICES.Diesel;

/**
 * Retourne le prix au litre (FCFA) correspondant au type d'énergie d'un véhicule.
 * `prices` doit être construit à partir des paramètres de l'application (AppSettings) —
 * voir `fuelPricesFromSettings` ci-dessous — pour refléter les valeurs modifiées par
 * l'utilisateur depuis le menu Paramètres plutôt que les constantes fixes.
 */
export function getFuelPrice(energie?: string, prices: Record<string, number> = FUEL_PRICES): number {
  if (!energie) return prices.Diesel ?? DEFAULT_FUEL_PRICE;
  return prices[energie] ?? prices.Diesel ?? DEFAULT_FUEL_PRICE;
}

/** Construit la table des prix carburant à partir des paramètres de l'application. */
export function fuelPricesFromSettings(settings: { fuelPriceEssence: number; fuelPriceDiesel: number }): Record<string, number> {
  return { Essence: settings.fuelPriceEssence, Diesel: settings.fuelPriceDiesel };
}
