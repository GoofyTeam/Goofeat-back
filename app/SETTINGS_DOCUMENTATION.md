# 📋 Documentation Complète des Settings Goofeat

Ce document centralise **TOUS** les types de paramètres configurables dans l'application Goofeat.

## 🏗️ Architecture des Settings

L'application utilise 3 niveaux de paramètres :

| Type | Entité | Champ | Format | Portée |
|------|--------|-------|---------|--------|
| **User Preferences** | `users` | `preferences` | `JSONB` | Individuelle |
| **User Notifications** | `users` | `notificationSettings` | `JSONB` | Individuelle |
| **Household Settings** | `households` | `settings` | `JSONB` | Collective |

---

## 👤 1. USER PREFERENCES (`users.preferences`)

### Interface TypeScript

```typescript
interface UserPreferences {
  allergenes?: string[];
  preferredCategories?: string[];
  excludedCategories?: string[];
  dietaryRestrictions?: DietaryRestriction[];
  notifications?: {
    email?: boolean;
    push?: boolean;
    expirationAlerts?: boolean;
    expirationDaysBefore?: number;
  };
}
```

### Restrictions Alimentaires Disponibles

```typescript
enum DietaryRestriction {
  VEGAN = 'vegan',
  VEGETARIAN = 'vegetarian',
  GLUTEN_FREE = 'gluten_free',
  DAIRY_FREE = 'dairy_free',
  NUT_FREE = 'nut_free',
}
```

### Exemple Complet

```json
{
  "allergenes": ["Arachides", "Gluten", "Lactose"],
  "preferredCategories": ["Plat principal", "Dessert", "Végétarien"],
  "excludedCategories": ["Fast food", "Épicé"],
  "dietaryRestrictions": ["vegan", "gluten_free"]
}
```

---

## 📱 2. USER NOTIFICATION SETTINGS (`users.notificationSettings`)

### Interface TypeScript

```typescript
interface NotificationSettings {
  // Notifications générales
  pushNotificationsEnabled: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;

  // Stock et produits
  stockExpirationEnabled: boolean;
  stockExpirationDays: number;  // 1-14 jours
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
  quietHoursStart: string;  // Format "HH:MM"
  quietHoursEnd: string;    // Format "HH:MM"
}
```

### Valeurs par Défaut

```json
{
  "pushNotificationsEnabled": true,
  "vibrationEnabled": true,
  "soundEnabled": true,
  "stockExpirationEnabled": true,
  "stockExpirationDays": 3,
  "lowStockEnabled": true,
  "recipeRecommendationsEnabled": true,
  "trendingRecipesEnabled": false,
  "mealRemindersEnabled": false,
  "householdUpdatesEnabled": true,
  "newMemberEnabled": true,
  "quietHoursEnabled": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

### Contraintes de Validation

- `stockExpirationDays`: entre 1 et 14
- `quietHoursStart/End`: format HH:MM (regex: `^([01]?\d|2[0-3]):[0-5]\d$`)

---

## 🏠 3. HOUSEHOLD SETTINGS (`households.settings`)

### Structure Générale

```json
{
  "notifications": { ... },
  "childApproval": { ... }
}
```

### 3.1 Notifications Familiales

#### Structure

```json
{
  "notifications": {
    "stockUpdates": boolean,
    "childActions": boolean,
    "expirationAlerts": boolean,
    "memberJoined": boolean,
    "onlyParentsForApproval": boolean,
    "digestMode": "instant" | "daily" | "weekly" | "disabled"
  }
}
```

#### Valeurs par Défaut

```json
{
  "notifications": {
    "stockUpdates": true,
    "childActions": true,
    "expirationAlerts": true,
    "memberJoined": true,
    "onlyParentsForApproval": true,
    "digestMode": "instant"
  }
}
```

### 3.2 Configuration d'Approbation des Enfants

#### Structure

```json
{
  "childApproval": {
    "enabled": boolean,
    "autoExpireHours": number,
    "maxQuantityWithoutApproval": number
  }
}
```

#### Valeurs par Défaut

```json
{
  "childApproval": {
    "enabled": true,
    "autoExpireHours": 24,
    "maxQuantityWithoutApproval": 1
  }
}
```

#### Contraintes

- `autoExpireHours`: entre 1 et 168 heures (7 jours max)
- `maxQuantityWithoutApproval`: >= 0

---

## 🔄 Relations et Priorités

### Hiérarchie des Settings

```
Household Settings (niveau foyer)
    ↓ surcharge si configuré
User Preferences (niveau individuel)
    ↓ surcharge si configuré
User Notification Settings (niveau personnel)
```

### Exemples de Priorités

1. **Notifications d'expiration** :
   - `households.settings.notifications.expirationAlerts` = `false` → **Bloque pour tout le foyer**
   - `users.notificationSettings.stockExpirationEnabled` = `true` → Ignoré

2. **Mode digest** :
   - `households.settings.notifications.digestMode` = `"daily"` → **Mode quotidien pour le foyer**
   - `users.notificationSettings.pushNotificationsEnabled` = `false` → L'utilisateur peut désactiver ses pushes personnels

---

## 📋 Exemples par Types de Foyers

### 🏠 Famille avec Enfants

#### User Preferences (Parent)
```json
{
  "allergenes": ["Arachides"],
  "preferredCategories": ["Famille", "Rapide"],
  "dietaryRestrictions": [],
  "notifications": {
    "expirationDaysBefore": 2
  }
}
```

#### User Notifications (Parent)
```json
{
  "pushNotificationsEnabled": true,
  "stockExpirationEnabled": true,
  "stockExpirationDays": 2,
  "householdUpdatesEnabled": true,
  "quietHoursEnabled": true,
  "quietHoursStart": "21:00",
  "quietHoursEnd": "07:00"
}
```

#### Household Settings
```json
{
  "notifications": {
    "stockUpdates": true,
    "childActions": true,
    "expirationAlerts": true,
    "memberJoined": true,
    "onlyParentsForApproval": true,
    "digestMode": "instant"
  },
  "childApproval": {
    "enabled": true,
    "autoExpireHours": 24,
    "maxQuantityWithoutApproval": 1
  }
}
```

### 👫 Couple

#### User Preferences
```json
{
  "allergenes": ["Lactose"],
  "preferredCategories": ["Healthy", "Végétarien"],
  "dietaryRestrictions": ["dairy_free"]
}
```

#### Household Settings
```json
{
  "notifications": {
    "stockUpdates": true,
    "childActions": false,
    "expirationAlerts": true,
    "digestMode": "daily"
  },
  "childApproval": {
    "enabled": false
  }
}
```

### 🏢 Colocation

#### Household Settings
```json
{
  "notifications": {
    "stockUpdates": true,
    "childActions": false,
    "memberJoined": true,
    "digestMode": "weekly"
  },
  "childApproval": {
    "enabled": false
  }
}
```

### 🧑‍🦳 Personne Seule

#### User Preferences
```json
{
  "allergenes": [],
  "preferredCategories": ["Rapide", "Une personne"],
  "dietaryRestrictions": []
}
```

#### Household Settings (minimal)
```json
{
  "notifications": {
    "stockUpdates": false,
    "childActions": false,
    "expirationAlerts": true,
    "digestMode": "daily"
  },
  "childApproval": {
    "enabled": false
  }
}
```

---

## 💻 Utilisation dans le Code

### Récupération avec Fallbacks

```typescript
// User preferences
const userPreferences = user.preferences || {};
const allergenes = userPreferences.allergenes || [];

// Notification settings
const notificationSettings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;

// Household settings
const householdNotifications = household.settings?.notifications || {
  stockUpdates: true,
  childActions: true,
  // ... defaults
};
```

### Mise à jour Partielle

```typescript
// Update user preferences
await usersService.updatePreferences(userId, {
  allergenes: ['Gluten', 'Lactose']
});

// Update household settings
await householdService.updateSettings(householdId, {
  notifications: {
    digestMode: 'daily'
  }
});
```

---

## 🚀 Évolution Future

### Extensibilité

Le format JSONB permet d'ajouter de nouveaux champs sans migration :

```json
{
  "notifications": { ... },
  "childApproval": { ... },
  "newFeature": {  // ← Nouveau en v2
    "enabled": true,
    "customSetting": "value"
  }
}
```

### Champs Potentiels Futurs

```json
{
  "privacy": {
    "shareDataWithPartners": false,
    "analyticsEnabled": true
  },
  "shopping": {
    "autoOrderEnabled": false,
    "preferredStores": ["Carrefour", "Leclerc"]
  },
  "mealPlanning": {
    "weeklyPlanningEnabled": true,
    "budgetLimit": 50.0
  }
}
```

---

## 📊 Résumé des Champs

### User Preferences (11 champs)
- `allergenes[]`
- `preferredCategories[]`
- `excludedCategories[]`
- `dietaryRestrictions[]`
- `notifications.email`
- `notifications.push`
- `notifications.expirationAlerts`
- `notifications.expirationDaysBefore`

### User Notification Settings (13 champs)
- `pushNotificationsEnabled`
- `vibrationEnabled`
- `soundEnabled`
- `stockExpirationEnabled`
- `stockExpirationDays`
- `lowStockEnabled`
- `recipeRecommendationsEnabled`
- `trendingRecipesEnabled`
- `mealRemindersEnabled`
- `householdUpdatesEnabled`
- `newMemberEnabled`
- `quietHoursEnabled`
- `quietHoursStart`
- `quietHoursEnd`

### Household Settings (9 champs)
- `notifications.stockUpdates`
- `notifications.childActions`
- `notifications.expirationAlerts`
- `notifications.memberJoined`
- `notifications.onlyParentsForApproval`
- `notifications.digestMode`
- `childApproval.enabled`
- `childApproval.autoExpireHours`
- `childApproval.maxQuantityWithoutApproval`

**TOTAL : 33 paramètres configurables** 🎯