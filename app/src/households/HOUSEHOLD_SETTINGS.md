# Configuration des Settings de Foyers

Ce document détaille les configurations **actuellement implémentées** pour le champ `settings` (JSONB) de l'entité `Household`.

## Format Général

```json
{
  "notifications": { ... },
  "childApproval": { ... }
}
```

## 1. Notifications Familiales

### Structure

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

### Valeurs par Défaut

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

### Exemples d'Usage

```json
// Famille avec notifications réduites
{
  "notifications": {
    "stockUpdates": false,
    "childActions": true,
    "expirationAlerts": true,
    "digestMode": "daily"
  }
}

// Colocation avec notifications minimales
{
  "notifications": {
    "stockUpdates": true,
    "childActions": false,
    "memberJoined": true,
    "digestMode": "weekly"
  }
}
```

## 2. Configuration d'Approbation des Enfants

### Structure

```json
{
  "childApproval": {
    "enabled": boolean,
    "autoExpireHours": number,
    "maxQuantityWithoutApproval": number
  }
}
```

### Valeurs par Défaut

```json
{
  "childApproval": {
    "enabled": true,
    "autoExpireHours": 24,
    "maxQuantityWithoutApproval": 1
  }
}
```

### Exemple Famille Stricte

```json
{
  "childApproval": {
    "enabled": true,
    "autoExpireHours": 12,
    "maxQuantityWithoutApproval": 0.5
  }
}
```

## Exemples Complets par Type de Foyer

### 🏠 Famille avec Enfants

```json
{
  "notifications": {
    "stockUpdates": true,
    "childActions": true,
    "expirationAlerts": true,
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

## Validation et Contraintes

### Champs Obligatoires

Aucun champ n'est obligatoire dans settings, les valeurs par défaut sont appliquées.

### Contraintes de Validation

- `autoExpireHours`: entre 1 et 168 heures (7 jours maximum)
- `maxQuantityWithoutApproval`: >= 0 (ne peut pas être négative)

### Évolution Future

Ce format peut être étendu sans migration de base de données grâce au type JSONB. Les nouvelles propriétés seront simplement ignorées par les anciennes versions de l'API.

## Utilisation dans le Code

```typescript
// Récupération des settings avec fallback
const notificationSettings = household.settings?.notifications || {
  stockUpdates: true,
  childActions: true,
  // ... autres défauts
};

// Mise à jour partielle
await householdService.updateSettings(householdId, {
  notifications: {
    digestMode: 'daily'
  }
});
```
