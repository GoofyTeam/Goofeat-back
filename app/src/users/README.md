# Module Users - API V1/V2

## Vue d'ensemble

Le module Users gère les utilisateurs avec deux versions d'API :
- **V1** : API legacy maintenue pour compatibilité
- **V2** : API refactorisée avec endpoints spécialisés

## Endpoints disponibles

### API V1 (Legacy - Deprecated)

#### Gestion des utilisateurs (Admin)
- `GET /api/v1/users` - Liste des utilisateurs (Admin uniquement)
- `POST /api/v1/users` - Créer un utilisateur (Admin uniquement)  
- `GET /api/v1/users/:id` - Détails d'un utilisateur
- `PATCH /api/v1/users/:id` - Modifier un utilisateur (Admin uniquement)
- `DELETE /api/v1/users/:id` - Supprimer un utilisateur (Admin uniquement)

#### Profil utilisateur connecté
- `GET /api/v1/user/profile` - Récupérer son profil complet
- `PUT /api/v1/user/profile` - Modifier son profil (monolithique)

### API V2 (Recommandée)

#### Gestion des utilisateurs (Admin)
- `GET /api/v2/users` - Liste des utilisateurs (Admin uniquement)
- `POST /api/v2/users` - Créer un utilisateur (Admin uniquement)
- `GET /api/v2/users/:id` - Détails d'un utilisateur
- `PATCH /api/v2/users/:id` - Modifier un utilisateur (Admin uniquement)
- `DELETE /api/v2/users/:id` - Supprimer un utilisateur (Admin uniquement)

#### Profil utilisateur connecté
- `GET /api/v2/user/profile` - Récupérer son profil complet
- `PATCH /api/v2/user/profile/basic-info` - Modifier nom, prénom, email
- `PATCH /api/v2/user/profile/password` - Changer son mot de passe
- `PATCH /api/v2/user/profile/dietary-restrictions` - Configurer restrictions alimentaires
- `PATCH /api/v2/user/profile/notification-preferences` - Configurer notifications

## Améliorations apportées

### ✅ Doublons éliminés
- Suppression de `UserPreferences.notifications` (deprecated)
- Utilisation uniquement de `User.notificationSettings` avec interface typée

### ✅ DTOs spécialisés
- `UpdateBasicInfoDto` - Informations personnelles de base
- `ChangePasswordDto` - Changement de mot de passe sécurisé
- `UpdateDietaryRestrictionsDto` - Restrictions et préférences alimentaires
- `UpdateNotificationPreferencesDto` - Préférences de notification typées

### ✅ Validation renforcée
- Type-safety complet avec interfaces TypeScript
- Validation stricte avec class-validator
- Messages d'erreur spécifiques et contextuels

### ✅ Documentation améliorée
- Swagger complet avec exemples
- Descriptions détaillées des endpoints
- Codes de réponse spécifiques

## Sécurité

- ✅ Vérification du mot de passe actuel pour changement
- ✅ Validation d'unicité d'email
- ✅ Authentification JWT requise
- ✅ Validation des formats (heures, etc.)
- ✅ Limites sur les valeurs numériques

## Types de données

### Restrictions alimentaires
```typescript
enum DietaryRestriction {
  VEGAN = 'vegan',
  VEGETARIAN = 'vegetarian', 
  GLUTEN_FREE = 'gluten_free',
  DAIRY_FREE = 'dairy_free',
  NUT_FREE = 'nut_free'
}
```

### Préférences de notification
```typescript
interface NotificationSettings {
  pushNotificationsEnabled: boolean;
  stockExpirationEnabled: boolean;
  stockExpirationDays: number; // 1-14 jours
  recipeRecommendationsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // Format HH:MM
  // ... autres préférences
}
```