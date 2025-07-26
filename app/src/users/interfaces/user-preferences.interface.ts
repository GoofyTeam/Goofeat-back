import { DietaryRestriction } from '../enums/dietary-restriction.enum';

export interface UserPreferences {
  allergenes?: string[];
  preferredCategories?: string[];
  excludedCategories?: string[];
  dietaryRestrictions?: DietaryRestriction[]; // e.g., vegan, gluten-free
  notifications?: {
    email?: boolean;
    push?: boolean;
    expirationAlerts?: boolean;
    expirationDaysBefore?: number; // Nombre de jours avant expiration pour les alertes
  };
}
