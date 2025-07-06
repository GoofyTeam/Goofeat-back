# Documentation de la Logique de Recherche

Ce document explique le fonctionnement interne de la recherche de recettes, de la requête initiale de l'utilisateur aux résultats personnalisés et scorés.

Le processus de recherche se déroule en deux grandes étapes :

1.  **Étape 1 : Filtrage (Trouver les recettes candidates)** - Elasticsearch sélectionne un ensemble de recettes pertinentes en se basant sur les mots-clés et les préférences de l'utilisateur.
2.  **Étape 2 : Scoring (Personnaliser et classer les résultats)** - Un script personnalisé (expliqué dans `SEARCH_SCORING.md`) est ensuite exécuté sur chaque recette candidate pour calculer un score de pertinence unique pour l'utilisateur.

## Étape 1 : Filtrage - Comment les recettes sont-elles trouvées ?

L'objectif de cette première étape est de construire une liste de recettes candidates qui correspondent aux critères de l'utilisateur. Pour cela, nous utilisons une requête `bool` qui combine plusieurs conditions.

### La Requête `bool`

Notre requête combine deux types de clauses :

- `must`: La condition est obligatoire.
- `should`: Au moins une de ces conditions doit être remplie pour que la clause `should` soit satisfaite.

1.  **Clause `must` : Correspondance sur le nom**

    - Nous utilisons une requête `match` sur le champ `name` de la recette.
    - Cela signifie que le nom de la recette **doit** correspondre au texte recherché par l'utilisateur (par ex., "pâtes").

2.  **Clause `should` : Préférences de catégories**
    - Si l'utilisateur a des catégories préférées (par ex., "Plat principal", "Pâtes"), nous ajoutons une requête `match` sur le champ `categories`.
    - Cette clause a un `boost` (actuellement de 2.0), ce qui signifie que les recettes correspondant à une catégorie préférée obtiendront un meilleur score de base.

Avec `minimum_should_match: 1`, une recette est considérée comme une candidate si elle remplit la condition `must` **ET** au moins une des conditions `should` (si des préférences de catégories existent).

### Analyseur de Langue (`analyzer: 'french'`)

Tous les champs textuels (`name`, `categories`) utilisent un analyseur de langue française. Cela permet une recherche "intelligente" qui gère les pluriels, les accents et ignore les mots courants sans importance.

## Étape 2 : Scoring - Comment le stock de l'utilisateur est-il utilisé ?

C'est seulement APRÈS qu'Elasticsearch a trouvé une liste de recettes candidates que le stock de l'utilisateur entre en jeu pour le classement final.

Pour chaque recette de cette liste, le script de scoring est exécuté (voir `SEARCH_SCORING.md` pour les détails du calcul).

### Le Lien entre le Stock et les Ingrédients : L'ID de Produit (`productId`)

Le lien crucial entre le stock de l'utilisateur et les ingrédients d'une recette est le `productId`.

1.  **Préparation des données :** Avant d'exécuter la recherche on prépare deux listes à partir du stock de l'utilisateur :

    - Une `Map` des produits que vous possédez, avec le `productId` comme clé (`params.stocks`).
    - Une `Map` des dates de péremption (DLC) de ces produits, également avec le `productId` comme clé (`params.dlcs`).

2.  **Comparaison dans le script :** Le script de scoring parcourt ensuite la liste des ingrédients de la recette. Pour chaque ingrédient, il récupère son `productId`.

3.  **La correspondance est une recherche par clé :** Le script effectue une vérification très simple et rapide : `params.stocks.containsKey(productId)`. Il vérifie si le `productId` de l'ingrédient de la recette existe comme clé dans la `Map` du stock de l'utilisateur.

**la correspondance entre le stock et les ingrédients est une correspondance exacte basée sur l'ID du produit**. Il n'y a pas de recherche partielle ou de "fuzzy matching" à ce niveau.
