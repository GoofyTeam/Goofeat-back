export interface NotificationSettings {
  // Notifications générales
  pushNotificationsEnabled: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;

  // Stock et produits
  stockExpirationEnabled: boolean;
  stockExpirationDays: number;
  lowStockEnabled: boolean;

  // Recettes et suggestions
  recipeRecommendationsEnabled: boolean;
  trendingRecipesEnabled: boolean;
  mealRemindersEnabled: boolean;

  // Foyer et partage
  householdUpdatesEnabled: boolean;
  newMemberEnabled: boolean;

  // Mode silencieux
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export type NotificationSettingsUpdate = Partial<NotificationSettings>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  pushNotificationsEnabled: true,
  vibrationEnabled: true,
  soundEnabled: true,
  stockExpirationEnabled: true,
  stockExpirationDays: 3,
  lowStockEnabled: true,
  recipeRecommendationsEnabled: true,
  trendingRecipesEnabled: false,
  mealRemindersEnabled: false,
  householdUpdatesEnabled: true,
  newMemberEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};
