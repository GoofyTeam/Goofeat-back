# API des Stocks - Documentation

## Vue d'ensemble

Le système de gestion des stocks est simplifié avec un contrôleur unique intelligent qui gère automatiquement les foyers.

### 1. API Stocks Unifiée (`/stocks`)
- **POST `/stocks`** - Créer un stock (auto-détection du foyer)
- **POST `/stocks/bulk`** - Créer plusieurs stocks (auto-détection du foyer)
- **GET `/stocks`** - Récupérer tous les stocks accessibles
- **GET `/stocks/:id`** - Détails d'un stock
- **PATCH `/stocks/:id`** - Modifier un stock  
- **DELETE `/stocks/:id`** - Supprimer un stock

### 2. Actions Rapides Enfants (`/stocks/child`)
- **POST `/stocks/child/action/:householdId`** - Action rapide d'un enfant
- **POST `/stocks/child/quick-consume`** - Consommation rapide
- **GET `/stocks/child/pending/:householdId`** - Actions en attente d'approbation
- **PATCH `/stocks/child/pending/:actionId/approve`** - Approuver/Rejeter une action

## Logique d'Auto-détection des Foyers

### Création de stocks
- Si `householdId` est spécifié : utilise ce foyer (après vérification des permissions)
- Si `householdId` n'est **PAS** spécifié :
  - **1 seul foyer** → Utilise automatiquement ce foyer
  - **0 foyer** → Erreur "Vous devez être membre d'au moins un foyer"
  - **Plusieurs foyers** → Erreur "Veuillez spécifier householdId"

### Consultation des stocks
- **Sans `householdId`** : Retourne les stocks de TOUS mes foyers
- **Avec `householdId`** : Filtre par ce foyer uniquement

## Règles métier

### Stocks de foyer (tous les stocks)
- Tous les stocks appartiennent à un foyer (plus de stocks "personnels")
- Partagés entre tous les membres du foyer
- Permissions basées sur le rôle dans le foyer :
  - `ADMIN` : Tous les droits
  - `PARENT` : Peut créer/modifier/supprimer
  - `MEMBER` : Dépend de `canEditStock`
  - `CHILD` : Actions soumises à approbation

### Isolation des données
- Un utilisateur ne peut voir que les stocks des foyers dont il est membre
- Les actions sur les stocks vérifient toujours l'appartenance au foyer

## Exemples d'utilisation

### Créer un stock (auto-détection)
```http
POST /stocks
{
  "productId": "uuid",
  "quantity": 2,
  "unit": "kg", 
  "dlc": "2024-12-31"
}
```
→ Si vous avez 1 seul foyer, il sera utilisé automatiquement

### Créer un stock dans un foyer spécifique
```http
POST /stocks
{
  "productId": "uuid",
  "householdId": "123-abc",
  "quantity": 5,
  "unit": "piece",
  "dlc": "2024-12-31"
}
```

### Voir tous mes stocks
```http
GET /stocks
```
→ Retourne les stocks de tous mes foyers

### Voir les stocks d'un foyer spécifique
```http
GET /stocks?householdId=123-abc
```

## Gestion des permissions

Le système vérifie automatiquement :
1. L'appartenance au foyer
2. Les permissions du membre (`canEditStock`)
3. Le rôle de l'utilisateur (ADMIN, PARENT, MEMBER, CHILD)
4. Pour les enfants : création d'actions en attente si `needsApproval = true`

## Traçabilité

Chaque stock de foyer conserve :
- `addedByMemberId` : Membre qui a créé le stock
- `lastUpdatedByMemberId` : Dernier membre ayant modifié le stock

Ces informations permettent de suivre qui fait quoi dans le foyer.