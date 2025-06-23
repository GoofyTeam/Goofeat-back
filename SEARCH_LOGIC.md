# Documentation de la Logique de Recherche Elasticsearch

Ce document explique le fonctionnement interne de la recherche de recettes, de la requête initiale de l'utilisateur aux résultats personnalisés et scorés.

Le processus de recherche se déroule en deux grandes étapes :

1.  **Étape 1 : Filtrage (Trouver les recettes candidates)** - Elasticsearch sélectionne un ensemble de recettes pertinentes en se basant sur les mots-clés de l'utilisateur.
2.  **Étape 2 : Scoring (Personnaliser et classer les résultats)** - Un script personnalisé (expliqué dans `SEARCH_SCORING.md`) est ensuite exécuté sur chaque recette candidate pour calculer un score de pertinence unique pour l'utilisateur.

## Étape 1 : Filtrage - Comment les recettes sont-elles trouvées ?

L'objectif de cette première étape n'est PAS de trouver des recettes basées sur les ingrédients que vous possédez. Il s'agit de trouver des recettes qui correspondent à la recherche textuelle de l'utilisateur (par exemple, "poulet", "pâtes", "salade").

### La Requête `multi_match`

Nous utilisons une requête `multi_match` dans Elasticsearch. Cela signifie que lorsque l'utilisateur tape "pâtes", nous cherchons ce terme dans plusieurs champs de nos documents de recette, principalement :

-   `name` (le nom de la recette)
-   `description` (la description)
-   `ingredients.name` (le nom des ingrédients)

### Analyseur de Langue (`analyzer: 'french'`)

La recherche n'est pas une simple comparaison de texte. Elasticsearch utilise un analyseur de langue française. Cela lui permet de comprendre les variations d'un mot. Par exemple :

-   Une recherche pour "tomate" trouvera aussi bien "tomates".
-   Il ignore les mots courants sans importance (comme "le", "la", "de").
-   Il gère les accents.

**La recherche textuelle est donc une recherche "intelligente" et partielle, mais elle ne concerne que le texte.**

## Étape 2 : Scoring - Comment le stock de l'utilisateur est-il utilisé ?

C'est seulement APRÈS qu'Elasticsearch a trouvé une liste de recettes candidates (par exemple, toutes les recettes contenant le mot "pâtes") que le stock de l'utilisateur entre en jeu.

Pour chaque recette de cette liste, le script de scoring est exécuté.

### Le Lien entre le Stock et les Ingrédients : L'ID de Produit (`productId`)

Le lien crucial entre le stock de l'utilisateur et les ingrédients d'une recette est le `productId`.

1.  **Préparation des données :** Avant d'exécuter la recherche, votre service NestJS prépare deux listes à partir du stock de l'utilisateur :
    *   Une `Map` des produits que vous possédez, avec le `productId` comme clé (`params.stocks`).
    *   Une `Map` des dates de péremption (DLC) de ces produits, également avec le `productId` comme clé (`params.dlcs`).

2.  **Comparaison dans le script :** Le script de scoring parcourt ensuite la liste des ingrédients de la recette (qui est stockée dans le document Elasticsearch). Pour chaque ingrédient, il récupère son `productId`.

3.  **La correspondance est une recherche par clé :** Le script effectue une vérification très simple et rapide : `params.stocks.containsKey(productId)`.
    *   Il vérifie si le `productId` de l'ingrédient de la recette existe comme clé dans la `Map` du stock de l'utilisateur.

### Une Correspondance Exacte par ID

Il est très important de comprendre que **la correspondance entre le stock et les ingrédients est une correspondance exacte basée sur l'ID du produit**. Il n'y a pas de recherche partielle, de recherche par nom ou de "fuzzy matching" à ce niveau.

-   **Si le `productId` de l'ingrédient de la recette est `12345` :** Le script vérifie si la clé `12345` existe dans la `Map` du stock.
-   **Si le `productId` est manquant ou vide :** L'ingrédient est ignoré par le script de scoring.

## Résumé du Flux

1.  **Utilisateur cherche :** "tarte aux pommes"
2.  **ES - Étape 1 (Filtrage) :**
    - Utilise `multi_match` et l'analyseur français.
    - Trouve toutes les recettes contenant "tarte", "tartes", "pomme", ou "pommes" dans leur nom, description, etc.
    - Résultat : Une liste de 10 recettes candidates.
3.  **ES - Étape 2 (Scoring) :**
    - Pour chacune des 10 recettes :
        - Exécute le script de scoring personnalisé.
        - Le script reçoit en paramètre le stock de l'utilisateur (sous forme de `Map` avec `productId` comme clé).
        - Le script parcourt les ingrédients de la recette et vérifie, pour chaque `productId`, s'il existe dans la `Map` du stock.
        - Il calcule un score basé sur la disponibilité, la quantité et la DLC.
4.  **Résultat Final :** Les 10 recettes sont renvoyées à l'utilisateur, triées par ce score personnalisé, du plus élevé au plus bas.