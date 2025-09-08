#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { Unit } from '../common/units/unit.enums';
import { IngredientsService } from '../ingredients/ingredients.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { Product } from '../products/entities/product.entity';
import { ProductService } from '../products/product.service';
import { RecipeService } from '../recipes/recipe.service';
import { CreateStockDto } from '../stocks/dto/create-stock.dto';
import { StockService } from '../stocks/stock.service';
import { UsersService } from '../users/users.service';

const logger = new Logger('TestRecipeSystemScript');

// Configuration du test
const CONFIG = {
  TEST_USER: {
    email: 'test.recipe@goofeat.com',
    password: 'TestRecipe123!',
    name: 'Recipe Tester',
  },
  PRODUCTS_TO_CREATE: [
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
  ],
};

async function bootstrap() {
  try {
    logger.log('🚀 Démarrage du script de test du système de recettes...');

    const app = await NestFactory.createApplicationContext(AppModule);

    // Récupération des services
    const authService = app.get(AuthService);
    const usersService = app.get(UsersService);
    const ingredientsService = app.get(IngredientsService);
    const productService = app.get(ProductService);
    const stockService = app.get(StockService);
    const recipeService = app.get(RecipeService);

    // Arguments en ligne de commande
    const args = process.argv.slice(2);
    const cleanupOnly = args.includes('--cleanup');
    const skipRecommendations = args.includes('--skip-recommendations');

    // Étape 1: Créer ou récupérer l'utilisateur de test
    logger.log("🔐 Gestion de l'utilisateur de test...");

    let testUser: any;
    try {
      testUser = await usersService.findOneByEmail(CONFIG.TEST_USER.email);
      logger.log(`Utilisateur existant trouvé: ${testUser.email}`);
    } catch {
      logger.log("Création d'un nouvel utilisateur de test...");
      const [firstName, lastName] = CONFIG.TEST_USER.name.split(' ');
      testUser = await authService.register(
        CONFIG.TEST_USER.email,
        CONFIG.TEST_USER.password,
        firstName || 'Test',
        lastName || 'User',
      );
      logger.log(`✅ Nouvel utilisateur créé: ${testUser.email}`);
    }

    // Nettoyage si demandé
    if (cleanupOnly) {
      logger.log('🧹 Nettoyage des données de test...');

      // Supprimer le stock de l'utilisateur
      const userStock = await stockService.findAll(testUser, {});
      for (const stockItem of userStock.data) {
        await stockService.remove(stockItem.id, testUser);
      }

      // Supprimer les produits manuels de l'utilisateur
      const userProducts = await productService.findAll(
        { onlyMyProducts: true },
        testUser,
      );
      for (const product of userProducts) {
        try {
          await productService.remove(product.id, testUser);
        } catch (e) {
          logger.warn(
            `Impossible de supprimer le produit ${product.name}: ${e.message}`,
          );
        }
      }

      logger.log('✅ Nettoyage terminé');
      await app.close();
      return;
    }

    // Étape 2: Récupérer les ingrédients disponibles
    logger.log('📋 Récupération des ingrédients disponibles...');
    const allIngredients = await ingredientsService.searchIngredients('', 1000);
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

    logger.log(`✅ ${ingredientMap.size} tags d'ingrédients disponibles`);

    // Étape 3: Créer les produits de test
    logger.log('🍎 Création des produits de test...');
    const createdProducts: Array<{
      product: Product;
      config: (typeof CONFIG.PRODUCTS_TO_CREATE)[0];
    }> = [];

    for (const productConfig of CONFIG.PRODUCTS_TO_CREATE) {
      try {
        // Trouver l'ingrédient correspondant
        const ingredient = ingredientMap.get(productConfig.offTag);
        const ingredientIds = ingredient ? [ingredient.id] : undefined;

        const createProductDto: CreateProductDto = {
          name: productConfig.name,
          defaultUnit: productConfig.defaultUnit,
          unitSize: productConfig.unitSize,
          defaultDlcTime: productConfig.defaultDlcTime,
          ingredients: ingredientIds,
        };

        // S'assurer que defaultDlcTime est une string valide
        if (typeof createProductDto.defaultDlcTime !== 'string') {
          createProductDto.defaultDlcTime = '7 days';
        }

        const product = await productService.create(createProductDto, testUser);
        createdProducts.push({ product, config: productConfig });

        logger.log(`✅ Produit créé: ${product.name} (${product.id})`);
        if (ingredient) {
          logger.log(
            `   └─ Associé à l'ingrédient: ${ingredient.name} (${productConfig.offTag})`,
          );
        } else {
          logger.warn(
            `   └─ Aucun ingrédient trouvé pour: ${productConfig.offTag}`,
          );
        }
      } catch (error) {
        logger.error(
          `❌ Échec création du produit ${productConfig.name}: ${error.message}`,
        );
      }
    }

    // Étape 4: Ajouter les produits au stock en bulk
    logger.log('📦 Ajout des produits au stock...');

    const stockDtos: CreateStockDto[] = createdProducts.map(
      ({ product, config }) => {
        const stockDto: CreateStockDto = {
          productId: product.id,
          quantity: config.stockQuantity,
          unit: config.defaultUnit,
        };

        // Ajouter DLC pour les produits périssables
        if (config.needsDlc) {
          const dlcDate = new Date();
          dlcDate.setDate(dlcDate.getDate() + 5); // 5 jours dans le futur
          stockDto.dlc = dlcDate;
        }

        return stockDto;
      },
    );

    const createdStocks = await stockService.createBulk(stockDtos, testUser);
    logger.log(`✅ Stock créé: ${createdStocks.length} articles ajoutés`);

    // Afficher le stock créé
    for (const stock of createdStocks) {
      logger.log(
        `   📦 ${stock.product.name}: ${stock.quantity} ${stock.unit}`,
      );
    }

    // Étape 5: Attendre la synchronisation et tester les recommandations
    if (!skipRecommendations) {
      logger.log('🍳 Test des recommandations de recettes...');
      logger.log(
        '⏳ Attente de la synchronisation Elasticsearch (3 secondes)...',
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const recommendations = await recipeService.findAll(
          { limit: 10, page: 1, path: '/api/v1/recipes' },
          testUser,
        );

        if (recommendations.data.length > 0) {
          logger.log(
            `✅ ${recommendations.data.length} recommandations trouvées`,
          );
          logger.log('🏆 Top 5 des recettes recommandées:');

          recommendations.data
            .slice(0, 5)
            .forEach((recipe: any, index: number) => {
              const completeness = recipe.completenessScore || 'N/A';
              logger.log(
                `   ${index + 1}. ${recipe.name} (Complétude: ${completeness}%)`,
              );
            });
        } else {
          logger.warn('❌ Aucune recommandation trouvée');
        }
      } catch (error) {
        logger.error(
          `❌ Erreur lors de la recherche de recommandations: ${error.message}`,
        );
      }
    }

    // Étape 6: Statistiques finales
    logger.log('📊 Statistiques finales...');
    const finalStock = await stockService.findAll(testUser, {});
    logger.log(`   📦 Articles en stock: ${finalStock.data.length}`);
    logger.log(`   👤 Utilisateur de test: ${testUser.email}`);
    logger.log(`   🆔 ID utilisateur: ${testUser.id}`);

    logger.log('🎉 Script terminé avec succès!');
    logger.log('');
    logger.log('💡 Commandes utiles:');
    logger.log(
      `   • Nettoyage: yarn ts-node src/scripts/test-recipe-system.script.ts --cleanup`,
    );
    logger.log(
      `   • Sans recommandations: yarn ts-node src/scripts/test-recipe-system.script.ts --skip-recommendations`,
    );
    logger.log('');
    logger.log('📧 Utilisateur de test créé:');
    logger.log(`   Email: ${CONFIG.TEST_USER.email}`);
    logger.log(`   Mot de passe: ${CONFIG.TEST_USER.password}`);

    await app.close();
  } catch (error) {
    logger.error(`❌ Erreur dans le script: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  logger.warn("🛑 Script interrompu par l'utilisateur");
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.warn('🛑 Script terminé');
  process.exit(0);
});

if (require.main === module) {
  bootstrap();
}

export { bootstrap };
