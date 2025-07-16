/**
 * Interface pour la configuration des poids utilisés dans le scoring
 */
export interface ScoringWeights {
  quantityWeight: number; // Poids pour la quantité en stock
  dlcCloseWeight: number; // Poids pour les produits dont la DLC est proche
  noStockPenalty: number; // Pénalité pour les produits absents du stock
  nutriScoreWeight?: number; // Poids pour le nutriScore (optionnel)
  preferredCategoryWeight?: number; // Poids pour les catégories préférées (optionnel)
}

import { UserPreferences } from 'src/users/interfaces/user-preferences.interface';

/**
 * Configuration complète pour le système de scoring
 */
export interface ScoringConfig {
  weights: ScoringWeights;
  userPreferences: UserPreferences;
}
