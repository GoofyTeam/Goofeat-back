# Système d'Import Spoonacular

Ce module permet d'importer des recettes depuis l'API Spoonacular avec un système de mapping intelligent des ingrédients vers la base OpenFoodFacts.

## 🚀 Configuration

### Variables d'environnement requises

Ajoutez dans votre `.env` :

```bash
# Clé API Spoonacular (https://spoonacular.com/food-api)
SPOONACULAR_API_KEY=your_api_key_here
```

### Extensions PostgreSQL

Pour le fuzzy matching, assurez-vous que l'extension `pg_trgm` est activée :

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## 📊 Architecture

### Entités

- **Recipe** : Étendue avec des métadonnées de traçabilité

  - `externalId` : ID Spoonacular original
  - `externalSource` : Source de la recette
  - `completenessScore` : % d'ingrédients mappés
  - `isComplete` : Recette complète ou non
  - `missingIngredients` : Ingrédients non mappés
  - `externalData` : Données brutes Spoonacular

- **SpoonacularIngredientMapping** : Cache des mappings ingrédients
  - Mapping entre IDs Spoonacular et ingrédients OpenFoodFacts
  - Score de confiance et type de mapping
  - Statistiques d'utilisation

### Services

- **SpoonacularMappingService** : Logique de mapping intelligent
- **SpoonacularRecipesSeedService** : Import et traitement des recettes

## 🛠️ Utilisation

### Import de recettes via CLI

```bash
# Import basique (500 recettes max, 60% complétude min)
yarn nest start --exec="seed:spoonacular:recipes"

# Import avec options personnalisées
yarn nest start --exec="seed:spoonacular:recipes --max-recipes 1000 --min-completeness-score 70 --complete-threshold 85"

# Filtrer par cuisine
yarn nest start --exec="seed:spoonacular:recipes --cuisine italian --max-recipes 200"

# Filtrer par régime alimentaire
yarn nest start --exec="seed:spoonacular:recipes --diet vegetarian --max-recipes 300"

# Mode test (pas de sauvegarde)
yarn nest start --exec="seed:spoonacular:recipes --dry-run"
```

### Options disponibles

| Option                     | Description                     | Défaut |
| -------------------------- | ------------------------------- | ------ |
| `--batch-size`             | Recettes par batch              | 50     |
| `--max-recipes`            | Nombre max de recettes          | 500    |
| `--min-completeness-score` | Score min requis (%)            | 60     |
| `--complete-threshold`     | Seuil "complet" (%)             | 80     |
| `--cuisine`                | Type de cuisine                 | -      |
| `--diet`                   | Régime alimentaire              | -      |
| `--include-nutrition`      | Inclure données nutritionnelles | false  |
| `--dry-run`                | Mode test sans sauvegarde       | false  |

### Test du système de mapping

```bash
# Tester le mapping sur des ingrédients de test
yarn ts-node src/common/external-apis/scripts/test-spoonacular-mapping.ts
```

## 🎯 Système de Mapping Intelligent

### Stratégie de matching

1. **Cache** : Vérification des mappings existants
2. **Match exact** : Correspondance directe par nom (FR/EN)
3. **Fuzzy matching** : Similarité textuelle (score > 80%)
4. **Fallback** : Skip l'ingrédient si non mappable

### Types de mapping

- `exact_match` : Correspondance parfaite
- `fuzzy_match` : Correspondance approximative
- `manual` : Mapping créé manuellement
- `synonym` : Mapping par synonyme
- `cached` : Récupéré depuis le cache

### Normalisation des noms

Le système normalise automatiquement les noms d'ingrédients :

- Suppression des mots parasites (`fresh`, `dried`, `chopped`, etc.)
- Suppression des quantités et unités
- Normalisation des caractères spéciaux

## 📈 Administration

### API Admin disponible

```http
GET /admin/spoonacular/mappings/stats
GET /admin/spoonacular/mappings/unvalidated
POST /admin/spoonacular/mappings/manual
PATCH /admin/spoonacular/mappings/:id/validate
```

### Statistiques de mapping

- Nombre total de mappings
- Mappings validés vs automatiques
- Score de confiance moyen
- Répartition par type de mapping

### Validation manuelle

Interface pour :

- Réviser les mappings automatiques
- Créer des mappings manuels
- Valider les correspondances douteuses

## 🔄 Workflow d'import

1. **Récupération** : API Spoonacular par batches
2. **Déduplication** : Vérification des recettes existantes
3. **Mapping ingrédients** : Correspondance intelligente
4. **Scoring** : Calcul du score de complétude
5. **Filtrage** : Application des seuils configurés
6. **Sauvegarde** : Création des entités Recipe + RecipeIngredient
7. **Indexation** : Ajout à Elasticsearch via event

## 📊 Métriques de qualité

### Score de complétude

```
completenessScore = (ingrédients mappés / total ingrédients) * 100
```

### Seuils par défaut

- **Minimum** : 60% (recettes avec moins sont rejetées)
- **Complet** : 80% (marquées comme `isComplete = true`)

### Traçabilité

Chaque recette importée conserve :

- ID Spoonacular original
- Données brutes de l'API
- Liste des ingrédients non mappés
- Score de complétude exact

## 🐛 Debug et troubleshooting

### Logs détaillés

Les services loggent :

- Statistiques par batch
- Ingrédients non mappés
- Erreurs de mapping
- Performance API

### Ingrédients manqués

Le système collecte automatiquement :

- Liste des ingrédients Spoonacular non mappés
- Fréquence d'apparition
- Suggestions de mappings à créer

### Monitoring

- Taux de succès par batch
- Score moyen de complétude
- Performance des appels API
- Erreurs et timeouts

## 🎨 Exemples d'utilisation

### Import ciblé par cuisine

```bash
# Recettes italiennes complètes
yarn nest start --exec="seed:spoonacular:recipes --cuisine italian --min-completeness-score 85 --max-recipes 200"
```

### Import végétarien de qualité

```bash
# Recettes végétariennes avec données nutritionnelles
yarn nest start --exec="seed:spoonacular:recipes --diet vegetarian --include-nutrition --complete-threshold 90 --max-recipes 150"
```

### Test sur petit échantillon

```bash
# Test avec 20 recettes seulement
yarn nest start --exec="seed:spoonacular:recipes --max-recipes 20 --batch-size 10"
```
