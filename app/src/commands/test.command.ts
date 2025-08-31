/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command, CommandRunner } from 'nest-commander';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { Unit } from 'src/common/units/unit.enums';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { ProductService } from 'src/products/product.service';
import { Stock } from 'src/stocks/entities/stock.entity';
import { UserPreferences } from 'src/users/interfaces/user-preferences.interface';
import { In, Repository } from 'typeorm';

@Injectable()
@Command({
  name: 'test:search',
  description: 'Test recipe search functionality',
})
export class TestSearchCommand extends CommandRunner {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('--- Démarrage du script de test de recherche ---');

    try {
      // 1. Créer un stock utilisateur fictif
      console.log('Récupération des ingrédients pour le stock fictif...');

      // Récupérer quelques recettes directement depuis Elasticsearch
      const sampleRecipes = await this.elasticsearchService['client'].search({
        index: 'recipes',
        query: { match_all: {} },
        size: 3,
      });

      if (sampleRecipes.hits.hits.length === 0) {
        throw new Error(
          'Aucune recette trouvée dans Elasticsearch pour créer le stock fictif',
        );
      }

      // Extraire les ingrédients des recettes trouvées
      const allIngredientIds = new Set<string>();
      sampleRecipes.hits.hits.forEach((hit) => {
        const recipe = hit._source as any;
        if (recipe.ingredients) {
          recipe.ingredients.forEach((ing: any) => {
            if (ing.productId) {
              allIngredientIds.add(ing.id);
            }
          });
        }
      });

      const ingredientIds = Array.from(allIngredientIds).slice(0, 6); // Prendre 6 ingrédients max

      const ingredients = await this.ingredientRepository.find({
        where: { id: In(ingredientIds) },
        relations: ['products'],
      });

      console.log(
        `Stock créé avec ${ingredients.length} ingrédients réels issus des recettes Elasticsearch`,
      );

      const today = new Date();
      const dlcProche = new Date();
      dlcProche.setDate(today.getDate() + 3); // DLC dans 3 jours

      const userStocks: Stock[] = ingredients
        .map((ing) => {
          if (!ing.products || ing.products.length === 0) {
            console.warn(
              `L'ingrédient "${ing.name}" n'a pas de produit associé et sera ignoré.`,
            );
            return null;
          }
          const stock = new Stock();
          stock.product = ing.products[0];
          stock.quantity = 200;
          stock.unit = Unit.G;
          // Mettre une DLC proche pour le premier ingrédient (test anti-gaspi)
          stock.dlc =
            ingredients.indexOf(ing) === 0
              ? dlcProche
              : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
          return stock;
        })
        .filter((stock): stock is Stock => stock !== null);

      console.log(
        'Stock utilisateur créé:',
        userStocks.map((s) => ({
          name: s.product.name,
          dlc: s.dlc.toISOString().split('T')[0],
          quantity: s.quantity,
          unit: s.unit,
        })),
      );

      // 2. Définir les préférences utilisateur
      const userPreferences: UserPreferences = {
        allergenes: [],
        preferredCategories: ['Plat principal', 'Pâtes'],
        dietaryRestrictions: [],
      };
      console.log('Préférences utilisateur:', userPreferences);

      // 3. Test simple d'abord - compter les recettes dans Elasticsearch
      console.log('--- Test de base : comptage des recettes ---');
      const recipeCount = await this.elasticsearchService.countRecipes();
      console.log(`Total de recettes dans Elasticsearch: ${recipeCount}`);

      if (recipeCount === 0) {
        console.log(
          '❌ Aucune recette dans Elasticsearch - Impossible de tester',
        );
        return;
      }

      // 4. Test simple sans scoring complexe - juste chercher des recettes
      console.log('--- Test de recherche simple ---');
      try {
        // Chercher toutes les recettes d'abord
        const allRecipes = await this.elasticsearchService['client'].search({
          index: 'recipes',
          query: { match_all: {} },
          size: 5,
        });

        console.log(
          `Recettes trouvées (échantillon): ${allRecipes.hits.hits.length}`,
        );
        allRecipes.hits.hits.forEach((hit, index) => {
          const recipe = hit._source as any;
          console.log(
            `${index + 1}. ${recipe.name} - ${recipe.ingredients?.length || 0} ingrédients`,
          );
        });
      } catch (searchError) {
        console.error('Erreur dans la recherche simple:', searchError);
      }

      // 5. Maintenant on peut tester la suggestion avec des ingrédients réalistes
      if (userStocks.length > 0) {
        console.log('--- Test avec les vrais ingrédients du stock ---');
        console.log(
          'Ingrédients du stock créé:',
          userStocks.map((s) => s.product.name).join(', '),
        );
      }
    } catch (error) {
      // Type guard for Elasticsearch errors
      if (
        typeof error === 'object' &&
        error !== null &&
        'meta' in error &&
        error.meta?.body
      ) {
        console.error(
          'Le script de test a échoué (Elasticsearch error):',
          JSON.stringify(error.meta.body, null, 2),
        );
      } else {
        console.error('Le script de test a échoué:', error);
      }
    }

    console.log('\n--- Script de test terminé ---');
  }
}

@Injectable()
@Command({
  name: 'test:discover',
  description: 'Test recipe discovery features',
})
export class TestDiscoverCommand extends CommandRunner {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('--- Démarrage du script de test de découverte ---');

    // Attendre que les événements d'indexation se propagent
    console.log("--- Attente de 2 secondes pour l'indexation... ---");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      // 1. Créer un stock utilisateur fictif avec de vrais ingrédients
      console.log('Récupération de recettes pour créer un stock réaliste...');

      // Récupérer des recettes directement depuis Elasticsearch
      const sampleRecipes = await this.elasticsearchService['client'].search({
        index: 'recipes',
        query: { match_all: {} },
        size: 3,
      });

      if (sampleRecipes.hits.hits.length === 0) {
        throw new Error(
          'Aucune recette trouvée dans Elasticsearch pour créer le stock fictif',
        );
      }

      // Extraire les ingrédients des premières recettes
      const allIngredientIds = new Set<string>();
      sampleRecipes.hits.hits.slice(0, 2).forEach((hit) => {
        const recipe = hit._source as any;
        if (recipe.ingredients) {
          recipe.ingredients.forEach((ing: any) => {
            if (ing.productId) {
              allIngredientIds.add(ing.id);
            }
          });
        }
      });

      const ingredientIds = Array.from(allIngredientIds).slice(0, 6);
      const ingredients = await this.ingredientRepository.find({
        where: { id: In(ingredientIds) },
        relations: ['products'],
      });

      console.log(
        `Stock créé avec ${ingredients.length} ingrédients réels pour le test de découverte`,
      );

      const userStocks: Stock[] = ingredients
        .map((ingredient) => {
          if (!ingredient.products || ingredient.products.length === 0) {
            console.warn(
              `L'ingrédient ${ingredient.name} n'a pas de produit associé.`,
            );
            return null;
          }
          const stock = new Stock();
          stock.product = ingredient.products[0];
          stock.quantity = 200; // Quantité généreuse pour couvrir les besoins
          stock.unit = Unit.G;
          stock.dlc = new Date();
          stock.dlc.setDate(stock.dlc.getDate() + 7); // DLC dans une semaine
          // Simuler un ID pour la logique qui pourrait en dépendre
          stock.id = Math.random().toString(36).substring(2);
          return stock;
        })
        .filter((stock): stock is Stock => stock !== null);

      console.log(
        'Stock utilisateur créé:',
        userStocks.map((s) => ({
          name: s.product.name,
          dlc: s.dlc.toISOString().split('T')[0],
          quantity: s.quantity,
          unit: s.unit,
        })),
      );

      // 2. Définir les préférences utilisateur
      const userPreferences: UserPreferences = {
        allergenes: ['Gluten'], // Exclure les recettes avec du gluten
        preferredCategories: ['Plat principal', 'Rapide'], // Préférer ces catégories
        dietaryRestrictions: [],
      };
      console.log('Préférences utilisateur:', userPreferences);

      // 3. Lancer la recherche/découverte
      console.log('--- Lancement de la recherche/découverte de recettes ---');
      const searchResults = await this.elasticsearchService.discoverRecipes(
        userPreferences,
        userStocks,
      );

      // 4. Afficher les résultats
      console.log(`\n--- Résultats de la découverte ---`);
      if (searchResults.results.length > 0) {
        console.log(`Total de recettes trouvées: ${searchResults.total}`);
        searchResults.results.forEach((recipe) => {
          console.log(
            `- ${recipe.name} (Score: ${recipe.score.toFixed(2)}) - Ingrédients: ${recipe.ingredients.map((i) => i.name).join(', ')}`,
          );
        });
      } else {
        console.log('Aucune recette suggérée.');
      }
    } catch (error) {
      const errorMessage = error.meta?.body
        ? JSON.stringify(error.meta.body, null, 2)
        : error;
      console.error('Le script de test a échoué:', errorMessage);
    }

    console.log('\n--- Script de test de découverte terminé ---');
  }
}

@Injectable()
@Command({
  name: 'test:packaging',
  description: 'Test packaging analysis',
})
export class TestPackagingCommand extends CommandRunner {
  constructor(private readonly elasticsearchService: ElasticsearchService) {
    super();
  }

  async run(): Promise<void> {
    console.log("--- Test d'analyse de packaging OpenFoodFacts ---");

    // Test de différents formats de packaging
    const testCases = [
      '1 l', // Simple
      '6 x 1 l', // Pack multiple
      '4 × 250 ml', // Pack avec symbole différent
      '12 x 33 cl', // Pack de canettes
      'Pack de 6 bouteilles 1L', // Format texte
      '500 g', // Masse simple
      '2 x 125 g', // Pack de masse
    ];

    console.log("Tests d'analyse de packaging:");

    // Import du service d'analyse (service non injecté car pas dans un module)
    const { OpenFoodFactsAnalyzerService } = await import(
      'src/common/units/openfoodfacts-analyzer.service'
    );
    const analyzer = new OpenFoodFactsAnalyzerService();

    for (const testCase of testCases) {
      console.log(`\n📦 Test: "${testCase}"`);

      try {
        const result = analyzer.analyzeQuantity(testCase);

        if (result) {
          console.log(`✅ Analysé:`, {
            totalQuantity: result.totalQuantity,
            totalUnit: result.totalUnit,
            isMultipack: result.isMultipack,
            ...(result.isMultipack && {
              packagingSize: result.packagingSize,
              unitSize: result.unitSize,
            }),
          });
        } else {
          console.log('❌ Impossible à analyser');
        }
      } catch (error) {
        console.error('❌ Erreur:', error.message);
      }
    }

    // Test avec des données OpenFoodFacts simulées
    console.log('\n--- Test avec produit OpenFoodFacts simulé ---');

    const mockProduct = {
      quantity: '6 x 1 l',
      product_quantity: '6',
      net_weight: '6000 ml',
    };

    try {
      const result = analyzer.analyzeOpenFoodFactsProduct(mockProduct);
      if (result) {
        console.log('✅ Produit OFF analysé:', {
          totalQuantity: result.totalQuantity,
          totalUnit: result.totalUnit,
          isMultipack: result.isMultipack,
          packagingSize: result.packagingSize,
          unitSize: result.unitSize,
        });
      } else {
        console.log('❌ Produit OFF non analysable');
      }
    } catch (error) {
      console.error('❌ Erreur analyse OFF:', error.message);
    }

    console.log("\n--- Test d'analyse de packaging terminé ---");
  }
}

@Injectable()
@Command({
  name: 'test:barcode',
  description: 'Test barcode scanning with taxonomy matching debug',
})
export class TestBarcodeCommand extends CommandRunner {
  constructor(
    private readonly productService: ProductService,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('--- Test de scan de code-barres avec debug taxonomie ---');

    const testBarcode = '3274080005003'; // Bouteille d'eau
    console.log(`🔍 Test du code-barres: ${testBarcode}`);

    try {
      // 1. Vérifier les ingrédients existants avec les catégories OFF attendues
      console.log('\n--- Vérification des ingrédients disponibles ---');
      const waterCategories = [
        'en:beverages',
        'en:waters',
        'en:spring-waters',
        'en:mineral-waters',
        'en:natural-mineral-waters',
        'en:beverages-and-beverages-preparations',
        'en:unsweetened-beverages',
      ];

      for (const category of waterCategories) {
        const ingredient = await this.ingredientRepository.findOne({
          where: { offTag: category },
        });
        if (ingredient) {
          console.log(`✅ Trouvé: ${category} → ${ingredient.name}`);
        } else {
          console.log(`❌ Absent: ${category}`);
        }
      }

      // 2. Test du scan du code-barres
      console.log(`\n--- Scan du code-barres ${testBarcode} ---`);
      const product = await this.productService.createFromBarcode(testBarcode);

      if (!product) {
        console.log('❌ Aucun produit retourné');
        return;
      }

      console.log('\n--- Résultat du scan ---');
      console.log(`Produit: ${product.name}`);
      console.log(`Code: ${product.code}`);
      console.log(`Taille packaging: ${product.packagingSize}`);
      console.log(`Taille unitaire: ${product.unitSize}`);
      console.log(`Unité par défaut: ${product.defaultUnit}`);
      console.log(`Ingrédients liés: ${product.ingredients?.length || 0}`);

      if (product.ingredients && product.ingredients.length > 0) {
        console.log('🎯 Ingrédients trouvés:');
        product.ingredients.forEach((ing) => {
          console.log(`  - ${ing.name} (${ing.offTag})`);
        });
      } else {
        console.log('❌ Aucun ingrédient lié au produit');
      }
    } catch (error) {
      console.error('❌ Erreur lors du test:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }

    console.log('\n--- Test de code-barres terminé ---');
  }
}
