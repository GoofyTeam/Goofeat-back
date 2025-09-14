/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command, CommandRunner, Option } from 'nest-commander';
import { AuthService } from 'src/auth/auth.service';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { IngredientMatcherHelper } from 'src/common/helpers/ingredient-matcher.helper';
import { Unit } from 'src/common/units/unit.enums';
import { HouseholdService } from 'src/households/household.service';
import { CreateHouseholdDto } from 'src/households/dto/create-household.dto';
import { HouseholdType } from 'src/households/enums/household-type.enum';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { IngredientsService } from 'src/ingredients/ingredients.service';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { Product } from 'src/products/entities/product.entity';
import { ProductService } from 'src/products/product.service';
import { CreateStockDto } from 'src/stocks/dto/create-stock.dto';
import { Stock } from 'src/stocks/entities/stock.entity';
import { StockService } from 'src/stocks/stock.service';
import { UserPreferences } from 'src/users/interfaces/user-preferences.interface';
import { UsersService } from 'src/users/users.service';
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
        relations: ['products', 'products.ingredients'],
      });

      console.log(
        `Stock créé avec ${ingredients.length} ingrédients réels issus des recettes Elasticsearch`,
      );

      const today = new Date();
      const dlcProche = new Date();
      dlcProche.setDate(today.getDate() + 3); // DLC dans 3 jours

      // Create mock products with ingredient relations for testing
      const userStocks: Stock[] = ingredients.map((ing) => {
        // Create a mock product for this ingredient
        const mockProduct = new Product();
        mockProduct.id = `test-product-${Math.random().toString(36).substring(2)}`;
        mockProduct.name = `Produit test ${ing.name}`;
        mockProduct.defaultUnit = Unit.G;
        mockProduct.unitSize = 100;
        mockProduct.defaultDlcTime = '7 days';

        // Link the ingredient to the product
        mockProduct.ingredients = [ing];

        const stock = new Stock();
        stock.product = mockProduct;
        stock.quantity = 200;
        stock.unit = Unit.G;
        // Mettre une DLC proche pour le premier ingrédient (test anti-gaspi)
        stock.dlc =
          ingredients.indexOf(ing) === 0
            ? dlcProche
            : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        console.log(
          `✓ Produit mock créé: ${mockProduct.name} avec ingrédient ${ing.name}`,
        );
        return stock;
      });

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
  name: 'test:makeable',
  description: 'Test 100% makeable recipes',
})
export class TestMakeableCommand extends CommandRunner {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly usersService: UsersService,
    private readonly stockService: StockService,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('--- Test recettes 100% réalisables avec utilisateur réel ---');

    try {
      // 1. Récupérer l'utilisateur de test
      console.log('🔍 Récupération utilisateur de test...');

      let testUser: any;
      try {
        testUser = await this.usersService.findOneByEmail(
          'test.mobile@goofeat.com',
        );
        console.log(`✅ Utilisateur: ${testUser.email}`);
      } catch {
        console.log('❌ Utilisateur de test non trouvé !');
        console.log("💡 Exécutez d'abord: yarn setup:test-user");
        return;
      }

      // 2. Récupérer le stock avec relations (récupérer tous les articles)
      const stockData = await this.stockService.findAll(testUser, {
        limit: 100,
      });
      const userStocks = stockData.data || [];

      if (userStocks.length === 0) {
        console.log('❌ Aucun stock disponible !');
        console.log("💡 Exécutez d'abord: yarn setup:test-user");
        return;
      }

      console.log(`📦 Stock: ${userStocks.length} articles`);

      // 3. Test avec findMakeableRecipes - uniquement les recettes 100% faisables
      console.log(
        '--- Test findMakeableRecipes (recettes 100% réalisables) ---',
      );
      const userPreferences = testUser.preferences || {
        allergenes: [],
        preferredCategories: [],
        dietaryRestrictions: [],
      };

      const makeableResults =
        await this.elasticsearchService.findMakeableRecipes(
          userPreferences,
          userStocks,
        );

      console.log(`\n--- Résultats ---`);
      if (makeableResults.results.length > 0) {
        console.log(
          `Total: ${makeableResults.total} recettes 100% réalisables`,
        );
        makeableResults.results.slice(0, 5).forEach((recipe: any) => {
          console.log(
            `✅ ${recipe.name} (Score: ${recipe.score.toFixed(2)}) - Ingrédients: ${recipe.ingredients.map((i: any) => i.name).join(', ')}`,
          );
        });
      } else {
        console.log('❌ Aucune recette 100% réalisable avec ce stock.');
        console.log(
          '💡 Essayez yarn cli test:discover pour voir les recommandations partielles',
        );
      }
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
    }

    console.log('\n--- Test makeable terminé ---');
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
    private readonly usersService: UsersService,
    private readonly stockService: StockService,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('--- Test de découverte avec utilisateur réel ---');

    try {
      // 1. Récupérer l'utilisateur de test avec son stock réel
      console.log("🔍 Récupération de l'utilisateur de test...");

      let testUser: any;
      try {
        testUser = await this.usersService.findOneByEmail(
          'test.mobile@goofeat.com',
        );
        console.log(
          `✅ Utilisateur trouvé: ${testUser.email} (ID: ${testUser.id})`,
        );
      } catch {
        console.log('❌ Utilisateur de test non trouvé !');
        console.log("💡 Exécutez d'abord: yarn setup:test-user");
        return;
      }

      // 2. Récupérer le stock de l'utilisateur avec ses relations
      const stockData = await this.stockService.findAll(testUser, {
        limit: 100,
      });
      const userStocks = stockData.data || [];
      console.log(`📦 Stock disponible: ${userStocks.length} articles`);

      if (userStocks.length === 0) {
        console.log('❌ Aucun stock disponible !');
        console.log("💡 Exécutez d'abord: yarn setup:test-user");
        return;
      }

      // Afficher tout le stock pour debug avec ingrédients
      userStocks.forEach((stock: any, index) => {
        const productName = stock.product?.name || 'Produit inconnu';
        const ingredients =
          stock.product?.ingredients?.map((ing: any) => ing.name).join(', ') ||
          'Aucun ingrédient lié';
        console.log(
          `   ${index + 1}. ${productName}: ${stock.quantity} ${stock.unit} → [${ingredients}]`,
        );
      });

      // 3. Définir les préférences utilisateur
      const userPreferences: UserPreferences = testUser.preferences || {
        allergenes: ['Gluten'],
        preferredCategories: ['Plat principal', 'Rapide'],
        dietaryRestrictions: [],
      };
      console.log('Préférences utilisateur:', userPreferences);

      // 4. Test découverte intelligente avec le stock réel
      console.log(
        '--- Test avec discoverRecipes (recommandations flexibles) ---',
      );
      const searchResults = await this.elasticsearchService.discoverRecipes(
        userPreferences,
        userStocks,
      );

      console.log(`\n--- Résultats de discoverRecipes ---`);
      if (searchResults.results.length > 0) {
        console.log(`Total de recettes trouvées: ${searchResults.total}`);
        searchResults.results.slice(0, 5).forEach((recipe) => {
          console.log(
            `- ${recipe.name} (Score: ${recipe.score.toFixed(2)}) - Ingrédients: ${recipe.ingredients.map((i) => i.name).join(', ')}`,
          );
        });
      } else {
        console.log('Aucune recette suggérée.');
      }

      // 4. Maintenant testons avec findMakeableRecipes (recettes complètement faisables)
      console.log(
        '\n--- Test avec findMakeableRecipes (recettes complètement réalisables) ---',
      );
      const makeableResults =
        await this.elasticsearchService.findMakeableRecipes(
          userPreferences,
          userStocks,
        );

      // 5. Afficher les résultats des recettes complètement réalisables
      console.log(`\n--- Résultats de findMakeableRecipes ---`);
      if (makeableResults.results.length > 0) {
        console.log(
          `Total de recettes complètement réalisables: ${makeableResults.total}`,
        );
        makeableResults.results.slice(0, 5).forEach((recipe: any) => {
          console.log(
            `- ${recipe.name} (Score: ${recipe.score.toFixed(2)}) - Ingrédients: ${recipe.ingredients.map((i: any) => i.name).join(', ')}`,
          );
        });
      } else {
        console.log('Aucune recette complètement réalisable avec ce stock.');
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

// Configuration pour l'utilisateur de test mobile
const TEST_USER_CONFIG = {
  email: 'test.mobile@goofeat.com',
  password: 'TestMobile123!',
  name: 'Test Mobile',

  // Produits réalistes à créer
  PRODUCTS: [
    {
      name: 'Blanc de poulet',
      defaultUnit: Unit.KG,
      unitSize: 1000,
      defaultDlcTime: '3 days',
      stockQuantity: 1.5,
      offTag: 'en:chicken',
      needsDlc: true,
    },
    {
      name: 'Bœuf haché',
      defaultUnit: Unit.KG,
      unitSize: 1000,
      defaultDlcTime: '2 days',
      stockQuantity: 1,
      offTag: 'en:beef',
      needsDlc: true,
    },
    {
      name: 'Riz basmati',
      defaultUnit: Unit.KG,
      unitSize: 1000,
      defaultDlcTime: '365 days',
      stockQuantity: 2,
      offTag: 'en:rice',
      needsDlc: false,
    },
    {
      name: 'Pâtes penne',
      defaultUnit: Unit.G,
      unitSize: 500,
      defaultDlcTime: '730 days',
      stockQuantity: 1000,
      offTag: 'en:pasta',
      needsDlc: false,
    },
    {
      name: 'Tomates fraîches',
      defaultUnit: Unit.KG,
      unitSize: 1000,
      defaultDlcTime: '7 days',
      stockQuantity: 1.5,
      offTag: 'en:tomato',
      needsDlc: true,
    },
    {
      name: 'Oignons',
      defaultUnit: Unit.PIECE,
      unitSize: 150,
      defaultDlcTime: '30 days',
      stockQuantity: 5,
      offTag: 'en:onion',
      needsDlc: false,
    },
    {
      name: 'Ail',
      defaultUnit: Unit.PIECE,
      unitSize: 5,
      defaultDlcTime: '21 days',
      stockQuantity: 3,
      offTag: 'en:garlic',
      needsDlc: false,
    },
    {
      name: 'Fromage râpé',
      defaultUnit: Unit.G,
      unitSize: 200,
      defaultDlcTime: '30 days',
      stockQuantity: 250,
      offTag: 'en:cheese',
      needsDlc: true,
    },
    {
      name: 'Œufs',
      defaultUnit: Unit.PIECE,
      unitSize: 60,
      defaultDlcTime: '21 days',
      stockQuantity: 12,
      offTag: 'en:egg',
      needsDlc: true,
    },
    {
      name: "Huile d'olive",
      defaultUnit: Unit.ML,
      unitSize: 500,
      defaultDlcTime: '730 days',
      stockQuantity: 500,
      offTag: 'en:olive-oil',
      needsDlc: false,
    },
    // Ingrédients stratégiques basés sur l'analyse Elasticsearch (top ingredients des recettes)
    {
      name: 'Sel',
      defaultUnit: Unit.G,
      unitSize: 1000,
      defaultDlcTime: '3650 days',
      stockQuantity: 500,
      offTag: 'en:salt',
      needsDlc: false,
    },
    {
      name: 'Poivre',
      defaultUnit: Unit.G,
      unitSize: 50,
      defaultDlcTime: '730 days',
      stockQuantity: 25,
      offTag: 'en:pepper',
      needsDlc: false,
    },
    {
      name: 'Tomate',
      defaultUnit: Unit.KG,
      unitSize: 1000,
      defaultDlcTime: '7 days',
      stockQuantity: 1,
      offTag: 'en:tomato',
      needsDlc: true,
    },
    {
      name: 'Poivron',
      defaultUnit: Unit.PIECE,
      unitSize: 200,
      defaultDlcTime: '10 days',
      stockQuantity: 3,
      offTag: 'en:bell-pepper',
      needsDlc: true,
    },
    {
      name: 'Persil',
      defaultUnit: Unit.G,
      unitSize: 30,
      defaultDlcTime: '7 days',
      stockQuantity: 15,
      offTag: 'en:parsley',
      needsDlc: true,
    },
    {
      name: 'Carotte',
      defaultUnit: Unit.KG,
      unitSize: 1000,
      defaultDlcTime: '21 days',
      stockQuantity: 0.5,
      offTag: 'en:carrot',
      needsDlc: true,
    },
    {
      name: 'Basilic',
      defaultUnit: Unit.G,
      unitSize: 30,
      defaultDlcTime: '5 days',
      stockQuantity: 15,
      offTag: 'en:basil',
      needsDlc: true,
    },
    {
      name: 'Jus de citron',
      defaultUnit: Unit.ML,
      unitSize: 200,
      defaultDlcTime: '30 days',
      stockQuantity: 100,
      offTag: 'en:lemon-juice',
      needsDlc: true,
    },
    {
      name: 'Saumon',
      defaultUnit: Unit.G,
      unitSize: 200,
      defaultDlcTime: '3 days',
      stockQuantity: 400,
      offTag: 'en:salmon',
      needsDlc: true,
    },
    {
      name: 'Paprika',
      defaultUnit: Unit.G,
      unitSize: 50,
      defaultDlcTime: '730 days',
      stockQuantity: 25,
      offTag: 'en:paprika',
      needsDlc: false,
    },
    {
      name: 'Thym',
      defaultUnit: Unit.G,
      unitSize: 15,
      defaultDlcTime: '730 days',
      stockQuantity: 8,
      offTag: 'en:thyme',
      needsDlc: false,
    },
    {
      name: 'Oignon vert',
      defaultUnit: Unit.PIECE,
      unitSize: 20,
      defaultDlcTime: '7 days',
      stockQuantity: 6,
      offTag: 'en:green-onion',
      needsDlc: true,
    },
    {
      name: 'Haricot',
      defaultUnit: Unit.G,
      unitSize: 400,
      defaultDlcTime: '365 days',
      stockQuantity: 400,
      offTag: 'en:bean',
      needsDlc: false,
    },
    {
      name: 'Fromage Romano',
      defaultUnit: Unit.G,
      unitSize: 200,
      defaultDlcTime: '30 days',
      stockQuantity: 100,
      offTag: 'en:romano-cheese',
      needsDlc: true,
    },
  ],
};

@Injectable()
@Command({
  name: 'setup:test-user',
  description:
    'Créer un utilisateur de test avec un stock réaliste pour les tests mobiles',
  options: { isDefault: false },
})
export class SetupTestUserCommand extends CommandRunner {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly ingredientsService: IngredientsService,
    private readonly productService: ProductService,
    private readonly stockService: StockService,
    private readonly householdService: HouseholdService,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly ingredientMatcher: IngredientMatcherHelper,
  ) {
    super();
  }

  @Option({
    flags: '-c, --clear',
    description: 'Supprimer les anciens stocks avant de créer les nouveaux',
  })
  parseClear(): boolean {
    return true;
  }

  async run(
    passedParams: string[],
    options?: Record<string, any>,
  ): Promise<void> {
    const shouldClear = options?.clear || false;

    console.log('🚀 Création utilisateur de test pour les tests mobiles...');
    if (shouldClear) {
      console.log('🔄 Mode clear activé: les anciens stocks seront supprimés');
    }

    try {
      // 1. Créer ou récupérer l'utilisateur de test
      console.log('🔐 Gestion utilisateur de test...');

      let testUser: any;
      try {
        testUser = await this.usersService.findOneByEmail(
          TEST_USER_CONFIG.email,
        );
        console.log(`✅ Utilisateur existant: ${testUser.email}`);
      } catch {
        console.log('📝 Création nouvel utilisateur...');
        const [firstName, lastName] = TEST_USER_CONFIG.name.split(' ');
        testUser = await this.authService.register(
          TEST_USER_CONFIG.email,
          TEST_USER_CONFIG.password,
          firstName || 'Test',
          lastName || 'Mobile',
        );
        console.log(`✅ Utilisateur créé: ${testUser.email}`);
      }

      // 2. Récupérer les ingrédients disponibles
      console.log('📋 Récupération ingrédients...');
      const allIngredients = await this.ingredientsService.searchIngredients(
        '',
        1000,
      );
      const ingredientMap = new Map();

      for (const ingredient of allIngredients) {
        if (ingredient.parentOffTags) {
          for (const tag of ingredient.parentOffTags) {
            if (!ingredientMap.has(tag)) {
              ingredientMap.set(tag, ingredient);
            }
          }
        }
      }

      console.log(`✅ ${ingredientMap.size} ingrédients disponibles`);

      // 3. Créer un foyer pour l'utilisateur test
      console.log('🏠 Création du foyer de test...');
      let household: any;
      try {
        const existingHouseholds =
          await this.householdService.findAll(testUser);
        if (existingHouseholds.length > 0) {
          household = existingHouseholds[0];
          console.log(`✅ Foyer existant utilisé: ${household.name}`);
        } else {
          const createHouseholdDto: CreateHouseholdDto = {
            name: 'Foyer de test mobile',
            type: HouseholdType.SINGLE,
            description: 'Foyer créé automatiquement pour les tests',
          };
          household = await this.householdService.create(
            createHouseholdDto,
            testUser,
          );
          console.log(`✅ Nouveau foyer créé: ${household.name}`);
        }
      } catch (error) {
        console.error(`❌ Erreur création foyer: ${error.message}`);
        process.exit(1);
      }

      // 4. Créer les produits avec matching intelligent des ingrédients
      console.log('🔗 Matching intelligent des ingrédients...');

      const createdProducts: Array<{ product: Product; config: any }> = [];

      for (const productConfig of TEST_USER_CONFIG.PRODUCTS) {
        try {
          // Utiliser directement le nom du produit pour trouver l'ingrédient correspondant
          let finalIngredientIds: string[] | undefined;

          // Utiliser le helper centralisé pour une recherche intelligente
          const matchResult = await this.ingredientMatcher.findBestMatch(
            productConfig.name,
          );

          if (matchResult.ingredient && matchResult.confidence !== 'none') {
            console.log(
              `🎯 ${productConfig.name}: Match trouvé ${matchResult.ingredient.name} (score: ${matchResult.score?.toFixed(3)}, confidence: ${matchResult.confidence})`,
            );
            finalIngredientIds = [matchResult.ingredient.id];
          } else {
            console.log(
              `⚠️  ${productConfig.name}: Aucune correspondance suffisamment fiable, utilisation de l'offTag`,
            );
            // Fallback : créer un nouveau produit avec mapping d'ingrédient OpenFoodFacts
            const ingredient = ingredientMap.get(productConfig.offTag);
            finalIngredientIds = ingredient ? [ingredient.id] : [];
          }

          // Dernier fallback si aucun ingrédient trouvé
          if (!finalIngredientIds || finalIngredientIds.length === 0) {
            const ingredient = ingredientMap.get(productConfig.offTag);
            finalIngredientIds = ingredient ? [ingredient.id] : [];

            if (finalIngredientIds.length === 0) {
              const similarIngredients = allIngredients.filter(
                (ing) =>
                  ing.name
                    .toLowerCase()
                    .includes(productConfig.name.toLowerCase().split(' ')[0]) ||
                  productConfig.name
                    .toLowerCase()
                    .includes(ing.name.toLowerCase()),
              );
              if (similarIngredients.length > 0) {
                finalIngredientIds = [similarIngredients[0].id];
                console.log(
                  `🔧 ${productConfig.name}: nouveau produit + mapping ${similarIngredients[0].name}`,
                );
              } else {
                console.log(
                  `⚠️  ${productConfig.name}: nouveau produit sans ingrédient`,
                );
              }
            } else {
              console.log(
                `✅ ${productConfig.name}: nouveau produit lié à ${ingredient.name}`,
              );
            }
          }

          const createProductDto: CreateProductDto = {
            name: productConfig.name,
            defaultUnit: productConfig.defaultUnit,
            unitSize: productConfig.unitSize,
            defaultDlcTime: productConfig.defaultDlcTime,
            ingredients:
              finalIngredientIds.length > 0 ? finalIngredientIds : undefined,
          };

          const product = await this.productService.create(
            createProductDto,
            testUser,
          );
          const productWithIngredients = await this.productService.findOne(
            product.id,
          );
          createdProducts.push({
            product: productWithIngredients,
            config: productConfig,
          });
        } catch (error) {
          console.log(`❌ Échec ${productConfig.name}: ${error.message}`);
        }
      }

      // 5. Nettoyer l'ancien stock si demandé
      if (shouldClear) {
        console.log("🗑️  Suppression de l'ancien stock...");
        try {
          const existingStocks = await this.stockService.findAll(testUser, {
            limit: 1000,
          });
          for (const stock of existingStocks.data || []) {
            await this.stockService.remove(stock.id, testUser);
          }
          console.log(
            `✅ ${existingStocks.data?.length || 0} anciens stocks supprimés`,
          );
        } catch (error) {
          console.log(
            `⚠️  Impossible de supprimer l'ancien stock: ${error.message}`,
          );
        }
      }

      // 6. Créer le nouveau stock en bulk
      console.log('📦 Création du nouveau stock...');

      const stockDtos: CreateStockDto[] = createdProducts.map(
        ({ product, config }) => {
          const stockDto: CreateStockDto = {
            productId: product.id,
            quantity: config.stockQuantity,
            unit: config.defaultUnit,
          };

          if (config.needsDlc) {
            const dlcDate = new Date();
            dlcDate.setDate(dlcDate.getDate() + 5); // 5 jours
            stockDto.dlc = dlcDate;
          }

          return stockDto;
        },
      );

      const createdStocks = await this.stockService.createBulk(
        stockDtos,
        testUser,
      );
      console.log(`✅ Stock créé: ${createdStocks.length} articles`);

      // 7. Résumé final
      console.log('\n📊 RÉSUMÉ DU COMPTE TEST:');
      console.log(`📧 Email: ${TEST_USER_CONFIG.email}`);
      console.log(`🔑 Password: ${TEST_USER_CONFIG.password}`);
      console.log(`🆔 User ID: ${testUser.id}`);
      console.log(`🏠 Foyer ID: ${household.id}`);
      console.log(`📦 Produits: ${createdProducts.length}`);
      console.log(`🏪 Articles en stock: ${createdStocks.length}`);

      console.log('\n🎯 Utilisation:');
      console.log('  • Connectez-vous avec ces identifiants sur mobile');
      console.log('  • Testez les endpoints /recipes, /recipes/makeable');
      console.log('  • Utilisez yarn cli test:makeable, test:discover');
    } catch (error) {
      console.error(`❌ Erreur: ${error.message}`);
      process.exit(1);
    }
  }
}

@Injectable()
@Command({
  name: 'test:anti-waste',
  description: 'Test anti-waste mode prioritizing expiring ingredients',
})
export class TestAntiWasteCommand extends CommandRunner {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly usersService: UsersService,
    private readonly stockService: StockService,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log("♻️  Test du mode anti-gaspillage avec l'utilisateur test");

    try {
      // Récupérer l'utilisateur de test
      const testUser = await this.usersService.findOneByEmail(
        TEST_USER_CONFIG.email,
      );
      if (!testUser) {
        console.error(`❌ Utilisateur ${TEST_USER_CONFIG.email} non trouvé`);
        console.log("Exécutez d'abord: yarn setup:test-user");
        return;
      }

      console.log(`👤 Utilisation du compte: ${testUser.email}`);

      // Récupérer le stock utilisateur réel
      const stockData = await this.stockService.findAll(testUser, {
        limit: 100,
      });
      const userStocks = stockData.data || [];

      console.log(`📦 Stock disponible: ${userStocks.length} articles`);

      // Analyser les DLCs
      const now = new Date();
      const expiringItems = userStocks.filter((stock) => {
        if (!stock.dlc) return false;
        const dlcDate =
          typeof stock.dlc === 'string' ? new Date(stock.dlc) : stock.dlc;
        const daysUntilExpiry = Math.ceil(
          (dlcDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysUntilExpiry <= 7;
      });

      console.log(
        `⚠️  Articles expirant dans 7 jours: ${expiringItems.length}`,
      );

      if (expiringItems.length > 0) {
        console.log('\n🚨 Articles à consommer rapidement:');
        expiringItems.forEach((stock) => {
          const productName = stock.product?.name || 'Produit inconnu';
          const dlcDate =
            typeof stock.dlc === 'string' ? new Date(stock.dlc) : stock.dlc;
          const daysLeft = Math.ceil(
            (dlcDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          console.log(`  • ${productName}: expire dans ${daysLeft} jour(s)`);
        });
      }

      // Tester la découverte avec priorité anti-gaspillage
      console.log('\n🔍 Recherche de recettes anti-gaspillage...');

      let userPreferences = {};
      if (testUser.preferences) {
        if (typeof testUser.preferences === 'string') {
          try {
            userPreferences = JSON.parse(testUser.preferences);
          } catch (e) {
            console.log('Erreur parsing préférences, utilisation des défauts');
            userPreferences = {};
          }
        } else {
          userPreferences = testUser.preferences;
        }
      }

      // Debug: regardons les IDs utilisés pour la recherche
      console.log('\n🔧 Debug - IDs des produits dans le stock:');
      userStocks.forEach((stock) => {
        const ingredientNames =
          stock.product?.ingredients?.map((i) => i.name).join(', ') || 'Aucun';
        console.log(
          `  • Product ${stock.product?.name} (ID: ${stock.product?.id}) → Ingrédients: ${ingredientNames}`,
        );
      });

      // Utiliser discoverRecipes avec priorité sur les DLCs courtes
      const results = await this.elasticsearchService.discoverRecipes(
        userPreferences,
        userStocks,
      );

      console.log(
        `\n📊 RÉSULTATS ANTI-GASPILLAGE (${results.results.length} recettes trouvées):`,
      );

      if (results.results.length === 0) {
        console.log('❌ Aucune recette trouvée');
      } else {
        results.results.slice(0, 10).forEach((recipe, index) => {
          console.log(
            `${index + 1}. "${recipe.name}" (Score: ${recipe.score?.toFixed(2) || 'N/A'})`,
          );
          console.log(
            `   Ingrédients: ${recipe.ingredients_count || recipe.ingredients?.length || 'N/A'}`,
          );
        });

        console.log('\n✅ Test anti-gaspillage terminé!');
        console.log(
          '💡 Les recettes avec les scores les plus élevés devraient prioriser',
        );
        console.log("   les ingrédients proches de leur date d'expiration.");
      }
    } catch (error) {
      console.error(`❌ Erreur lors du test: ${error.message}`);
      console.error(error.stack);
    }
  }
}
