# Documentation du Scoring de Recherche

## Objectif

Notre objectif est de proposer à l'utilisateur les recettes les plus pertinentes en fonction de ce qu'il a dans son frigo. Le score de chaque recette est calculé pour mettre en avant celles qui utilisent des ingrédients que l'utilisateur possède déjà, en donnant une priorité aux produits proches de leur date de péremption pour lutter contre le gaspillage.

## Comment ça marche ?

Le calcul du score est réalisé par Elasticsearch au moment de la recherche, en utilisant une `function_score`. Cette approche nous permet de moduler le score de base d'une recette (sa pertinence par rapport au mot-clé cherché) en y ajoutant des bonus basés sur des critères personnalisés.

Nous utilisons deux fonctions de script principales, chacune avec son propre poids pour ajuster son influence sur le score final.

### Les Poids : Le Cœur du Réglage

Vous pouvez ajuster l'importance de chaque critère en modifiant les poids directement dans le code, au sein du fichier `src/common/elasticsearch/elasticsearch.service.ts`.

```typescript
// Fichier: src/common/elasticsearch/elasticsearch.service.ts

functions: [
  {
    script_score: { /* ... script DLC ... */ },
    weight: 2.0, // Poids pour le score de péremption (DLC)
  },
  {
    script_score: { /* ... script Disponibilité ... */ },
    weight: 1.5, // Poids pour le score de disponibilité
  },
],
```

-   `weight: 2.0` (Score de Péremption) : Donne un bonus significatif aux recettes utilisant des produits qui vont bientôt périmer.
-   `weight: 1.5` (Score de Disponibilité) : Augmente le score des recettes pour lesquelles l'utilisateur possède déjà beaucoup d'ingrédients.

## Calcul du Score en Détail

Le score final est le résultat d'une multiplication : `Score de la recherche initiale * (Somme des scores des fonctions)`.

### 1. Score de Péremption (DLC) - `weight: 2.0`

Cette fonction a pour but de promouvoir les recettes "anti-gaspi".

-   **Pour qui ?** Uniquement pour les ingrédients que l'utilisateur possède et dont la date de péremption est dans moins de 7 jours.
-   **Calcul :** Le score est basé sur une formule qui combine l'urgence (plus la date est proche, plus le score est haut) et la quantité en stock (via un logarithme, pour modérer l'effet des très grandes quantités).
    -   `Urgence = (7 - jours restants) / 7`
    -   `Bonus = Urgence * log(1 + quantité)`
-   Le score final de cette fonction est la somme des bonus de tous les ingrédients concernés.

### 2. Score de Disponibilité - `weight: 1.5`

Cette fonction mesure à quel point une recette est "faisable" avec le stock actuel de l'utilisateur.

-   **Calcul :** C'est un simple ratio.
    -   `Ratio = (Nombre d'ingrédients que j'ai) / (Nombre total d'ingrédients dans la recette)`
-   **Exemple :** Si j'ai 3 des 4 ingrédients d'une recette, le score de cette fonction sera de 0.75. Si je les ai tous, le score sera de 1.0.
