# Documentation du Scoring de Recherche Personnalisée

## Objectif

Le but de ce système est de fournir des résultats de recherche de recettes qui sont personnalisés pour chaque utilisateur en fonction du contenu de leur stock alimentaire. Le score de chaque recette reflète sa pertinence pour l'utilisateur, en privilégiant les recettes pour lesquelles l'utilisateur possède déjà la plupart des ingrédients, et en particulier ceux qui sont proches de leur date de péremption.

## Le Script de Scoring (Painless)

Le calcul du score est effectué directement dans Elasticsearch à l'aide d'un script écrit en langage "Painless". Ce script est exécuté pour chaque recette qui correspond aux critères de recherche de base (par exemple, le nom de la recette).

### Paramètres Modifiables (Poids)

Le cœur de la personnalisation réside dans un ensemble de "poids" que vous pouvez ajuster pour modifier l'importance de chaque facteur dans le calcul du score final. Ces poids sont définis dans le fichier `src/common/elasticsearch/elasticsearch.service.ts`, dans la méthode `searchRelevantRecipes`.

```typescript
// Fichier: src/common/elasticsearch/elasticsearch.service.ts

script: {
  source: scriptSource,
  params: {
    // ... autres paramètres
    weights: {
      quantityWeight: 1.5,
      dlcWeight: 2.0,
      availabilityWeight: 5.0,
    },
  },
},
```

- `quantityWeight` (Poids de la Quantité) : Un score de base ajouté pour chaque ingrédient que l'utilisateur possède.
- `dlcWeight` (Poids de la DLC) : Un bonus pour les produits dont la date de péremption est proche. Plus la date est proche, plus le bonus est élevé.
- `availabilityWeight` (Poids de la Disponibilité) : Un multiplicateur basé sur le pourcentage total d'ingrédients que l'utilisateur possède pour la recette.

## Calcul du Score en Détail

Le score final d'une recette est la somme de plusieurs composantes, calculées pour chaque ingrédient de la recette.

### 1. Boucle sur les Ingrédients

Le script parcourt chaque ingrédient de la recette. Pour qu'un ingrédient contribue au score, l'utilisateur doit le posséder dans son stock (la correspondance se fait via le `productId`).

### 2. Score de Quantité (`quantityWeight`)

Si un ingrédient requis est présent dans le stock de l'utilisateur, un score de base est immédiatement ajouté au score total.

- **Calcul :** `totalScore += quantityWeight`
- **Exemple :** Si `quantityWeight` est `1.5`, chaque ingrédient que vous possédez ajoute 1.5 au score.

### 3. Score de Proximité de la DLC (`dlcWeight`)

Si un ingrédient possédé a une date de péremption (DLC) dans les 7 prochains jours, un score bonus est ajouté. Ce bonus est plus élevé si la date est très proche.

- **Calcul :** `totalScore += dlcWeight * (1.0f - (float)joursRestants / 7.0f)`
- **Exemple :**
    - Un produit périmant aujourd'hui (0 jours restants) obtient un bonus de `dlcWeight * 1.0`.
    - Un produit périmant dans 3 jours obtient un bonus de `dlcWeight * (1.0 - 3.0/7.0)`.
    - Un produit périmant dans 7 jours obtient un bonus de `dlcWeight * 0.0`.

### 4. Score de Disponibilité (`availabilityWeight`)

Après avoir examiné tous les ingrédients, le script calcule le "ratio de disponibilité" : le pourcentage d'ingrédients de la recette que l'utilisateur possède.

- **Calcul du Ratio :** `availabilityRatio = (nombre d'ingrédients possédés) / (nombre total d'ingrédients requis)`
- Ce ratio est ensuite multiplié par le poids de la disponibilité et ajouté au score total.
- **Calcul du Score de Disponibilité :** `totalScore += availabilityRatio * availabilityWeight`
- **Exemple :** Si vous avez 4 des 8 ingrédients d'une recette, le ratio est de 0.5. Le score de disponibilité ajouté sera de `0.5 * availabilityWeight`. C'est un facteur très influent qui récompense fortement les recettes que vous pouvez presque entièrement réaliser.

## Score Final

Le score final est la somme de tous les scores de quantité, de tous les bonus DLC, et du score final de disponibilité.

`Score Final = Σ(scores de quantité) + Σ(bonus DLC) + score de disponibilité`

Ce système permet une grande flexibilité. En ajustant les trois poids, vous pouvez complètement changer le comportement de la recherche pour qu'elle corresponde mieux aux objectifs de votre application (par exemple, privilégier la lutte contre le gaspillage en augmentant `dlcWeight`, ou la commodité en augmentant `availabilityWeight`).